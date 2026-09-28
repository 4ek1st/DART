const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const CatalogLogic = require('../wwwroot/catalog-logic.js');
const source = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');

function fixture(respond, count = 3) {
  let now = 100000;
  let timerId = 0;
  const timers = new Map();
  const follows = Array.from({ length: count }, (_, index) => ({
    key: `danbooru::artist_${index}`, source: 'danbooru', artistId: `artist_${index}`,
    name: `Artist ${index}`, followedAt: '2024-01-01T00:00:00Z'
  }));
  const tab = { id: 1, kind: 'follows', rating: 'all', items: [] };
  const requests = [];
  const context = vm.createContext({ CatalogLogic, AbortController, URLSearchParams,
    Date: class extends Date { static now() { return now; } },
    setTimeout: (callback, delay) => { timers.set(++timerId, { callback, at: now + delay }); return timerId; },
    clearTimeout: id => timers.delete(id), contentPreferences: {}, follows,
    followedKeys: new Set(), activeId: 1,
    settings: { hasApiKey: true, hasRule34ApiKey: true },
    names: { danbooru: 'Danbooru', gelbooru: 'Gelbooru', rule34: 'Rule34' },
    findTab: id => id === 1 ? tab : null, refreshFollows: async () => true,
    rememberItems() {}, render() {},
    request: async (url, options) => {
      if (url === '/api/follows/seen') return follows;
      if (url.startsWith('/api/follows/cache?')) return { groups: [] };
      const parsed = new URL(url, 'http://fixture');
      const entry = { source: parsed.searchParams.get('sources') || parsed.searchParams.get('source'),
        page: Number(parsed.searchParams.get('page')),
        query: parsed.searchParams.get('q') || parsed.searchParams.get('artist'), at: now };
      requests.push(entry);
      return respond(entry, options);
    }
  });
  const start = source.indexOf('function decorateFollowItems(');
  const end = source.indexOf('\nasync function loadBookmarks(', start);
  vm.runInContext(source.slice(start, end), context);
  // Pacing is exercised with a clock; scheduled background retries remain pending until requested.
  if (context.waitFollowRequest) context.waitFollowRequest = async delay => { now += delay; };
  return { tab, context, requests, timers, advance: milliseconds => { now += milliseconds; },
    load: () => context.loadFollowFeed(tab), more: () => context.loadMoreFollows(tab) };
}
const reply = (entry, hasMore = false) => ({ items: [{
  key: `${entry.source}:${entry.query}:${entry.page}`, source: entry.source,
  title: 'Artwork', creatorTag: entry.query, rating: 'e',
  images: [`https://example.org/${entry.source}/${entry.query}/${entry.page}.jpg`],
  published: '2025-01-01T00:00:00Z'
}], errors: {}, hasMore, hasMoreSources: hasMore ? [entry.source] : [] });

test('a Rule34 outage for many subscriptions keeps one source status and a normal refresh timestamp', async () => {
  const f = fixture(entry => entry.source === 'rule34'
    ? { items: [], errors: { rule34: 'Сайт ограничил частоту запросов (HTTP 429).' }, hasMoreSources: [] }
    : reply(entry), 35);
  await f.load();
  assert.equal(f.tab.items.length, 70);
  assert.deepEqual(Array.from(f.tab.followErrors), []);
  assert.deepEqual(Object.keys(f.tab.followSourceErrors), ['rule34']);
  assert(f.tab.lastLoadedAt > 0);
  assert.equal(f.requests.filter(entry => entry.source === 'rule34').length, 1,
    'Do not send the same failing request for every author during a cooldown');
  assert.equal(f.tab.followStreams.filter(stream => stream.source === 'rule34').length, 35);
  assert.equal(f.timers.size, 1, 'Use one background retry timer');
});

test('a failed Rule34 page does not stop subsequent Danbooru and Gelbooru pages', async () => {
  const f = fixture(entry => entry.source === 'rule34' && entry.page === 1
    ? { items: [], errors: { rule34: 'Источник сейчас недоступен.' }, hasMoreSources: [] }
    : reply(entry, entry.page < 2), 1);
  await f.load();
  await f.more();
  assert.equal(f.tab.followLoadError, false);
  assert.equal(f.tab.hasMore, true);
  await f.more();
  assert(f.requests.some(entry => entry.source === 'danbooru' && entry.page === 2));
  assert(f.requests.some(entry => entry.source === 'gelbooru' && entry.page === 2));
});

test('a temporary Rule34 failure recovers without reloading healthy catalogs', async () => {
  let unavailable = true;
  const f = fixture(entry => entry.source === 'rule34' && unavailable
    ? { items: [], errors: { rule34: 'Источник не ответил вовремя.' }, hasMoreSources: [] }
    : reply(entry), 1);
  await f.load();
  assert.equal(f.tab.items.length, 2);
  const count = f.requests.length;
  unavailable = false;
  f.advance(120000);
  await f.more();
  assert.deepEqual(f.requests.slice(count).map(entry => entry.source), ['rule34']);
  assert.equal(f.tab.items.length, 3);
  assert.deepEqual(Object.keys(f.tab.followSourceErrors), []);
});

test('subscriptions honor the backend Rule34 cooldown instead of retrying early', async () => {
  let unavailable = true;
  const f = fixture(entry => entry.source === 'rule34' && unavailable
    ? { items: [], errors: { rule34: 'Сайт ограничил частоту запросов (HTTP 429).' },
      retryAt: { rule34: 220000 }, hasMoreSources: [] }
    : reply(entry), 1);
  await f.load();
  const count = f.requests.length;
  f.advance(60000);
  await f.more();
  assert.equal(f.requests.length, count);
  unavailable = false;
  f.advance(60001);
  await f.more();
  assert.equal(f.tab.items.length, 3);
});

test('a temporary HTTP 403 does not permanently disable Rule34 subscriptions', async () => {
  const f = fixture(entry => entry.source === 'rule34'
    ? { items: [], errors: { rule34: 'Rule34 временно ограничил доступ (HTTP 403). Повторим позже.' },
      retryAt: { rule34: 115000 }, hasMoreSources: [] }
    : reply(entry), 1);
  await f.load();
  assert.equal(f.tab.followStreams.find(stream => stream.source === 'rule34').retryAt, 115000);
  assert.equal(f.timers.size, 1);
});

test('Rule34 subscription requests run one at a time with a pause between authors', async () => {
  let inFlight = 0;
  let peak = 0;
  const f = fixture(async entry => {
    if (entry.source === 'rule34') {
      peak = Math.max(peak, ++inFlight);
      await new Promise(resolve => setImmediate(resolve));
      inFlight--;
    }
    return reply(entry);
  }, 4);
  await f.load();
  const calls = f.requests.filter(entry => entry.source === 'rule34');
  assert.equal(peak, 1);
  assert.equal(calls.length, 4);
  for (let index = 1; index < calls.length; index++)
    assert(calls[index].at - calls[index - 1].at >= 1000);
});

test('slow Rule34 responses count toward the request interval', async () => {
  let advance;
  const f = fixture(async entry => {
    if (entry.source === 'rule34') advance(1500);
    return reply(entry);
  }, 3);
  advance = f.advance;
  await f.load();
  const times = f.requests.filter(entry => entry.source === 'rule34').map(entry => entry.at);
  assert.deepEqual(times, [100000, 101500, 103000]);
});

test('repeated temporary failures increase the pause and keep one background timer', async () => {
  const f = fixture(entry => entry.source === 'rule34'
    ? { items: [], errors: { rule34: 'Сайт ограничил частоту запросов (HTTP 429).' } }
    : reply(entry), 1);
  await f.load();
  const firstAt = f.tab.followStreams[0].retryAt;
  f.advance(10000);
  await f.more();
  assert.equal(f.tab.followStreams[0].retryAt - firstAt, 20000);
  assert.equal(f.timers.size, 1);
  f.advance(20000);
  await f.more();
  assert.equal(f.tab.followStreams[0].retryAt - firstAt, 60000);
  assert.equal(f.timers.size, 1);
});

test('a rejected API key waits for settings or a manual refresh instead of retrying forever', async () => {
  let invalidKey = true;
  const f = fixture(entry => entry.source === 'rule34' && invalidKey
    ? { items: [], errors: { rule34: 'Rule34 отклонил ключ API. Проверьте данные в настройках.' } }
    : reply(entry), 1);
  await f.load();
  assert.equal(f.tab.followStreams[0].retryAt, Infinity);
  assert.equal(f.timers.size, 0);
  f.advance(120000);
  await f.more();
  assert.equal(f.requests.filter(entry => entry.source === 'rule34').length, 1);
  invalidKey = false;
  await f.load();
  assert.equal(f.tab.items.length, 3);
  assert.deepEqual(Object.keys(f.tab.followSourceErrors), []);
});

test('a background retry does not fetch for an inactive tab and resumes on activation', async () => {
  const f = fixture(entry => entry.source === 'rule34'
    ? { items: [], errors: { rule34: 'Источник не ответил вовремя.' } }
    : reply(entry), 1);
  await f.load();
  const timer = [...f.timers.values()][0];
  const count = f.requests.length;
  f.context.activeId = 2;
  f.advance(10000);
  timer.callback();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.requests.length, count);
  f.context.activeId = 1;
  f.context.scheduleFollowRetry(f.tab);
  const resumedTimer = [...f.timers.values()].at(-1);
  resumedTimer.callback();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.requests.length, count + 1);
});

test('cancelling a subscription request does not create a Rule34 outage', async () => {
  const f = fixture((entry, { signal }) => entry.source === 'rule34'
    ? new Promise((resolve, reject) => signal.addEventListener('abort', () =>
      reject(Object.assign(new Error('Cancelled'), { name: 'AbortError' })), { once: true }))
    : reply(entry), 1);
  const loading = f.load();
  await new Promise(resolve => setImmediate(resolve));
  f.tab.followController.abort();
  await loading;
  assert.equal(f.context.requestFollowSource.rule34.failures, 0);
  assert.equal(f.timers.size, 0);
  assert.deepEqual(Object.keys(f.tab.followSourceErrors), []);
});

test('a slow Rule34 response does not delay ready works from the other subscriptions', async () => {
  let finish;
  const slow = new Promise(resolve => { finish = resolve; });
  const f = fixture(entry => entry.source === 'rule34' ? slow : reply(entry));
  const loading = f.load();
  await new Promise(resolve => setImmediate(resolve));
  try {
    assert.equal(f.tab.items.length, 6);
    assert.equal(f.requests.filter(entry => entry.source === 'rule34').length, 1);
  } finally {
    finish({ items: [], errors: { rule34: 'Источник сейчас недоступен.' }, hasMoreSources: [] });
    await loading;
  }
});

test('an unsuccessful refresh preserves previously loaded Rule34 artworks', async () => {
  let unavailable = false;
  const f = fixture(entry => entry.source === 'rule34' && unavailable
    ? { items: [], errors: { rule34: 'Источник сейчас недоступен.' }, hasMoreSources: [] }
    : reply(entry), 1);
  await f.load();
  const rule34Key = f.tab.items.find(item => item.source === 'rule34').key;
  unavailable = true;
  await f.load();
  assert(f.tab.items.some(item => item.key === rule34Key));
});

test('subscription source failures use one small status icon and do not fill the page with authors', () => {
  const start = source.indexOf('function renderFollowArtist(');
  const end = source.indexOf('\nfunction renderProfile(', start);
  const helperStart = source.indexOf('function followSourceNeedsSettings(');
  const helperEnd = source.indexOf('\nasync function requestFollowSource(', helperStart);
  const render = vm.runInNewContext(source.slice(helperStart, helperEnd) +
    source.slice(start, end) + '\nrenderFollows', {
    follows: [{ key: 'danbooru::artist', source: 'danbooru', artistId: 'artist', name: 'Artist' }],
    settings: { hasApiKey: true }, names: { rule34: 'Rule34' },
    escapeHtml: value => String(value), renderGrid: () => '<grid>', skeletons: () => '<skeletons>'
  });
  const html = render({ id: 1, rating: 'all', items: [{}], loading: false,
    followSourceErrors: { rule34: 'Источник сейчас недоступен.' },
    followErrors: [], newKeys: new Set() });
  assert.match(html, /follow-source-status/);
  assert.match(html, /title="[^"\n]*Rule34/);
  assert.doesNotMatch(html, /error-box|Не удалось обновить Rule34/);
});

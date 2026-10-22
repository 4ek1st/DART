const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const logic = require('../wwwroot/catalog-logic.js');
const app = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
const loader = app.slice(app.indexOf('function createRecommendationPools('),
  app.indexOf('\nfunction decorateFollowItems('));
const scheduler = app.slice(app.indexOf('function scheduleRule34Recovery('),
  app.indexOf('\nfunction curationContext('));
const work = (key, source = 'danbooru') => ({ key, source, rating: 'e', tags: ['latex'] });

function fixture(sources, respond) {
  let now = 10000, timerId = 0;
  const timers = new Map(), requests = [];
  const tab = { id: 11, kind: 'recommendations', rating: 'explicit', selectedSources: sources,
    items: [], errors: {}, loading: false };
  class FixtureDate extends Date { static now() { return now; } }
  const context = { CatalogLogic: logic, likes: Array.from({ length: 10 }, (_, i) => work(`liked:${i}`)),
    bookmarks: [], recommendationTagPreferences: {}, recommendationVisitCount: 0,
    localStorage: { setItem() {} }, contentPreferences: { aiMode: 'all' },
    findTab: id => id === tab.id ? tab : undefined, activeId: tab.id, Date: FixtureDate,
    AbortController, URLSearchParams, rememberItems() {}, render() {},
    setTimeout(callback, delay) { const id = ++timerId; timers.set(id, { callback, at: now + delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    request: async (url, options) => {
      const query = new URL(url, 'http://fixture').searchParams;
      const call = { q: query.get('q'), page: Number(query.get('page')),
        sources: query.get('sources').split(','), signal: options.signal };
      requests.push(call);
      return respond(call, requests.length);
    }
  };
  const api = vm.runInNewContext(scheduler + '\n' + loader + '\n({ loadRecommendations, ' +
    'scheduleRule34Recovery, retry: typeof retryRecommendationSources === "function" ? retryRecommendationSources : null })', context);
  return { tab, requests, timers, context, ...api,
    async advance(milliseconds) {
      now += milliseconds;
      const due = [...timers.entries()].filter(([, timer]) => timer.at <= now);
      for (const [id, timer] of due) { timers.delete(id); await timer.callback(); }
    },
    streams() { return Object.values(tab.recommendationPools || {}).flat().flatMap(group => group.streams); }
  };
}

const flushAsyncWork = () => new Promise(resolve => setImmediate(resolve));

for (const source of ['danbooru', 'gelbooru', 'sankaku']) {
  test(`a temporary ${source} error retries the exact page automatically without Refresh`, async () => {
    const f = fixture([source], (_, count) => count === 1
      ? { items: [], errors: { [source]: 'HTTP 503 temporarily unavailable' }, hasMoreSources: [] }
      : { items: [work(`${source}:new`, source)], errors: {}, hasMoreSources: [] });
    await f.loadRecommendations(f.tab);
    assert.equal(f.tab.hasMore, true, 'a failed source is not exhausted');
    assert.equal(f.tab.loading, false);
    assert.equal(f.timers.size, 1, 'the UI scheduler reawakens the failed stream');
    await f.advance(14999);
    assert.equal(f.requests.length, 1, 'no immediate retry loop');
    await f.advance(1);
    assert.equal(f.requests.length, 2);
    assert.equal(f.requests[1].page, 0);
    assert.deepEqual(f.requests[1].sources, [source]);
    assert.equal(f.tab.items[0].key, `${source}:new`);
    assert.equal(f.tab.hasMore, false);
    assert.equal(f.tab.errors[source], undefined);
    assert.equal(f.timers.size, 0);
  });
}

test('a partial failure preserves successful source advancement and the visible card prefix', async () => {
  const f = fixture(['danbooru', 'gelbooru'], (call, count) => count === 1
    ? { items: [work('danbooru:visible')], errors: { gelbooru: 'HTTP 503' }, hasMoreSources: ['danbooru'] }
    : { items: call.sources.map(source => work(`${source}:${call.page}`, source)), errors: {}, hasMoreSources: [] });
  await f.loadRecommendations(f.tab);
  assert.ok(f.streams().some(stream => stream.sources.includes('gelbooru') && stream.nextPage === 0));
  assert.ok(f.streams().some(stream => stream.sources.includes('danbooru') && stream.nextPage === 1));
  const prefix = f.tab.items.map(item => item.key);
  await f.advance(15000);
  assert.ok(f.requests.some(call => call.page === 0 && call.sources.length === 1 && call.sources[0] === 'gelbooru'));
  assert.ok(f.requests.some(call => call.page === 1 && call.sources.length === 1 && call.sources[0] === 'danbooru'));
  assert.deepEqual(f.tab.items.slice(0, prefix.length).map(item => item.key), prefix);
});

test('repeated outages use backoff and stop automatic requests until explicit retry', async () => {
  const f = fixture(['danbooru'], () => ({ items: [], errors: { danbooru: 'HTTP 503' }, hasMoreSources: [] }));
  await f.loadRecommendations(f.tab);
  await f.advance(15000);
  assert.equal(f.requests.length, 2);
  await f.advance(29999);
  assert.equal(f.requests.length, 2);
  await f.advance(1);
  assert.equal(f.requests.length, 3);
  await f.advance(60000);
  assert.equal(f.requests.length, 4);
  assert.equal(f.timers.size, 0, 'the visit does not retry a broken source forever');
  assert.equal(f.tab.hasMore, true);
  assert.equal(f.tab.recommendationPaused, true);
  assert.equal(typeof f.retry, 'function');
  await f.retry(f.tab);
  assert.equal(f.requests.length, 5, 'manual Retry resumes without discarding the visit');
  assert.equal(f.requests[4].page, 0);
});

test('one failed source cools all its tag queries while healthy sources remain available', async () => {
  const f = fixture(['danbooru', 'gelbooru'], call => ({
    items: call.sources.includes('danbooru') ? [work(`danbooru:${call.q}:${call.page}`)] : [],
    errors: call.sources.includes('gelbooru') ? { gelbooru: 'HTTP 503' } : {},
    hasMoreSources: call.sources.filter(source => source === 'danbooru') }));
  f.context.likes = Array.from({ length: 10 }, (_, i) => ({ ...work(`liked:${i}`),
    tags: ['latex', 'bodysuit', 'ribbon', 'scenery', 'jacket', 'braid'] }));
  await f.loadRecommendations(f.tab);
  const initial = f.requests.length;
  for (let index = 0; index < 3; index++) await f.loadRecommendations(f.tab, true);
  assert.ok(f.requests.length > initial, 'healthy queries can still advance');
  assert.equal(f.requests.slice(initial).some(call => call.sources.includes('gelbooru')), false,
    'changing tag queries must not bypass the source cooldown');
});

test('an unavailable source with many interests cannot rotate queries in a busy loop', async () => {
  const f = fixture(['danbooru'], () => ({ items: [], errors: { danbooru: 'HTTP 503' }, hasMoreSources: [] }));
  f.context.likes = Array.from({ length: 10 }, (_, i) => ({ ...work(`liked:${i}`),
    tags: ['latex', 'bodysuit', 'ribbon', 'scenery', 'jacket', 'braid'] }));
  await f.loadRecommendations(f.tab);
  const initial = f.requests.length;
  for (let index = 0; index < 8; index++) await f.loadRecommendations(f.tab, true);
  assert.equal(f.requests.length, initial);
  assert.equal(f.tab.recommendationPaused, true);
  assert.equal(f.timers.size, 1);
  f.context.likes = [...f.context.likes, ...Array.from({ length: 10 }, (_, i) => ({
    ...work(`newly-liked:${i}`), tags: ['kimono'] }))];
  f.tab.recommendationProfileDirty = true;
  await f.loadRecommendations(f.tab, true);
  assert.equal(f.requests.length, initial, 'a new interest must retain the existing source cooldown');
});

test('a rejected query does not pause every other interest on the same source', async () => {
  let rejected;
  const f = fixture(['danbooru'], call => {
    rejected ||= call.q;
    return call.q === rejected
      ? { items: [], errors: { danbooru: 'Источник вернул ошибку HTTP 422.' }, hasMoreSources: [] }
      : { items: [work(`danbooru:${call.q}`)], errors: {}, hasMoreSources: [] };
  });
  f.context.likes = Array.from({ length: 10 }, (_, i) => ({ ...work(`liked:${i}`),
    tags: ['latex', 'bodysuit', 'ribbon', 'scenery', 'jacket', 'braid'] }));
  await f.loadRecommendations(f.tab);
  const initial = f.requests.length;
  await f.loadRecommendations(f.tab, true);
  assert.ok(f.requests.length > initial, 'other queries still load');
  assert.equal(f.requests.slice(initial).some(call => call.q === rejected), false,
    'a successful different query does not clear this query\'s cooldown');
});

test('authorization failures wait for settings or an explicit user retry', async () => {
  for (const [source, message] of [['gelbooru', 'Укажите user ID и API key Gelbooru в настройках.'],
    ['sankaku', 'Авторизуйтесь в Sankaku.'], ['danbooru', 'HTTP 401 Unauthorized']]) {
    const f = fixture([source], (_, count) => count === 1
      ? { items: [], errors: { [source]: message }, hasMoreSources: [] }
      : { items: [work(`${source}:new`, source)], errors: {}, hasMoreSources: [] });
    await f.loadRecommendations(f.tab);
    assert.equal(f.tab.hasMore, true);
    assert.equal(f.timers.size, 0, 'credentials are not retried on a timer');
    await f.advance(120000);
    assert.equal(f.requests.length, 1);
    assert.equal(typeof f.retry, 'function');
    await f.retry(f.tab);
    assert.equal(f.requests.length, 2);
    assert.equal(f.requests[1].page, 0);
  }
});

test('notices alone do not schedule a source retry', async () => {
  const f = fixture(['sankaku'], () => ({ items: [work('sankaku:public', 'sankaku')],
    notices: { sankaku: 'Some posts require authorization' }, errors: {}, hasMoreSources: [] }));
  await f.loadRecommendations(f.tab);
  assert.equal(f.requests.length, 1);
  assert.equal(f.tab.hasMore, false);
  assert.equal(f.timers.size, 0);
});

test('settings and Sankaku login success rearm blocked streams without resetting the feed', async () => {
  for (const [source, formId] of [['gelbooru', 'settings-form'], ['sankaku', 'sankaku-login-form']]) {
    const f = fixture([source], (_, count) => count === 1
      ? { items: [], errors: { [source]: source === 'sankaku' ? 'Авторизуйтесь' : 'API key required' }, hasMoreSources: [] }
      : { items: [work(`${source}:new`, source)], errors: {}, hasMoreSources: [] });
    await f.loadRecommendations(f.tab);
    let submit;
    const submitSource = app.slice(app.indexOf("main.addEventListener('submit',"),
      app.indexOf("main.addEventListener('mousedown',", app.indexOf("main.addEventListener('submit',")));
    vm.runInNewContext(submitSource, {
      main: { addEventListener(_, handler) { submit = handler; } }, tabs: [f.tab],
      retryRecommendationSources: f.retry, settings: {}, sankakuSigningIn: false, sankakuLoginError: '',
      FormData: class { get() { return 'fixture'; } }, request: async () => ({}),
      render() {}, toast() {}, loadDetail() {}
    });
    await submit({ preventDefault() {}, target: { id: formId,
      classList: { contains: () => false }, querySelector: () => ({ value: '' }) } });
    assert.equal(f.requests.length, 1, 'saving credentials does not reset or immediately fetch the feed');
    assert.equal(f.timers.size, 1, 'returning to the tab has a recovery to resume');
    await f.advance(500);
    assert.equal(f.requests.length, 2);
    assert.equal(f.requests[1].page, 0);
    assert.equal(f.tab.items[0].key, `${source}:new`);
  }
});

test('saving changed credentials cancels an older in-flight retry before resuming', async () => {
  let complete;
  const f = fixture(['gelbooru'], (_, count) => count === 1
    ? { items: [], errors: { gelbooru: 'API key required' }, hasMoreSources: [] }
    : count === 2 ? new Promise(resolve => { complete = resolve; })
    : { items: [work('gelbooru:new', 'gelbooru')], errors: {}, hasMoreSources: [] });
  await f.loadRecommendations(f.tab);
  const pending = f.retry(f.tab);
  f.retry(f.tab, ['gelbooru'], false);
  const aborted = f.requests[1].signal.aborted;
  complete({ items: [], errors: { gelbooru: 'Old API key is invalid' }, hasMoreSources: [] });
  await pending;
  assert.equal(aborted, true);
  assert.equal(f.tab.loading, false);
  await f.advance(500);
  assert.equal(f.requests.length, 3);
  assert.equal(f.tab.items[0].key, 'gelbooru:new');
});

test('saving unrelated credentials leaves a Danbooru batch waiting for its background sample intact', async () => {
  let finishBackground;
  const f = fixture(['danbooru'], call => call.q === ''
    ? new Promise(resolve => { finishBackground = resolve; })
    : { items: [work(`danbooru:page${call.page}`)], errors: {}, hasMoreSources: ['danbooru'] });
  f.context.likes = Array.from({ length: 24 }, (_, i) => work(`liked:${i}`));
  const pending = f.loadRecommendations(f.tab);
  await flushAsyncWork();
  const signal = f.requests.find(call => call.q).signal;
  f.retry(f.tab, ['gelbooru'], false);
  const aborted = signal.aborted;
  finishBackground({ items: [], errors: {}, hasMoreSources: [] });
  await pending;
  assert.equal(aborted, false, 'an unrelated settings save must not discard the completed search');
  assert.equal(f.tab.items[0].key, 'danbooru:page0');
  assert.equal(f.streams()[0].nextPage, 1);
});

test('an affected settings change during the background await leaves the uncommitted page retryable', async () => {
  let finishBackground, backgroundRequests = 0;
  const f = fixture(['gelbooru'], call => call.q === ''
    ? ++backgroundRequests === 1 ? new Promise(resolve => { finishBackground = resolve; })
      : { items: [], errors: {}, hasMoreSources: [] }
    : { items: [work(`gelbooru:page${call.page}`, 'gelbooru')], errors: {}, hasMoreSources: ['gelbooru'] });
  f.context.likes = Array.from({ length: 24 }, (_, i) => work(`liked:${i}`));
  const pending = f.loadRecommendations(f.tab);
  await flushAsyncWork();
  f.retry(f.tab, ['gelbooru'], false);
  finishBackground({ items: [], errors: {}, hasMoreSources: [] });
  await pending;
  assert.equal(f.requests.find(call => call.q).signal.aborted, true);
  assert.equal(f.streams()[0].nextPage, 0, 'a page with discarded cards has not been consumed');
  await f.loadRecommendations(f.tab, true);
  assert.equal(f.requests.filter(call => call.q).at(-1).page, 0);
  assert.equal(f.tab.items[0].key, 'gelbooru:page0');
});

test('an affected settings change during ranking preserves the prefix and the pending append page', async () => {
  const f = fixture(['gelbooru'], call => ({ items: [work(`gelbooru:page${call.page}`, 'gelbooru')],
    errors: {}, hasMoreSources: ['gelbooru'] }));
  await f.loadRecommendations(f.tab);
  const prefix = f.tab.items.map(item => item.key);
  let finishRanking, rankingArgs;
  f.context.mergeRecommendationsAsync = (...args) => {
    rankingArgs = args;
    return new Promise(resolve => { finishRanking = resolve; });
  };
  const pending = f.loadRecommendations(f.tab, true);
  await flushAsyncWork();
  f.retry(f.tab, ['gelbooru'], false);
  finishRanking(logic.mergeRecommendations(...rankingArgs));
  await pending;
  assert.deepEqual(f.tab.items.map(item => item.key), prefix);
  assert.equal(f.streams()[0].nextPage, 1, 'the interrupted append page must remain pending');
  f.context.mergeRecommendationsAsync = async (...args) => logic.mergeRecommendations(...args);
  await f.loadRecommendations(f.tab, true);
  assert.equal(f.requests.at(-1).page, 1);
  assert.deepEqual(f.tab.items.map(item => item.key), [...prefix, 'gelbooru:page1']);
});

test('cancellation while ranking does not commit partial source failures or consume healthy peers', async () => {
  const f = fixture(['danbooru', 'gelbooru'], () => ({ items: [work('danbooru:page0')],
    errors: { gelbooru: 'HTTP 503' }, hasMoreSources: ['danbooru'] }));
  let finishRanking;
  f.context.mergeRecommendationsAsync = () => new Promise(resolve => { finishRanking = resolve; });
  const pending = f.loadRecommendations(f.tab);
  await flushAsyncWork();
  f.retry(f.tab, ['gelbooru'], false);
  finishRanking([]);
  await pending;
  assert.equal(f.streams().length, 1, 'discarded failure state must not split the stream');
  assert.equal(f.streams()[0].nextPage, 0);
  assert.deepEqual(Array.from(f.streams()[0].sources), ['danbooru', 'gelbooru']);
  assert.deepEqual(Object.keys(f.tab.errors), []);
});

test('an inactive or closed recommendation tab does not restart from its recovery timer', async () => {
  const f = fixture(['danbooru'], () => ({ items: [], errors: { danbooru: 'HTTP 503' }, hasMoreSources: [] }));
  await f.loadRecommendations(f.tab);
  f.context.activeId = -1;
  await f.advance(15000);
  assert.equal(f.requests.length, 1);
  f.context.activeId = f.tab.id;
  f.scheduleRule34Recovery(f.tab);
  f.context.findTab = () => undefined;
  await f.advance(500);
  assert.equal(f.requests.length, 1);
});

test('cancelled responses do not create retry streams or replace existing cards', async () => {
  let complete;
  const f = fixture(['danbooru'], (_, count) => count === 1
    ? { items: [work('danbooru:visible')], errors: {}, hasMoreSources: ['danbooru'] }
    : new Promise(resolve => { complete = resolve; }));
  await f.loadRecommendations(f.tab);
  const prefix = f.tab.items.map(item => item.key);
  const pending = f.loadRecommendations(f.tab, true);
  f.tab.recommendationController.abort();
  complete({ items: [], errors: { danbooru: 'HTTP 503' }, hasMoreSources: [] });
  await pending;
  assert.equal(f.requests.length, 2);
  assert.equal(f.timers.size, 0);
  assert.equal(f.streams().length, 1);
  assert.equal(f.streams()[0].nextPage, 1);
  assert.equal(f.streams()[0].retryAt || 0, 0);
  assert.deepEqual(f.tab.items.map(item => item.key), prefix);
});

test('recommendation warning Retry uses the incremental recovery action', () => {
  const renderSource = app.slice(app.indexOf('function renderRecommendations('),
    app.indexOf('\nfunction followButton('));
  let action;
  const profileSource = app.slice(app.indexOf('function recommendationLikedWorks('),
    app.indexOf('\nfunction recommendationPoolsHaveMore('));
  const render = vm.runInNewContext(profileSource + renderSource + '\nrenderRecommendations', {
    CatalogLogic: logic, likes: [work('liked')], contentPreferences: {}, recommendationTagPreferences: {},
    names: {}, sourceKeyHint: () => '', renderRecommendationTagChips: () => '',
    renderErrors: (_, retryAction) => { action = retryAction; return ''; },
    renderGrid: () => '', filteredRecommendationOtherTags: () => [], escapeHtml: value => value
  });
  render({ id: 11, items: [work('visible')], errors: { danbooru: 'HTTP 503' },
    recommendationTags: [{ tag: 'latex' }], selectedSources: ['danbooru'] });
  assert.equal(action, 'recommendation-more-retry');
});

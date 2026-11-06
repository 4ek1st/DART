'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('./helpers/viewer-vm.cjs');
const CatalogLogic = require('../wwwroot/catalog-logic.js');
const DartResourceCache = require('../wwwroot/resource-cache.js');
const ArtworkNavigation = require('../wwwroot/artwork-navigation.js');
const DartProviderPages = require('../wwwroot/provider-pages.js');
const source = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
const tick = async () => { for (let index = 0; index < 5; index++) await new Promise(setImmediate); };
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const work = (provider, id = 1) => ({ key: `${provider}:${id}`, source: provider, id: String(id), rating: 'g',
  tags: ['forest'], title: 'Neutral landscape', images: [`https://example.test/${provider}/${id}.jpg`] });

for (const provider of CatalogLogic.supportedSources) test(`both real cache/transport layers isolate held ${provider} requests`, async t => {
  const calls = [], gates = [], pending = [];
  const context = vm.createContext({ CatalogLogic, DartResourceCache, AbortController, URLSearchParams,
    structuredClone, setTimeout, clearTimeout, addCatalogVisualHashes() {},
    fetch: async (url, options) => {
      calls.push(url);
      const params = new URL(url, 'http://fixture').searchParams;
      if (params.get('sources') === provider) {
        const gate = deferred(); gates.push(gate);
        await Promise.race([gate.promise, new Promise((_, reject) => options.signal.addEventListener('abort', () =>
          reject(Object.assign(new Error('Cancelled'), { name: 'AbortError' })), { once: true }))]);
      }
      return { ok: true, headers: { get() { return ''; } }, json: async () => ({ items: [], errors: {}, hasMoreSources: [] }),
        blob: async () => ({ size: 10 }) };
    } });
  vm.runInContext(source.slice(source.indexOf('async function request('), source.indexOf('\nconst visualHashJobs')), context);
  const track = value => { pending.push(value.catch(() => {})); return value; };
  t.after(async () => { for (let round = 0; round < 16; round++) { gates.forEach(gate => gate.resolve()); await tick(); } await Promise.all(pending); });
  for (let index = 0; index < 8; index++) track(context.request(`/api/search?sources=${provider}&q=neutral_${index}`));
  await tick();
  const other = CatalogLogic.supportedSources.find(name => name !== provider);
  let healthy = false, local = false, image = false;
  track(context.request(`/api/search?sources=${other}&q=forest`).then(() => { healthy = true; }));
  track(context.request('/api/favorites?rating=all').then(() => { local = true; }));
  track(context.readMediaBlob('https://example.test/neutral.jpg').then(() => { image = true; }));
  await tick();
  assert(healthy, 'healthy source must reach the wire through both cache and transport while the peer is held');
  assert(local, 'local collection reads must not wait for a remote provider');
  assert(image, 'visible media must retain an ordinary lane');
  assert(calls.filter(url => new URL(url, 'http://fixture').searchParams.get('sources') === provider).length <= 2,
    'one provider must not occupy every ordinary transport lane');
});

for (const kind of ['home', 'search']) test(`${kind} publishes the ready source and keeps independent cursors while a peer is held`, async () => {
  const slow = deferred(), calls = [], rendered = [];
  const tab = { id: 1, kind, rating: 'all', query: 'forest', selectedSources: ['danbooru', 'gelbooru'], items: [] };
  const context = vm.createContext({ CatalogLogic, AbortController, URLSearchParams,
    findTab: id => id === tab.id ? tab : null, activeId: 1, rememberItems() {},
    render: () => rendered.push(Array.from(tab.items, item => item.key)),
    request: async url => {
      const params = new URL(url, 'http://fixture').searchParams, sources = params.get('sources');
      calls.push({ sources, page: params.get('page') });
      if (sources.includes('danbooru')) await slow.promise;
      return { items: [work(sources)], errors: {}, hasMoreSources: [sources] };
    } });
  const code = source.slice(source.indexOf('async function loadSearch('), source.indexOf('\nfunction setSavedWorks('));
  const load = vm.runInContext(code + '\nloadSearch', context), pending = load(tab);
  try {
    await tick();
    assert(calls.every(call => !call.sources.includes(',')), 'each provider must have an independently deliverable request');
    assert.deepEqual(Array.from(tab.items, item => item.key), ['gelbooru:1']);
    assert.equal(tab.sourcePages.gelbooru, 1); assert.equal(tab.sourcePages.danbooru, 0);
    assert(rendered.some(keys => keys.includes('gelbooru:1')));
  } finally { slow.resolve(); await pending; }
  assert.deepEqual(Array.from(tab.items, item => item.key), ['gelbooru:1', 'danbooru:1']);
});

test('a generic search recovery timer honors the earliest failed provider deadline and retries only due sources', async () => {
  let now = 100000, callback, delay;
  const tab = { id: 1, kind: 'search', loading: false, pausedSources: { danbooru: true, sankaku: true },
    sourceRetryAt: { danbooru: 130000, sankaku: 160000 } }, calls = [];
  const context = vm.createContext({ Date: class extends Date { static now() { return now; } },
    activeId: 1, findTab: id => id === tab.id ? tab : null,
    setTimeout: (fn, value) => { callback = fn; delay = value; return 1; }, clearTimeout() {},
    loadSearch: (...args) => calls.push(args), loadRecommendations() {} });
  vm.runInContext(source.slice(source.indexOf('function scheduleRule34Recovery('), source.indexOf('\nfunction curationContext(')), context);
  context.scheduleRule34Recovery(tab); assert.equal(delay, 30000);
  now = 130001; await callback();
  assert.deepEqual(Array.from(calls[0][3]), ['danbooru']); assert.equal(calls[0][1], true);
});

function followFixture(respond, count = 4) {
  let now = 100000;
  const follows = Array.from({ length: count }, (_, index) => ({ key: `danbooru::fixture_${index}`,
    source: 'danbooru', artistId: `fixture_${index}`, name: `Neutral artist ${index}`,
    followedAt: '2024-01-01T00:00:00Z' }));
  const calls = [], tab = { id: 1, kind: 'follows', rating: 'all', items: [] };
  const context = vm.createContext({ CatalogLogic, AbortController, URLSearchParams,
    Date: class extends Date { static now() { return now; } }, setTimeout, clearTimeout,
    follows, followedKeys: new Set(), contentPreferences: {}, activeId: 1,
    settings: { hasApiKey: true, hasRule34ApiKey: false, sankakuAvailable: true },
    names: { danbooru: 'Danbooru', gelbooru: 'Gelbooru', sankaku: 'Sankaku' },
    findTab: id => id === tab.id ? tab : null, refreshFollows: async () => true,
    rememberItems() {}, render() {},
    request: async (url, options = {}) => {
      if (url.startsWith('/api/follows/cache?')) return { groups: [] };
      if (url === '/api/follows/seen') return follows;
      const params = new URL(url, 'http://fixture').searchParams;
      const entry = { source: params.get('sources') || params.get('source'),
        page: Number(params.get('page')), query: params.get('q') || params.get('artist') };
      calls.push(entry); return respond(entry, options);
    } });
  vm.runInContext(source.slice(source.indexOf('function decorateFollowItems('), source.indexOf('\nasync function loadBookmarks(')), context);
  return { context, calls, tab, advance: value => { now += value; },
    load: () => context.loadFollowFeed(tab), more: () => context.loadMoreFollows(tab) };
}
const followReply = (entry, more = false) => ({ items: [work(entry.source, `${entry.query}_${entry.page}`)], errors: {},
  hasMore: more, hasMoreSources: more ? [entry.source] : [] });

test('Following finishes every healthy subscription lane while Danbooru remains held', async () => {
  const slow = deferred(), f = followFixture(entry => entry.source === 'danbooru' ? slow.promise : followReply(entry), 12);
  const loading = f.load();
  try {
    await tick();
    assert.equal(f.calls.filter(call => call.source === 'gelbooru').length, 12);
    assert.equal(f.calls.filter(call => call.source === 'sankaku').length, 12);
    assert.equal(f.tab.items.filter(item => item.source !== 'danbooru').length, 24);
  } finally { slow.resolve({ items: [], errors: {}, hasMoreSources: [] }); await loading; }
});

test('Following shares provider cooldowns, preserves server deadlines and recovers only failed pages', async () => {
  let unavailable = true;
  const f = followFixture(entry => entry.source === 'danbooru' && unavailable
    ? { items: [], errors: { danbooru: 'Danbooru unavailable (HTTP 503)' }, retryAt: { danbooru: 220000 }, hasMoreSources: [] }
    : followReply(entry), 9);
  await f.load();
  try {
    assert(f.calls.filter(call => call.source === 'danbooru').length <= 2,
      'one failing provider must not request every followed author during its shared cooldown');
    const failed = f.tab.followStreams.filter(stream => stream.source === 'danbooru');
    assert.equal(failed.length, 9); assert(failed.every(stream => stream.retryAt === 220000));
    const count = f.calls.length; f.advance(60000); await f.more(); assert.equal(f.calls.length, count);
    unavailable = false; f.advance(60001); await f.more();
    assert(f.calls.slice(count).every(call => call.source === 'danbooru' && call.page === 0));
    assert(f.tab.items.some(item => item.source === 'danbooru'));
    assert(f.tab.items.some(item => item.source === 'gelbooru'));
  } finally { clearTimeout(f.tab.followRetryTimer); }
});

test('an older Following author response retains its art without clearing a newer provider deadline', async () => {
  const held = deferred(), deadline = 220000;
  const f = followFixture(entry => entry.source === 'danbooru' && entry.query === 'fixture_0'
    ? held.promise : entry.source === 'danbooru' && entry.query === 'fixture_1'
      ? { items: [], errors: { danbooru: 'HTTP 503' }, retryAt: { danbooru: deadline }, hasMoreSources: [] }
      : followReply(entry), 2);
  const initial = f.load();
  try {
    await tick(); assert.equal(f.context.requestFollowSource.providers.danbooru.retryAt, deadline);
    held.resolve({ items: [work('danbooru', 'older_success')], errors: {}, hasMoreSources: [] });
    await initial;
    assert(f.tab.items.some(item => item.key === 'danbooru:older_success'));
    assert.equal(f.context.requestFollowSource.providers.danbooru.retryAt, deadline);
    const before = f.calls.length, entry = { source: 'danbooru', path: '/api/search?sources=danbooru&q=fixture_recover&page=0' };
    await assert.rejects(f.context.requestFollowSource(entry, f.tab.followController.signal), error => error.retryAt === deadline);
    assert.equal(f.calls.length, before, 'another author must not reach upstream before the provider deadline');
    f.advance(120001);
    await f.context.requestFollowSource(entry, f.tab.followController.signal);
    assert.equal(f.calls.length, before + 1);
    assert.equal(f.context.requestFollowSource.providers.danbooru.retryAt, 0);
  } finally { held.resolve({ items: [], errors: {}, hasMoreSources: [] }); await initial; clearTimeout(f.tab.followRetryTimer); }
});

test('Following pagination publishes ready healthy streams before a held peer completes', async () => {
  const slow = deferred(), f = followFixture(entry => entry.page === 1 && entry.source === 'danbooru'
    ? slow.promise : followReply(entry, entry.page === 0), 1);
  await f.load();
  const before = f.tab.items.length, pending = f.more();
  try {
    await tick();
    assert(f.tab.items.length > before, 'healthy page cannot wait at a Promise.all publication barrier');
    assert(f.tab.items.some(item => item.source === 'gelbooru' && item.id.endsWith('_1')));
  } finally { slow.resolve({ items: [], errors: {}, hasMoreSources: [] }); await pending; }
});

test('Related publishes ready filtered/ranked works while a selected provider is held', async () => {
  const slow = deferred(), current = work('danbooru', 100), tab = { id: 1, kind: 'detail', item: current };
  const context = vm.createContext({ CatalogLogic, AbortController, URLSearchParams, defaultSources: ['danbooru', 'gelbooru'],
    activeId: 1, findTab: id => id === tab.id ? tab : null, ratingFilterFor: () => 'all', render() {}, rememberItems() {},
    filterFeedWorks: items => items, curationContext: () => ({}),
    request: async url => {
      const params = new URL(url, 'http://fixture').searchParams, provider = params.get('sources');
      if (provider.includes('danbooru')) await slow.promise;
      return { items: [work(provider, 101)], errors: {}, hasMoreSources: [] };
    } });
  vm.runInContext(source.slice(source.indexOf('async function loadRelated('), source.indexOf('\nasync function loadProfile(')), context);
  const pending = context.loadRelated(tab);
  try { await tick(); assert(tab.related.some(item => item.source === 'gelbooru')); }
  finally { slow.resolve(); await pending; }
});

test('an older Related query retains its artwork without reopening a newer failed provider query before RetryAt', async () => {
  const held = deferred(), deadline = Date.now() + 60000, calls = [];
  const tab = { id: 1, kind: 'detail', item: work('gelbooru', 100) };
  const context = vm.createContext({ CatalogLogic: { ...CatalogLogic, relatedQueries: () => ['one', 'two'] },
    AbortController, URLSearchParams, defaultSources: ['danbooru', 'gelbooru'], activeId: 1,
    findTab: id => id === 1 ? tab : null, ratingFilterFor: () => 'all', render() {}, rememberItems() {},
    filterFeedWorks: items => items, curationContext: () => ({}),
    request: async url => {
      const params = new URL(url, 'http://fixture').searchParams, provider = params.get('sources'), query = params.get('q');
      calls.push([provider, query]);
      if (provider === 'danbooru' && query === 'one') return held.promise;
      if (provider === 'danbooru') return { items: [], errors: { danbooru: 'HTTP 503' },
        retryAt: { danbooru: deadline }, hasMoreSources: [] };
      return { items: [work(provider, query === 'one' ? 101 : 102)], errors: {}, hasMoreSources: [] };
    } });
  vm.runInContext(source.slice(source.indexOf('async function loadRelated('), source.indexOf('\nasync function loadProfile(')), context);
  const initial = context.loadRelated(tab);
  let append;
  try {
    await tick(); append = context.loadRelated(tab, true); await tick();
    assert.equal(tab.relatedServerRetryAt.danbooru, deadline);
    held.resolve({ items: [work('danbooru', 103)], errors: {}, hasMoreSources: [] });
    await Promise.all([initial, append]);
    assert(tab.related.some(item => item.key === 'danbooru:103'));
    assert.equal(calls.filter(([provider, query]) => provider === 'danbooru' && query === 'two').length, 1);
    assert.equal(tab.relatedServerRetryAt.danbooru, deadline); assert.equal(tab.relatedPaused.danbooru, true);
    assert.match(tab.relatedErrors.danbooru, /503/);
  } finally { held.resolve({ items: [], errors: {}, hasMoreSources: [] }); await initial; if (append) await append; clearTimeout(tab.rule34RecoveryTimer); }
});

test('a superseded pending-only Related waiter cannot clear the newer generation error', async () => {
  const held = deferred(), tab = { id: 1, kind: 'detail', item: work('gelbooru', 100) };
  let requests = 0;
  const context = vm.createContext({ CatalogLogic: { ...CatalogLogic, relatedQueries: () => ['one'] },
    AbortController, URLSearchParams, defaultSources: ['danbooru'], activeId: 1,
    findTab: id => id === 1 ? tab : null, ratingFilterFor: () => 'all', render() {}, rememberItems() {},
    filterFeedWorks: items => items, curationContext: () => ({}), request: async () => ++requests === 1
      ? held.promise : { items: [work('danbooru', 101)], errors: {}, hasMoreSources: [] } });
  vm.runInContext(source.slice(source.indexOf('async function loadRelated('), source.indexOf('\nasync function loadProfile(')), context);
  const original = context.loadRelated(tab); await tick();
  const waiter = context.loadRelated(tab, true); await tick();
  context.mergeRelatedWorks = () => { throw new Error('Fixture publication failure'); };
  await context.loadRelated(tab, false); assert.equal(tab.relatedError, true);
  held.resolve({ items: [], errors: {}, hasMoreSources: [] });
  await Promise.all([original, waiter]); assert.equal(tab.relatedError, true);
});

test('server-directed recommendation recovery does not become permanently disabled after three maintenance responses', () => {
  const start = source.indexOf('function deferRecommendationSource('), end = source.indexOf('\nfunction settleRecommendationSourceRetries(', start);
  const context = vm.createContext({ Date: class extends Date { static now() { return 100000; } } });
  vm.runInContext(source.slice(start, end), context);
  const stream = { sources: ['danbooru'], nextPage: 4 }, group = { streams: [stream] };
  for (let round = 0; round < 6; round++) {
    const failed = context.deferRecommendationSource(group, stream, 'danbooru', 'Danbooru unavailable (HTTP 503)', 220000);
    assert(Number.isFinite(failed.retryAt)); assert(failed.retryAt >= 220000); assert.equal(failed.nextPage, 4);
  }
});

for (const kind of ['search', 'recommendations', 'follows', 'profile', 'related'])
  test(`viewer ${kind} page boundary consumes healthy partial rows before the held source finishes`, async () => {
    const slow = deferred(), initial = work('gelbooru', 1), next = work('gelbooru', 2);
    const tab = { kind: kind === 'related' ? 'detail' : kind, started: true, items: [initial],
      related: [initial], relatedStarted: true, relatedHasMore: true, hasMore: true, errors: {} };
    const route = { source: tab, list: kind };
    const load = async () => {
      tab.loading = true; tab.relatedLoading = true; tab.followLoadingMore = true;
      tab.items = [initial, next]; tab.related = tab.items;
      await slow.promise;
      tab.loading = false; tab.relatedLoading = false; tab.followLoadingMore = false;
    };
    const context = vm.createContext({ Date, setTimeout, artworkRouteSource: value => value.source,
      artworkSourceItems: value => kind === 'related' ? value.source.related : value.source.items,
      loadSearch: load, loadRecommendations: load, loadMoreFollows: load, loadFollowFeed: load,
      loadProfile: load, loadRelated: load, copyArtworkSource: value => value });
    vm.runInContext(source.slice(source.indexOf('async function loadArtworkSource('), source.indexOf('\nfunction createArtworkRoute(')), context);
    let done = false;
    const pending = context.loadArtworkSource(route).then(() => { done = true; });
    try {
      await new Promise(resolve => setTimeout(resolve, 95));
      assert(done, 'a published healthy neighbor must release viewer pagination while a failed peer remains pending');
      assert.equal(tab.loading, true);
    } finally { slow.resolve(); await pending; }
  });

test('provider grouping also bounds queued same-provider work while preserving foreground promotion and cancellation', async t => {
  const transport = DartResourceCache.createTransport({ maxQueued: 1, timeout: 1000 });
  const waits = [], pending = [], calls = [];
  const run = (id, provider, priority, signal) => {
    const value = transport.run(inner => {
      calls.push(id); const wait = deferred(); waits.push(wait);
      return Promise.race([wait.promise, new Promise((_, reject) => inner.addEventListener('abort', () =>
        reject(Object.assign(new Error('Cancelled'), { name: 'AbortError' })), { once: true }))]);
    }, signal, { group: provider, priority });
    pending.push(value.catch(() => {})); return value;
  };
  t.after(async () => { for (let index = 0; index < 8; index++) { waits.forEach(wait => wait.resolve()); await tick(); } await Promise.all(pending); });
  run('blocked-a', 'danbooru'); run('blocked-b', 'danbooru');
  const controller = new AbortController(), queued = run('abandoned', 'danbooru', undefined, controller.signal);
  const abandoned = assert.rejects(queued, { name: 'AbortError' });
  await tick(); await assert.rejects(run('overflow', 'danbooru'), { name: 'TransportQueueFullError' });
  run('visible-current', 'danbooru', 'foreground');
  await tick(); assert(calls.includes('visible-current'), 'reserved visible-artwork slot must survive provider isolation');
  controller.abort(); await abandoned; await new Promise(resolve => setTimeout(resolve, 5));
  assert(!calls.includes('abandoned'));
  run('healthy', 'gelbooru'); await tick(); assert(calls.includes('healthy'));
});

test('a query-specific Following error does not put other artists from that provider into cooldown', async () => {
  const f = followFixture(entry => entry.source === 'danbooru' && entry.query.includes('fixture_0')
    ? { items: [], errors: { danbooru: 'Invalid query (HTTP 400)' }, hasMoreSources: [] } : followReply(entry), 6);
  await f.load();
  try {
    assert.equal(f.calls.filter(call => call.source === 'danbooru').length, 6);
    assert(f.tab.items.filter(item => item.source === 'danbooru').length >= 5);
    assert.equal(f.context.requestFollowSource.providers.danbooru.retryAt, 0);
  } finally { clearTimeout(f.tab.followRetryTimer); }
});

test('fast viewer pagination does not introduce a polling-frame delay', async () => {
  const first = work('gelbooru', 1), tab = { kind: 'search', items: [first], started: true, hasMore: true, errors: {} };
  const timers = [];
  const context = vm.createContext({ Date, setTimeout: resolve => { timers.push(resolve); return timers.length; }, clearTimeout() {},
    artworkRouteSource: route => route.source, artworkSourceItems: route => route.source.items,
    loadSearch: async () => {}, copyArtworkSource: value => value });
  vm.runInContext(source.slice(source.indexOf('async function loadArtworkSource('), source.indexOf('\nfunction createArtworkRoute(')), context);
  let done = false;
  const pending = context.loadArtworkSource({ source: tab, list: 'search' }).then(() => { done = true; });
  try {
    await tick();
    assert(done, 'an already completed page must finish without firing a polling timer');
    assert(timers.length <= 1);
  } finally { timers.forEach(resolve => resolve()); await pending; }
});

test('optional recommendation samples isolate provider requests and retain healthy evidence during a peer failure', async () => {
  const calls = [], context = vm.createContext({ AbortController, URLSearchParams, Date, setTimeout, clearTimeout,
    request: async url => {
      const providers = new URL(url, 'http://fixture').searchParams.get('sources'); calls.push(providers);
      if (providers.includes('danbooru')) throw Object.assign(new Error('HTTP 503'), { status: 503 });
      return { items: [work(providers)], errors: {} };
    } });
  vm.runInContext(source.slice(source.indexOf('async function loadRecommendationBackground('), source.indexOf('\nfunction rememberRecommendationExposure(')), context);
  const tab = { rating: 'all', selectedSources: ['danbooru', 'gelbooru', 'sankaku'] };
  const sample = await context.loadRecommendationBackground(tab, new AbortController().signal);
  assert(calls.every(provider => !provider.includes(',')));
  assert.deepEqual(Array.from(sample, item => item.source), ['gelbooru', 'sankaku']);
});

for (const kind of ['search', 'recommendations', 'detail']) test(`${kind} long provider deadlines use bounded timer ticks without early retries`, async () => {
  let now = 100000, delay, callback;
  const deadline = now + 30 * 86400000, calls = [];
  const tab = { id: 1, kind, loading: false, pausedSources: { danbooru: true }, sourceRetryAt: { danbooru: deadline },
    relatedPaused: { danbooru: true }, relatedRetryAt: { danbooru: deadline },
    recommendationPools: { names: [{ streams: [{ sources: ['danbooru'], error: 'HTTP 503', retryAt: deadline }] }] } };
  const context = vm.createContext({ Date: class extends Date { static now() { return now; } },
    findTab: id => id === 1 ? tab : null, activeId: 1,
    setTimeout: (fn, value) => { callback = fn; delay = value; return 1; }, clearTimeout() {},
    loadSearch: (...args) => calls.push(args), loadRecommendations: (...args) => calls.push(args), retryRelatedSearch: (...args) => calls.push(args) });
  vm.runInContext(source.slice(source.indexOf('function scheduleRule34Recovery('), source.indexOf('\nfunction curationContext(')), context);
  context.scheduleRule34Recovery(tab);
  assert(delay > 0 && delay <= 60000);
  now += delay; await callback(); assert.equal(calls.length, 0); assert(delay <= 60000);
  now = deadline; await callback(); assert.equal(calls.length, 1);
});

test('Following long cooldown polling does not overflow timers or request before the deadline', async () => {
  let now = 100000, callback, delay;
  const deadline = now + 30 * 86400000, calls = [], tab = { id: 1, loading: false, followStreams: [{
    source: 'danbooru', error: 'HTTP 503', retryAt: deadline, buffer: [], nextPage: 0 }] };
  const context = vm.createContext({ Date: class extends Date { static now() { return now; } }, activeId: 1,
    findTab: id => id === 1 ? tab : null, requestFollowSource: Object.assign(() => {}, { providers: {} }),
    setTimeout: (fn, value) => { callback = fn; delay = value; return 1; }, clearTimeout() {},
    loadMoreFollows: value => calls.push(value) });
  vm.runInContext(source.slice(source.indexOf('function followStreamRetryAt('), source.indexOf('\nasync function updateFollowFeed(')), context);
  context.scheduleFollowRetry(tab); assert(delay > 0 && delay <= 60000);
  now += delay; await callback(); assert.equal(calls.length, 0); assert(delay <= 60000);
  now = deadline; await callback(); assert.equal(calls.length, 1);
});

test('viewer crosses multiple Search page boundaries without closing while a peer remains held', async () => {
  const slow = deferred(), initial = work('gelbooru', 100), calls = [];
  const tab = { id: 1, kind: 'search', started: true, rating: 'all', query: 'forest', selectedSources: ['danbooru', 'gelbooru'],
    sourcePages: { danbooru: 0, gelbooru: 1 }, pausedSources: {}, items: [initial], errors: {}, hasMore: true, page: 0 };
  const route = { source: tab, list: 'search' };
  const context = vm.createContext({ CatalogLogic, Date, setTimeout, clearTimeout, AbortController, URLSearchParams,
    findTab: id => id === 1 ? tab : null, activeId: 1, render() {}, rememberItems() {},
    artworkRouteSource: value => value.source, artworkSourceItems: value => value.source.items, copyArtworkSource: value => value,
    request: async url => {
      const params = new URL(url, 'http://fixture').searchParams, provider = params.get('sources'), page = Number(params.get('page'));
      calls.push([provider, page]);
      if (provider === 'danbooru') return slow.promise;
      return { items: [work(provider, 100 + page)], errors: {}, hasMoreSources: page < 4 ? [provider] : [] };
    } });
  vm.runInContext(source.slice(source.indexOf('async function loadSearch('), source.indexOf('\nfunction setSavedWorks(')) +
    source.slice(source.indexOf('async function loadArtworkSource('), source.indexOf('\nfunction createArtworkRoute(')), context);
  route.engine = ArtworkNavigation.create({ items: [initial], read: () => tab.items,
    merge: CatalogLogic.mergeGroupedWorks, same: CatalogLogic.sameWork, more: () => tab.hasMore || tab.loading,
    load: () => context.loadArtworkSource(route) });
  let latest;
  try {
    for (let step = 1; step <= 3; step++) {
      let done = false;
      latest = route.engine.move(1).then(item => { done = true; return item; });
      await new Promise(resolve => setTimeout(resolve, 95));
      assert(done, `healthy Search page ${step} must advance without waiting on the peer or main grid scrolling`);
      assert.equal((await latest).key, `gelbooru:${100 + step}`);
    }
    assert.equal(calls.filter(([provider]) => provider === 'danbooru').length, 1, 'keep the existing held peer request instead of retrying it each boundary');
    assert.equal((await route.engine.move(-1)).key, 'gelbooru:102');
  } finally { slow.resolve({ items: [], errors: {}, hasMoreSources: [] }); if (latest) await latest; }
});

test('generation page ownership deduplicates pending cursors and serializes publications without cloning promises into tabs', async () => {
  const owner = {}, controller = new AbortController(), gate = deferred(), order = [];
  const pages = DartProviderPages.scope(owner, 'search', 1, controller.signal);
  const first = pages.run('danbooru', () => gate.promise);
  assert.equal(pages.run('danbooru', () => { throw new Error('duplicate request'); }), first);
  const publishing = pages.publish(async () => { order.push('start'); await gate.promise; order.push('finish'); });
  const next = pages.publish(() => order.push('next'));
  await tick(); assert.deepEqual(order, ['start']); assert.deepEqual(structuredClone(owner), {});
  gate.resolve(); await Promise.all([first, publishing, next]);
  assert.deepEqual(order, ['start', 'finish', 'next']); assert.equal(pages.pending.size, 0);
  DartProviderPages.scope(owner, 'search', 2, controller.signal);
  await pages.publish(() => order.push('stale'));
  assert(!order.includes('stale'));
});

for (const surface of ['recommendations', 'follows', 'related'])
  test(`viewer crosses three ${surface} boundaries while a peer is held, preserving publication order and previous navigation`, async () => {
    const slow = deferred(), pending = [], calls = [];
    const initial = work('gelbooru', 101), route = { list: surface };
    let context, tab;
    if (surface === 'follows') {
      const f = followFixture(entry => {
        calls.push([entry.source, entry.page]);
        return entry.source === 'danbooru' && entry.page > 0 ? slow.promise : followReply(entry, entry.page < 8);
      }, 1);
      ({ context, tab } = f); await f.load();
    } else {
      tab = { id: 1, kind: surface === 'related' ? 'detail' : surface, rating: 'all', started: true,
        selectedSources: ['danbooru', 'gelbooru'], item: initial, items: [], errors: {} };
      context = vm.createContext({ CatalogLogic, AbortController, URLSearchParams, Date, setTimeout, clearTimeout,
        defaultSources: ['danbooru', 'gelbooru'], activeId: 1, findTab: id => id === 1 ? tab : null,
        contentPreferences: {}, likes: Array.from({ length: 8 }, (_, index) => work('gelbooru', 1000 + index)),
        recommendationTagPreferences: { forest: 'priority' }, recommendationVisitCount: 0,
        localStorage: { setItem() {} }, ratingFilterFor: () => 'all', render() {}, rememberItems() {},
        filterFeedWorks: items => items, curationContext: () => ({}),
        request: async url => {
          const params = new URL(url, 'http://fixture').searchParams, provider = params.get('sources'), page = Number(params.get('page'));
          calls.push([provider, page]);
          if (provider === 'danbooru') return slow.promise;
          return { items: [work(provider, 200 + page)], errors: {}, hasMoreSources: page < 8 ? [provider] : [] };
        } });
      vm.runInContext(surface === 'related'
        ? source.slice(source.indexOf('async function loadRelated('), source.indexOf('\nasync function loadProfile('))
        : source.slice(source.indexOf('function createRecommendationPools('), source.indexOf('\nfunction decorateFollowItems(')), context);
      pending.push(surface === 'related' ? context.loadRelated(tab) : context.loadRecommendations(tab));
      await tick();
    }
    route.source = tab;
    context.artworkRouteSource = value => value.source;
    context.artworkSourceItems = value => surface === 'related' ? value.source.related : value.source.items;
    context.copyArtworkSource = value => value;
    vm.runInContext(source.slice(source.indexOf('async function loadArtworkSource('), source.indexOf('\nfunction createArtworkRoute(')), context);
    const read = () => context.artworkSourceItems(route), displayed = [...read()];
    const engine = ArtworkNavigation.create({ items: displayed, current: displayed.at(-1), read,
      merge: CatalogLogic.mergeGroupedWorks, same: CatalogLogic.sameWork,
      more: () => surface === 'related' ? tab.relatedHasMore || tab.relatedLoading : tab.hasMore || tab.loading || tab.followLoadingMore,
      load: () => context.loadArtworkSource(route) });
    const visited = new Set(displayed.map(item => item.key)), selected = [];
    let moving;
    try {
      for (let step = 1; step <= 3; step++) {
        let done = false; moving = engine.move(1).then(item => { done = true; return item; });
        await new Promise(resolve => setTimeout(resolve, 95));
        assert(done, `${surface} boundary ${step} must not wait on a held peer`);
        const item = await moving;
        assert(item, `${surface} boundary ${step} must yield a fresh work`);
        assert(!visited.has(item.key), 'a new boundary must not bounce to an already visited slot');
        assert(read().some(row => CatalogLogic.sameWork(row, item)), 'viewer work must exist in the grid publication');
        visited.add(item.key); selected.push(item);
        engine.select(engine.items.at(-1)); // Cross the next loaded boundary without scrolling the grid.
      }
      assert.equal(calls.filter(([provider, page]) => provider === 'danbooru' && (surface !== 'follows' || page > 0)).length, 1);
      const current = engine.items[engine.state.index], previous = await engine.move(-1);
      assert(previous && !CatalogLogic.sameWork(previous, current));
    } finally {
      slow.resolve({ items: [], errors: {}, hasMoreSources: [] });
      if (moving) await moving;
      await Promise.all(pending); clearTimeout(tab.followRetryTimer); clearTimeout(tab.rule34RecoveryTimer);
    }
  });

test('held-provider Search navigation crosses duplicate-only and hidden-only pages, and latest reverse cancels a slow next step', async () => {
  const slow = deferred(), nextPage = deferred(), calls = [], initial = work('gelbooru', 100);
  const tab = { id: 1, kind: 'search', started: true, rating: 'all', query: 'forest', selectedSources: ['danbooru', 'gelbooru'],
    sourcePages: { danbooru: 0, gelbooru: 1 }, pausedSources: {}, items: [initial], errors: {}, hasMore: true, page: 0 };
  const read = () => CatalogLogic.filterWorks(tab.items, { excludedTags: ['blocked_tag'] });
  const route = { source: tab, list: 'search' };
  const context = vm.createContext({ CatalogLogic, Date, setTimeout, clearTimeout, AbortController, URLSearchParams,
    findTab: id => id === 1 ? tab : null, activeId: 1, render() {}, rememberItems() {},
    artworkRouteSource: value => value.source, artworkSourceItems: read, copyArtworkSource: value => value,
    request: async url => {
      const params = new URL(url, 'http://fixture').searchParams, provider = params.get('sources'), page = Number(params.get('page'));
      calls.push([provider, page]); if (provider === 'danbooru') return slow.promise;
      if (page === 5) return nextPage.promise;
      const item = work(provider, page === 1 ? 100 : 100 + page);
      if (page === 2) item.tags.push('blocked_tag');
      return { items: [item], errors: {}, hasMoreSources: [provider] };
    } });
  vm.runInContext(source.slice(source.indexOf('async function loadSearch('), source.indexOf('\nfunction setSavedWorks(')) +
    source.slice(source.indexOf('async function loadArtworkSource('), source.indexOf('\nfunction createArtworkRoute(')), context);
  const engine = ArtworkNavigation.create({ items: [initial], read, merge: CatalogLogic.mergeGroupedWorks, same: CatalogLogic.sameWork,
    more: () => tab.hasMore || tab.loading, load: () => context.loadArtworkSource(route) });
  let moving;
  try {
    assert.equal((await engine.move(1)).key, 'gelbooru:103');
    assert.equal((await engine.move(1)).key, 'gelbooru:104');
    moving = engine.move(1); await tick();
    assert.equal((await engine.move(-1)).key, 'gelbooru:104', 'reverse first cancels the queued forward step');
    assert.equal((await engine.move(-1)).key, 'gelbooru:103');
    nextPage.resolve({ items: [work('gelbooru', 105)], errors: {}, hasMoreSources: ['gelbooru'] });
    assert.equal(await moving, null, 'an older pending Next must not override the newest reverse command');
    assert.equal(engine.items[engine.state.index].key, 'gelbooru:103');
    assert.deepEqual(calls.filter(([provider]) => provider === 'gelbooru').map(([, page]) => page), [1, 2, 3, 4, 5]);
    assert.equal(calls.filter(([provider]) => provider === 'danbooru').length, 1);
    assert.equal(tab.sourcePages.gelbooru, 6);
  } finally { slow.resolve({ items: [], errors: {}, hasMoreSources: [] }); nextPage.resolve({ items: [], errors: {}, hasMoreSources: [] }); if (moving) await moving; }
});

test('cached detail metadata starts related and artist rows before its held provider and avoids a second reset for unchanged metadata', async () => {
  const slow = deferred(), item = { ...work('danbooru', 400), creatorTag: 'fixture_artist', creatorName: 'Fixture artist' };
  const tab = { id: 1, item, artworkRoute: { engine: { update() {} } } }, calls = [];
  const context = vm.createContext({ CatalogLogic, AbortController, URLSearchParams, findTab: id => id === 1 ? tab : null,
    activeId: 1, recent: [], ratingFilterFor: () => 'all', render() {}, rememberItem: value => value, refreshSavedDetail() {}, saveSession() {},
    localStorage: { setItem() {} }, favoritesController: () => ({ metadata() {} }), recordViewedWorks() {},
    loadRelated: value => { calls.push('related'); value.related = [work('gelbooru', 401)]; },
    loadCreatorWorks: () => calls.push('creator'), warmArtworkRoute: () => calls.push('warm'), request: () => slow.promise });
  vm.runInContext(source.slice(source.indexOf('async function loadDetail('), source.indexOf('\nasync function loadCreatorWorks(')), context);
  const loading = context.loadDetail(tab);
  await tick(); assert.deepEqual(calls, ['related', 'creator']); assert.equal(tab.related[0].source, 'gelbooru');
  slow.resolve(item); await loading;
  assert.equal(calls.filter(value => value === 'related').length, 1);
  assert.equal(calls.filter(value => value === 'creator').length, 1);
});

for (const kind of ['search', 'recommendations', 'detail'])
  test(`${kind} recovery is independent of a different provider's pending page`, async () => {
    let now = 100000, callback;
    const deadline = now + 30000, calls = [], tab = { id: 1, kind, loading: true, relatedLoading: true,
      pausedSources: { gelbooru: true }, sourceRetryAt: { gelbooru: deadline }, relatedPaused: { gelbooru: true },
      relatedRetryAt: { gelbooru: deadline }, recommendationPools: { names: [{ streams: [
        { sources: ['gelbooru'], error: 'HTTP 503', retryAt: deadline }] }] } };
    const context = vm.createContext({ Date: class extends Date { static now() { return now; } }, activeId: 1,
      findTab: id => id === 1 ? tab : null, setTimeout: fn => { callback = fn; return 1; }, clearTimeout() {},
      loadSearch: (...args) => calls.push(args), loadRecommendations: (...args) => calls.push(args), retryRelatedSearch: (...args) => calls.push(args) });
    vm.runInContext(source.slice(source.indexOf('function scheduleRule34Recovery('), source.indexOf('\nfunction curationContext(')), context);
    context.scheduleRule34Recovery(tab); assert.equal(typeof callback, 'function');
    now = deadline; await callback(); assert.equal(calls.length, 1);
  });

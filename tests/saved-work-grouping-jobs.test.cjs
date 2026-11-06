'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const Logic = require('../wwwroot/catalog-logic.js');
const app = fs.readFileSync(process.env.DART_SAVED_GROUPING_APP || require.resolve('../wwwroot/app.js'), 'utf8');
const workerSource = fs.readFileSync(process.env.DART_SAVED_GROUPING_WORKER || require.resolve('../wwwroot/catalog-worker.js'), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
const plain = value => JSON.parse(JSON.stringify(value));
const work = (id, extra = {}) => ({ key: 'danbooru:' + id, source: 'danbooru', id: String(id),
  rating: 'g', title: 'Neutral artwork ' + id, tags: ['forest'], characterTags: [],
  images: ['https://example.test/' + id + '.jpg'], ...extra });

function fixture({ jobs = true, load, run, rejectCache = false } = {}) {
  const calls = [], cached = [], remembered = [], notifications = [];
  const items = [work(1), work(2)];
  Object.defineProperty(items, 'savedRevision', { value: 'fixture-server-revision' });
  let release;
  const grouping = new Promise(resolve => { release = resolve; });
  const context = vm.createContext({ CatalogLogic: { ...Logic,
    cacheGroupedWorks(input, grouped) { cached.push([input, grouped]);
      return rejectCache ? null : Logic.cacheGroupedWorks(input, grouped); } },
    likes: [], bookmarks: [], likedKeys: new Set(), savedKeys: new Set(), tabs: [{ kind: 'likes' }, { kind: 'bookmarks' }],
    rememberItems: values => remembered.push(values), scheduleRelatedKnownRefresh() {},
    request: async path => { calls.push(['request', path]); return load ? load(path) : items; },
    toast: text => notifications.push(text) });
  if (jobs) context.DartCatalogJobs = { run(operation, args, fallback) {
    calls.push(['job', operation, args]); return run ? run(operation, args, fallback) : grouping;
  } };
  const start = app.indexOf('function setSavedWorks(');
  vm.runInContext(app.slice(start, app.indexOf('\nfunction refreshSavedDetail(', start)), context);
  return { context, items, calls, cached, remembered, notifications, release,
    refresh: (collection = 'likes', force = false) => context.refreshSavedWorks(collection, force) };
}

test('a saved collection warms shared grouping in the worker before its first publication', async () => {
  const f = fixture();
  const first = f.refresh(), second = f.refresh(); await tick();
  assert.equal(f.calls.filter(call => call[0] === 'request').length, 1);
  assert.equal(f.calls.filter(call => call[0] === 'job').length, 1, 'concurrent readers must share the grouping job');
  assert.equal(f.calls[1][1], 'groupWorks'); assert.equal(f.calls[1][2][0], f.items);
  assert.equal(f.context.likes.length, 0, 'the interactive collection is published only after its shared grouping is ready');
  const grouped = Logic.groupWorks(structuredClone(f.items)); f.release(grouped);
  assert.equal(await first, true); assert.equal(await second, true);
  assert.equal(f.cached.length, 1); assert.equal(f.cached[0][0], f.items); assert.equal(f.cached[0][1], grouped);
  assert.equal(Logic.groupWorks(f.items), grouped, 'the first collection render must reuse the complete worker grouping');
  assert.equal(f.context.likes, f.items); assert.equal(f.context.tabs[0].items, f.items);
  assert.equal(f.context.refreshSavedWorks.states.likes.serverRevision, 'fixture-server-revision');
  assert.equal(f.context.refreshSavedWorks.states.likes.syncedRevision, f.context.refreshSavedWorks.states.likes.revision);
  await f.refresh(); assert.equal(f.calls.length, 2, 'a warm visit must not refetch or regroup unchanged saved data');
});

test('a same-size local saved change supersedes a delayed grouping reply without seeding or overwriting it', async () => {
  const f = fixture(), pending = f.refresh(); await tick();
  const changed = [work(8), work(9)]; f.context.setSavedWorks('likes', changed, changed);
  f.release(Logic.groupWorks(structuredClone(f.items))); await pending;
  assert.equal(f.context.likes, changed); assert.equal(f.cached.length, 0);
  assert.equal(f.context.refreshSavedWorks.states.likes.serverRevision, undefined);
});

test('a saved change made before a slow fetch finishes does not launch obsolete worker work', async () => {
  let finish;
  const f = fixture({ load: () => new Promise(resolve => { finish = resolve; }) }), pending = f.refresh();
  const changed = [work(7)]; f.context.setSavedWorks('likes', changed, changed); finish(f.items); await pending;
  assert.equal(f.context.likes, changed); assert.equal(f.calls.filter(call => call[0] === 'job').length, 0);
  assert.equal(f.cached.length, 0);
});

test('a failed worker cannot turn an available saved collection into a load error', async () => {
  const f = fixture({ run: async () => { throw Error('Worker unavailable'); } });
  assert.equal(await f.refresh('bookmarks'), true);
  assert.equal(f.context.bookmarks, f.items); assert.equal(f.cached.length, 0);
  assert.deepEqual(f.notifications, []);
});

test('a host without worker jobs and invalid worker replies retain the original saved data', async () => {
  for (const options of [{ jobs: false }, { run: async () => null }, { run: async () => ({ error: true }) },
    { run: async (_, args) => Logic.groupWorks(structuredClone(args[0])), rejectCache: true }]) {
    const f = fixture(options);
    assert.equal(await f.refresh('bookmarks'), true); assert.equal(f.context.bookmarks, f.items);
    assert.deepEqual(f.notifications, []); assert.equal(f.context.tabs[1].items, f.items);
  }
});

test('an empty saved collection does not create an unnecessary grouping job', async () => {
  const f = fixture({ load: async () => [] });
  assert.equal(await f.refresh(), true); assert.equal(f.context.likes.length, 0);
  assert.equal(f.calls.filter(call => call[0] === 'job').length, 0); assert.equal(f.cached.length, 0);
});

function worker(overrides = {}) {
  let receive, reply;
  const calls = [];
  const context = { CatalogLogic: { ...Logic, ...overrides,
    mergeRecommendations(...args) { calls.push('merge'); return Logic.mergeRecommendations(...args); } },
    importScripts() {}, structuredClone,
    self: { addEventListener(_, callback) { receive = callback; }, postMessage(value) { reply = structuredClone(value); } } };
  vm.runInNewContext(workerSource, context);
  return { calls, run(operation, args) { reply = null; receive({ data: { id: 1, operation, args: structuredClone(args) } }); return reply; } };
}

test('the grouping worker uses the shared exact grouping algorithm with complete independent metadata', () => {
  const hash = 'a'.repeat(32), items = [work(1, { contentHash: hash }),
    work(2, { key: 'rule34:2', source: 'rule34', contentHash: hash }), work(3, { tags: ['rain'] })];
  const before = JSON.stringify(items), f = worker(), reply = f.run('groupWorks', [items]);
  assert.equal(reply.error, undefined); assert.deepEqual(reply.value, plain(Logic.groupWorks(structuredClone(items))));
  assert.equal(reply.value.length, 2); assert.equal(reply.reusedPrefix, undefined);
  assert.deepEqual(f.calls, []); assert.equal(JSON.stringify(items), before);
});

test('shared worker analysis returns the same tags, groups and query streams without merge-prefix processing', () => {
  const liked = Array.from({ length: 14 }, (_, index) => work(100 + index, {
    creatorTag: 'fixture_artist_' + index % 4,
    tags: [index < 8 ? 'fixture_character' : 'forest', 'watercolor'],
    characterTags: index < 8 ? ['fixture_character'] : [] }));
  const preferences = { 'fixture character': 'priority' }, background = [work(200, { tags: ['sky'] })];
  const before = JSON.stringify({ liked, preferences, background }), f = worker();
  const reply = f.run('workAnalysis', [liked, preferences, background]);
  assert.equal(reply.error, undefined);
  assert.deepEqual(reply.value, plain({ tags: Logic.recommendationTags(liked, 6),
    tagGroups: Logic.recommendationTagGroups(liked, 2, preferences),
    queryGroups: Logic.recommendationQueryGroups(liked, preferences, background) }));
  assert.equal(reply.reusedPrefix, undefined); assert.deepEqual(f.calls, []);
  assert.equal(JSON.stringify({ liked, preferences, background }), before);
});

test('Favorites worker analysis never computes unused combination queries', () => {
  const liked = Array.from({ length: 32 }, (_, index) => work(index + 1, {
    creatorTag: 'fixture_artist_' + index % 8, tags: ['forest', 'river', 'watercolor'] }));
  let queries = 0;
  const f = worker({ recommendationQueryGroups(items, preferences, background, options) {
    assert.equal(options?.includeCombinations, false); queries++;
    return Logic.recommendationQueryGroups(items, preferences, background, options);
  } });
  const reply = f.run('workAnalysis', [liked, {}, [], { includeCombinations: false }]);
  assert.equal(reply.error, undefined); assert.equal(queries, 1);
  assert.deepEqual(reply.value.queryGroups, plain(Logic.recommendationQueryGroups(liked, {}, [], { includeCombinations: false })));
  assert.deepEqual(reply.value.queryGroups.combinations, []);
});

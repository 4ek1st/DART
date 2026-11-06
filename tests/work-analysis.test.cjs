'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { create } = require('../wwwroot/work-analysis.js');
const Logic = require('../wwwroot/catalog-logic.js');
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const result = value => ({ tags: [{ tag: value, count: 3 }], tagGroups: { names: [], copyright: [], other: [] },
  queryGroups: { priority: [], names: [], copyright: [], other: [], combinations: [] } });
const work = index => ({ key: 'danbooru:' + index, source: 'danbooru', id: String(index), rating: 'g',
  creatorTag: 'fixture_artist_' + index % 4, tags: ['forest', 'river', 'detail_' + index % 3],
  characterTags: ['fixture_character'], images: [] });
function fixture(options = {}) {
  const calls = [], revisions = new WeakMap(), waits = [];
  const logic = { ...Logic, recommendationInputVersion: input => revisions.get(input) || 0 };
  const jobs = { run(operation, args, fallback) { const wait = deferred(); calls.push({ operation, args, fallback }); waits.push(wait); return wait.promise; } };
  return { service: create({ logic, jobs, ...options }), calls, waits, revisions, logic };
}

test('Favorites and Recommendations share one promise and result for a large unchanged library', async () => {
  const f = fixture(), liked = Array.from({ length: 4000 }, (_, index) => work(index));
  const first = f.service.analyze(liked, { forest: 'priority', river: 'disabled' });
  const second = f.service.analyze(liked, { river: 'disabled', forest: 'priority' }, []);
  assert.equal(first, second); assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].operation, 'workAnalysis'); assert.equal(f.calls[0].args[0], liked, 'the service must not copy the full saved library');
  const value = result('shared'); f.waits[0].resolve(value);
  assert.equal(await first, value); assert.equal(await f.service.analyze(liked, { river: 'disabled', forest: 'priority' }), value);
  assert.equal(f.calls.length, 1);
});

test('preferences are captured before a pending caller mutates its input', async () => {
  const f = fixture(), liked = [work(1)], prefs = { forest: 'priority' };
  const first = f.service.analyze(liked, prefs); prefs.forest = 'disabled';
  assert.notEqual(f.calls[0].args[1], prefs); assert.deepEqual(f.calls[0].args[1], { forest: 'priority' });
  const second = f.service.analyze(liked, prefs); assert.equal(f.calls.length, 2);
  f.waits[1].resolve(result('new')); f.waits[0].resolve(result('old'));
  assert.equal((await second).tags[0].tag, 'new'); assert.equal((await first).tags[0].tag, 'old');
});

test('library replacement, length and same-size metadata revisions require fresh analysis', async () => {
  const f = fixture(), liked = [work(1)];
  let pending = f.service.analyze(liked); f.waits.at(-1).resolve(result('initial')); await pending;
  for (const mutate of [() => liked.push(work(2)), () => f.revisions.set(liked, 1)]) {
    mutate(); pending = f.service.analyze(liked); f.waits.at(-1).resolve(result('changed')); await pending;
  }
  pending = f.service.analyze([...liked]); f.waits.at(-1).resolve(result('replacement')); await pending;
  assert.equal(f.calls.length, 4);
});

test('background identity and revision are part of the shared analysis scope', async () => {
  const f = fixture(), liked = [work(1)], background = [work(2)];
  const first = f.service.analyze(liked, {}, background); f.waits.at(-1).resolve(result('a')); await first;
  assert.equal(await f.service.analyze(liked, {}, background), await first);
  f.revisions.set(background, 1);
  const revised = f.service.analyze(liked, {}, background); f.waits.at(-1).resolve(result('b')); await revised;
  const replacement = f.service.analyze(liked, {}, [...background]); f.waits.at(-1).resolve(result('c')); await replacement;
  assert.equal(f.calls.length, 3);
});

test('late old snapshots remain scoped to their original callers and cannot replace a newer cached result', async () => {
  const f = fixture(), liked = [work(1)];
  const old = f.service.analyze(liked); f.revisions.set(liked, 1);
  const current = f.service.analyze(liked); const currentResult = result('new');
  f.waits[1].resolve(currentResult); await current; f.waits[0].resolve(result('old')); await old;
  assert.equal(await f.service.analyze(liked), currentResult); assert.equal(f.calls.length, 2);
});

test('clear invalidates ready and pending entries without cancelling their original consumers', async () => {
  const f = fixture(), liked = [work(1)], old = f.service.analyze(liked);
  f.service.clear(); const current = f.service.analyze(liked); const value = result('current');
  f.waits[1].resolve(value); await current; f.waits[0].resolve(result('late')); await old;
  assert.equal(await f.service.analyze(liked), value); assert.equal(f.calls.length, 2);
  f.service.clear(); const fresh = f.service.analyze(liked); assert.equal(f.calls.length, 3);
  f.waits[2].resolve(result('fresh')); await fresh;
});

test('failures and synchronous dispatch errors remain retryable', async () => {
  const f = fixture(), liked = [work(1)], failed = f.service.analyze(liked);
  f.waits[0].reject(Error('Unavailable')); await assert.rejects(failed, /Unavailable/);
  const retry = f.service.analyze(liked); f.waits[1].resolve(result('retry')); await retry;
  assert.equal(f.calls.length, 2);
  let attempts = 0;
  const sync = create({ logic: Logic, jobs: { run() { if (++attempts === 1) throw Error('Dispatch failed'); return result('ready'); } } });
  await assert.rejects(sync.analyze(liked), /Dispatch failed/); assert.equal((await sync.analyze(liked)).tags[0].tag, 'ready');
});

test('malformed worker results cannot poison the cache', async () => {
  const f = fixture(), liked = [work(1)], bad = f.service.analyze(liked);
  f.waits[0].resolve([]); await assert.rejects(bad, /analysis/i);
  const retry = f.service.analyze(liked); f.waits[1].resolve(result('valid')); await retry;
  assert.equal(f.calls.length, 2);
});

test('the per-library cache is bounded and uses recent access when selecting an entry to evict', async () => {
  const f = fixture(), liked = [work(1)];
  const load = async tag => { const pending = f.service.analyze(liked, { [tag]: 'priority' }); f.waits.at(-1).resolve(result(tag)); return pending; };
  await load('a'); await load('b'); await load('c');
  await f.service.analyze(liked, { a: 'priority' }); await load('d');
  assert.equal(f.calls.length, 4);
  await f.service.analyze(liked, { a: 'priority' }); assert.equal(f.calls.length, 4);
  await load('b'); assert.equal(f.calls.length, 5);
});

test('evicted pending jobs may resolve but cannot silently refill their old cache slot', async () => {
  const f = fixture({ maxEntries: 1 }), liked = [work(1)];
  const old = f.service.analyze(liked, { a: 'priority' }), next = f.service.analyze(liked, { b: 'priority' });
  f.waits[1].resolve(result('b')); await next; f.waits[0].resolve(result('a')); await old;
  const retry = f.service.analyze(liked, { a: 'priority' }); assert.equal(f.calls.length, 3);
  f.waits[2].resolve(result('new a')); await retry;
});

test('fallback hosts use the existing exact algorithms and preserve input metadata', async () => {
  const liked = Array.from({ length: 16 }, (_, index) => work(index)), prefs = { forest: 'priority' }, background = [work(50)];
  const before = JSON.stringify({ liked, prefs, background });
  const expected = { tags: Logic.recommendationTags(liked, 6), tagGroups: Logic.recommendationTagGroups(liked, 2, prefs),
    queryGroups: Logic.recommendationQueryGroups(liked, prefs, background) };
  const service = create({ logic: Logic });
  assert.deepEqual(await service.analyze(liked, prefs, background), expected);
  assert.equal(JSON.stringify({ liked, prefs, background }), before);
});

test('the existing jobs service receives an exact fallback instead of a second worker implementation', async () => {
  const liked = [work(1)], service = create({ logic: Logic, jobs: { run(operation, args, fallback) {
    assert.equal(operation, 'workAnalysis'); assert.equal(args[0], liked); return fallback();
  } } });
  const actual = await service.analyze(liked);
  assert.deepEqual(actual.tags, Logic.recommendationTags(liked, 6));
  assert.deepEqual(actual.queryGroups, Logic.recommendationQueryGroups(liked));
});

test('partial Favorites analysis skips unused combinations in both the shared dispatch and exact fallback', async () => {
  const liked = Array.from({ length: 64 }, (_, index) => work(index)), calls = [];
  const logic = { ...Logic, recommendationQueryGroups(items, preferences, background, options) {
    assert.equal(options?.includeCombinations, false, 'Favorites must never request the expensive pair calculation');
    calls.push(options); return Logic.recommendationQueryGroups(items, preferences, background, options);
  } };
  const service = create({ logic, jobs: { run(operation, args, fallback) {
    assert.equal(operation, 'workAnalysis'); assert.deepEqual(args[3], { includeCombinations: false }); return fallback();
  } } });
  const actual = await service.analyze(liked, {}, [], { includeCombinations: false });
  assert.equal(calls.length, 1); assert.deepEqual(actual.queryGroups.combinations, []);
  assert.deepEqual(actual.queryGroups, Logic.recommendationQueryGroups(liked, {}, [], { includeCombinations: false }));
});

test('completed partial evidence never satisfies full Recommendations and each mode coalesces independently', async () => {
  const f = fixture(), liked = [work(1)];
  const partial = f.service.analyze(liked, {}, [], { includeCombinations: false });
  assert.equal(f.service.analyze(liked, {}, [], { includeCombinations: false }), partial);
  const partialResult = result('partial'); f.waits[0].resolve(partialResult); await partial;
  const full = f.service.analyze(liked); assert.notEqual(full, partial); assert.equal(f.calls.length, 2);
  assert.deepEqual(f.calls[0].args[3], { includeCombinations: false });
  assert.deepEqual(f.calls[1].args[3], { includeCombinations: true });
  const fullResult = result('full'); fullResult.queryGroups.combinations.push({ tag: 'forest river', query: 'forest river' });
  f.waits[1].resolve(fullResult); assert.equal(await full, fullResult);
  assert.equal(await f.service.analyze(liked), fullResult); assert.equal(f.calls.length, 2);
});

test('a completed full result can serve Favorites without another calculation', async () => {
  const f = fixture(), liked = [work(1)], full = f.service.analyze(liked);
  const fullResult = result('full'); f.waits[0].resolve(fullResult); await full;
  assert.equal(f.service.analyze(liked, {}, [], { includeCombinations: false }), full);
  assert.equal(f.calls.length, 1);
});

test('a pending full calculation does not hold Favorites behind unused combinations', async () => {
  const f = fixture(), liked = [work(1)], full = f.service.analyze(liked);
  const partial = f.service.analyze(liked, {}, [], { includeCombinations: false });
  assert.notEqual(partial, full); assert.equal(f.calls.length, 2);
  f.waits[1].resolve(result('partial')); assert.equal((await partial).tags[0].tag, 'partial');
  f.waits[0].resolve(result('full')); assert.equal((await full).tags[0].tag, 'full');
});

test('the application forwards Favorites options through its dependency and shared analysis boundary', async () => {
  const fs = require('node:fs'), vm = require('node:vm'), source = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
  const block = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
  const calls = [], liked = [work(1)], preferences = { forest: 'priority' }, options = { includeCombinations: false };
  const context = vm.createContext({ CatalogLogic: Logic,
    DartWorkAnalysis: { create: () => ({ analyze: (...args) => { calls.push(args); return result('partial'); } }) },
    DartFavorites: { create: deps => deps } });
  for (const name of ['request', 'svg', 'favoritesKnownWorks', 'recommendationLikedWorks', 'selectedRating',
    'emptyNsfwRatingsMessage', 'toast', 'saveSession', 'openSearch', 'openDetail', 'currentTab']) context[name] = () => {};
  vm.runInContext(block('function favoritesController(', '\nfunction favoriteGroupsController(') +
    block('function analyzeArtworkCollection(', '\nfunction recommendationPoolsHaveMore('), context);
  const controller = context.favoritesController(); await controller.analyze(liked, preferences, options);
  assert.equal(calls.length, 1); assert.equal(calls[0][0], liked); assert.equal(calls[0][1], preferences);
  assert.equal(calls[0][2].length, 0); assert.equal(calls[0][3], options);
});

test('the application fallback also preserves the partial analysis cost contract', async () => {
  const fs = require('node:fs'), vm = require('node:vm'), source = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
  const liked = [work(1)], options = { includeCombinations: false };
  const context = vm.createContext({ CatalogLogic: { ...Logic, recommendationQueryGroups(items, preferences, background, received) {
    assert.equal(received, options); return Logic.recommendationQueryGroups(items, preferences, background, received);
  } } });
  const start = source.indexOf('function analyzeArtworkCollection(');
  vm.runInContext(source.slice(start, source.indexOf('\nfunction recommendationPoolsHaveMore(', start)), context);
  const actual = await context.analyzeArtworkCollection(liked, {}, [], options);
  assert.deepEqual(actual.queryGroups, Logic.recommendationQueryGroups(liked, {}, [], options));
});

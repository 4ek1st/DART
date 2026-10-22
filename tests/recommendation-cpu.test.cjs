const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const logic = require('../wwwroot/catalog-logic.js');
const logicSource = fs.readFileSync(require.resolve('../wwwroot/catalog-logic.js'), 'utf8');
const appSource = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
const workerSource = fs.readFileSync(require.resolve('../wwwroot/catalog-worker.js'), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));

function instrumentedLogic() {
  const context = vm.createContext({});
  vm.runInContext(`globalThis.unicodeNormalizations = 0;
    const originalNormalize = String.prototype.normalize;
    String.prototype.normalize = function(...args) {
      globalThis.unicodeNormalizations++; return originalNormalize.apply(this, args);
    };`, context);
  vm.runInContext(logicSource.replace('function normalizeTag(tag) {',
    'function normalizeTag(tag) { globalThis.tagNormalizations = (globalThis.tagNormalizations || 0) + 1;'), context);
  return context;
}

test('cold recommendation profile resolves canonical spellings in linear tag work', () => {
  for (const count of [80, 160]) {
    const context = instrumentedLogic();
    const tags = Array.from({ length: count }, (_, index) => `distinct_topic_${index}`);
    context.tagNormalizations = 0;
    context.CatalogLogic.recommendationTags([{ key: 'danbooru:1', source: 'danbooru',
      title: 'Artwork', tags }], count);
    assert(context.tagNormalizations <= count * 10,
      `${count} tags caused ${context.tagNormalizations} normalization visits; avoid scanning raw tags for every tag`);
  }
});

test('repeated tag normalization reuses pure Unicode results without changing spelling rules', () => {
  const context = instrumentedLogic();
  context.unicodeNormalizations = 0;
  const spellings = ['rare_topic', 'Rare:Topic', 'ＲＡＲＥ＿ＴＯＰＩＣ', 'cafe\u0301', 'Café'];
  const results = [];
  for (let round = 0; round < 40; round++)
    for (const tag of spellings) results.push(context.CatalogLogic.isBroadRecommendationTag(tag));
  assert(results.every(value => value === false));
  assert(context.unicodeNormalizations <= spellings.length,
    `repeated tags performed ${context.unicodeNormalizations} Unicode normalizations`);
});

function rankingFixture() {
  const batch = (prefix, count, tags, extra = {}) => Array.from({ length: count }, (_, index) => ({
    key: `${prefix}:${index}`, source: 'danbooru', rating: 'e', tags,
    creatorTag: `${prefix}_artist_${index}`, ...extra }));
  const liked = [...batch('a', 8, ['character_a', 'Series:Name', 'series name', 'rare_fabric', 'Café', 'cafe\u0301'],
    { characterTags: ['character_a'], copyrightTags: ['Series:Name'] }),
  ...batch('b', 8, ['character_b', 'other_fabric'], { characterTags: ['character_b'] })];
  const preferences = { 'character a': 'priority', 'unseen choice': 'priority', 'wide view': 'disabled' };
  const background = [...batch('bg', 15, ['rare_fabric']), ...batch('bgother', 15, ['other_fabric'])];
  const candidates = Array.from({ length: 12 }, (_, index) => ({ key: `rule34:${index}`, source: 'rule34',
    id: String(100 + index), title: `Artwork ${index}`, rating: 'e', creatorTag: `candidate_${index % 4}`,
    tags: [index % 2 ? 'character_a' : 'character_b', index % 3 ? 'rare_fabric' : 'other_fabric',
      ...(index % 4 === 0 ? ['wide_view'] : [])], images: [`https://example.invalid/${index}.jpg`] }));
  return { liked, preferences, background, candidates };
}

test('cold and warm profile keep exact query spelling, association weights, priorities and diversity', () => {
  const { liked, preferences, background, candidates } = rankingFixture();
  const expectedGroups = {
    priority: [{ tag: 'character a', count: 8 }, { tag: 'unseen choice', count: 0 }],
    names: [{ tag: 'character b', count: 8 }], copyright: [{ tag: 'series name', count: 8, query: 'series:name' }],
    other: [{ tag: 'café', count: 8 }, { tag: 'rare fabric', count: 8 }, { tag: 'other fabric', count: 8 }],
    combinations: [
      { tag: 'café\0character a', query: 'café character_a', count: 8 },
      { tag: 'character b\0other fabric', query: 'character_b other_fabric', count: 8 },
      { tag: 'rare fabric\0series name', query: 'rare_fabric series:name', count: 8 },
      { tag: 'café\0series name', query: 'café series:name', count: 8 },
      { tag: 'character a\0rare fabric', query: 'character_a rare_fabric', count: 8 },
      { tag: 'café\0rare fabric', query: 'café rare_fabric', count: 8 }]
  };
  const expectedPairs = [
    { tags: ['café', 'character a'], count: 8, support: 8, query: 'café character_a', weight: 0.19245251093566368 },
    { tags: ['café', 'series name'], count: 8, support: 8, query: 'café series:name', weight: 0.18769327588838353 },
    { tags: ['café', 'rare fabric'], count: 8, support: 8, query: 'café rare_fabric', weight: 0.1792003660059913 },
    { tags: ['character a', 'rare fabric'], count: 8, support: 8, query: 'character_a rare_fabric', weight: 0.14476081295464394 },
    { tags: ['character b', 'other fabric'], count: 8, support: 8, query: 'character_b other_fabric', weight: 0.14118096496442042 },
    { tags: ['rare fabric', 'series name'], count: 8, support: 8, query: 'rare_fabric series:name', weight: 0.14118096496442042 }
  ];
  for (let run = 0; run < 2; run++) {
    assert.deepEqual(logic.recommendationQueryGroups(liked, preferences, background), expectedGroups);
    assert.deepEqual(logic.recommendationCombinations(liked, preferences, background), expectedPairs);
    assert.deepEqual(logic.rankRecommendations(liked, candidates, 'all', 8, preferences, 7,
      { background, recentKeys: ['rule34:1'], curation: { enabled: true } }).map(item => item.key),
    ['rule34:11', 'rule34:5', 'rule34:3', 'rule34:9', 'rule34:7', 'rule34:1', 'rule34:10', 'rule34:2']);
  }
});

test('profile caches rebuild after invalidation and cached grouping refinement on the same library array', () => {
  const liked = [{ key: 'danbooru:1', source: 'danbooru', tags: ['old_interest'] }];
  assert.deepEqual(logic.recommendationTags(liked), [{ tag: 'old interest', count: 1 }]);
  liked[0].tags = ['new_interest']; logic.invalidateGrouping(liked);
  assert.deepEqual(logic.recommendationTags(liked), [{ tag: 'new interest', count: 1 }]);
  logic.groupWorks(liked);
  liked[0].tags = ['refined_interest']; logic.refineGrouping(liked, [liked[0]]);
  assert.deepEqual(logic.recommendationTags(liked), [{ tag: 'refined interest', count: 1 }]);
});

function workerBridge(failPostAt = 0) {
  const messages = [];
  let attempts = 0;
  class Worker {
    constructor() {
      this.handlers = {};
      const worker = this;
      const context = { CatalogLogic: logic, importScripts() {}, self: {
        addEventListener(name, callback) { worker.receive = callback; },
        postMessage(value) { queueMicrotask(() => worker.handlers.message({ data: structuredClone(value) })); }
      } };
      vm.runInNewContext(workerSource, context);
    }
    addEventListener(name, callback) { this.handlers[name] = callback; }
    terminate() {}
    postMessage(value) {
      if (++attempts === failPostAt) throw new Error('Worker transport unavailable');
      const data = structuredClone(value); messages.push(data);
      queueMicrotask(() => this.receive({ data }));
    }
  }
  const start = appSource.indexOf('async function mergeRecommendationsAsync(');
  const end = appSource.indexOf('\nasync function loadRecommendations(', start);
  const merge = vm.runInNewContext(appSource.slice(start, end) + '\nmergeRecommendationsAsync',
    { Worker, CatalogLogic: logic, setTimeout, clearTimeout });
  return { merge, messages };
}

test('worker reuses the liked profile and sends metadata again after its explicit grouping revision', async () => {
  const { merge, messages } = workerBridge();
  const { liked, candidates, preferences, background } = rankingFixture();
  const args = [liked, [], [{ items: candidates }], 'all', preferences, 7, { background }];
  const first = await merge(...args);
  const second = await merge(...args);
  assert.deepEqual(plain(first), plain(logic.mergeRecommendations(...args)));
  assert.deepEqual(plain(second), plain(first));
  assert.equal(messages[0].args[0].length, liked.length);
  assert.equal(messages[1].args[0], null, 'a warm rank must not clone the saved library again');
  assert.equal(messages[1].profileId, messages[0].profileId);
  liked[0].tags = [...liked[0].tags, 'new_manual_topic'];
  logic.invalidateGrouping(liked);
  await merge(...args);
  assert.equal(messages[2].args[0].length, liked.length, 'updated in-place metadata must reach the worker');
  assert.notEqual(messages[2].profileId, messages[1].profileId);
  const replaced = [...liked];
  await merge(replaced, ...args.slice(1));
  assert.equal(messages[3].args[0].length, liked.length);
  assert.notEqual(messages[3].profileId, messages[2].profileId);
});

test('a failed warm worker send falls back with the complete original liked arguments', async () => {
  const { merge, messages } = workerBridge(2);
  const { liked, candidates, preferences, background } = rankingFixture();
  const args = [liked, [], [{ items: candidates }], 'all', preferences, 7, { background }];
  const expected = plain(logic.mergeRecommendations(...args));
  assert.deepEqual(plain(await merge(...args)), expected);
  assert.deepEqual(plain(await merge(...args)), expected);
  assert.deepEqual(plain(await merge(...args)), expected);
  assert.equal(messages.length, 1, 'a broken worker is not retried on every rank');
});

test('interleaved profile jobs use their own liked snapshot and keep manual preference changes', async () => {
  const { merge, messages } = workerBridge();
  const item = (key, tag) => ({ key, source: 'danbooru', rating: 'g', tags: [tag] });
  const a = [item('saved:a', 'topic_a')], b = [item('saved:b', 'topic_b')];
  const candidates = [{ items: [item('candidate:a', 'topic_a'), item('candidate:b', 'topic_b')] }];
  const calls = [
    [a, [], candidates, 'all', {}, 0], [a, [], candidates, 'all', { 'topic b': 'priority' }, 0],
    [b, [], candidates, 'all', {}, 0], [a, [], candidates, 'all', {}, 0]
  ];
  const actual = await Promise.all(calls.map(args => merge(...args)));
  actual.forEach((result, index) => assert.deepEqual(plain(result), plain(logic.mergeRecommendations(...calls[index]))));
  assert.equal(messages[1].args[0], null);
  assert(Array.isArray(messages[2].args[0]) && Array.isArray(messages[3].args[0]));
});

test('visible liked metadata is shared between append passes and refreshed for content or grouping changes', () => {
  const start = appSource.indexOf('function createRecommendationPools(');
  const end = appSource.indexOf('\nasync function loadFollowFeed(', start);
  const liked = [{ key: 'danbooru:1', source: 'danbooru', title: 'Artwork', tags: ['topic_a'] }];
  const context = { CatalogLogic: logic, likes: liked,
    contentPreferences: { aiMode: 'all', excludedTags: ['unrelated_topic'] } };
  const visible = vm.runInNewContext(appSource.slice(start, end) + '\nrecommendationLikedWorks', context);
  const first = visible();
  assert.strictEqual(visible(), first, 'unchanged active filters must not allocate a different profile per append');
  liked[0].tags = ['unrelated_topic']; logic.invalidateGrouping(liked);
  assert.equal(visible().length, 0, 'in-place metadata revision must reapply content filters');
  context.contentPreferences = { aiMode: 'all', excludedTags: [] };
  assert.equal(visible().length, 1, 'changed content preferences must rebuild the profile');
});

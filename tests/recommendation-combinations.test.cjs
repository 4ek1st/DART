const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const logic = require('../wwwroot/catalog-logic.js');
const app = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
const work = (key, tags, extra = {}) => ({ key, source: 'danbooru', rating: 'e', tags, ...extra });
const batch = (prefix, count, tags, extra = {}) => Array.from({ length: count }, (_, i) =>
  work(`${prefix}:${i}`, tags, { creatorTag: `${prefix}_artist_${i}`, ...extra }));
const recurring = () => [
  ...batch('a', 8, ['test_character', 'latex'], { characterTags: ['test_character'] }),
  ...batch('b', 8, ['other_character', 'bodysuit'], { characterTags: ['other_character'] })
];
const loaderSource = app.slice(app.indexOf('function createRecommendationPools('),
  app.indexOf('\nfunction decorateFollowItems('));

test('recurring character and content combinations distinguish equal marginal interests', () => {
  const likes = recurring();
  const pairs = logic.recommendationCombinations(likes);
  assert.ok(pairs.some(pair => pair.tags.includes('test character') && pair.tags.includes('latex')));
  const ranked = logic.rankRecommendations(likes, [
    work('crossed', ['test_character', 'bodysuit']),
    work('matching', ['test_character', 'latex'])
  ], 'explicit');
  assert.equal(ranked[0].key, 'matching');
});

test('statistically independent tag frequencies do not become an extra preference', () => {
  const likes = [
    ...batch('both', 8, ['latex', 'bodysuit']),
    ...batch('latex', 8, ['latex']), ...batch('suit', 8, ['bodysuit']),
    ...batch('neither', 8, ['scenery'])
  ];
  assert.equal(logic.recommendationCombinations(likes)
    .some(pair => pair.tags.includes('latex') && pair.tags.includes('bodysuit')), false);
});

test('a combination refines close matches without overriding stronger individual interests', () => {
  const likes = [...batch('pair', 20, ['latex', 'bodysuit']),
    ...batch('stronger', 26, ['gag', 'collar']), ...batch('rest', 40, ['scenery'])];
  const ranked = logic.rankRecommendations(likes, [
    work('pair', ['latex', 'bodysuit']), work('stronger', ['latex', 'gag'])
  ], 'explicit');
  assert.equal(ranked[0].key, 'stronger');
});

test('a parent phrase cannot multiply evidence for the same attribute', () => {
  const likes = [...batch('both', 10, ['black_thighhighs', 'thighhighs', 'latex']),
    ...batch('other', 20, ['scenery'])];
  const pairs = logic.recommendationCombinations(likes);
  assert.equal(pairs.some(pair => pair.tags.includes('black thighhighs') && pair.tags.includes('thighhighs')), false);
  assert.ok(pairs.some(pair => pair.tags.includes('latex')));
});

test('resolution metadata does not become a content combination unless explicitly prioritized', () => {
  const likes = [...batch('large', 8, ['high_resolution', 'latex']),
    ...batch('larger', 8, ['very_high_resolution', 'bodysuit']), ...batch('rest', 32, ['scenery'])];
  assert.equal(logic.recommendationCombinations(likes).length, 0);
  assert.ok(logic.recommendationCombinations(likes, { 'high resolution': 'priority' })
    .some(pair => pair.tags.includes('high resolution')));
});

test('almost predictable content pairs carry less evidence than a separate context', () => {
  const likes = [...batch('echo', 10, ['echo_a', 'echo_b']),
    ...batch('context', 10, ['latex', 'bodysuit']), ...batch('latex', 10, ['latex']),
    ...batch('suit', 10, ['bodysuit']), ...batch('rest', 40, ['scenery'])];
  const pairs = logic.recommendationCombinations(likes);
  const weight = a => pairs.find(pair => pair.tags.includes(a))?.weight;
  assert.ok(weight('latex') > weight('echo a'));
});

test('search combinations spread across interests instead of repeating one anchor', () => {
  const likes = [...batch('rest', 100, ['scenery']),
    ...Array.from({ length: 12 }, (_, i) => batch(`latex${i}`, 8, ['latex', `outfit_${i}`])).flat(),
    ...batch('suit', 8, ['bodysuit', 'gag'])];
  const groups = logic.recommendationQueryGroups(likes).combinations;
  assert.ok(groups.slice(0, 4).some(group => group.query === 'bodysuit gag'));
});

test('incidental matches, mirrored copies and a single creator cannot establish a combination', () => {
  const incidental = [...batch('passing', 2, ['latex', 'gag']), ...batch('rest', 40, ['scenery'])];
  assert.equal(logic.recommendationCombinations(incidental).length, 0);
  const copies = Array.from({ length: 10 }, (_, i) => work(`copy:${i}`, ['latex', 'gag'],
    { source: i % 2 ? 'danbooru' : 'gelbooru', groupKey: 'one_work' }));
  assert.equal(logic.recommendationCombinations([...copies, ...batch('rest', 20, ['scenery'])]).length, 0);
  assert.equal(logic.recommendationCombinations([...batch('one', 12, ['latex', 'gag'],
    { creatorTag: 'one_artist' }), ...batch('rest', 30, ['scenery'])]).length, 0);
});

test('canonical Copyright punctuation survives joint searches and two identities do not form a pair', () => {
  const likes = [...batch('nikke', 8, ['goddess_of_victory:_nikke', 'test_character', 'latex'],
    { copyrightTags: ['goddess_of_victory:_nikke'], characterTags: ['test_character'] }),
  ...batch('rest', 16, ['bodysuit'])];
  const pairs = logic.recommendationCombinations(likes);
  assert.ok(pairs.some(pair => pair.query === 'goddess_of_victory:_nikke latex' && pair.count === 8));
  assert.equal(pairs.some(pair => pair.tags.includes('goddess of victory nikke') && pair.tags.includes('test character')), false);
});

test('broad tags require a manual priority and disabled choices invalidate every containing pair', () => {
  const likes = [...batch('both', 8, ['latex', 'sex']), ...batch('rest', 16, ['bodysuit'])];
  assert.equal(logic.recommendationCombinations(likes).some(pair => pair.tags.includes('sex')), false);
  assert.ok(logic.recommendationCombinations(likes, { sex: 'priority' }).some(pair => pair.tags.includes('sex')));
  assert.equal(logic.recommendationCombinations(likes, { latex: 'disabled', sex: 'priority' }).length, 0);
  const ranked = logic.rankRecommendations(recurring(), [
    work('pair', ['test_character', 'latex']), work('chosen', ['gag'])
  ], 'explicit', 20, { gag: 'priority' });
  assert.equal(ranked[0].key, 'chosen');
});

test('an ordinary sample reduces associations that also occur without personalization', () => {
  const likes = [...batch('both', 8, ['latex', 'bodysuit']), ...batch('rest', 24, ['scenery'])];
  const background = [...batch('bg', 20, ['latex', 'bodysuit']), ...batch('bgrest', 20, ['scenery'])];
  assert.ok(logic.recommendationCombinations(likes, {}, background)[0].weight <
    logic.recommendationCombinations(likes)[0].weight);
});

test('joint searches share the existing two-query loading budget', async () => {
  const tab = { id: 7, rating: 'explicit', selectedSources: ['danbooru'], items: [] };
  const queries = [];
  const context = { CatalogLogic: logic, likes: recurring(), bookmarks: [],
    recommendationTagPreferences: {}, recommendationVisitCount: 0,
    localStorage: { setItem() {} }, contentPreferences: {}, activeId: -1,
    findTab: id => id === tab.id ? tab : null, render() {}, rememberItems() {},
    AbortController, URLSearchParams, request: async (url, { signal }) => {
      assert.ok(signal);
      const q = new URL(url, 'http://fixture').searchParams.get('q'); queries.push(q);
      return { items: [work(`new:${q}`, q.split(' '))], errors: {}, hasMoreSources: [] };
    } };
  await vm.runInNewContext(loaderSource + '\nloadRecommendations', context)(tab);
  assert.equal(queries.length, 2);
  assert.ok(queries.some(query => query.split(' ').length === 2));
  assert.ok(queries.some(query => query.split(' ').length === 1));
  assert.ok(tab.items.length);
  assert.equal(tab.loading, false);
});

test('full metadata, exclusions and stable append order remain effective with combinations', () => {
  const likes = recurring();
  const first = work('first', [], { allTags: ['test_character', 'latex'] });
  const blocked = work('blocked', [], { allTags: ['test_character', 'latex', 'gag'] });
  assert.deepEqual(logic.rankRecommendations(likes, [first, blocked], 'explicit', 20,
    { gag: 'disabled' }).map(item => item.key), ['first']);
  const merged = logic.mergeRecommendations(likes, [first], [{ kind: 'combinations', items: [
    first, work('more', ['other_character', 'bodysuit'])
  ] }], 'explicit');
  assert.equal(merged[0].key, 'first');
  assert.equal(merged.length, 2);
});

test('remaining combination streams load on every round after ordinary streams are exhausted', () => {
  const select = vm.runInNewContext(loaderSource + '\nselectRecommendationGroups', { CatalogLogic: logic });
  const pair = { tag: 'latex\u0000bodysuit', query: 'latex bodysuit',
    streams: [{ sources: ['danbooru'], nextPage: 1 }] };
  for (let round = 0; round < 4; round++) {
    const tab = { recommendationRound: round, recommendationCursors: {},
      recommendationPools: { priority: [], other: [], names: [], copyright: [], combinations: [pair] } };
    assert.equal(select(tab)[0]?.query, 'latex bodysuit', `round ${round} must keep loading`);
  }
});

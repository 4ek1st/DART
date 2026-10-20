const test = require('node:test');
const assert = require('node:assert/strict');
const logic = require('../wwwroot/catalog-logic.js');
const work = (key, tags, extra = {}) => ({ key, source: 'danbooru', rating: 'e', tags, ...extra });
const likes = (count, tags, extra = {}) => Array.from({ length: count }, (_, i) =>
  work(`liked:${i}`, tags, { creatorTag: `artist_${i}`, ...extra }));

test('technical file properties never create automatic recommendation queries or matches', () => {
  const technical = ['high_resolution', 'very_high_resolution', 'lowres', 'absolutely_absurdres',
    'large_filesize', 'extremely_large_filesize', 'file_size'];
  const history = likes(30, ['latex', ...technical]);
  const queries = logic.recommendationQueryGroups(history);
  assert.deepEqual(queries.other.map(group => group.query || group.tag), ['latex']);
  assert.equal(queries.combinations.length, 0);
  const ranked = logic.rankRecommendations(history, [
    work('technical', [], { allTags: technical }), work('interest', ['latex'])
  ], 'explicit');
  assert.deepEqual(ranked.map(item => item.key), ['interest']);
  assert.deepEqual(history[0].tags, ['latex', ...technical], 'Stored metadata stays available to the artwork view');
});

test('an explicit technical priority remains searchable and effective through raw metadata', () => {
  const history = likes(30, ['latex', 'high_resolution']);
  const preferences = { 'high resolution': 'priority' };
  assert.ok(logic.recommendationQueryGroups(history, preferences).priority
    .some(group => (group.query || group.tag.replaceAll(' ', '_')) === 'high_resolution'));
  const candidates = [work('normal', ['latex']), work('chosen', [], { allTags: ['high_resolution'] })];
  assert.equal(logic.rankRecommendations(history, candidates, 'explicit', 20, preferences)[0].key, 'chosen');
  assert.deepEqual(logic.rankRecommendations(history, candidates, 'explicit', 20,
    { 'high resolution': 'disabled' }).map(item => item.key), ['normal']);
});

test('broad vocabulary aliases from different catalogs do not become independent taste signals', () => {
  const broad = ['clothing', 'clothes', 'busty', 'vagina', 'bodily_fluids', 'straight',
    'female_focus', 'male_focus', 'legwear', 'flat_chest'];
  const history = likes(30, ['latex', ...broad]);
  assert.deepEqual(logic.recommendationQueryGroups(history).other.map(group => group.tag), ['latex']);
  assert.deepEqual(logic.rankRecommendations(history, [work('generic', broad), work('interest', ['latex'])],
    'explicit').map(item => item.key), ['interest']);
  const preferred = logic.rankRecommendations(history, [work('chosen', ['clothing'])], 'explicit', 20,
    { clothing: 'priority' });
  assert.equal(preferred[0]?.key, 'chosen');
});

test('incidental tags cannot admit an otherwise unrelated work in a large collection', () => {
  const history = likes(200, ['latex']);
  history[0] = work('liked:0', ['latex', 'passing_detail', 'passing_character'],
    { creatorTag: 'artist_0', characterTags: ['passing_character'] });
  const candidates = [work('incidental', ['passing_detail', 'passing_character']), work('recurring', ['latex'])];
  assert.deepEqual(logic.rankRecommendations(history, candidates, 'explicit').map(item => item.key), ['recurring']);
  assert.ok(logic.recommendationTagGroups(history, 1).other.some(group => group.tag === 'passing detail'),
    'A rare tag remains accessible for a manual choice');
  assert.equal(logic.rankRecommendations(history, candidates, 'explicit', 20,
    { 'passing detail': 'priority' })[0]?.key, 'incidental');
});

test('recurring support discounts one creator without discarding a strongly repeated interest', () => {
  const history = [
    ...likes(200, ['latex']),
    ...Array.from({ length: 6 }, (_, i) => work(`one:${i}`, ['weak_outfit'], { creatorTag: 'one_artist' })),
    ...Array.from({ length: 36 }, (_, i) => work(`strong:${i}`, ['strong_outfit'], { creatorTag: 'strong_artist' })),
    ...Array.from({ length: 6 }, (_, i) => work(`many:${i}`, ['independent_outfit'], { creatorTag: `other_${i}` }))
  ];
  const ranked = logic.rankRecommendations(history, [work('weak', ['weak_outfit']),
    work('strong', ['strong_outfit']), work('independent', ['independent_outfit'])], 'explicit');
  assert.deepEqual(new Set(ranked.map(item => item.key)), new Set(['strong', 'independent']));
  assert.equal(logic.recommendationQueryGroups(history).other.some(group => group.tag === 'weak outfit'), false);
});

test('small histories keep useful discovery as the collection crosses the confidence boundary', () => {
  const candidates = [work('new', ['latex']), work('unrelated', ['scenery'])];
  for (const count of [1, 2, 11, 12]) {
    const history = likes(count, ['latex']);
    assert.deepEqual(logic.rankRecommendations(history, candidates, 'explicit').map(item => item.key), ['new']);
    assert.ok(logic.recommendationQueryGroups(history).other.some(group => group.tag === 'latex'));
  }
});

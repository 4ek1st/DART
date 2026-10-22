const test = require('node:test');
const assert = require('node:assert/strict');
const logic = require('../wwwroot/catalog-logic.js');

const work = (source, id, extra = {}) => ({
  source, id: String(id), key: `${source}:${id}`, rating: 'g', tags: ['watercolor'],
  images: [`https://fixture.test/${source}-${id}.png`], ...extra
});
const liked = () => [work('danbooru', 99)];
const exactPair = () => {
  const first = work('rule34', 1);
  const learned = { ...first, contentHash: 'a'.repeat(32) };
  const mirror = work('danbooru', 2, { contentHash: 'a'.repeat(32) });
  return { first, learned, mirror };
};

test('recommendation pagination retains a newly confirmed exact-file alias', () => {
  const { first, learned, mirror } = exactPair();
  const initial = logic.groupWorks([first]);
  const next = logic.mergeRecommendations(liked(), initial, [{ items: [learned, mirror] }]);
  assert.equal(next.length, 1);
  assert.deepEqual(new Set(next[0].memberKeys), new Set(['rule34:1', 'danbooru:2']));
  assert(logic.workHistoryTokens(next[0]).includes('hash:' + 'a'.repeat(32)));
});

test('a later recommendation mirror cannot repeat after its exact-file alias was learned', () => {
  const { first, learned, mirror } = exactPair();
  const confirmed = logic.mergeRecommendations(liked(), logic.groupWorks([first]),
    [{ items: [learned, mirror] }]);
  const later = logic.mergeRecommendations(liked(), JSON.parse(JSON.stringify(confirmed)),
    [{ items: [mirror] }]);
  assert.equal(later.length, 1);
  assert.equal(logic.groupWorks(later).length, 1);
});

test('later publication pages enrich the existing recommendation slot without moving its neighbors', () => {
  const publication = { originalUrl: 'https://www.pixiv.net/artworks/100001', pixivGroupKey: 'pixiv:100001' };
  const existing = logic.groupWorks([work('rule34', 10), work('rule34', 1, publication), work('rule34', 11)]);
  const next = logic.mergeRecommendations(liked(), existing, [{ items: [
    work('gelbooru', 2, publication), work('gelbooru', 3)
  ] }]);
  assert.equal(next.length, 4);
  assert.equal(next[0], existing[0]);
  assert.equal(next[2], existing[2]);
  assert(next[1].memberKeys.includes('rule34:1'));
  assert.deepEqual(new Set(next[1].memberKeys), new Set(['rule34:1', 'gelbooru:2']));
  assert.deepEqual(new Set(next[1].images), new Set([
    'https://fixture.test/rule34-1.png', 'https://fixture.test/gelbooru-2.png'
  ]));
  assert.equal(next[3].key, 'gelbooru:3');
});

const visualPair = () => [
  work('rule34', 1, { creatorTag: 'fixture_artist', characterTags: ['fixture_character'],
    tags: Array.from({ length: 16 }, (_, index) => `detail_${index}`),
    originalUrl: 'https://x.com/fixture_artist/status/100001',
    visualHash: 'aaaaaaaaaaaaaaaa', visualPHash: 'cccccccccccccccc', visualAspectRatio: 16 / 9 }),
  work('rule34', 2, { creatorTag: 'fixture_artist', characterTags: ['fixture_character'],
    tags: Array.from({ length: 16 }, (_, index) => `detail_${index}`),
    originalUrl: 'https://www.pixiv.net/artworks/200001', pixivGroupKey: 'pixiv:200001',
    visualHash: 'aaaaaaaaaaaaaaab', visualPHash: 'ccccccccccccccc3', visualAspectRatio: 16 / 9 })
];

test('a close dual fingerprint and confirmed artist can join cross-platform repost variants', () => {
  for (const source of logic.supportedSources) {
    const [first, second] = visualPair();
    second.source = source; second.key = `${source}:2`;
    const initial = JSON.parse(JSON.stringify(logic.groupWorks([first])));
    const grouped = logic.mergeGroupedWorks(initial, [second]);
    assert.equal(grouped.length, 1, source);
    assert.equal(grouped[0].memberKeys.length, 2, source);
    assert.equal(grouped[0].images.length, 2, source);
    assert.equal(logic.groupWorks(JSON.parse(JSON.stringify(grouped))).length, 1, source);
  }
});

test('cross-platform publication links need reliable artist, character, aspect and close dual fingerprints', () => {
  for (const patch of [
    { creatorTag: 'another_artist', participants: [{ tag: 'another_artist', role: 'artist' }] },
    { characterTags: ['another_character'] },
    { characterTags: ['fixture_character', 'another_character'] },
    { characterTags: [] },
    { visualAspectRatio: 0 },
    { visualAspectRatio: 1 },
    { visualHash: 'aaaaaaaaaaaaaaad' }, // Three edge bits differ.
    { visualPHash: 'cccccccccccccc33' }, // Eight perceptual bits differ.
    { visualPHash: '' },
    { tags: ['detail_1', 'detail_2', 'detail_3'] }
  ]) {
    const [first, second] = visualPair();
    Object.assign(second, patch);
    assert.equal(logic.groupWorks([first, second]).length, 2, JSON.stringify(patch));
  }
});

test('generic character labels cannot establish a cross-platform visual repost', () => {
  for (const tag of ['original_character', 'character_request']) {
    const items = visualPair();
    for (const item of items) item.characterTags = [tag];
    assert.equal(logic.groupWorks(items).length, 2, tag);
  }
});

test('close fingerprints cannot override two distinct publications from the same platform', () => {
  for (const publications of [
    ['https://x.com/fixture_artist/status/100001', 'https://twitter.com/fixture_artist/status/100002'],
    ['https://www.pixiv.net/artworks/200001', 'https://www.pixiv.net/artworks/200002']
  ]) {
    const [first, second] = visualPair();
    first.originalUrl = publications[0]; second.originalUrl = publications[1];
    first.pixivGroupKey = ''; second.pixivGroupKey = '';
    assert.equal(logic.groupWorks([first, second]).length, 2);
  }
});

test('a cross-platform visual bridge cannot combine two distinct same-platform publications', () => {
  const [first, bridge] = visualPair();
  const separate = { ...first, key: 'rule34:3', id: '3',
    images: ['https://fixture.test/separate.png'], originalUrl: 'https://x.com/fixture_artist/status/100002' };
  for (const items of [[first, bridge, separate], [bridge, separate, first], [separate, first, bridge]]) {
    const grouped = logic.groupWorks(structuredClone(items));
    assert.equal(grouped.length, 2);
    assert(!grouped.some(item => item.memberKeys.includes('rule34:1') && item.memberKeys.includes('rule34:3')));
  }
});

test('a parent relationship cannot bridge cross-platform publications without visual proof', () => {
  const [first, second] = visualPair();
  for (const item of [first, second]) Object.assign(item, {
    groupKey: 'rule34:parent:50', visualHash: '', visualPHash: ''
  });
  assert.equal(logic.groupWorks([first, second]).length, 2);
});

test('grouping revisions change for explicit invalidation and cached evidence refinement only on that list', () => {
  assert.equal(typeof logic.groupingRevision, 'function');
  const { first, learned, mirror } = exactPair();
  const items = [first, { ...mirror, contentHash: '' }], other = [work('rule34', 10)];
  const initial = logic.groupingRevision(items), untouched = logic.groupingRevision(other);
  assert.equal(logic.groupWorks(items).length, 2);
  Object.assign(first, learned);
  logic.invalidateGrouping(items);
  assert(logic.groupingRevision(items) > initial);
  const invalidated = logic.groupingRevision(items);
  assert.equal(logic.groupWorks(items).length, 2); // Fill the cache before the late evidence arrives.
  items[1].contentHash = mirror.contentHash;
  logic.refineGrouping(items, [items[1]]);
  assert(logic.groupingRevision(items) > invalidated);
  assert.equal(logic.groupWorks(items).length, 1);
  assert.equal(logic.groupingRevision(other), untouched);
});

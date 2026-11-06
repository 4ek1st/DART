'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const logic = require('../wwwroot/catalog-logic.js');

// Neutral source records: no personal profile, remote requests or media bytes.
const work = (source, id, originalUrl, extra = {}) => ({
  source, id: String(id), key: `${source}:${id}`, originalUrl,
  creatorTag: 'neutral_artist', creatorName: 'Neutral Artist',
  tags: ['neutral_character', 'neutral_landscape'], characterTags: ['neutral_character'],
  images: [`https://fixture.test/${source}/${id}.jpg`], ...extra
});
const keys = items => new Set(items.flatMap(item => item.memberKeys || [item.key]));
const sharedTokens = (first, second) => {
  const known = new Set(logic.workHistoryTokens(first));
  return logic.workHistoryTokens(second).filter(token => known.has(token));
};

test('a DeviantArt artwork keeps one identity across author, title and tracking URL variants', () => {
  const items = [
    work('rule34', 710001, 'https://www.deviantart.com/neutral-artist/art/A-Neutral-Study-900001'),
    work('gelbooru', 710002, 'https://deviantart.com/renamed-artist/art/Updated-Title-900001?utm_source=mirror#comments'),
    work('sankaku', 'opaqueStudy', 'https://neutral-artist.deviantart.com/art/Old-Title-900001')
  ];
  const groups = logic.groupWorks(items);
  assert.equal(groups.length, 1);
  assert.deepEqual(keys(groups), new Set(items.map(item => item.key)));
  assert.equal(groups[0].images.length, 3, 'different versions remain available inside the gallery');
  assert(sharedTokens(items[0], items[1]).some(token => /deviantart/.test(token)));
  assert.deepEqual(logic.hideViewedWorks([items[1]], new Set(logic.workHistoryTokens(items[0]))), []);
});

test('the direct DeviantArt deviation route uses the same artwork identity', () => {
  const first = work('danbooru', 720001, 'https://www.deviantart.com/neutral-artist/art/Study-900002');
  const second = work('rule34', 720002, 'https://www.deviantart.com/deviation/900002');
  assert.equal(logic.groupWorks([first, second]).length, 1);
});

test('DeviantArt identity rejects deceptive hosts and non-artwork or malformed paths', () => {
  const original = work('danbooru', 730001, 'https://www.deviantart.com/neutral-artist/art/Study-900003');
  for (const originalUrl of [
    'https://www.deviantart.com.attacker.test/neutral-artist/art/Study-900003',
    'https://deviantart.com@attacker.test/neutral-artist/art/Study-900003',
    'https://notdeviantart.com/neutral-artist/art/Study-900003',
    'https://www.deviantart.com/neutral-artist/gallery/900003',
    'https://www.deviantart.com/neutral-artist/favourites/900003',
    'https://www.deviantart.com/neutral-artist/art/Study-900003-extra',
    'https://www.deviantart.com/neutral-artist/art/Study-900003.jpg',
    'https://www.deviantart.com/neutral-artist',
    'ftp://www.deviantart.com/neutral-artist/art/Study-900003'
  ]) {
    const other = work('rule34', 730002, originalUrl);
    assert.equal(logic.groupWorks([original, other]).length, 2, originalUrl);
    assert.equal(sharedTokens(original, other).length, 0, originalUrl);
  }
});

test('a parent relationship cannot join distinct known DeviantArt artwork IDs', () => {
  const items = [
    work('danbooru', 740001, 'https://www.deviantart.com/neutral-artist/art/First-900004'),
    work('danbooru', 740002, 'https://www.deviantart.com/neutral-artist/art/Second-900005')
  ].map(item => ({ ...item, groupKey: 'danbooru:parent:740000' }));
  assert.equal(logic.groupWorks(items).length, 2);
  assert.equal(logic.hideViewedWorks([items[1]], new Set(logic.workHistoryTokens(items[0]))).length, 1,
    'a different confirmed publication is not considered viewed through the shared parent');
});

test('an exact file copy can retain conflicting DeviantArt source attribution without losing the file', () => {
  const items = [
    work('danbooru', 750001, 'https://www.deviantart.com/neutral-artist/art/First-900006'),
    work('gelbooru', 750002, 'https://www.deviantart.com/neutral-artist/art/Second-900007')
  ].map(item => ({ ...item, contentHash: 'a'.repeat(32) }));
  const groups = logic.groupWorks(items);
  assert.equal(groups.length, 1, 'exact byte identity is stronger evidence than a bad source attribution');
  assert.equal(groups[0].images.length, 1);
  assert.deepEqual(keys(groups), new Set(items.map(item => item.key)));
});

const sceneWork = (source, id, hash, publication = '', extra = {}) => work(source, id, publication, {
  uploaderId: 'neutral_uploader', rating: 'g', published: '2026-11-01T12:00:00Z',
  tags: Array.from({ length: 40 }, (_, index) => `neutral_detail_${index}`),
  contentHash: hash, visualHash: '0123456789abcdef',
  visualPHash: '0123456789abcdef', visualAspectRatio: 1, ...extra
});
const sceneMirrors = () => [
  sceneWork('sankaku', 'opaqueA', 'a'.repeat(32)),
  sceneWork('sankaku', 'opaqueB', 'b'.repeat(32), '', {
    published: '2026-11-01T12:00:10Z',
    visualHash: 'fedcba9876543210', visualPHash: 'fedcba9876543210'
  }),
  sceneWork('danbooru', 800001, 'a'.repeat(32), 'https://www.pixiv.net/artworks/900008'),
  sceneWork('danbooru', 800002, 'b'.repeat(32), 'https://www.pixiv.net/artworks/900009', {
    visualHash: 'fedcba9876543210', visualPHash: 'fedcba9876543210'
  })
];

test('a scene batch cannot bridge different known publications through exact-file mirrors', () => {
  for (const order of [[0, 1, 2, 3], [2, 0, 3, 1], [3, 1, 0, 2], [1, 3, 2, 0]]) {
    const raw = sceneMirrors(), items = order.map(index => raw[index]);
    const groups = logic.groupWorks(items);
    assert.equal(groups.length, 2, `source order ${order}`);
    assert.deepEqual(keys(groups), new Set(raw.map(item => item.key)));
    for (const group of groups) {
      assert.equal(group.images.length, 1, 'each exact-file component keeps its own gallery');
      assert.equal(group.memberKeys.length, 2);
    }
    const reloaded = logic.groupWorks(JSON.parse(JSON.stringify(groups)));
    assert.equal(reloaded.length, 2, 'publication boundaries survive JSON persistence');
  }
});

test('an unpublished compact scene batch still groups and preserves each distinct frame', () => {
  const items = sceneMirrors().slice(0, 2);
  const grouped = logic.groupWorks(items);
  assert.equal(grouped.length, 1);
  assert.equal(grouped[0].images.length, 2, 'scene grouping must not deduplicate different frames');
  assert.deepEqual(keys(grouped), new Set(items.map(item => item.key)));
});

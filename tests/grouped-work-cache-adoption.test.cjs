'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const Logic = require('../wwwroot/catalog-logic.js');
const work = (id, more = {}) => ({ key: `danbooru:${id}`, source: 'danbooru', id: String(id),
  title: `Neutral artwork ${id}`, rating: 'g', creatorTag: `fixture_artist_${id}`,
  tags: ['forest'], characterTags: [], images: [`https://example.test/neutral-${id}.jpg`],
  contentHash: id.toString(16).padStart(32, '0'), ...more });
function fixture() {
  const items = [work(1), work(2, { contentHash: '1'.padStart(32, '0') }), work(3)];
  return { items, grouped: Logic.groupWorks(structuredClone(items)) };
}

for (const [name, corrupt] of [
  ['a non-array reply', () => ({ items: [] })],
  ['a null row', rows => [null, ...rows.slice(1)]],
  ['a missing member-key array', rows => rows.map((row, index) => index ? row : { ...row, memberKeys: undefined })],
  ['a foreign primary key', rows => rows.map((row, index) => index ? row : { ...row, key: 'rule34:999' })],
  ['a foreign member key', rows => rows.map((row, index) => index ? row : { ...row, memberKeys: [...row.memberKeys, 'rule34:999'] })],
  ['an omitted work', rows => rows.slice(0, 1)],
  ['an omitted grouped member', rows => rows.map((row, index) => index ? row : { ...row, memberKeys: [row.key] })]
]) test(`worker grouping cache rejects ${name} without seeding the ordinary grouping path`, () => {
  const { items, grouped } = fixture(), before = JSON.stringify(items), reply = corrupt(grouped);
  assert.equal(Logic.cacheGroupedWorks(items, reply), null);
  const actual = Logic.groupWorks(items);
  assert.notEqual(actual, reply);
  assert.deepEqual(actual, Logic.groupWorks(structuredClone(items)));
  assert.equal(JSON.stringify(items), before);
});

test('a valid worker grouping is reused exactly and explicit input invalidation recomputes learned metadata', () => {
  const { items, grouped } = fixture();
  assert.equal(Logic.cacheGroupedWorks(items, grouped), grouped);
  assert.equal(Logic.groupWorks(items), grouped);
  items[2].tags = ['learned_landscape'];
  Logic.invalidateGrouping(items);
  const next = Logic.groupWorks(items);
  assert.notEqual(next, grouped);
  assert.deepEqual(next, Logic.groupWorks(structuredClone(items)));
  assert(next.find(item => item.key === 'danbooru:3').allTags.includes('learned_landscape'));
});

test('filtered grouped views retain their records without scanning metadata again', () => {
  const items = Array.from({ length: 2400 }, (_, i) => work(100 + i));
  const grouped = Logic.groupWorks(items);
  const view = grouped.filter((_, i) => i % 2);
  let reads = 0;
  for (const item of view) {
    const tags = item.tags;
    Object.defineProperty(item, 'tags', { configurable: true, get() { reads++; return tags; } });
  }
  assert.equal(Logic.groupWorks(view), view);
  assert.equal(reads, 0, 'A verified filtered view must not rebuild grouping evidence');
  // One repeated object in a new input is still a duplicate, not a grouped view.
  assert.equal(Logic.groupWorks([view[0], view[0]]).length, 1);
});

test('learned identities invalidate filtered grouped views before they are reused', () => {
  const grouped = Logic.groupWorks([work(300), work(301), work(302)]);
  const view = grouped.slice(0, 2);
  assert.equal(Logic.groupWorks(view), view);
  view[1].contentHash = view[0].contentHash;
  Logic.invalidateGrouping([view[1]]);
  const next = Logic.groupWorks(view);
  assert.notEqual(next, view);
  assert.equal(next.length, 1);
  assert.deepEqual(new Set(next[0].memberKeys), new Set(view.map(item => item.key)));
});

test('a worker batch adopted onto itself recomputes after a member learns an identity', () => {
  const grouped = Logic.groupWorks([work(400), work(401)]);
  Logic.cacheGroupedWorks(grouped, grouped);
  assert.equal(Logic.groupWorks(grouped), grouped);
  grouped[1].contentHash = grouped[0].contentHash;
  Logic.invalidateGrouping([grouped[1]]);
  const next = Logic.groupWorks(grouped);
  assert.equal(next.length, 1);
  assert.deepEqual(next, Logic.groupWorks(structuredClone(grouped)));
});

test('a cached earlier publication follows child invalidation after its prefix is adopted', () => {
  const earlier = Logic.groupWorks([work(500), work(501)]);
  Logic.cacheGroupedWorks(earlier, earlier);
  const later = [...earlier, ...Logic.groupWorks([work(502)])];
  Logic.cacheGroupedWorks(later, later);
  later[1].contentHash = later[0].contentHash;
  Logic.invalidateGrouping([later[1]]);
  const refreshed = Logic.groupWorks(earlier);
  assert.equal(refreshed.length, 1);
  assert.deepEqual(refreshed, Logic.groupWorks(structuredClone(earlier)));
});

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

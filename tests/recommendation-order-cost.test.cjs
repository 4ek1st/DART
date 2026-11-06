'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const logic = require(process.env.DART_RECOMMENDATION_ORDER_MODULE || '../wwwroot/catalog-logic.js');
const detailTags = Array.from({ length: 24 }, (_, index) => 'detail_' + String(index).padStart(2, '0'));
const works = count => Array.from({ length: count }, (_, index) => ({
  key: 'danbooru:' + (1000 + index), id: String(1000 + index), source: 'danbooru',
  creatorTag: 'fixture_artist_' + index % 12, published: '2026-11-01T00:00:00Z', rating: 'g',
  tags: index % 2 ? [...detailTags].reverse() : [...detailTags], images: []
}));

test('combination collation work follows the distinct interests instead of repeating for every liked artwork', () => {
  const calls = [];
  for (const size of [120, 480]) {
    let count = 0;
    const original = String.prototype.localeCompare;
    String.prototype.localeCompare = function (...args) { count++; return original.apply(this, args); };
    try {
      const result = logic.recommendationQueryGroups(works(size));
      assert.equal(result.other.length, detailTags.length);
      assert.deepEqual(result.combinations, [], 'ubiquitous co-occurrence must not create false associations');
    } finally { String.prototype.localeCompare = original; }
    calls.push(count);
  }
  assert(calls[1] <= calls[0] + 100,
    `four times as many records repeated collation: ${calls[0]} versus ${calls[1]} calls`);
});

test('equal collation ranks preserve each record order at the twenty-interest combination boundary', () => {
  const liked = [
    ...Array.from({ length: 12 }, (_, index) => ({
      key: 'danbooru:' + (2000 + index), source: 'danbooru', creatorTag: 'fixture_artist_' + index,
      tags: [...detailTags.slice(index), ...detailTags.slice(0, index)]
    })),
    ...Array.from({ length: 100 }, (_, index) => ({
      key: 'danbooru:' + (3000 + index), source: 'danbooru', creatorTag: 'fixture_background_' + index,
      tags: ['scenery']
    }))
  ];
  const before = JSON.stringify(liked), original = String.prototype.localeCompare;
  String.prototype.localeCompare = () => 0;
  try {
    const result = logic.recommendationCombinations(liked);
    assert.equal(result.length, 256);
    assert.deepEqual(result[0].tags, ['detail 00', 'detail 02']);
    assert.equal(result[0].count, 6);
    assert.equal(result.at(-1).count, 12);
    // Frozen pre-optimization output under an equal collator covers every
    // selected pair, spelling, count, support and weight, not only its order.
    assert.equal(crypto.createHash('sha256').update(JSON.stringify(result)).digest('hex'),
      '97f8f014cea0ca5a582f3bdb4ddb6fd03e6941e57f41491a9f5bda47791e7c67');
    assert.equal(JSON.stringify(liked), before, 'ranking must not sort saved tags in place');
  } finally { String.prototype.localeCompare = original; }
});

test('works without upload-batch eligibility retain their groups without constructing batch tag maps', () => {
  let maps = 0;
  const tags = new Proxy(['detail_a', 'detail_b'], { get(target, property, receiver) {
    if (property === 'map') return function (...args) { maps++; return Array.prototype.map.apply(target, args); };
    return Reflect.get(target, property, receiver);
  } });
  const items = works(32).map(item => ({ ...item, tags }));
  const grouped = logic.groupWorks(items);
  assert.equal(grouped.length, items.length);
  for (let index = 0; index < grouped.length; index++) {
    assert.equal(grouped[index].key, items[index].key);
    assert.deepEqual(grouped[index].memberKeys, [items[index].key]);
    assert.deepEqual(grouped[index].allTags, ['detail_a', 'detail_b']);
  }
  assert.equal(maps, 0, 'an absent uploader cannot enter upload-batch inference');
});

'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../wwwroot/catalog-logic.js'), 'utf8');
const work = id => ({ key: `danbooru:${id}`, source: 'danbooru', id: String(id),
  title: `Neutral work ${id}`, creatorTag: `neutral_artist_${id % 120}`, rating: 'g',
  tags: ['forest', 'landscape', `scene_${id % 24}`],
  images: [`https://fixture.test/${id}.jpg`], contentHash: id.toString(16).padStart(32, '0') });
function fixture() {
  const context = vm.createContext({ URL, TextEncoder, sizes: [] });
  vm.runInContext(source.replace('function groupWorks(items) {',
    'function groupWorks(items) { globalThis.sizes.push(items?.length || 0);'), context);
  return { logic: context.CatalogLogic, sizes: context.sizes };
}
const plain = value => JSON.parse(JSON.stringify(value));

test('a whole visible route with one detail delta regroups only its creator/identity component', () => {
  const { logic, sizes } = fixture();
  const previous = Array.from(logic.groupWorks(Array.from({ length: 1920 }, (_, i) => work(i + 1))));
  const changed = { ...previous[7], tags: [...previous[7].tags, 'learned_detail'] };
  const incoming = previous.map(item => item.key === changed.key ? changed : item);
  sizes.length = 0;
  const actual = logic.mergeGroupedWorks(previous, incoming);
  assert(sizes.length && Math.max(...sizes) <= 33,
    `A one-work delta regrouped ${Array.from(sizes)} records instead of its bounded creator component`);
  assert.strictEqual(actual[0], previous[0], 'unrelated immutable records keep their metadata caches');
  assert(actual.find(item => item.key === changed.key).allTags.includes('learned_detail'));
  const expected = logic.groupWorks(structuredClone([...previous, ...incoming]));
  assert.deepEqual(plain(actual), plain(expected));
});

test('mixed new pages still discover aliases/variants while reusing unchanged visible records', () => {
  const { logic, sizes } = fixture();
  const previous = Array.from(logic.groupWorks(Array.from({ length: 480 }, (_, i) => work(i + 1))));
  const mirror = { ...work(2000), key: 'gelbooru:2000', source: 'gelbooru', contentHash: previous[4].contentHash };
  const incoming = [...previous, mirror, work(2001)];
  sizes.length = 0;
  const actual = logic.mergeGroupedWorks(previous, incoming);
  assert(Math.max(...sizes) < 40);
  const merged = actual.find(item => item.memberKeys.includes(mirror.key));
  assert(merged.memberKeys.includes(previous[4].key));
  assert.equal(actual.length, previous.length + 1);
  assert.deepEqual(plain(actual), plain(logic.groupWorks(structuredClone([...previous, ...incoming]))));
});

test('explicitly invalidated in-place evidence cannot be discarded as an unchanged route reference', () => {
  const { logic } = fixture();
  const previous = Array.from(logic.groupWorks([work(1), work(2), work(3)]));
  previous[1].contentHash = previous[0].contentHash;
  logic.invalidateGrouping([previous[1]]);
  const actual = logic.mergeGroupedWorks(previous, [...previous, work(4)]);
  assert.equal(actual.length, 3);
  assert(actual.some(item => item.memberKeys.includes(previous[0].key) && item.memberKeys.includes(previous[1].key)));
  assert.deepEqual(plain(actual), plain(logic.groupWorks(structuredClone([...previous, work(4)]))));
});

test('one enriched thumbnail invalidates canonical grouping without regrouping every unchanged route record', () => {
  const { logic, sizes } = fixture();
  const previous = Array.from(logic.groupWorks(Array.from({ length: 1920 }, (_, i) => work(i + 1))));
  previous[7].visualHash = 'aaaaaaaaaaaaaaaa';
  logic.invalidateGrouping([previous[7]]);
  sizes.length = 0;
  const actual = logic.mergeGroupedWorks(previous, previous.slice());
  assert(sizes.length && Math.max(...sizes) <= 33,
    `A single-record invalidation regrouped ${Array.from(sizes)} records`);
  assert.strictEqual(actual[0], previous[0]);
  assert.equal(actual[7].visualHash, 'aaaaaaaaaaaaaaaa');
  assert.deepEqual(plain(actual), plain(logic.groupWorks(structuredClone(previous))));
});

test('a sparse new page cannot regroup the whole archive merely by sharing artist names', () => {
  const { logic, sizes } = fixture();
  const previous = logic.groupWorks(Array.from({ length: 1800 }, (_, i) => work(i + 1)));
  const incoming = Array.from({ length: 120 }, (_, i) => work(i + 2000));
  sizes.length = 0;
  const actual = logic.mergeGroupedWorks(previous, incoming);
  assert.equal(Math.max(...sizes), incoming.length);
  assert.strictEqual(actual[0], previous[0]);
  assert.deepEqual(plain(actual), plain(logic.groupWorks(structuredClone([...previous, ...incoming]))));
});

test('invalidating a registered raw origin remains conservative for every derived output record', () => {
  const { logic, sizes } = fixture();
  const raw = Array.from({ length: 96 }, (_, i) => work(i + 1));
  const previous = Array.from(logic.groupWorks(raw));
  // The raw inputs differ from grouped output objects, so a whole-origin
  // invalidation must never be mistaken for an unchanged output-only subset.
  logic.invalidateGrouping(raw);
  sizes.length = 0;
  const actual = logic.mergeGroupedWorks(previous, previous.slice());
  assert(sizes.some(size => size >= previous.length));
  assert.deepEqual(plain(actual), plain(logic.groupWorks(structuredClone(previous))));
});

test('whole registered invalidation also invalidates a newer batch that adopted its prefix records', () => {
  const { logic, sizes } = fixture();
  const original = logic.groupWorks(Array.from({ length: 96 }, (_, i) => work(i + 1)));
  const extra = logic.groupWorks(Array.from({ length: 24 }, (_, i) => work(i + 1000)));
  const adopted = [...original, ...extra];
  assert.equal(logic.cacheGroupedWorks(adopted, adopted), adopted);
  logic.invalidateGrouping(original);
  sizes.length = 0;
  const actual = logic.mergeGroupedWorks(adopted, adopted.slice());
  assert(sizes.some(size => size >= adopted.length * 2),
    'Full invalidation must remain conservative for the rebranded prefix origin');
  assert.deepEqual(plain(actual), plain(logic.groupWorks(structuredClone(adopted))));
});

test('an arbitrary child subset of an adopted batch keeps unrelated records eligible for delta reuse', () => {
  const { logic, sizes } = fixture();
  const original = logic.groupWorks(Array.from({ length: 96 }, (_, i) => work(i + 1)));
  const extra = logic.groupWorks(Array.from({ length: 24 }, (_, i) => work(i + 1000)));
  const adopted = [...original, ...extra];
  logic.cacheGroupedWorks(adopted, adopted);
  adopted[7].visualHash = 'aaaaaaaaaaaaaaaa';
  logic.invalidateGrouping([adopted[7]]);
  sizes.length = 0;
  const actual = logic.mergeGroupedWorks(adopted, adopted.slice());
  assert(Math.max(...sizes) < 20);
  assert.strictEqual(actual[0], adopted[0]);
  assert.deepEqual(plain(actual), plain(logic.groupWorks(structuredClone(adopted))));
});

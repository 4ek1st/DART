const test = require('node:test');
const assert = require('node:assert/strict');
const logic = require('../wwwroot/catalog-logic.js');

const hash = '52c06dea46e56ae83824313d4af1711e';
const sources = ['danbooru', 'sankaku', 'rule34', 'gelbooru'];
const urls = [
  `https://cdn.donmai.us/sample/52/c0/sample-${hash}.jpg`,
  `https://s.sankakucomplex.com/data/52/c0/${hash}.png?e=1&m=signature`,
  `https://us-cdn.rule34.xxx/images/123/${hash}.png`,
  `https://img4.gelbooru.com/images/52/c0/${hash}.png`
];
const legacy = { key: 'danbooru:8363294', source: 'danbooru', contentHash: hash,
  images: urls, memberKeys: sources.map((source, index) => `${source}:${8363294 + index}`) };

test('old grouped saves with four catalog URLs render one identical file and retain all source links', () => {
  assert.deepEqual(logic.artworkMedia(legacy).images, [urls[0]]);
  const detail = logic.mergeDetailPages(legacy, { key: legacy.key, source: legacy.source,
    contentHash: hash, images: [urls[0]] });
  assert.deepEqual(detail.images, [urls[0]]);
  assert.equal(detail.imageRecords[0].hash, hash);
  assert.deepEqual(logic.workSources(detail).map(record => record.source).sort(), [...sources].sort());
  assert.equal(detail.groupCount, 1);
});

test('per-image hashes survive repeated detail hydration and metadata refresh', () => {
  const [grouped] = logic.groupWorks(sources.map((source, index) => ({ source,
    key: `${source}:100`, contentHash: hash, images: [`https://fixture.test/${source}.jpg`] })));
  const detail = { key: grouped.key, source: grouped.source, contentHash: hash,
    images: ['https://fixture.test/full-size.jpg'] };
  let current = logic.mergeDetailPages(grouped, detail);
  for (let index = 0; index < 3; index++) current = logic.mergeWorkMetadata(current,
    logic.mergeDetailPages(current, detail));
  assert.equal(current.images.length, 1);
  assert.equal(current.imageRecords[0].hash, hash);
  assert.equal(current.memberKeys.length, 4);
});

test('different variants and animation files survive even with the same group and visual fingerprint', () => {
  const variant = `https://cdn.donmai.us/original/${'a'.repeat(32)}.png`;
  const animation = `https://cdn.donmai.us/original/${'b'.repeat(32)}.webm`;
  const [grouped] = logic.groupWorks([{ ...legacy, images: [...urls, variant, animation],
    groupKey: 'shared-post', visualHash: 'abcde123456789ab' }]);
  assert.deepEqual(grouped.images, [urls[0], variant, animation]);
  const reopened = logic.mergeDetailPages(grouped, { key: grouped.key, source: grouped.source,
    contentHash: hash, images: [urls[0]] });
  assert.deepEqual(reopened.images, grouped.images);
});

test('only known CDN hash filenames or explicit per-image hashes identify files', () => {
  const unknown = ['https://one.test/image.jpg', 'https://two.test/image.jpg',
    `https://cdn.donmai.us.evil.test/${hash}.jpg`, `https://elsewhere.test/${hash}.jpg`];
  assert.deepEqual(logic.artworkMedia({ images: unknown, contentHash: hash }).images, unknown);
  const cropped = `https://s.sankakucomplex.com/${hash}.jpg?width=300`;
  const signed = `https://s.sankakucomplex.com/opaque.jpg?e=1&m=old`;
  assert.equal(logic.artworkMedia({ images: [signed, signed.replace('e=1&m=old', 'e=2&m=new')] }).images.length, 1);
  assert.equal(logic.artworkMedia({ images: [cropped, unknown[0]], imageRecords: [
    { url: cropped, hash: 'invalid' }, { url: unknown[0], hash: 'invalid' }] }).images.length, 2);
});

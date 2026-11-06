'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const logic = require('../wwwroot/catalog-logic.js');

function randomHashes(seed) {
  let value = seed >>> 0;
  const next = () => { value ^= value << 13; value ^= value >>> 17; value ^= value << 5; return value >>> 0; };
  return () => next().toString(16).padStart(8, '0') + next().toString(16).padStart(8, '0');
}
function video(id, frames, duration = 20.49) {
  const url = `https://fixture.test/cost-${id}.mp4`;
  return { key: `gelbooru:${id}`, source: 'gelbooru', id: String(id), creatorTag: 'neutral_animator',
    uploaderId: 'neutral_uploader', tags: Array.from({ length: 24 }, (_, index) => `neutral_tag_${index}`),
    characterTags: ['neutral_character'], originalUrl: `https://x.com/neutral/status/${90000000 + id}`,
    images: [url], videoSamples: [{ url, duration, aspectRatio: 16 / 9, frames }] };
}
function frames(seed) {
  const next = randomHashes(seed);
  return Array.from({ length: 5 }, () => ({ hash: next(), perceptualHash: next() }));
}

test('one thousand unrelated videos by one creator do not examine every frame pair', () => {
  let hashReads = 0;
  const next = randomHashes(0x64a381d7);
  const items = Array.from({ length: 1000 }, (_, index) => {
    const samples = Array.from({ length: 5 }, () => {
      const hash = next(), frame = { perceptualHash: next() };
      Object.defineProperty(frame, 'hash', { enumerable: true, get() { hashReads++; return hash; } });
      return frame;
    });
    return video(100000 + index, samples);
  });
  const grouped = logic.groupWorks(items);
  assert.equal(grouped.length, items.length);
  assert(hashReads < 100000,
    `candidate matching must be indexed before frame comparisons; observed ${hashReads} frame-hash reads`);
});

test('four matching frames still find a version when its first anchor frame changes', () => {
  const original = frames(0x8712a93c), modified = structuredClone(original);
  modified[0] = { hash: 'ffffffff00000000', perceptualHash: '00000000ffffffff' };
  for (const reverse of [false, true]) {
    const items = [video(200001, structuredClone(original)), video(200002, structuredClone(modified), 20.51)];
    if (reverse) items.reverse();
    const result = logic.groupWorks(items);
    assert.equal(result.length, 1);
    assert.equal(result[0].images.length, 2);
    assert.deepEqual(new Set(result[0].memberKeys), new Set(items.map(item => item.key)));
  }
});

test('the index admits six changed hash bits spread across six byte bands', () => {
  const original = frames(0x29107c54), modified = structuredClone(original);
  modified[0] = { hash: 'ffffffff00000000', perceptualHash: '00000000ffffffff' };
  for (let index = 1; index < 5; index++)
    modified[index].hash = (BigInt('0x' + modified[index].hash) ^ 0x0101010101010000n).toString(16).padStart(16, '0');
  for (const reverse of [false, true]) {
    const items = [video(210001, structuredClone(original)), video(210002, structuredClone(modified))];
    if (reverse) items.reverse();
    assert.equal(logic.groupWorks(items).length, 1);
  }
});

test('candidate duration neighbors retain the exact duration tolerance', () => {
  const base = frames(0x9216de34);
  assert.equal(logic.groupWorks([video(220001, structuredClone(base), 20.49),
    video(220002, structuredClone(base), 20.51)]).length, 1);
  assert.equal(logic.groupWorks([video(220003, structuredClone(base), 20.49),
    video(220004, structuredClone(base), 20.81)]).length, 2);
});

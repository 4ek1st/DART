'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const { create } = require('../wwwroot/fingerprint-cache.js');
const CatalogLogic = require('../wwwroot/catalog-logic.js');
const url = number => `https://cdn.donmai.us/neutral-${number}.jpg`;
const image = (changes = {}) => ({ hash: '0123456789ABCDEF', perceptualHash: 'FEDCBA9876543210',
  aspectRatio: 1.5, layout: 'vl1:00112233', ...changes });
const video = (key, changes = {}) => ({ url: key, duration: 12.5, aspectRatio: 1.5,
  frames: Array.from({ length: 5 }, (_, index) => ({ hash: String(index).repeat(16),
    perceptualHash: String(index + 1).repeat(16) })), ...changes });

test('image and five-frame video evidence round-trip without retaining pixels, blobs or catalog records', () => {
  const cache = create(), clip = 'https://cdn.donmai.us/neutral.mp4';
  cache.images.set(url(1), image({ pixels: [1, 2, 3], blob: { size: 100 }, title: 'private metadata' }));
  cache.videos.set(clip, video(clip, { item: { title: 'private metadata' } }));
  const saved = cache.snapshot();
  assert.equal(saved.images.length, 1); assert.equal(saved.videos.length, 1);
  assert.deepEqual(Object.keys(saved.images[0][1]).sort(), ['aspectRatio', 'hash', 'layout', 'perceptualHash']);
  assert.deepEqual(Object.keys(saved.videos[0][1]).sort(), ['aspectRatio', 'duration', 'frames', 'url']);
  const restored = create(); restored.restore(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(restored.snapshot(), saved);
  assert.equal(restored.images.get(url(1)).hash, '0123456789abcdef');
  assert.equal(restored.videos.get(clip).frames[4].perceptualHash, '5555555555555555');
  assert.equal(JSON.stringify(saved).includes('private metadata'), false);
});

test('bounded Maps retain the most recently used images and video entries', () => {
  const cache = create();
  for (let index = 0; index < 512; index++) cache.images.set(url(index), image());
  cache.images.get(url(0)); cache.images.set(url(512), image());
  assert.equal(cache.images.size, 512); assert(cache.images.has(url(0))); assert(!cache.images.has(url(1)));
  for (let index = 0; index < 65; index++) { const key = `https://cdn.donmai.us/clip-${index}.mp4`; cache.videos.set(key, video(key)); }
  assert.equal(cache.videos.size, 64); assert(!cache.videos.has('https://cdn.donmai.us/clip-0.mp4'));
  assert.equal(cache.videos.delete('https://cdn.donmai.us/clip-1.mp4'), true);
  cache.videos.clear(); assert.equal(cache.snapshot().videos.length, 0);
});

test('one shared byte limit bounds worst-case long keys and layouts below 500KB', () => {
  const cache = create();
  for (let index = 0; index < 900; index++) cache.images.set(`https://cdn.donmai.us/${'x'.repeat(850)}-${index}.jpg`, image({ layout: 'vl1:' + 'a'.repeat(1020) }));
  for (let index = 0; index < 100; index++) { const key = `https://cdn.donmai.us/${'v'.repeat(850)}-${index}.mp4`; cache.videos.set(key, video(key)); }
  const snapshot = cache.snapshot();
  assert(Buffer.byteLength(JSON.stringify(snapshot)) < 500000);
  assert(snapshot.images.length <= 512); assert(snapshot.videos.length <= 64);
  assert.deepEqual(cache.snapshot(), snapshot, 'an unchanged cache serializes deterministically');
});

test('canonical owner removes signed credentials, and residual query strings never persist', () => {
  const cache = create({ cacheKey: CatalogLogic.mediaCacheKey });
  const signed = 'https://v.sankakucomplex.com/o/ab/cd/0123456789abcdef0123456789abcdef.mp4?e=10&m=secret&expires=20&token=private';
  const canonical = CatalogLogic.mediaCacheKey(signed);
  cache.videos.set(signed, video(signed));
  assert.equal(cache.videos.size, 1); assert.equal(cache.videos.get(canonical).url, canonical);
  const text = JSON.stringify(cache.snapshot()); assert(!text.includes('secret')); assert(!text.includes('private')); assert(!text.includes('?'));
  for (const key of [url(1) + '?token=private', url(1) + '?width=100', 'http://cdn.donmai.us/a.jpg',
    'https://user:password@cdn.donmai.us/a.jpg', url(1) + '#fragment', 'blob:private', 'data:image/png;base64,secret',
    'https://cdn.donmai.us/' + 'x'.repeat(1000)]) cache.images.set(key, image());
  assert.equal(cache.images.size, 0);
});

test('malformed evidence, cross-media video ownership and same-size poisoned restores are rejected', () => {
  const cache = create();
  for (const change of [{ hash: 'bad' }, { perceptualHash: '' }, { aspectRatio: 0 }, { aspectRatio: Infinity },
    { layout: 'other:format' }, { layout: 'vl1:' + 'a'.repeat(1021) }, { layout: 'vl1:\u0000' }]) cache.images.set(url(1), image(change));
  assert.equal(cache.images.size, 0);
  const key = 'https://cdn.donmai.us/clip.mp4';
  for (const change of [{ duration: 0.1 }, { duration: 43201 }, { duration: Infinity }, { aspectRatio: NaN },
    { frames: [] }, { frames: video(key).frames.slice(0, 4) }, { url: key + '.other' },
    { frames: Array(5).fill({ hash: 'bad', perceptualHash: '0123456789abcdef' }) }]) cache.videos.set(key, video(key, change));
  assert.equal(cache.videos.size, 0);
  cache.restore({ images: [[url(1), image()]], videos: [[key, video(key)]] });
  assert.equal(cache.images.size, 1); assert.equal(cache.videos.size, 1);
  cache.restore({ images: [[url(1), image({ hash: 'invalid' })]], videos: [[key, video(key, { duration: NaN })]] });
  assert.equal(cache.images.size, 0); assert.equal(cache.videos.size, 0);
  cache.restore({ images: [null, ['malformed'], [url(2), image()]], videos: 'not an array' });
  assert.equal(cache.images.size, 1); assert.equal(cache.videos.size, 0);
});

test('stored evidence cannot be mutated through an input, returned value or snapshot reference', () => {
  const cache = create(), key = 'https://cdn.donmai.us/clip.mp4', original = video(key);
  cache.videos.set(key, original); original.frames[0].hash = 'f'.repeat(16);
  assert.equal(cache.videos.get(key).frames[0].hash, '0'.repeat(16));
  assert.throws(() => { cache.videos.get(key).duration = 0; }, TypeError);
  assert.throws(() => { cache.snapshot().videos[0][1].frames[0].hash = 'bad'; }, TypeError);
  assert.equal(cache.videos.get(key).duration, 12.5);
});

test('browser script exposes the same bounded cache without a CommonJS loader', () => {
  const context = { URL }; vm.runInNewContext(fs.readFileSync(require.resolve('../wwwroot/fingerprint-cache.js'), 'utf8'), context);
  const cache = context.DartFingerprintCache.create(); cache.images.set(url(1), image());
  assert.equal(cache.snapshot().images.length, 1);
});

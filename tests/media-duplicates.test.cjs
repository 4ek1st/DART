const test = require('node:test');
const assert = require('node:assert/strict');
const { isStaticRaster, sameImagePixels, createDuplicateIndex, uniqueImages } = require('../wwwroot/media-duplicates.js');
const sample = () => ({ width: 850, height: 1133,
  pixels: Uint8ClampedArray.from({ length: 128 * 128 * 4 }, (_, i) => i % 4 === 3 ? 255 : 100) });
test('decoded image comparison accepts small compression noise and proportional resizing', () => {
  const left = sample(), right = sample();
  right.width *= 2; right.height *= 2;
  for (let i = 0; i < right.pixels.length; i++) if (i % 4 !== 3) right.pixels[i] += i % 2;
  assert.equal(sameImagePixels(left, right), true);
});
test('local edits, different colors, transparency and different crops stay separate', () => {
  const left = sample();
  let right = sample(); right.pixels.fill(120, 0, 4 * 64);
  assert.equal(sameImagePixels(left, right), false);
  right = sample();
  for (let i = 0; i < right.pixels.length; i++) if (i % 4 !== 3) right.pixels[i] += 3;
  assert.equal(sameImagePixels(left, right), false);
  right = sample(); right.pixels[3] = 100;
  assert.equal(sameImagePixels(left, right), false);
  right = sample(); right.width = 800;
  assert.equal(sameImagePixels(left, right), false);
  assert.equal(sameImagePixels(left, null), false);
});
test('animated and unrecognized image containers cannot be collapsed by their first frame', () => {
  assert.equal(isStaticRaster(Buffer.from([255, 216, 255, 224])), true);
  assert.equal(isStaticRaster(Buffer.from('GIF89a')), false);
  const png = Buffer.concat([Buffer.from([137]), Buffer.from('PNG\r\n\x1a\n'),
    Buffer.from([0, 0, 0, 0]), Buffer.from('IDAT')]);
  assert.equal(isStaticRaster(png), true);
  const apng = Buffer.from(png); apng.write('acTL', 12);
  assert.equal(isStaticRaster(apng), false);
  const webp = Buffer.alloc(30); webp.write('RIFF'); webp.write('WEBPVP8X', 8);
  webp[20] = 2; assert.equal(isStaticRaster(webp), false);
  webp[20] = 0; assert.equal(isStaticRaster(webp), true);
  assert.equal(isStaticRaster(Buffer.alloc(3)), false);
});

test('gallery and card counts retain two unique images from four mirrors after fingerprint eviction and restart', () => {
  const urls = ['a', 'b', 'c', 'd'].map(name => 'https://example.test/' + name + '.png');
  const first = sample(), second = sample();
  for (let i = 0; i < second.pixels.length; i++) if (i % 4 !== 3) second.pixels[i] += 30;
  const signatures = new Map([[urls[0], first], [urls[1], second], [urls[2], first], [urls[3], second]]);
  const index = createDuplicateIndex();
  assert.deepEqual(uniqueImages(urls, index, url => url, url => signatures.get(url)), urls.slice(0, 2));
  assert.equal(index.entries().length, 2);
  signatures.clear();
  assert.equal(uniqueImages(urls, index, url => url, () => null).length, 2);
  const restored = createDuplicateIndex(JSON.parse(JSON.stringify(index.entries())));
  assert.equal(uniqueImages([...urls].reverse(), restored, url => url, () => null).length, 2);
  assert.equal(uniqueImages([...urls, 'https://example.test/new.png'], restored, url => url, () => null).length, 3,
    'a new variant must increase the count instead of reusing a cached number');
  const video = 'https://example.test/animation.webm';
  assert.equal(uniqueImages([...urls, video], restored, url => url, () => null).length, 3);
});

test('duplicate relationships restore safely and do not equate uninspected images', () => {
  const a = 'https://example.test/a.png', b = 'https://example.test/b.png';
  const index = createDuplicateIndex([[a, b], [b, a], ['bad', b], null, { key: 'invalid' }]);
  assert.equal(index.resolve(a), index.resolve(b));
  assert.equal(index.entries().length, 1);
  assert.equal(uniqueImages([a, b, 'https://example.test/c.png'], index, url => url, () => null).length, 2);
});

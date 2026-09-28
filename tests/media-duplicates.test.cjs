const test = require('node:test');
const assert = require('node:assert/strict');
const { isStaticRaster, sameImagePixels } = require('../wwwroot/media-duplicates.js');
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

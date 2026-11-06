'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const modulePath = path.join(__dirname, '../wwwroot/visual-layout.js');
const layout = fs.existsSync(modulePath) ? require(modulePath) : null;

function picture({ clothing = false, pose = false, shift = 0, palette = false } = {}) {
  const pixels = new Uint8ClampedArray(32 * 32 * 4);
  const background = [224, 227, 231];
  for (let offset = 0; offset < pixels.length; offset += 4) pixels.set([...background, 255], offset);
  const rect = (x, y, width, height, color, pattern = 0) => {
    for (let row = Math.max(0, y); row < Math.min(32, y + height); row++)
      for (let column = Math.max(0, x + shift); column < Math.min(32, x + shift + width); column++) {
        const offset = (row * 32 + column) * 4;
        const contrast = pattern && (column + row * 3) % pattern === 0 ? 30 : 0;
        pixels.set([...color.map(value => Math.max(0, Math.min(255, value + contrast))), 255], offset);
      }
  };
  // A neutral illustration with distributed structural landmarks and a flat background.
  rect(10, 1, 12, 3, [30, 38, 52], 3);
  rect(12, 4, 8, 6, [170, 132, 91], 4);
  rect(12, 6, 2, 1, [20, 25, 30]); rect(18, 6, 2, 1, [20, 25, 30]);
  rect(15, 8, 3, 1, [65, 35, 35]);
  rect(8, 10, 16, 14, clothing ? [30, 85, 155] : [170, 132, 91], clothing ? 2 : 0);
  rect(8, 10, 2, 14, [45, 55, 65]); rect(22, 10, 2, 14, [45, 55, 65]);
  rect(pose ? 0 : 3, pose ? 3 : 12, 5, 10, [170, 132, 91], 3);
  rect(pose ? 26 : 24, pose ? 1 : 11, 5, 10, [170, 132, 91], 4);
  rect(9, 24, 6, 8, [55, 65, 75], 3); rect(18, 24, 6, 8, [55, 65, 75], 4);
  if (palette) for (let offset = 0; offset < pixels.length; offset += 4)
    for (let channel = 0; channel < 3; channel++) pixels[offset + channel] = 255 - pixels[offset + channel];
  return pixels;
}

test('a shared browser and Node regional verifier is available', () => {
  assert(layout, 'visual-layout.js must exist');
  assert.equal(typeof layout.fingerprint, 'function');
  assert.equal(typeof layout.matches, 'function');
  const context = {};
  vm.runInNewContext(fs.readFileSync(modulePath, 'utf8'), context);
  assert.equal(typeof context.DartVisualLayout.fingerprint, 'function');
  assert.equal(typeof context.DartVisualLayout.matches, 'function');
});

test('regional evidence is deterministic, compact and does not mutate the source pixels', () => {
  assert(layout);
  const pixels = picture(), before = Uint8ClampedArray.from(pixels);
  const evidence = layout.fingerprint(pixels);
  assert.equal(typeof evidence, 'string'); assert(evidence.length > 0);
  assert(evidence.length < 1024, 'one artwork must not retain raw pixels');
  assert.equal(layout.fingerprint(pixels), evidence);
  assert.deepEqual(pixels, before);
});

test('distributed unchanged composition survives a changed clothing color and interior pattern', () => {
  assert(layout);
  assert(layout.matches(layout.fingerprint(picture()), layout.fingerprint(picture({ clothing: true }))));
});

test('a different pose on the same flat background fails even with an unchanged head and body palette', () => {
  assert(layout);
  assert.equal(layout.matches(layout.fingerprint(picture()), layout.fingerprint(picture({ pose: true }))), false);
});

function texturedScene(kind, size) {
  const pixels = new Uint8ClampedArray(32 * 32 * 4);
  let seed = 12345;
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    pixels.set([seed & 255, seed >>> 8 & 255, seed >>> 16 & 255, 255], (y * 32 + x) * 4);
  }
  // The same character may occupy a different small pose in front of a reused
  // detailed set. The surrounding texture must not outvote its changed shape.
  for (let y = 20; y < 20 + size; y++) for (let x = 20; x < 20 + size; x++)
    if (kind === 'upright' ? x < 23 || y < 23 : Math.abs(x - y) < 2)
      pixels.set(kind === 'upright' ? [255, 170, 80, 255] : [80, 170, 255, 255], (y * 32 + x) * 4);
  return pixels;
}

test('a repeated detailed background cannot outvote a changed small subject or pose', () => {
  assert(layout);
  for (const size of [4, 6, 8, 10, 12]) {
    const first = layout.fingerprint(texturedScene('upright', size));
    const second = layout.fingerprint(texturedScene('diagonal', size));
    assert(first && second, 'the fixture has informative distributed texture');
    assert.equal(layout.matches(first, second), false, `normal ${size}px changed subject`);
    assert.equal(layout.matches(first, second, { strict: true }), false, `strict ${size}px changed subject`);
    assert.equal(layout.matches(first, first, { strict: true }), true, 'unchanged detailed pictures remain valid');
  }
});

test('moving the same subject to a different composition cannot match the background', () => {
  assert(layout);
  assert.equal(layout.matches(layout.fingerprint(picture()), layout.fingerprint(picture({ shift: 7 }))), false);
});

test('unrelated RGB colors do not establish a version through matching luminance structure', () => {
  assert(layout);
  assert.equal(layout.matches(layout.fingerprint(picture()), layout.fingerprint(picture({ palette: true }))), false);
});

test('compression-sized pixel noise preserves strong evidence in strict mode', () => {
  assert(layout);
  const first = picture(), second = Uint8ClampedArray.from(first);
  for (let offset = 0; offset < second.length; offset += 4)
    for (let channel = 0; channel < 3; channel++) second[offset + channel] += (offset / 4 + channel) % 3 - 1;
  assert(layout.matches(layout.fingerprint(first), layout.fingerprint(second), { strict: true }));
});

test('blank images, smooth gradients and tiny corner details cannot prove composition', () => {
  assert(layout);
  const blank = new Uint8ClampedArray(32 * 32 * 4), gradient = new Uint8ClampedArray(blank.length);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const offset = (y * 32 + x) * 4;
    blank.set([180, 180, 180, 255], offset);
    gradient.set([x * 5 + y * 2, x * 4 + y, 40 + y * 5, 255], offset);
  }
  assert.equal(layout.fingerprint(blank), '');
  assert.equal(layout.fingerprint(gradient), '');
  const tiny = Uint8ClampedArray.from(blank);
  for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) tiny.set([x * 40, y * 40, 10, 255], (y * 32 + x) * 4);
  assert.equal(layout.fingerprint(tiny), '');
  assert.equal(layout.matches('', ''), false);
});

test('malformed, unsupported or truncated serialized evidence fails closed', () => {
  assert(layout);
  const valid = layout.fingerprint(picture());
  for (const invalid of [null, {}, [], 123, '', 'vl999:' + '0'.repeat(304), valid.slice(0, -1), valid + '0', valid.replace(/.$/, '!')]) {
    assert.equal(layout.matches(valid, invalid), false);
    assert.equal(layout.matches(invalid, valid), false);
  }
  for (const invalid of [null, [], new Uint8Array(32), { length: 32 * 32 * 4 }])
    assert.equal(layout.fingerprint(invalid), '');
});

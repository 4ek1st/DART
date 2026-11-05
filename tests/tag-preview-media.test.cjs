'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const app = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
function fixture({ read, decode = async () => {}, cached = {} } = {}) {
  let pins = 0, remembered = 0;
  const context = vm.createContext({ DOMException, imageLoader: {
    pin() { pins++; let released = false; return () => { if (!released) { released = true; pins--; } }; },
    cached: () => cached,
    rememberBlob() { remembered++; return { blobUrl: 'blob:neutral-preview' }; }, decode
  }, readMediaBlob: read || (async () => ({})) });
  const start = app.indexOf('async function loadTagPreviewImage(');
  vm.runInContext(app.slice(start, app.indexOf('\nfunction tagPreviewController(', start)), context);
  return { load: signal => context.loadTagPreviewImage({ thumbnail: 'https://example.test/neutral.jpg' }, signal),
    pins: () => pins, remembered: () => remembered };
}
test('closing a tag preview settles and releases its pin even if shared image decoding never finishes', async () => {
  const f = fixture({ decode: () => new Promise(() => {}) }), controller = new AbortController();
  const loading = f.load(controller.signal); assert.equal(f.pins(), 1); controller.abort();
  assert.equal(f.pins(), 0, 'cancelled image pins must release immediately');
  await assert.rejects(loading, { name: 'AbortError' });
});
test('an aborted image reply cannot populate the image cache or retain a pin', async () => {
  let finish;
  const f = fixture({ cached: null, read: () => new Promise(resolve => { finish = resolve; }) });
  const controller = new AbortController(), loading = f.load(controller.signal); controller.abort();
  finish({}); await assert.rejects(loading, { name: 'AbortError' });
  assert.equal(f.remembered(), 0); assert.equal(f.pins(), 0);
});
test('a ready preview keeps exactly one image pin until its consumer closes', async () => {
  const f = fixture({ cached: { blobUrl: 'blob:neutral-ready' } });
  const result = await f.load(new AbortController().signal);
  assert.equal(result.url, 'blob:neutral-ready'); assert.equal(f.pins(), 1);
  result.release(); result.release(); assert.equal(f.pins(), 0);
});

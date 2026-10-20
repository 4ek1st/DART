const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const CatalogLogic = require('../wwwroot/catalog-logic.js');
const { createController, createFrameCache } = require('../wwwroot/video-preview.js');
const source = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));

function block(startMarker, endMarker) {
  const start = source.indexOf(startMarker), end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, startMarker + ' is available');
  return source.slice(start, end);
}

for (const cancellation of ['deadline', 'consumer cancellation']) {
test(`artwork preparation ${cancellation} also releases a caller waiting for image decoding`, async t => {
  let finishDecode, decoding = false, completed = false, timeoutMs;
  const decodeGate = new Promise(resolve => { finishDecode = resolve; });
  const deadline = new AbortController();
  const consumer = new AbortController();
  const context = vm.createContext({
    CatalogLogic, AbortController,
    AbortSignal: { any: signals => AbortSignal.any(signals), timeout: ms => {
      timeoutMs = ms; return deadline.signal;
    } },
    URL: { createObjectURL: () => 'blob:prepared', revokeObjectURL() {} },
    Image: class { decode() { decoding = true; return decodeGate; } },
    IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} },
    main: { clientHeight: 900, querySelectorAll: () => [] },
    galleryImages: () => [], readMediaBlob: async () => ({ size: 10 })
  });
  const loader = vm.runInContext(block('const imageLoader = {', '\nconst autoFeed = {') + '\nimageLoader', context);
  context.imageLoader = loader;
  vm.runInContext(block('async function prepareArtworkMedia(', '\nasync function moveArtwork('), context);
  const item = { thumbnail: 'https://example.org/slow-decode.jpg' };
  const preparing = context.prepareArtworkMedia(item, consumer.signal);
  preparing.then(() => { completed = true; });
  t.after(async () => { finishDecode(); const release = await preparing; release?.(); });
  await tick();
  assert.equal(decoding, true);
  assert.equal(timeoutMs, 4500);

  if (cancellation === 'deadline') deadline.abort(new DOMException('Preparation deadline', 'TimeoutError'));
  else consumer.abort();
  await tick();

  assert.equal(completed, true, 'The bounded fallback must settle even when the browser decoder has not settled');
  assert.equal(loader.pinned.size, 0, 'Cancellation must release the cache pin before the decoder settles');
  const release = await preparing;
  assert.equal(typeof release, 'function', 'The navigation caller keeps the same release contract after cancellation');
  release?.();
  assert.equal(loader.pinned.size, 0, 'A timed-out transition must be able to release its cache pin');
});
}

class Events {
  listeners = new Map();
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
  emit(type, event) { for (const listener of this.listeners.get(type) || []) listener(event); }
}

function previewSurface() {
  const motion = new Events(); motion.matches = false;
  const win = new Events(); win.matchMedia = () => motion;
  const doc = new Events(); doc.defaultView = win; doc.hidden = false;
  const root = new Events(); root.ownerDocument = doc;
  root.contains = card => card?.isConnected === true;
  root.getBoundingClientRect = () => ({ top: 0, bottom: 900, left: 0, right: 1200 });
  const card = url => {
    const overlay = { hidden: true, removeAttribute(name) { delete this[name]; } };
    const classes = new Set();
    return { isConnected: true, dataset: { videoPreview: url }, overlay,
      classList: { add: name => classes.add(name), remove: name => classes.delete(name) },
      querySelector: () => overlay, closest() { return this; },
      contains(other) { return other === this; },
      getBoundingClientRect: () => ({ width: 200, height: 200, top: 20, bottom: 220, left: 20, right: 220 }) };
  };
  return { root, card,
    hover: target => root.emit('pointerover', { target, relatedTarget: null, pointerType: 'mouse' }) };
}

test('a late cached-frame decode failure from the previous card cannot stop the current hover preview', async t => {
  const ui = previewSurface();
  const cache = createFrameCache({ createUrl: blob => blob.url, revokeUrl() {} });
  const frames = prefix => ({ blobs: Array.from({ length: 5 }, (_, index) => ({
    size: 10, url: `blob:${prefix}-${index}`
  })), times: [1, 3, 5, 7, 9] });
  cache.put('previous.mp4', frames('previous'));
  cache.put('current.mp4', frames('current'));
  let failPrevious;
  const previousDecode = new Promise((_, reject) => { failPrevious = reject; });
  const controller = createController(ui.root, { cache, interval: 10000,
    decode: url => url.startsWith('blob:previous-') ? previousDecode : Promise.resolve() });
  t.after(() => controller.dispose());
  const previous = ui.card('previous.mp4'), current = ui.card('current.mp4');

  ui.hover(previous);
  ui.hover(current);
  await tick();
  assert.equal(current.overlay.hidden, false, 'The new hovered preview should already be playing');
  assert.equal(current.overlay.src, 'blob:current-0');

  failPrevious(new Error('The old cached frame could not decode'));
  await tick();

  assert.equal(current.overlay.hidden, false, 'A stale decode error must not hide an unrelated active preview');
  assert.equal(current.overlay.src, 'blob:current-0');
  assert.equal(previous.overlay.hidden, true);
});

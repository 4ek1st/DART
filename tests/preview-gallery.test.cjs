const test = require('node:test');
const assert = require('node:assert/strict');
const Gallery = require('../wwwroot/preview-gallery.js');

const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
test('gallery uses unique media identity, starts at explicitly selected page and has hard boundaries', async () => {
  const shown = [];
  const gallery = Gallery.create({ urls: ['a?token=1', 'b', 'a?token=2', 'c'], selected: 'b',
    key: url => url.split('?')[0], prepare: async url => url, show: value => shown.push(value) });
  assert.equal(gallery.state.length, 3); assert.equal(gallery.state.index, 1);
  await gallery.move(1); assert.equal(gallery.state.index, 2);
  await gallery.move(1); assert.deepEqual(shown, ['c']);
  await gallery.move(-1); await gallery.move(-1); await gallery.move(-1);
  assert.deepEqual(shown, ['c', 'b', 'a?token=1']); assert.equal(gallery.state.index, 0);
});
test('rapid page keys cancel stale decoding, keep current pixels and honor final desired position', async () => {
  const jobs = [], shown = [];
  const gallery = Gallery.create({ urls: ['a', 'b', 'c'], selected: 'a',
    prepare: (url, signal) => { const job = { url, signal, ...deferred() }; jobs.push(job); return job.promise; },
    show: value => shown.push(value) });
  const first = gallery.move(1), second = gallery.move(1);
  assert.equal(jobs[0].signal.aborted, true); assert.equal(gallery.state.index, 0); assert.equal(gallery.state.wanted, 2);
  jobs[1].resolve('c'); await second;
  jobs[0].resolve('b'); await first;
  assert.deepEqual(shown, ['c']); assert.equal(gallery.state.index, 2); assert.equal(gallery.state.busy, false);
});
test('failed media keeps current image, supports retry and lets the next page proceed', async () => {
  let fail = true; const shown = [];
  const gallery = Gallery.create({ urls: ['a', 'b', 'c'], prepare: async url => {
    if (url === 'b' && fail) throw Error('offline'); return url;
  }, show: value => shown.push(value) });
  await gallery.move(1); assert.equal(gallery.state.index, 0); assert.equal(gallery.state.error, true);
  fail = false; await gallery.retry(); assert.deepEqual(shown, ['b']);
  await gallery.move(-1); fail = true; await gallery.move(1); await gallery.move(1);
  assert.equal(gallery.state.index, 2); assert.deepEqual(shown, ['b', 'a', 'c']);
});
test('closing or changing artworks releases readers and forbids late media publication', async () => {
  const wait = deferred(), shown = []; let signal;
  const gallery = Gallery.create({ urls: ['a', 'b'], prepare: (url, reader) => { signal = reader; return wait.promise; }, show: value => shown.push(value) });
  const moving = gallery.move(1); gallery.dispose(); assert.equal(signal.aborted, true);
  wait.resolve('b'); await moving; assert.deepEqual(shown, []);
  assert.equal(await gallery.move(-1), false);
});
test('gallery key policy guards text entry, modifiers and composition without changing A/D', () => {
  for (const key of ['ArrowDown', 's', 'S']) assert.equal(Gallery.shortcut({ key }, null), 1);
  for (const key of ['ArrowUp', 'w', 'W']) assert.equal(Gallery.shortcut({ key }, null), -1);
  for (const key of ['a', 'd', 'ArrowLeft', 'ArrowRight', 'f', 'b']) assert.equal(Gallery.shortcut({ key }, null), 0);
  assert.equal(Gallery.shortcut({ key: 's', ctrlKey: true }), 0);
  assert.equal(Gallery.shortcut({ key: 's', isComposing: true }), 0);
  assert.equal(Gallery.shortcut({ key: 's' }, { isContentEditable: true }), 0);
  assert.equal(Gallery.shortcut({ key: 's' }, { closest: () => ({}) }), 0);
});
test('wheel paging is bounded per gesture; zoomed wheels pan and ctrl-wheel keeps zoom', () => {
  assert.equal(Gallery.wheelMode({ length: 3, scale: 1, ctrlKey: false, video: false }), 'page');
  assert.equal(Gallery.wheelMode({ length: 3, scale: 2, ctrlKey: false, video: false }), 'pan');
  assert.equal(Gallery.wheelMode({ length: 3, scale: 1, ctrlKey: true, video: false }), 'zoom');
  assert.equal(Gallery.wheelMode({ length: 1, scale: 1, ctrlKey: false, video: false }), 'zoom');
  assert.equal(Gallery.wheelMode({ length: 3, scale: 1, ctrlKey: false, video: true }), 'page');
  const gesture = Gallery.wheelGesture();
  assert.equal(gesture(40, 1000), 1); assert.equal(gesture(80, 1060), 0);
  assert.equal(gesture(20, 1100), 0); assert.equal(gesture(-40, 1120), -1);
  assert.equal(gesture(-40, 1200), 0); assert.equal(gesture(-40, 1500), -1);
});

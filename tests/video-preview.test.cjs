const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const CatalogLogic = require('../wwwroot/catalog-logic.js');
const { sampleTimes, createFrameCache, createController } = require('../wwwroot/video-preview.js');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check) {
  for (let n = 0; n < 100; n++) { if (check()) return; await pause(2); }
  assert.ok(check(), 'Preview did not reach the expected state');
}
const frames = () => ({ blobs: Array.from({ length: 5 }, () => ({ size: 10 })), times: [1, 3, 5, 7, 9], duration: 10 });
function cache(options = {}) {
  let next = 0;
  return createFrameCache({ createUrl: () => `blob:frame-${next++}`, revokeUrl: () => {}, ...options });
}
class Events {
  listeners = new Map();
  addEventListener(type, handler) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(handler); }
  removeEventListener(type, handler) { this.listeners.get(type)?.delete(handler); }
  emit(type, event = {}) { for (const handler of this.listeners.get(type) || []) handler(event); }
}
function surface() {
  const motion = new Events(); motion.matches = false;
  const win = new Events(); win.matchMedia = () => motion;
  const doc = new Events(); doc.defaultView = win; doc.hidden = false;
  const root = new Events(); root.ownerDocument = doc;
  root.getBoundingClientRect = () => ({ left: 0, right: 2560, top: 0, bottom: 1440 });
  root.contains = card => card?.isConnected;
  function card(url) {
    const overlay = { hidden: true, removeAttribute() { delete this.src; } };
    const classes = new Set();
    const node = { isConnected: true, dataset: { videoPreview: url },
      classList: { add: name => classes.add(name), remove: name => classes.delete(name) },
      querySelector: () => overlay, closest() { return this; }, matches: () => true,
      getBoundingClientRect: () => ({ width: 200, height: 200, left: 20, right: 220, top: 20, bottom: 220 }),
      contains(other) { return other === this; }, overlay, classes };
    return node;
  }
  const hover = node => root.emit('pointerover', { target: node, relatedTarget: null, pointerType: 'mouse' });
  const leave = node => root.emit('pointerout', { target: node, relatedTarget: null, pointerType: 'mouse' });
  return { root, doc, win, motion, card, hover, leave };
}
function setup(options) {
  const ui = surface();
  const controller = createController(ui.root, { cache: cache(), decode: async () => {}, dwell: 5, interval: 10, ...options });
  return { ...ui, controller };
}

test('five samples span the video, without selecting an empty end frame', () => {
  assert.deepEqual(sampleTimes(10), [1, 3, 5, 7, 9]);
  assert.equal(sampleTimes(0.01).length, 5);
  for (const duration of [0, -1, Infinity, NaN]) assert.deepEqual(sampleTimes(duration), []);
});

test('all catalog video cards share the hover overlay without eagerly loading a video player', () => {
  const source = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
  const start = source.indexOf('function renderCard('), end = source.indexOf('\nfunction skeletons(', start);
  const render = vm.runInNewContext(source.slice(start, end) + '\nrenderCard', {
    CatalogLogic, rememberItem: value => value, galleryImages: item => item.images,
    currentTab: () => ({ kind: 'search' }), contentPreferences: {},
    names: { danbooru: 'Danbooru', gelbooru: 'Gelbooru', rule34: 'Rule34', sankaku: 'Sankaku' },
    escapeHtml: value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;'),
    isAdultRating: () => false, savedWorkButton: () => '', workAuthorContextData: () => ''
  });
  for (const name of CatalogLogic.supportedSources) {
    const item = { key: `${name}:1`, source: name, id: '1', title: 'Video',
      thumbnail: 'https://cdn.donmai.us/preview.jpg', images: ['https://cdn.donmai.us/movie.mp4'] };
    const markup = render(item);
    assert.match(markup, /data-video-preview="https:\/\/cdn.donmai.us\/movie.mp4"/);
    assert.match(markup, /class="video-preview-frame"[^>]*hidden/);
    assert.match(markup, /<img data-image-url=/);
    assert.doesNotMatch(markup, /<video|\/api\/video/);
    item.images = ['https://cdn.donmai.us/image.jpg'];
    assert.doesNotMatch(render(item), /data-video-preview|video-preview-frame/);
  }
});

test('frame cache reuses objects, bounds bytes and entries, and releases evicted URLs', () => {
  const revoked = [];
  const store = cache({ maxEntries: 2, maxBytes: 100, revokeUrl: value => revoked.push(value) });
  const first = store.put('a', frames()); store.put('b', frames());
  assert.equal(store.get('a'), first);
  store.put('c', frames());
  assert.equal(store.get('b'), null);
  assert.equal(revoked.length, 5);
  assert.equal(store.put('partial', { blobs: [{}] }), null);
  assert.equal(store.put('large', { blobs: Array.from({ length: 5 }, () => ({ size: 100 })) }), null);
  store.clear(); assert.equal(revoked.length, 15);
});

test('passing across thumbnails, touch and reduced motion do not start video work', async () => {
  let calls = 0;
  const ui = setup({ extract: async () => { calls++; return frames(); }, dwell: 20 });
  try {
    const card = ui.card('video'); ui.hover(card); ui.leave(card);
    await pause(25); assert.equal(calls, 0);
    ui.root.emit('pointerover', { target: card, pointerType: 'touch' });
    await pause(25); assert.equal(calls, 0);
    ui.motion.matches = true; ui.hover(card);
    await pause(25); assert.equal(calls, 0);
  } finally { ui.controller.dispose(); }
});

test('warm hover cycles five cached frames without another video load and restores on leave', async () => {
  let calls = 0;
  const ui = setup({ extract: async () => { calls++; return frames(); } });
  try {
    const card = ui.card('video'); ui.hover(card);
    await until(() => !card.overlay.hidden);
    const first = card.overlay.src;
    await until(() => card.overlay.src !== first);
    ui.leave(card);
    assert.equal(card.overlay.hidden, true); assert.equal(card.overlay.src, undefined);
    ui.hover(card); await until(() => !card.overlay.hidden);
    assert.equal(calls, 1);
    assert.equal(card.overlay.src, first);
    ui.doc.hidden = true; ui.doc.emit('visibilitychange');
    assert.equal(card.overlay.hidden, true);
  } finally { ui.controller.dispose(); }
});

test('decoded video evidence publishes once per activation and reuses cached frames on warm hover', async () => {
  const learned = [];
  let extractions = 0;
  const ui = setup({ extract: async () => { extractions++; return frames(); },
    onFrames: (entry, context) => learned.push({ entry, context }) });
  try {
    const card = ui.card('movie.mp4'); ui.hover(card);
    await until(() => !card.overlay.hidden && learned.length === 1);
    assert.equal(learned[0].entry.duration, 10);
    assert.equal(learned[0].entry.blobs.length, 5);
    assert.equal(learned[0].context.card, card);
    assert.equal(learned[0].context.key, 'movie.mp4');
    assert.equal(learned[0].context.url, 'movie.mp4');
    assert.equal(learned[0].context.signal.aborted, false);
    await pause(35); assert.equal(learned.length, 1, 'cycling frames must not publish repeatedly');
    ui.leave(card); assert.equal(learned[0].context.signal.aborted, true);
    ui.hover(card); await until(() => learned.length === 2 && !card.overlay.hidden);
    assert.equal(extractions, 1);
    assert.equal(learned[1].entry, learned[0].entry);
    assert.notEqual(learned[1].context.signal, learned[0].context.signal);
    assert.equal(learned[1].context.signal.aborted, false);
  } finally { ui.controller.dispose(); }
  assert.equal(learned.at(-1).context.signal.aborted, true);
});

test('cancelled or stale video decoding cannot publish evidence for another card', async () => {
  const learned = [];
  let started = 0;
  const ui = setup({ extract: async () => { started++; await pause(25); return frames(); },
    onFrames: (_, context) => learned.push(context) });
  try {
    const first = ui.card('first'), second = ui.card('second');
    ui.hover(first); await until(() => started === 1);
    ui.leave(first); ui.hover(second);
    await until(() => !second.overlay.hidden);
    assert.equal(learned.length, 1); assert.equal(learned[0].card, second);
    ui.root.emit('scroll'); assert.equal(learned[0].signal.aborted, true);
  } finally { ui.controller.dispose(); }
});

test('a failed optional evidence callback cannot break the hover player or cause another extraction', async () => {
  let extractions = 0, calls = 0;
  const ui = setup({ extract: async () => { extractions++; return frames(); }, onFrames: async () => {
    calls++; throw new Error('Evidence unavailable');
  } });
  try {
    const card = ui.card('video'); ui.hover(card);
    await until(() => !card.overlay.hidden);
    await pause(10); assert.equal(calls, 1);
    ui.leave(card); ui.hover(card); await until(() => !card.overlay.hidden && calls === 2);
    assert.equal(extractions, 1);
  } finally { ui.controller.dispose(); }
});

test('five decoded preview frames retain the full video duration without another media request', async () => {
  const source = fs.readFileSync(require.resolve('../wwwroot/video-preview.js'), 'utf8');
  const video = new Events(); let position = 0, metadataLoads = 0;
  Object.assign(video, { duration: 12.5, videoWidth: 1920, videoHeight: 1080, readyState: 2,
    pause() {}, load() { if (this.src) { metadataLoads++; queueMicrotask(() => this.emit('loadedmetadata')); } },
    removeAttribute(name) { delete this[name]; } });
  Object.defineProperty(video, 'currentTime', { get: () => position, set(value) {
    position = value; queueMicrotask(() => video.emit('seeked'));
  } });
  let frameDecodes = 0, frameEncodes = 0, infoRequests = 0;
  const canvas = { width: 0, height: 0,
    getContext: () => ({ drawImage() { frameDecodes++; } }),
    toBlob(callback) { frameEncodes++; callback({ size: 12 }); } };
  const context = { module: { exports: {} }, DOMException, URL, setTimeout, clearTimeout,
    crypto: { randomUUID: () => '00000000-0000-4000-8000-000000000000' },
    document: { createElement: name => name === 'video' ? video : canvas },
    fetch: async () => { infoRequests++; return { ok: true, json: async () => ({ sampleTimes: [] }) }; } };
  vm.runInNewContext(source, context);
  const result = await context.module.exports.extractFrames('https://cdn.donmai.us/movie.mp4', new AbortController().signal);
  assert.equal(result.duration, 12.5);
  assert.equal(result.blobs.length, 5); assert.equal(result.times.length, 5);
  assert.equal(metadataLoads, 1); assert.equal(infoRequests, 1);
  assert.equal(frameDecodes, 5); assert.equal(frameEncodes, 5);
  assert.equal(result.width, 320); assert.equal(result.height, 180);
});

test('rapid card switches wait for cancelled decoding to finish and cannot paint stale frames', async () => {
  let active = 0, peak = 0, calls = 0;
  const ui = setup({ extract: async (url, signal) => {
    active++; peak = Math.max(peak, active); calls++;
    try {
      await pause(25);
      if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      return frames();
    } finally { active--; }
  } });
  try {
    const a = ui.card('a'), b = ui.card('b');
    ui.hover(a); await until(() => active === 1);
    ui.leave(a); ui.hover(b);
    await until(() => !b.overlay.hidden);
    assert.equal(calls, 2); assert.equal(peak, 1); assert.equal(a.overlay.hidden, true);
    b.isConnected = false; ui.controller.refresh();
    assert.equal(b.overlay.hidden, true);
  } finally { ui.controller.dispose(); }
});

test('renewed signed media shares the cached frames and refresh does not interrupt an active overlay', async () => {
  let calls = 0;
  const ui = setup({ cacheKey: url => url.split('?')[0], extract: async () => { calls++; return frames(); } });
  try {
    const card = ui.card('video?token=old'); ui.hover(card);
    await until(() => !card.overlay.hidden);
    card.dataset.videoPreview = 'video?token=new'; card.classes.clear(); ui.controller.refresh();
    assert.ok(card.classes.has('video-preview-active'));
    ui.leave(card); ui.hover(card); await until(() => !card.overlay.hidden);
    assert.equal(calls, 1);
    card.dataset.videoPreview = 'different-video'; ui.controller.refresh();
    assert.equal(card.overlay.hidden, true);
  } finally { ui.controller.dispose(); }
});

test('failure keeps the thumbnail and backs off; cancelled work can be retried', async () => {
  let calls = 0;
  const ui = setup({ extract: async () => { calls++; throw new Error('Source unavailable'); } });
  try {
    const card = ui.card('video'); ui.hover(card); await until(() => calls === 1);
    await pause(5); ui.leave(card); ui.hover(card); await pause(20);
    assert.equal(calls, 1); assert.equal(card.overlay.hidden, true);
    card.dataset.videoPreview = 'renewed'; ui.leave(card); ui.hover(card);
    await until(() => calls === 2);
  } finally { ui.controller.dispose(); }
});

test('keyboard focus starts the same preview and click, scrolling and blur release it', async () => {
  const ui = setup({ extract: async () => frames() });
  try {
    const card = ui.card('video');
    ui.root.emit('focusin', { target: card }); await until(() => !card.overlay.hidden);
    ui.root.emit('click'); assert.equal(card.overlay.hidden, true);
    ui.hover(card); await until(() => !card.overlay.hidden);
    ui.root.emit('scroll'); assert.equal(card.overlay.hidden, true);
    ui.hover(card); await until(() => !card.overlay.hidden);
    ui.win.emit('blur'); assert.equal(card.overlay.hidden, true);
  } finally { ui.controller.dispose(); }
});

test('a timed-out source is cancelled and backed off instead of reloading on every hover', async () => {
  let calls = 0, cancelled = 0;
  const ui = setup({ timeout: 10, extract: (url, signal) => new Promise((resolve, reject) => {
    calls++;
    signal.addEventListener('abort', () => { cancelled++; reject(new DOMException('Cancelled', 'AbortError')); }, { once: true });
  }) });
  try {
    const card = ui.card('slow-video'); ui.hover(card);
    await until(() => cancelled === 1);
    ui.leave(card); ui.hover(card); await pause(25);
    assert.equal(calls, 1); assert.equal(card.overlay.hidden, true);
  } finally { ui.controller.dispose(); }
});

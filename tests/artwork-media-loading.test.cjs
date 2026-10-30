const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const CatalogLogic = require('../wwwroot/catalog-logic.js');
const DartResourceCache = require('../wwwroot/resource-cache.js');
const source = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
const block = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

function fixture(t, { transportSlots = Infinity } = {}) {
  const reads = [], entries = new Map(), revoked = [], decodes = [], images = [];
  const transportQueue = [];
  let activeTransport = 0;
  let media, decodeGate = Promise.resolve(), detailGate = Promise.resolve(null), serial = 0;
  class Image {
    constructor() { this.attrs = new Map(); this.dataset = {}; this.naturalWidth = 0; this.isConnected = false; images.push(this); }
    get attributes() { return [...this.attrs].map(([name, value]) => ({ name, value })); }
    setAttribute(name, value) {
      this.attrs.set(name, String(value));
      if (name === 'data-image-url') this.dataset.imageUrl = String(value);
      if (name === 'data-preview-url') this.dataset.previewUrl = String(value);
    }
    getAttribute(name) { return this.attrs.get(name) || null; }
    hasAttribute(name) { return this.attrs.has(name); }
    removeAttribute(name) { this.attrs.delete(name); }
    get src() { return this.getAttribute('src') || ''; }
    set src(value) { this.setAttribute('src', value); }
    async decode() { decodes.push(this.src); await decodeGate; this.naturalWidth = 800; this.naturalHeight = 600; }
    addEventListener() {}
    replaceWith(next) { this.isConnected = false; next.isConnected = true; media = next; }
    closest() { return null; }
  }
  const preview = { open: false, classList: { toggle() {}, contains() { return false; } }, setAttribute() {},
    set innerHTML(html) { media = new Image(); media.isConnected = true; const src = html.match(/<img[^>]*\ssrc="([^"]*)"/); if (src) media.src = src[1]; },
    querySelector: () => media,
    querySelectorAll: selector => selector === 'video' ? [] : media ? [media] : [],
    showModal() { this.open = true; }, focus() {}, close() { this.open = false; },
    replaceChildren() { if (media) media.isConnected = false; media = null; } };
  const context = vm.createContext({ CatalogLogic, DartResourceCache, AbortController, AbortSignal, Promise, Map, Set,
    setTimeout, clearTimeout, Image,
    URL: { createObjectURL: blob => { const url = `blob:fixture-${++serial}`; entries.set(url, blob); return url; },
      revokeObjectURL: url => revoked.push(url) },
    IntersectionObserver: class { observe() {} disconnect() {} unobserve() {} },
    main: { clientHeight: 900, querySelectorAll: () => [] },
    fetch: async (path, { signal }) => {
      if (activeTransport >= transportSlots) await new Promise(resolve => transportQueue.push(resolve));
      activeTransport++;
      try {
        if (signal.aborted) throw Object.assign(new Error('cancelled'), { name: 'AbortError' });
        const url = decodeURIComponent(path.split('url=')[1]);
        const ready = deferred(); reads.push({ url, signal, ready });
        await Promise.race([ready.promise, new Promise((_, reject) => signal.addEventListener('abort', () =>
          reject(Object.assign(new Error('cancelled'), { name: 'AbortError' })), { once: true }))]);
        return { ok: true, blob: async () => ({ size: 10, url }) };
      } finally { activeTransport--; transportQueue.shift()?.(); }
    },
    request: async () => detailGate,
    galleryImages: item => item.images || [], rememberItem: item => item,
    quickPreview: preview, quickPreviewMediaController: null, quickPreviewRoute: null, quickPreviewGeneration: 0,
    quickPreviewZoomTimer: null, quickPreviewWork: null, quickPreviewDrag: null, quickPreviewView: null,
    currentTab: () => ({ kind: 'recommendations' }), pauseDetailVideos() {},
    retainFeedWork() {}, paintQuickPreview() {}, recordDetailVisit() {},
    escapeHtml: value => String(value || ''), savedWorkButton: () => '' });
  vm.runInContext(block('function readMediaBlob(', '\nconst visualHashJobs'), context);
  const loader = vm.runInContext(block('const imageLoader = {', '\nconst autoFeed = {') + '\nimageLoader', context);
  context.imageLoader = loader;
  vm.runInContext(block('function warmArtworkRoute(', '\nasync function moveArtwork('), context);
  vm.runInContext(block('function stopQuickPreviewMedia(', '\nasync function toggleSavedWork('), context);
  const route = { warmed: new Map(), engine: { state: { index: 0 }, items: [],
    neighbors: () => [], prefetch: async () => {}, update() {}, select() {}, cancel() {} } };
  const item = { key: 'danbooru:2', source: 'danbooru', id: '2', title: 'Next artwork',
    thumbnail: 'https://cdn.donmai.us/preview/fixture.jpg', images: ['https://cdn.donmai.us/original/fixture.jpg'] };
  t.after(async () => {
    if (preview.open) context.closeQuickPreview(); route.warmController?.abort();
    for (let wave = 0; wave < 8; wave++) { reads.forEach(read => read.ready.resolve()); await tick(); }
  });
  return { context, loader, reads, revoked, decodes, images, route, item, preview, get media() { return media; },
    detail: promise => { detailGate = promise; }, decoding: promise => { decodeGate = promise; } };
}

test('known neighboring pixels warm before its slow detail response', async t => {
  const f = fixture(t), detail = deferred(); f.detail(detail.promise);
  f.route.engine.items = [{ key: 'danbooru:1' }, f.item];
  f.route.engine.neighbors = () => [f.item];
  f.context.warmArtworkRoute(f.route); await tick();
  assert.deepEqual(f.reads.map(read => read.url).sort(), [f.item.thumbnail, f.item.images[0]].sort());
  f.reads.forEach(read => read.ready.resolve()); detail.resolve(f.item);
  await f.route.warming;
  assert.equal(f.reads.length, 2, 'The detail response must reuse the already warmed known media');
});

test('an expired known signature does not occupy the preload slot or suppress the renewed detail URL', async t => {
  const f = fixture(t), detail = deferred(); f.detail(detail.promise);
  const expired = { ...f.item, source: 'sankaku', key: 'sankaku:2', images: [],
    thumbnail: 'https://s.sankakucomplex.com/preview/fixture.jpg?e=1&m=old' };
  const renewed = { ...expired, thumbnail: 'https://s.sankakucomplex.com/preview/fixture.jpg?e=9999999999&m=new' };
  f.route.engine.items = [{ key: 'danbooru:1' }, expired];
  f.route.engine.neighbors = () => [expired];
  f.context.warmArtworkRoute(f.route); await tick();
  assert.equal(f.reads.length, 0, 'Known expired media must wait for renewal rather than consume speculative transport');
  detail.resolve(renewed); await tick();
  assert.deepEqual(f.reads.map(read => read.url), [renewed.thumbnail]);
  f.reads[0].ready.resolve(); await f.route.warming;
});

test('a video transition does not wait for its unavailable poster or schedule an image decode', async t => {
  const f = fixture(t);
  f.item.images = ['https://cdn.donmai.us/original/neutral.mp4'];
  const controller = new AbortController();
  t.after(() => controller.abort());
  let ready = false;
  const preparing = f.context.prepareArtworkMedia(f.item, controller.signal).then(release => {
    ready = true; release?.();
  });
  await tick();
  assert.equal(ready, true, 'playable video must be selected without waiting up to 4.5 seconds for a poster');
  assert.equal(f.reads.length, 0, 'the video element owns media loading; no blocking poster transport is needed');
  assert.equal(f.decodes.length, 0);
  await preparing;
});

test('a video selected from a mixed gallery bypasses unrelated image preparation', async t => {
  const f = fixture(t), video = 'https://cdn.donmai.us/original/neutral.webm';
  f.item.images.push(video);
  const controller = new AbortController();
  t.after(() => controller.abort());
  let ready = false;
  const preparing = f.context.prepareArtworkMedia(f.item, controller.signal,
    CatalogLogic.previewMedia(f.item)).then(release => { ready = true; release?.(); });
  await tick();
  assert.equal(ready, true, 'Space navigation selects the playable file even when a picture precedes it');
  assert.equal(f.reads.length, 0);
  await preparing;
});

test('Space navigation passes the selected mixed-gallery video into media preparation', async t => {
  const f = fixture(t), video = 'https://cdn.donmai.us/original/neutral.webm';
  f.item.images.push(video);
  f.preview.open = true;
  Object.assign(f.context, { quickPreviewRoute: f.route, quickPreviewWork: { key: 'danbooru:1' },
    ratingFilterFor: () => 'general', toast() {} });
  f.route.engine.items = [f.item];
  f.route.engine.move = async () => f.item;
  f.route.engine.sync = () => {};
  const opened = [];
  f.context.openQuickPreview = value => opened.push(value);
  vm.runInContext(block('async function moveArtwork(', '\nfunction openDetail('), f.context);
  const moving = f.context.moveArtwork(1);
  t.after(() => f.route.navigationController?.abort());
  await tick();
  assert.equal(opened.length, 1, 'the selected video should open before a cold poster is ready');
  assert.equal(opened[0].url, video);
  assert.equal(f.reads.length, 0);
  await moving;
});

test('a photo transition still waits for prepared pixels to decode before switching', async t => {
  const f = fixture(t), decoded = deferred();
  f.decoding(decoded.promise);
  const controller = new AbortController();
  t.after(() => { controller.abort(); decoded.resolve(); });
  let ready = false;
  const preparing = f.context.prepareArtworkMedia(f.item, controller.signal).then(release => {
    ready = true; return release;
  });
  await tick();
  assert.equal(ready, false, 'the new photo waits while its prepared thumbnail loads');
  assert.equal(f.reads[0].url, f.item.thumbnail);
  f.reads[0].ready.resolve(); await tick();
  assert.equal(ready, false, 'a loaded but undecoded photo must not replace the current viewer');
  decoded.resolve();
  const release = await preparing;
  assert.equal(ready, true);
  assert.equal(typeof release, 'function');
  release();
});

test('a next-artwork thumbnail starts with foreground capacity while normal media are pending', async t => {
  // The production proxy also limits upstream images to four transports.
  const f = fixture(t, { transportSlots: 4 }), background = [];
  for (let index = 0; index < 6; index++) background.push(f.context.readMediaBlob(`normal-${index}`));
  await tick();
  const controller = new AbortController();
  const preparing = f.context.prepareArtworkMedia(f.item, controller.signal);
  await tick();
  const target = f.reads.find(read => read.url === f.item.thumbnail);
  assert.ok(target, 'The current transition must start without waiting for an older normal download');
  target.ready.resolve(); const release = await preparing; release?.();
  f.reads.forEach(read => read.ready.resolve());
  // Completing the first wave starts the remaining queued normal download.
  await tick(); f.reads.forEach(read => read.ready.resolve()); await Promise.all(background);
});

test('a newly opened detail image starts while old feed downloads still own normal capacity', async t => {
  const f = fixture(t, { transportSlots: 4 });
  for (let index = 0; index < 3; index++) void f.context.readMediaBlob(`pending-feed-${index}`);
  await tick();
  const image = new f.context.Image(); image.isConnected = true;
  image.dataset.imageUrl = f.item.images[0];
  image.getBoundingClientRect = () => ({ top: 10, bottom: 500 });
  image.closest = () => ({ classList: { remove() {} } });
  f.context.main.getBoundingClientRect = () => ({ top: 0, bottom: 900 });
  f.context.main.querySelectorAll = () => [image];
  f.loader.visible.add(image); f.loader.enqueue(image);
  await tick();
  assert.ok(f.reads.some(read => read.url === f.item.images[0]),
    'The selected detail image must use the foreground slot before old feed readers finish');
});

test('Space full image shares the media transport, preserves its poster until decoded and retains pixels until close', async t => {
  const f = fixture(t), decoded = deferred(); f.decoding(decoded.promise);
  f.context.warmArtworkRoute = () => {};
  const shared = f.context.readMediaBlob(f.item.images[0], undefined, { priority: 'background' });
  f.context.openQuickPreview({ item: f.item, image: { currentSrc: 'blob:poster' }, url: f.item.images[0], route: f.route });
  await tick();
  assert.equal(f.reads.length, 1, 'Warming and visible preview must share one full-image transport');
  assert.equal(f.media.src, 'blob:poster');
  f.reads[0].ready.resolve(); await shared; await tick();
  assert.equal(f.media.src, 'blob:poster', 'The existing poster stays visible during decoding');
  decoded.resolve(); await tick();
  const visibleUrl = f.media.src;
  assert.match(visibleUrl, /^blob:fixture-/);
  f.loader.bytes = 49 * 1024 * 1024; f.loader.evict();
  assert.equal(f.revoked.includes(visibleUrl), false, 'Modal pixels must survive cache pressure while visible');
  f.context.closeQuickPreview();
  assert.equal(f.loader.pinned.size, 0);
  assert.equal(f.revoked.includes(visibleUrl), true, 'Closing the modal releases its held cache entry');
});

test('replacing or closing a cold Space preview cancels old consumers and never paints stale full pixels', async t => {
  const f = fixture(t); f.context.warmArtworkRoute = () => {};
  f.context.openQuickPreview({ item: f.item, image: { currentSrc: 'blob:first-poster' }, url: f.item.images[0], route: f.route });
  await tick();
  assert.equal(f.reads.length, 1, 'Cold full media must use the cancellable shared transport');
  const next = { ...f.item, key: 'danbooru:3', id: '3', thumbnail: 'next-thumb', images: ['https://cdn.donmai.us/original/next.jpg'] };
  f.context.openQuickPreview({ item: next, image: { currentSrc: 'blob:next-poster' }, url: next.images[0], route: f.route });
  await tick();
  f.reads[0].ready.resolve(); await tick();
  assert.equal(f.media.src, 'blob:next-poster');
  f.context.closeQuickPreview();
  await new Promise(resolve => setTimeout(resolve, 280));
  assert.equal(f.reads[1].signal.aborted, true, 'An abandoned preview must release its transport after shared grace');
  assert.equal(f.loader.pinned.size, 0);
});

for (const firstReader of ['feed', 'modal']) {
test(`a ${firstReader}-first shared download has one decoded blob owner for the feed and Space preview`, async t => {
  const f = fixture(t), decoded = deferred(); f.decoding(decoded.promise);
  f.context.warmArtworkRoute = () => {};
  const feed = new f.context.Image(); feed.isConnected = true; feed.dataset.imageUrl = f.item.images[0];
  feed.getBoundingClientRect = () => ({ top: 10, bottom: 500 });
  f.context.main.getBoundingClientRect = () => ({ top: 0, bottom: 900 });
  f.context.main.querySelectorAll = () => [feed];
  const startFeed = () => { f.loader.visible.add(feed); f.loader.enqueue(feed); };
  const startModal = () => f.context.openQuickPreview({ item: f.item, image: { currentSrc: 'blob:poster' },
    url: f.item.images[0], route: f.route });
  if (firstReader === 'feed') { startFeed(); await tick(); startModal(); }
  else { startModal(); await tick(); startFeed(); }
  await tick(); assert.equal(f.reads.length, 1);
  f.reads[0].ready.resolve(); await tick();
  assert.equal(f.decodes.length, 1, 'Shared transport readers must also share one cached blob and decoder');
  decoded.resolve(); await tick(); await tick();
  const visible = f.media.src;
  assert.equal(feed.src, visible);
  assert.equal(f.loader.cached(f.item.images[0]).blobUrl, visible);
  assert.equal(f.revoked.includes(visible), false, 'A feed commit must not revoke pixels already used by the modal');
  assert.equal(f.loader.bytes, 10, 'Shared pixels are counted exactly once');
});
}

test('a feed generation cancelled during shared decoding cannot revoke the current Space preview', async t => {
  const f = fixture(t), decoded = deferred(); f.decoding(decoded.promise);
  f.context.warmArtworkRoute = () => {};
  const feed = new f.context.Image(); feed.isConnected = true; feed.dataset.imageUrl = f.item.images[0];
  feed.getBoundingClientRect = () => ({ top: 10, bottom: 500 });
  f.context.main.getBoundingClientRect = () => ({ top: 0, bottom: 900 });
  f.loader.visible.add(feed); f.loader.enqueue(feed); await tick();
  f.context.openQuickPreview({ item: f.item, image: { currentSrc: 'blob:poster' }, url: f.item.images[0], route: f.route });
  f.reads[0].ready.resolve(); await tick();
  f.loader.mount(f.context.main);
  decoded.resolve(); await tick(); await tick();
  const visible = f.media.src;
  assert.match(visible, /^blob:fixture-/);
  assert.equal(f.loader.cached(f.item.images[0]).blobUrl, visible);
  assert.equal(f.revoked.includes(visible), false);
  f.context.closeQuickPreview();
  assert.equal(f.loader.pinned.size, 0);
});

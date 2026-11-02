const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('./helpers/viewer-vm.cjs');
const Logic = require('../wwwroot/catalog-logic.js');
const Navigation = require('../wwwroot/artwork-navigation.js');
const ResourceCache = require('../wwwroot/resource-cache.js');
const app = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
const block = (start, end) => app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start)));
const tick = () => new Promise(resolve => setImmediate(resolve));

function routeFixture() {
  const items = Array.from({ length: 100 }, (_, index) => ({ key: `rule34:${index + 1}`,
    source: 'rule34', id: String(index + 1), title: 'Fixture', tags: [],
    images: [`https://fixture.test/${index}.jpg`] }));
  const tab = { id: 1, kind: 'search', rating: 'all', started: true, items, hasMore: false };
  const preview = { open: true, contains: () => false, close() { this.open = false; }, replaceChildren() {} };
  const context = vm.createContext({ CatalogLogic: Logic, DartArtworkNavigation: Navigation, structuredClone,
    artworkRoutes: new Set(), nextArtworkSourceId: -1, contentPreferences: {}, recent: [], likes: [], bookmarks: [],
    viewedTokens: new Set(), viewedPending: new Set(), findTab: () => tab, currentTab: () => tab,
    localStorage: { setItem() {} }, recordViewedWorks() {}, favoritesController: () => ({ record() {}, metadata() {} }),
    quickPreview: preview, quickPreviewRoute: null, quickPreviewGeneration: 0, quickPreviewZoomTimer: null,
    quickPreviewDrag: null, quickPreviewWork: null, stopQuickPreviewMedia() {}, clearTimeout,
    tabs: [tab], navigation: [], abortTab() {} });
  vm.runInContext(block('function recordDetailVisit(', '\nfunction abortTab('), context);
  vm.runInContext(block('function knownWorkTokens(', '\nfunction emptyFeedMessage('), context);
  vm.runInContext(block('function artworkSourceSignature(', '\nfunction warmArtworkRoute('), context);
  vm.runInContext(block('function closeQuickPreview(', '\nasync function toggleSavedWork('), context);
  const open = () => {
    const route = context.quickPreviewRoute = context.createArtworkRoute(tab, items[0]);
    preview.open = true;
    return route;
  };
  return { context, tab, open };
}

test('repeated Space-preview closure releases unowned route snapshots immediately', () => {
  const f = routeFixture();
  for (let count = 0; count < 20; count++) {
    const route = f.open();
    f.context.closeQuickPreview();
    assert.equal(f.context.artworkRoutes.size, 0, 'Closed feed previews must not retain whole cloned feeds');
    assert.equal(route.disposed, true);
  }
});

test('closing a preview preserves routes still owned by a detail tab or navigation history', () => {
  for (const owner of ['detail', 'history']) {
    const f = routeFixture(), route = f.open();
    if (owner === 'detail') Object.assign(f.tab, { kind: 'detail', item: f.tab.items[0], artworkRoute: route });
    else f.context.navigation.push({ view: { artworkRoute: route } });
    f.context.closeQuickPreview();
    assert.equal(f.context.artworkRoutes.size, 1);
    assert.equal(route.disposed, false);
    assert.equal(route.engine.state.next, true, 'Closing a modal must retain the shared viewer navigation');
  }
});

test('closing a preview can transfer its route to a detail view before the next tab activation', () => {
  const f = routeFixture(), route = f.open();
  f.context.closeQuickPreview(route);
  assert.equal(f.context.artworkRoutes.size, 1);
  assert.equal(route.disposed, false);
  Object.assign(f.tab, { kind: 'detail', item: f.tab.items[0], artworkRoute: route });
  f.context.pruneArtworkRoutes();
  assert.equal(f.context.artworkRoutes.size, 1);
  assert.equal(route.engine.state.next, true);
});

const expired = 'https://s.sankakucomplex.com/data/fixture.png?e=1&m=expired';
const fresh = 'https://s.sankakucomplex.com/data/fixture.png?e=4102444800&m=fresh';
function imageFixture({ original = expired, recover = async () => fresh, available = fresh, realRecovery = false } = {}) {
  const reads = [], recoveries = [], metadata = [], entries = new Map();
  let src = '';
  const media = { dataset: {}, isConnected: true, addEventListener() {},
    closest: () => ({ dataset: { workKey: 'sankaku:fixture' } }),
    get src() { return src; }, set src(value) { src = value; } };
  const preview = { open: false, classList: { toggle() {}, contains: () => false }, setAttribute() {}, focus() {},
    querySelector: () => media, showModal() { this.open = true; }, contains: () => false,
    close() { this.open = false; }, replaceChildren() { media.isConnected = false; },
    querySelectorAll: () => [],
    set innerHTML(value) { src = value.match(/<img[^>]* src="([^"]+)"/)?.[1] || ''; } };
  const item = { key: 'sankaku:fixture', source: 'sankaku', id: 'fixture', title: 'Fixture', images: [original],
    thumbnail: 'https://s.sankakucomplex.com/preview/fixture.jpg?e=4102444800&m=fresh' };
  const route = { engine: { select() {}, cancel() {} } };
  const context = vm.createContext({ CatalogLogic: Logic, DartResourceCache: ResourceCache,
    AbortController, AbortSignal, clearTimeout, URL,
    quickPreview: preview, quickPreviewRoute: null, quickPreviewGeneration: 0, quickPreviewMediaController: null,
    quickPreviewZoomTimer: null, quickPreviewWork: null, quickPreviewView: null, quickPreviewDrag: null,
    viewerPreferences: { videoSound: false }, currentTab: () => ({ kind: 'search' }), pauseDetailVideos() {},
    imageLoader: { pin: () => () => {}, cached: url => entries.get(Logic.mediaCacheKey(url)), adopt() {},
      rememberBlob(url, blob) { const entry = { blob, blobUrl: 'blob:decoded-full-image' }; entries.set(Logic.mediaCacheKey(url), entry); return entry; },
      decode: async () => {}, reveal: (image, url) => { image.src = url; } },
    fetch: async (path, { signal }) => {
      const url = new URL(path, 'http://fixture.test').searchParams.get('url');
      reads.push(url);
      if (signal.aborted) throw Object.assign(new Error('Cancelled'), { name: 'AbortError' });
      return { ok: url === available, status: url === available ? 200 : 502,
        blob: async () => new Blob(['fixture full image']) };
    },
    sankakuMediaRecovery: { recover: async (images, url, signal) => {
      recoveries.push(url); return recover(images, url, signal);
    } },
    rememberItem: value => value, retainFeedWork() {}, escapeHtml: String, savedWorkButton: () => '',
    artworkMoreButton: () => '', paintQuickPreview() {}, recordDetailVisit() {}, warmArtworkRoute() {},
    itemIndex: new Map([[item.key, item]]), likes: [], bookmarks: [], recent: [], tabs: [],
    request: async path => { metadata.push(path); return { ...item, images: [fresh] }; },
    pruneArtworkRoutes() {} });
  vm.runInContext(block('function readMediaBlob(', '\nconst visualHashJobs'), context);
  if (realRecovery) vm.runInContext(block('const sankakuMediaRecovery = {', '\n// Portable profiles'), context);
  vm.runInContext(block('function stopQuickPreviewMedia(', '\nasync function toggleSavedWork('), context);
  return { context, reads, recoveries, metadata, media, item, open() {
    context.openQuickPreview({ item, url: original, route, image: { currentSrc: 'blob:small-cached-thumbnail' } }, 'fullscreen');
  } };
}

test('fullscreen renews an expired signed original before fetching and replaces its thumbnail', async () => {
  const f = imageFixture();
  f.open(); await tick();
  assert.deepEqual(f.reads, [fresh], 'Known expired originals must be renewed before the image request');
  assert.equal(f.media.src, 'blob:decoded-full-image');
  assert.equal(f.media.dataset.imageUrl, fresh);
  f.context.closeQuickPreview();
});

test('modal recovery uses the media-only detail endpoint and preserves the work while renewing its original', async () => {
  const f = imageFixture({ realRecovery: true });
  f.open(); await tick();
  assert.deepEqual(f.metadata, ['/api/detail?source=sankaku&id=fixture&mediaOnly=true']);
  assert.deepEqual(f.reads, [fresh]);
  assert.equal(f.media.src, 'blob:decoded-full-image');
  assert.deepEqual([...f.item.images], [fresh]);
  assert.equal(f.item.key, 'sankaku:fixture');
  f.context.closeQuickPreview();
});

test('a signed original rejected before its expiry renews once and replaces the thumbnail', async () => {
  const original = fresh.replace('m=fresh', 'm=rejected');
  const f = imageFixture({ original });
  f.open(); await tick();
  assert.deepEqual(f.reads, [original, fresh]);
  assert.deepEqual(f.recoveries, [original]);
  assert.equal(f.media.src, 'blob:decoded-full-image');
  f.context.closeQuickPreview();
});

test('unavailable renewal keeps its poster without a retry loop', async () => {
  const f = imageFixture({ recover: async () => '', available: '' });
  f.open(); await tick();
  assert.deepEqual(f.recoveries, [expired]);
  assert.deepEqual(f.reads, [expired]);
  assert.equal(f.media.src, 'blob:small-cached-thumbnail');
  f.context.closeQuickPreview();
});

test('closing during signature renewal cancels the modal consumer before fetching pixels', async () => {
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const f = imageFixture({ recover: () => pending });
  f.open();
  f.context.closeQuickPreview();
  finish(fresh); await tick();
  assert.deepEqual(f.reads, []);
});

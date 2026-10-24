const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const CatalogLogic = require('../wwwroot/catalog-logic.js');
const DartResourceCache = require('../wwwroot/resource-cache.js');
const source = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
const block = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const tick = () => new Promise(resolve => setImmediate(resolve));

function fixture(t) {
  const reads = [], releases = new Map(), controllers = [];
  const item = id => ({ key: `danbooru:${id}`, source: 'danbooru', id: String(id), images: [] });
  const first = item(2), neighbors = [item(1), item(3)];
  const route = { warmed: new Map(), engine: { state: { index: 0 }, items: [first],
    neighbors: () => neighbors, prefetch: async () => {}, update() {} } };
  const tab = { id: 1, kind: 'detail', item: first, artworkRoute: route };
  const context = vm.createContext({ CatalogLogic, DartResourceCache, AbortController, structuredClone,
    setTimeout, clearTimeout, URLSearchParams, galleryImages: value => value.images || [],
    requestJson(path, { signal }) {
      reads.push(path);
      return new Promise((resolve, reject) => {
        releases.set(path, resolve);
        signal.addEventListener('abort', () => reject(Object.assign(new Error('Cancelled'), { name: 'AbortError' })), { once: true });
      });
    },
    clearCatalogResponses() {}, catalogRequestKey: path => path, addCatalogVisualHashes() {},
    imageLoader: { cached() {} }, rememberItem: value => value,
    findTab: () => tab, activeId: tab.id, recent: [], render() {},
    loadCreatorWorks() {}, loadRelated() {}, saveSession() {}, refreshSavedDetail() {},
    localStorage: { setItem() {} } });
  vm.runInContext(block('async function request(', '\nfunction catalogRequestKey(') +
    block('function warmArtworkRoute(', '\nasync function prepareArtworkMedia(') +
    block('async function loadDetail(', '\nasync function loadCreatorWorks('), context);
  t.after(async () => {
    controllers.forEach(controller => controller.abort());
    route.warmController?.abort(); tab.detailController?.abort();
    for (const release of releases.values()) release(null);
    await tick();
  });
  function following() {
    return Array.from({ length: 4 }, (_, index) => {
      const controller = new AbortController(); controllers.push(controller);
      return context.request(`/api/search?fixture-follow=${index}`, { signal: controller.signal }).catch(() => {});
    });
  }
  return { context, tab, route, reads, releases, following };
}

test('selected artwork metadata starts while Following and speculative neighbors remain pending', async t => {
  const f = fixture(t);
  f.following();
  f.context.warmArtworkRoute(f.route);
  const selected = f.context.loadDetail(f.tab);
  await tick();
  assert.ok(f.reads.includes('/api/detail?source=danbooru&id=2'),
    'The selected artwork must not queue behind a background Following request or a neighbor');
  assert.equal(f.tab.detailLoading, true);
  f.releases.get('/api/detail?source=danbooru&id=2')(null);
  await selected;
  assert.equal(f.tab.detailLoading, false);
});

test('a visible reader promotes a queued neighbor without duplicating its transport', async t => {
  const f = fixture(t);
  f.following();
  f.context.warmArtworkRoute(f.route);
  await tick();
  const path = '/api/detail?source=danbooru&id=3';
  assert.equal(f.reads.includes(path), false, 'Speculation must leave one catalog slot available');
  const selected = f.context.request(path, { priority: 'foreground' });
  await tick();
  assert.equal(f.reads.filter(value => value === path).length, 1);
  f.releases.get(path)(null);
  await selected;
});

test('a forced foreground metadata refresh keeps scheduling priority out of Fetch options', async () => {
  const context = vm.createContext({ CatalogLogic, DartResourceCache, structuredClone,
    clearCatalogResponses() {}, catalogRequestKey: path => path, addCatalogVisualHashes() {},
    fetch: async (path, options) => {
      if (options.priority && !['high', 'low', 'auto'].includes(options.priority))
        throw new TypeError('Invalid RequestPriority');
      return { ok: true, json: async () => ({ key: 'danbooru:2' }) };
    } });
  vm.runInContext(block('async function request(', '\nfunction catalogRequestKey(') +
    block('async function requestJson(', '\nfunction readMediaBlob('), context);
  const result = await context.request('/api/detail?source=danbooru&id=2',
    { cache: 'reload', priority: 'foreground' });
  assert.equal(result.key, 'danbooru:2');
});

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const CatalogLogic = require('../wwwroot/catalog-logic.js');
const source = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
const block = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const tick = () => new Promise(resolve => setImmediate(resolve));

function fixture() {
  const first = { key: 'danbooru:1', source: 'danbooru', id: '1', title: 'One' };
  const second = { ...first, key: 'danbooru:2', id: '2', title: 'Two', thumbnail: 'https://cdn.donmai.us/preview/two.jpg' };
  const route = { warmed: new Map(), engine: { move: async () => second } };
  const tab = { id: 1, kind: 'detail', item: first, artworkRoute: route };
  const activations = [], reads = [], decoded = [];
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const entries = new Map();
  const context = vm.createContext({ CatalogLogic, AbortController, AbortSignal, Promise, Map,
    currentTab: () => tab, quickPreview: { open: false }, quickPreviewGeneration: 0,
    quickPreviewWork: null, quickPreviewRoute: null, defaultSources: ['danbooru'],
    galleryImages: item => item.images || [],
    imageLoader: { cached: url => entries.get(url), pin: () => () => {},
      rememberBlob(url, blob) { const entry = { blob, blobUrl: 'blob:ready' }; entries.set(url, entry); return entry; },
      async decode(entry) { decoded.push(entry); await gate; return entry; } },
    readMediaBlob: async (url, signal) => { reads.push({ url, signal }); return {}; },
    ratingFilterFor: () => 'all', activate: (...args) => activations.push(args), toast() {} });
  vm.runInContext(block('function warmArtworkRoute(', '\nfunction openDetail('), context);
  return { context, route, tab, first, second, activations, reads, decoded, release };
}

test('cancelled forward navigation returning the current work does not rebuild the viewer', async () => {
  const f = fixture(); f.route.engine.move = async () => f.first;
  f.release(); await f.context.moveArtwork(-1);
  assert.equal(f.activations.length, 0);
  assert.equal(f.reads.length, 0);
});

test('the old viewer remains until replacement pixels have decoded', async () => {
  const f = fixture(); const pending = f.context.moveArtwork(1);
  await tick();
  assert.equal(f.reads.length, 1);
  assert.equal(f.decoded.length, 1);
  assert.equal(f.activations.length, 0);
  f.release(); await pending;
  assert.equal(f.activations.length, 1);
  assert.equal(f.activations[0][2].item.key, f.second.key);
});

test('a superseded image preparation cannot replace the latest selected artwork', async () => {
  const f = fixture(); const pending = f.context.moveArtwork(1); await tick();
  f.route.engine.move = async () => f.first;
  await f.context.moveArtwork(-1);
  f.release(); await pending;
  assert.equal(f.reads[0].signal.aborted, true);
  assert.equal(f.activations.length, 0);
});

test('known neighbors start warming while the next catalog page is still pending', async () => {
  const f = fixture(); let details = 0;
  f.route.engine.state = { index: 0 }; f.route.engine.items = [f.first, f.second];
  f.route.engine.prefetch = () => new Promise(() => {});
  f.route.engine.neighbors = () => [f.second]; f.route.engine.update = () => {};
  f.context.request = async () => { details++; return f.second; };
  f.context.rememberItem = item => item;
  f.release(); f.context.warmArtworkRoute(f.route); await tick();
  assert.equal(details, 1);
  assert.equal(f.reads.length, 1);
  f.route.warmController.abort();
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const CatalogLogic = require('../wwwroot/catalog-logic.js');
const Navigation = require('../wwwroot/artwork-navigation.js');
const app = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
const block = (start, end) => app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start)));
const tick = () => new Promise(resolve => setImmediate(resolve));

function fixture(t, decode = async image => (await fetch(image.src)).text()) {
  const objectUrls = new Set(), reads = [], decoded = [];
  const main = { clientHeight: 900, querySelectorAll: () => [],
    getBoundingClientRect: () => ({ top: 0, bottom: 900 }) };
  const context = vm.createContext({ CatalogLogic, AbortController, AbortSignal, main,
    URL: {
      createObjectURL(blob) { const url = URL.createObjectURL(blob); objectUrls.add(url); return url; },
      revokeObjectURL(url) { URL.revokeObjectURL(url); objectUrls.delete(url); }
    },
    IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} },
    Image: class { async decode() { decoded.push(await decode(this)); } },
    galleryImages: item => item.images || [],
    readMediaBlob: async (url, signal) => {
      reads.push({ url, signal });
      return new Blob(['replacement pixels']);
    }
  });
  t.after(() => { for (const url of objectUrls) URL.revokeObjectURL(url); });
  const loader = vm.runInContext(block('const imageLoader = {', '\nconst autoFeed = {') + '\nimageLoader', context);
  context.imageLoader = loader;
  vm.runInContext(block('function warmArtworkRoute(', '\nfunction openDetail('), context);
  return { context, loader, reads, decoded };
}

test('preparation keeps replacement pixels usable when current media fills the cache budget', async t => {
  const f = fixture(t);
  const current = 'https://fixture.test/current.jpg';
  f.loader.current.add(current);
  f.loader.cache.set(current, { blobUrl: 'blob:current-media', size: 48 * 1024 * 1024 });
  f.loader.bytes = 48 * 1024 * 1024;

  await f.context.prepareArtworkMedia({ thumbnail: 'https://fixture.test/next.jpg' },
    new AbortController().signal);

  assert.deepEqual(f.decoded, ['replacement pixels'], 'Prepared media must remain usable until decoding finishes');
});

test('undecodable prepared bytes do not poison the visible image cache', async t => {
  const f = fixture(t, async () => { throw new Error('Invalid image'); });
  const url = 'https://fixture.test/invalid.jpg';
  const release = await f.context.prepareArtworkMedia({ thumbnail: url }, new AbortController().signal);
  release?.();
  assert.equal(f.loader.cached(url), undefined);
  assert.equal(f.loader.bytes, 0);
});

test('closing a preparing preview cancels its consumer and preserves the visible artwork position', async t => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const f = fixture(t, async image => { await gate; return (await fetch(image.src)).text(); });
  const works = [1, 2, 3].map(id => ({ key: `danbooru:${id}`, source: 'danbooru',
    id: String(id), thumbnail: `https://fixture.test/${id}.jpg` }));
  const route = { warmed: new Map(), engine: Navigation.create({ items: works, current: works[0] }) };
  const tab = { id: 1, kind: 'detail', item: works[0], artworkRoute: route };
  const quickPreview = { open: true, close() { this.open = false; }, replaceChildren() {} };
  Object.assign(f.context, { currentTab: () => tab, quickPreview,
    quickPreviewGeneration: 0, quickPreviewWork: works[0], quickPreviewRoute: route,
    quickPreviewZoomTimer: null, quickPreviewDrag: null, stopQuickPreviewMedia() {}, clearTimeout,
    defaultSources: [], ratingFilterFor: () => 'all', activate() {}, toast() {} });
  vm.runInContext(block('function closeQuickPreview(', '\nasync function toggleSavedWork('), f.context);

  const pending = f.context.moveArtwork(1);
  await tick();
  assert.equal(f.reads.length, 1);
  f.context.closeQuickPreview();
  const next = await route.engine.move(1);
  release();
  await pending;

  assert.equal(next?.key, works[1].key, 'The next arrow after closing must follow the artwork still shown below the preview');
  assert.equal(f.reads[0].signal.aborted, true, 'Closing must cancel the media consumer owned by the preview');
});

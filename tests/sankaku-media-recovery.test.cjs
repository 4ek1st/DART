const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const logic = require('../wwwroot/catalog-logic.js');
const old = 'https://v.sankakucomplex.com/preview/a.avif?expires=1&token=old';
const fresh = 'https://v.sankakucomplex.com/preview/a.avif?expires=4102444800&token=fresh';
const full = 'https://s.sankakucomplex.com/data/a.png?e=1&m=old';
const renewedFull = 'https://s.sankakucomplex.com/data/a.png?e=4102444800&m=fresh';

test('only expired, signed Sankaku media triggers proactive renewal', () => {
  assert.equal(logic.signedMediaExpired(old), true);
  assert.equal(logic.signedMediaExpired(full), true);
  assert.equal(logic.signedMediaExpired(fresh), false);
  assert.equal(logic.signedMediaExpired(old.replace('sankakucomplex.com', 'rule34.xxx')), false);
  assert.equal(logic.signedMediaExpired('https://v.sankakucomplex.com/a.jpg?expires=1'), false);
  assert.equal(logic.signedMediaExpired('https://v.sankakucomplex.com/a.jpg?expires=oops&token=x'), false);
});

test('renewing media preserves saved groups, metadata, ordering and other catalogs', () => {
  const item = { key: 'sankaku:AbC', source: 'sankaku', id: 'AbC', thumbnail: old,
    title: 'Saved title', creatorTag: 'confirmed_artist', tags: ['one'],
    images: [full, 'https://rule34.xxx/other.jpg'], memberKeys: ['sankaku:AbC', 'rule34:2'],
    imageRecords: [{ url: full, hash: 'a'.repeat(32) }, { url: 'https://rule34.xxx/other.jpg' }] };
  const detail = { key: 'sankaku:AbC', source: 'sankaku', thumbnail: fresh, images: [renewedFull] };
  const updated = logic.renewWorkMedia(item, detail);
  assert.equal(updated.thumbnail, fresh);
  assert.deepEqual(updated.images, [renewedFull, item.images[1]]);
  assert.deepEqual(updated.imageRecords[0], { url: renewedFull, hash: 'a'.repeat(32) });
  for (const field of ['title', 'creatorTag', 'tags', 'memberKeys']) assert.deepEqual(updated[field], item[field]);
  assert.equal(item.thumbnail, old, 'The pure helper does not mutate its input');
  const mirrored = { ...item, key: 'danbooru:5', source: 'danbooru', thumbnail: 'https://cdn.donmai.us/a.jpg' };
  assert.equal(logic.renewWorkMedia(mirrored, detail).thumbnail, mirrored.thumbnail);
  assert.equal(logic.renewWorkMedia(mirrored, detail).images[0], renewedFull);
});

function harness({ expired = true, failDetail = false, source = 'sankaku', count = 1 } = {}) {
  const item = { key: `${source}:AbC`, source, id: 'AbC', thumbnail: expired ? old : fresh,
    images: [full], memberKeys: [`${source}:AbC`, 'rule34:2'] };
  if (source !== 'sankaku') item.thumbnail = 'https://cdn.donmai.us/a.jpg';
  const calls = [], requests = [], likes = [structuredClone(item)];
  const refreshedUrl = expired ? fresh : fresh.replace('token=fresh', 'token=renewed');
  const tab = { kind: 'likes', items: likes };
  const images = Array.from({ length: count }, () => ({
    dataset: { imageUrl: item.thumbnail }, isConnected: true, src: '', failed: false,
    closest(selector) { return selector.includes('data-work-key') ? { dataset: { workKey: item.key } } :
      { classList: { add: () => { this.failed = true; }, remove: () => { this.failed = false; } } }; },
    getAttribute(name) { return name === 'src' ? this.src : null; },
    getBoundingClientRect: () => ({ top: 0, bottom: 100 })
  }));
  const main = { clientHeight: 1440, getBoundingClientRect: () => ({ top: 0, bottom: 1440 }),
    querySelectorAll: () => images };
  class FixtureURL extends URL {}
  FixtureURL.createObjectURL = () => 'blob:loaded'; FixtureURL.revokeObjectURL = () => {};
  const context = vm.createContext({ CatalogLogic: logic, likes, bookmarks: [], recent: [], tabs: [tab],
    itemIndex: new Map([[item.key, item]]), currentTab: () => tab, quickPreviewWork: null,
    main, URL: FixtureURL, URLSearchParams, AbortController, AbortSignal, setTimeout, clearTimeout,
    DartResourceCache: require('../wwwroot/resource-cache.js'),
    IntersectionObserver: class { observe() {} disconnect() {} },
    request: async url => { requests.push(url); await new Promise(r => setTimeout(r, 5));
      if (failDetail) throw new Error('Temporarily unavailable');
      return { key: 'sankaku:AbC', source: 'sankaku', id: 'AbC', thumbnail: refreshedUrl, images: [renewedFull] }; },
    fetch: async url => { calls.push(url); const requested = new URL(url, 'http://local').searchParams.get('url');
      const ok = requested === refreshedUrl;
      return { ok, blob: async () => ({ size: 10 }) }; }
  });
  const app = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
  vm.runInContext(app.slice(app.indexOf('function readMediaBlob('), app.indexOf('\nconst visualHashJobs')), context);
  const start = app.indexOf('const sankakuMediaRecovery = {');
  const end = app.indexOf('\nconst autoFeed = {', start);
  assert(start >= 0 && end > start, 'Shared image recovery must exist');
  vm.runInContext(app.slice(start, end) + '\nthis.loader = imageLoader; this.recovery = sankakuMediaRecovery;', context);
  const loader = context.loader;
  for (const img of images) { loader.visible.add(img); loader.enqueue(img, false); }
  return { loader, recovery: context.recovery, images, likes, calls, requests, item, async run() {
    loader.drain();
    while (loader.active || loader.queue.length) await new Promise(r => setTimeout(r, 5));
  } };
}

test('Liked renews expired media before loading and shares one refresh across duplicate cards', async () => {
  const probe = harness({ count: 2 }); await probe.run();
  assert.equal(probe.requests.length, 1);
  assert.equal(probe.calls.length, 1, 'Never request the known-expired URL');
  assert(probe.images.every(img => img.src === 'blob:loaded' && !img.failed));
  assert.equal(probe.likes[0].thumbnail, fresh);
  assert.equal(probe.likes[0].memberKeys.length, 2);
});

test('a failed refresh is bounded and does not delete a like or its existing media', async () => {
  const probe = harness({ failDetail: true }); await probe.run();
  for (const img of probe.images) probe.loader.enqueue(img, false);
  await probe.run();
  assert.equal(probe.requests.length, 1, 'Failed metadata refreshes have a cooldown');
  assert.equal(probe.likes.length, 1); assert.equal(probe.likes[0].thumbnail, old);
  assert.equal(probe.images[0].failed, true);
});

test('an unexpected CDN failure renews even a signature whose expiry has not arrived', async () => {
  const probe = harness({ expired: false }); await probe.run();
  assert.equal(probe.requests.length, 1); assert.equal(probe.calls.length, 2);
  assert.equal(probe.images[0].src, 'blob:loaded');
  assert.equal(probe.likes[0].thumbnail, fresh.replace('token=fresh', 'token=renewed'));
});

test('leaving the page during recovery does not attach pixels or start stale image work', async () => {
  const probe = harness(); probe.loader.drain();
  probe.loader.generation++;
  for (const controller of probe.loader.controllers) controller.abort();
  await probe.run();
  assert.equal(probe.images[0].src, ''); assert.equal(probe.calls.length, 0);
});

test('offscreen saved works do not start metadata or media requests', async () => {
  const probe = harness(); probe.loader.visible.clear(); await probe.run();
  assert.equal(probe.requests.length, 0); assert.equal(probe.calls.length, 0);
});

test('metadata queued by a page that has closed is skipped before it reaches the source', async () => {
  const probe = harness();
  const keep = new AbortController(), closed = new AbortController();
  const first = probe.recovery.post('First', keep.signal);
  const second = probe.recovery.post('Second', keep.signal);
  const queued = probe.recovery.post('Queued', closed.signal);
  closed.abort();
  await Promise.all([first, second, queued]);
  assert.equal(probe.requests.length, 2);
});

test('other catalogs keep their normal media path without a Sankaku request', async () => {
  const probe = harness({ source: 'danbooru' }); await probe.run();
  assert.equal(probe.requests.length, 0); assert.equal(probe.calls.length, 1);
});

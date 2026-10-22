const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const logic = require('../wwwroot/catalog-logic.js');
const source = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
const slice = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
function knownFixture() {
  let scans = 0;
  const context = vm.createContext({ Set, Map, WeakMap, likes: [{ key: 'danbooru:1', source: 'danbooru' }],
    bookmarks: [], recent: [], viewedTokens: new Set(['key:rule34:2']), viewedPending: new Set(),
    CatalogLogic: { ...logic, workHistoryTokens(item) { scans++; return logic.workHistoryTokens(item); } } });
  vm.runInContext(slice('function knownWorkTokens(', '\nfunction scheduleRelatedKnownRefresh('), context);
  return { context, read: () => context.knownWorkTokens(), scans: () => scans };
}
test('repeated history filtering reuses unchanged library identities', () => {
  const f = knownFixture();
  assert(f.read().has('key:danbooru:1'));
  assert(f.read().has('key:rule34:2'));
  f.read();
  assert.equal(f.scans(), 1, 'unchanged saved metadata is scanned once');
});
test('new/replaced libraries and same-size viewed/pending changes apply immediately', () => {
  const f = knownFixture(); f.read();
  f.context.viewedTokens.delete('key:rule34:2'); f.context.viewedTokens.add('key:rule34:3');
  f.context.viewedPending.add('key:gelbooru:4');
  assert(!f.read().has('key:rule34:2')); assert(f.read().has('key:rule34:3')); assert(f.read().has('key:gelbooru:4'));
  assert.equal(f.scans(), 1, 'live viewed changes do not rescan the library');
  f.context.likes.push({ key: 'sankaku:new', source: 'sankaku' });
  assert(f.read().has('key:sankaku:new'));
  f.context.likes = [{ key: 'danbooru:5', source: 'danbooru' }];
  assert(!f.read().has('key:danbooru:1')); assert(f.read().has('key:danbooru:5'));
});
test('learned hash invalidation refreshes cached library history', () => {
  const f = knownFixture(); f.read();
  f.context.likes[0].contentHash = 'a'.repeat(32); logic.invalidateGrouping(f.context.likes);
  assert(f.read().has('hash:' + 'a'.repeat(32)));
  f.context.likes[0].contentHash = 'b'.repeat(32); logic.refineGrouping(f.context.likes, [f.context.likes[0]]);
  assert(f.read().has('hash:' + 'b'.repeat(32))); assert(!f.read().has('hash:' + 'a'.repeat(32)));
});
test('an unchanged retained feed avoids the entire known-library lookup', () => {
  let reads = 0;
  const item = { key: 'danbooru:1', source: 'danbooru' }, tab = { kind: 'recommendations' };
  const filter = vm.runInNewContext(slice('function filterFeedWorks(', '\nfunction emptyFeedMessage(') + '\nfilterFeedWorks', {
    CatalogLogic: logic, contentPreferences: { hideViewedAndSaved: true }, isHideableFeed: () => true,
    isRetainedFeedWork: (_, work) => work.key === item.key, knownWorkTokens: () => { reads++; return new Set(['key:rule34:2']); },
    curateFeedWorks: works => works });
  assert.equal(filter([item], tab).length, 1); assert.equal(reads, 0);
  assert.equal(filter([item, { key: 'rule34:2', source: 'rule34' }], tab).length, 1); assert.equal(reads, 1);
});
test('one queue drain measures each image at most once while retaining viewport priority', async () => {
  const started = []; let rectReads = 0;
  class IntersectionObserver { observe() {} disconnect() {} }
  const loader = vm.runInNewContext(slice('const imageLoader = {', '\nconst autoFeed = {') + '\nimageLoader', {
    IntersectionObserver, main: { getBoundingClientRect: () => ({ top: 0, bottom: 800 }) }, URL, AbortController, CatalogLogic: logic,
    readMediaBlob(url) { started.push(url); return new Promise(() => {}); } });
  const images = Array.from({ length: 96 }, (_, index) => ({ isConnected: true, dataset: { imageUrl: 'url-' + index },
    getBoundingClientRect() { rectReads++; return { top: index === 95 ? 100 : 1000, bottom: index === 95 ? 300 : 1200 }; } }));
  loader.visible = new Set(images); loader.queue = images.map(image => ({ url: image.dataset.imageUrl, images: new Set([image]), generation: loader.generation }));
  loader.active = 3; await loader.drain();
  assert.deepEqual(started, ['url-95']); assert(rectReads <= 96, `${rectReads} rect reads for 96 queued images`);
});

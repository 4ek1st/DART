const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const CatalogLogic = require('../wwwroot/catalog-logic.js');
const app = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
const block = (start, end) => app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start)));
const tick = () => new Promise(resolve => setImmediate(resolve));
const listing = { source: 'danbooru', id: '1', key: 'danbooru:1',
  images: ['https://fixture.test/listing.png'], tags: ['landscape'], rating: 'g' };
const detail = { ...listing, contentHash: 'a'.repeat(32), images: ['https://fixture.test/original.png'] };

function fixture() {
  const tab = { id: 1, kind: 'detail', item: { ...listing } }, persisted = new Set(), posts = [];
  const context = vm.createContext({ CatalogLogic, Map, Set, AbortController, URLSearchParams,
    contentPreferences: { hideViewedAndSaved: true }, recent: [], likes: [], bookmarks: [],
    viewedTokens: new Set(), viewedPending: new Set(), activeId: tab.id,
    findTab: id => id === tab.id ? tab : null, rememberItem: item => item,
    localStorage: { setItem() {} }, scheduleRelatedKnownRefresh() {}, toast() {}, render() {},
    refreshSavedDetail() {}, saveSession() {}, loadCreatorWorks() {}, loadRelated() {}, warmArtworkRoute() {},
    request: async (path, options = {}) => {
      if (path.startsWith('/api/detail?')) return detail;
      assert.equal(path, '/api/viewed-identities');
      assert.equal(options.method, 'POST');
      const batch = JSON.parse(options.body); posts.push(batch);
      batch.forEach(token => persisted.add(token));
      return {};
    }
  });
  vm.runInContext(block('function recordDetailVisit(', '\nfunction abortTab(') +
    block('async function recordViewedWorks(', '\nasync function refreshFollows(') +
    block('async function loadDetail(', '\nasync function loadCreatorWorks(') +
    block('function knownWorkTokens(', '\nfunction scheduleRelatedKnownRefresh('), context);
  return { context, tab, persisted, posts };
}

test('displayed detail identities stay hidden after their sparse listing leaves the 40-item recent history', async () => {
  const f = fixture();
  f.context.recordDetailVisit(f.tab); await tick();
  assert.equal(f.persisted.has(`key:${listing.key}`), true);
  assert.equal(f.persisted.has(`hash:${detail.contentHash}`), false,
    'The listing genuinely lacks the identity that detail will teach');
  await f.context.loadDetail(f.tab); await tick();
  assert.equal(f.tab.item.contentHash, detail.contentHash);
  assert.equal(f.context.recent[0].contentHash, detail.contentHash);
  for (let index = 0; index < 40; index++) f.context.recordDetailVisit({ item: {
    source: 'gelbooru', id: String(index + 10), key: `gelbooru:${index + 10}`,
    images: [`https://fixture.test/other-${index}.png`], tags: ['landscape'], rating: 'g' } });
  await tick();
  assert.equal(f.context.recent.length, 40);
  assert.equal(f.context.recent.some(item => item.key === listing.key), false);
  assert.equal(f.context.viewedPending.size, 0);
  assert.equal(f.persisted.has(`hash:${detail.contentHash}`), true,
    'Learned displayed identities must survive independently of the bounded recent list');
  f.context.viewedTokens = new Set(f.persisted);
  const mirror = { source: 'rule34', id: '500', key: 'rule34:500',
    images: ['https://fixture.test/mirror.png'], contentHash: detail.contentHash, rating: 'g' };
  assert.equal(CatalogLogic.hideViewedWorks([mirror], f.context.knownWorkTokens()).length, 0);
});

test('a cancelled or replaced detail request does not persist the discarded metadata', async () => {
  for (const cancelled of ['abort', 'replace']) {
    const f = fixture(); let finish;
    const transport = f.context.request;
    f.context.request = (path, options) => path.startsWith('/api/detail?')
      ? new Promise(resolve => { finish = resolve; }) : transport(path, options);
    f.context.recordDetailVisit(f.tab); await tick();
    const loading = f.context.loadDetail(f.tab);
    if (cancelled === 'abort') f.tab.detailController.abort();
    else f.context.findTab = () => ({ id: f.tab.id });
    finish(detail); await loading; await tick();
    assert.equal(f.persisted.has(`hash:${detail.contentHash}`), false, cancelled);
  }
});

test('speculatively warming an unvisited neighbor does not add its learned identities to viewed history', async () => {
  const f = fixture(), neighbor = { source: 'rule34', id: '600', key: 'rule34:600', images: [] };
  Object.assign(f.context, { galleryImages: () => [], imageLoader: { cached() {} } });
  const transport = f.context.request;
  f.context.request = (path, options) => path.startsWith('/api/detail?')
    ? Promise.resolve({ ...neighbor, contentHash: 'b'.repeat(32) }) : transport(path, options);
  vm.runInContext(block('function warmArtworkRoute(', '\nasync function prepareArtworkMedia('), f.context);
  const route = { warmed: new Map(), engine: { state: { index: 0 }, items: [listing],
    neighbors: () => [neighbor], prefetch: async () => {}, update() {} } };
  f.context.warmArtworkRoute(route); await route.warming; await tick();
  assert.equal(route.warmed.get(neighbor.key).contentHash, 'b'.repeat(32));
  assert.equal(f.persisted.size, 0);
  assert.equal(f.context.viewedTokens.size, 0);
});

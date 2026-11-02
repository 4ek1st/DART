const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('./helpers/viewer-vm.cjs');
const CatalogLogic = require('../wwwroot/catalog-logic.js');
const app = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
const keys = works => Array.from(works, work => work.key);
const preferences = { enabled: true, popularity: true, personal: true, freshness: true, resolution: true };
function fixture() {
  const context = vm.createContext({ CatalogLogic, contentPreferences: { curation: { ...preferences } },
    curationContext: () => ({ liked: [] }) });
  const start = app.indexOf('function curateFeedWorks(');
  vm.runInContext(app.slice(start, app.indexOf('\nfunction emptyFeedMessage(', start)), context);
  return context;
}
function work(source, id, published, popularityCount = 1) {
  return { key: `${source}:${id}`, id: String(id), source, rating: 'e', published, popularityCount,
    creatorTag: `fixture_${source}_${id}`, tags: ['landscape'],
    width: popularityCount > 1 ? 4096 : 1024, height: popularityCount > 1 ? 4096 : 1024,
    images: [`https://fixture.test/${source}/${id}.jpg`] };
}

for (const source of CatalogLogic.supportedSources) {
  test(`Following does not lift old popular ${source} works above recent publications`, () => {
    const context = fixture();
    const recent = work(source, 1, '2026-11-02T12:00:00Z');
    const old = work(source, 2, '2026-08-31T02:11:44Z', 100000);
    for (const detached of [false, true]) {
      const tab = { kind: 'follows', rating: 'all', artworkDetached: detached };
      assert.deepEqual(keys(context.filterFeedWorks([recent, old], tab, true, 'follows')), [recent.key, old.key]);
    }
  });
}

test('Following preserves publication order inside the New group with every quality factor enabled', () => {
  const context = fixture();
  const newest = work('danbooru', 1, '2026-11-02T12:00:00Z');
  const olderNew = work('sankaku', 2, '2026-11-01T12:00:00Z', 100000);
  const ordinary = work('rule34', 3, '2026-10-10T12:00:00Z', 100000);
  const feed = CatalogLogic.groupFollowFeed([{ follow: { followedAt: '2026-10-31T00:00:00Z' },
    items: [ordinary, olderNew, newest] }], 'all');
  const tab = { kind: 'follows', rating: 'all', newKeys: feed.newKeys };
  assert.deepEqual(keys(context.filterFeedWorks(feed.items, tab, true, 'follows')),
    [newest.key, olderNew.key, ordinary.key]);
});

test('Following keeps staged cards stable when another old high-score work arrives', () => {
  const context = fixture();
  const recent = work('gelbooru', 1, '2026-11-02T12:00:00Z');
  const old = work('danbooru', 2, '2026-08-31T12:00:00Z', 10000);
  const late = work('sankaku', 3, '2025-06-01T12:00:00Z', 100000);
  const tab = { kind: 'follows', rating: 'all' };
  const first = context.filterFeedWorks([recent, old], tab, true, 'follows');
  const staged = CatalogLogic.stableFeedItems(first, [recent, old, late]);
  assert.deepEqual(keys(context.filterFeedWorks(staged, tab, true, 'follows')), [recent.key, old.key, late.key]);
});

test('Following bypasses quality ranking while keeping content filtering active', () => {
  const context = fixture(), recent = work('danbooru', 1, '2026-11-02T12:00:00Z');
  const hidden = { ...work('sankaku', 2, '2026-08-31T12:00:00Z', 100000), tags: ['blocked'] };
  context.contentPreferences.excludedTags = ['blocked'];
  context.CatalogLogic = { ...CatalogLogic, rankCuratedWorks() { throw new Error('Following must not rerank its dates'); } };
  context.curationContext = () => { throw new Error('Following must not rebuild the taste profile'); };
  assert.deepEqual(keys(context.filterFeedWorks([recent, hidden], { kind: 'follows', rating: 'all' }, true)), [recent.key]);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('./helpers/viewer-vm.cjs');
const CatalogLogic = require('../wwwroot/catalog-logic.js');
const DartArtworkNavigation = require('../wwwroot/artwork-navigation.js');
const source = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
const block = (start, end) => {
  const first = source.indexOf(start), last = source.indexOf(end, first);
  assert.ok(first >= 0 && last > first, `Missing application block: ${start}`);
  return source.slice(first, last);
};
const work = (id, score = 0, extra = {}) => ({ key: `danbooru:${id}`, source: 'danbooru',
  id: String(id), title: `Neutral work ${id}`, tags: ['landscape'], rating: 'g',
  popularityCount: score, ...extra });
const keys = items => Array.from(items, item => item.key);
const curation = { enabled: true, popularity: true, personal: false, freshness: false, resolution: false };

function fixture(kind = 'likes', items = []) {
  const tab = { id: 1, kind, items, started: true }, tabs = [tab];
  const context = vm.createContext({ CatalogLogic, DartArtworkNavigation, structuredClone,
    contentPreferences: { curation: { ...curation } }, likes: [], bookmarks: [], recent: items,
    likedKeys: new Set(), savedKeys: new Set(), tabs, currentTab: () => tab,
    findTab: id => tabs.find(item => item.id === id), rememberItems() {},
    scheduleRelatedKnownRefresh() {}, toast() {}, isExpiredFeedWork: () => false,
    renderFeedCard: item => `<span>${item.key}</span>`, escapeHtml: String,
    emptyFeedMessage: () => '<div>Empty</div>',
    request() { throw Error('Reading a saved library must not request catalogs'); } });
  context.curationContext = () => ({ liked: context.likes, curation: context.contentPreferences.curation });
  vm.runInContext(block('function isHideableFeed(', '\nfunction isFollowedArtistFeed(') +
    block('function curateFeedWorks(', '\nfunction emptyFeedMessage(') +
    block('function renderGrid(', '\nfunction renderFeedCard(') +
    block('function setSavedWorks(', '\nasync function refreshBookmarks(') +
    block('const artworkRoutes = new Set();', '\nfunction pruneArtworkRoutes('), context);
  return { context, tab };
}

test('a low-score latest like remains first instead of older high-score works', () => {
  const items = [work(1), work(2, 1000), work(3, 100)];
  const { context, tab } = fixture('likes', items);
  assert.deepEqual(keys(context.filterFeedWorks(items, tab, false, 'likes')), keys(items));
  assert.deepEqual(keys(items), ['danbooru:1', 'danbooru:2', 'danbooru:3']);
});
test('manual Favorites preserve target-first traversal even with discovery curation enabled',async()=>{
 const items=[work(1),work(2,1000000)],{context,tab}=fixture('favorites',items);
 const route=context.createArtworkRoute(tab,items[0]);
 assert.deepEqual(keys(context.filterFeedWorks(items,tab)),keys(items));
 assert.equal((await route.engine.move(1))?.key,items[1].key);
});

test('saved chronology still groups mirrors at the newest slot and applies content filters', () => {
  const newest = work(1, 0, { key: 'sankaku:one', source: 'sankaku', id: 'one', contentHash: 'a'.repeat(32) });
  const older = work(2, 1000), mirror = work(3, 500, { contentHash: 'a'.repeat(32) });
  const hidden = work(4, 2000, { tags: ['ai_generated'] });
  const items = [newest, older, hidden, mirror], { context, tab } = fixture('likes', items);
  context.contentPreferences.aiMode = 'generated';
  const visible = context.filterFeedWorks(items, tab, false, 'likes');
  assert.equal(visible.length, 2);
  assert.ok(CatalogLogic.sameWork(visible[0], newest), 'The deduplicated group retains its latest saved slot');
  assert.ok(visible[0].memberKeys.includes(newest.key));
  assert.ok(visible[0].memberKeys.includes(mirror.key));
  assert.equal(visible[1].key, older.key);
});

test('rendered saved grids and both gallery directions use the same chronological sequence', async () => {
  for (const kind of ['likes', 'bookmarks', 'recent']) {
    const items = [work(1), work(2, 1000), work(3, 100)], { context, tab } = fixture(kind, items);
    context.renderGrid(items, kind);
    assert.deepEqual(keys(tab.artworkLists.get(kind)), keys(items), kind);
    const route = context.createArtworkRoute(tab, items[0]);
    assert.equal((await route.engine.move(1)).key, items[1].key, `${kind}: next`);
    assert.equal((await route.engine.move(-1)).key, items[0].key, `${kind}: previous`);
  }
});

test('opening a saved gallery before its grid cache exists also retains chronology', async () => {
  const items = [work(1), work(2, 1000)], { context, tab } = fixture('likes', items);
  const route = context.createArtworkRoute(tab, items[0]);
  assert.equal((await route.engine.move(1)).key, items[1].key);
  assert.equal(await route.engine.move(1), null);
  assert.equal((await route.engine.move(-1)).key, items[0].key);
});

test('late saved metadata hydration preserves positions and never restores a removed like', () => {
  const items = [work(1), work(2)], { context, tab } = fixture('likes', items);
  context.setSavedWorks('likes', items);
  context.refreshSavedDetail(work(2, 1000, { thumbnail: 'https://cdn.donmai.us/neutral.jpg', tags: ['landscape', 'watercolor'] }));
  context.renderGrid(context.likes, 'likes');
  assert.deepEqual(keys(context.likes), keys(items));
  assert.deepEqual(keys(tab.artworkLists.get('likes')), keys(items));
  context.setSavedWorks('likes', [items[0]]);
  context.refreshSavedDetail(work(2, 1000));
  assert.deepEqual(keys(context.likes), [items[0].key]);
});

test('changing curation preferences never reranks saved lists or reuses an older quality order', () => {
  const items = [work(1), work(2, 1000)], { context, tab } = fixture('bookmarks', items);
  for (const enabled of [true, false, true]) {
    context.contentPreferences = { curation: { ...curation, enabled } };
    context.renderGrid(items, 'bookmarks');
    assert.deepEqual(keys(tab.artworkLists.get('bookmarks')), keys(items));
  }
});

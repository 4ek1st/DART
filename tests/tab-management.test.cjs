const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const CatalogLogic = require('../wwwroot/catalog-logic.js');
const source = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');

function slice(start, end) { return source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start))); }
function fixture() {
  const values = new Map(), writes = [], visits = [];
  const context = vm.createContext({ CatalogLogic, URLSearchParams, AbortController,
    tabs: [], nextId: 1, activeId: null, navigation: [], navPosition: -1,
    main: { scrollTop: 0, dataset: {}, querySelectorAll: () => [] },
    defaultSources: ['danbooru', 'gelbooru', 'rule34'],
    names: { danbooru: 'Danbooru', gelbooru: 'Gelbooru', rule34: 'Rule34' },
    tabPreferences: { artworkTabs: 'preview' }, recent: [], recommendationExposure: [],
    detailImageDeduper: { duplicates: { entries: () => [] } },
    localStorage: { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) },
    fetch: async (url, options) => { writes.push(JSON.parse(options.body)); return {}; },
    getSearchHistory: () => [], rememberItem: item => item, retainFeedWork() {},
    ratingFilterFor: () => 'all', recordViewedWorks: async items => visits.push(...items.map(item => item.key)),
    hideTabPanels() {}, closeQuickPreview() {}, pauseDetailVideos() {}, loadFollowFeed() {}, scheduleFollowRetry() {},
    renderChrome() {}, loadCreatorWorks() {}, loadRelated() {},
    clearTimeout, setTimeout, toast() {}, startTab(tab) { if (tab) tab.started = true; },
    render() { this.main.dataset.tabId = String(this.activeId); }
  });
  vm.runInContext('function findTab(id) { return tabs.find(tab => tab.id === id); } function currentTab() { return findTab(activeId); }', context);
  vm.runInContext(slice('function saveSession(', '\nasync function saveRecommendationTagPreference('), context);
  vm.runInContext(slice('function restoreSession(', '\nfunction openSearch('), context);
  vm.runInContext(slice('function openDetail(', '\nfunction isSavedWork('), context);
  // The app's real rendering is exercised in the browser checks; this harness keeps the navigation state real.
  context.render = () => { context.main.dataset.tabId = String(context.activeId); };
  context.hideTabPanels = () => {};
  return { context, values, writes, visits, run: code => vm.runInContext(code, context) };
}
const a = { key: 'danbooru:1', source: 'danbooru', id: '1', title: 'One', rating: 'g' };
const b = { key: 'gelbooru:2', source: 'gelbooru', id: '2', title: 'Two', rating: 'g' };

test('casual artwork browsing reuses one preview tab', () => {
  const f = fixture(); f.context.a = a; f.context.b = b;
  f.run('createTab("bookmarks", "Закладки"); openDetail(a); openDetail(b);');
  assert.equal(f.context.tabs.length, 2);
  assert.equal(f.run('currentTab().item.key'), 'gelbooru:2');
});

test('back and forward restore previous artwork and the original feed scroll', () => {
  const f = fixture(); f.context.a = a; f.context.b = b;
  f.run('createTab("bookmarks", "Закладки"); main.scrollTop = 640; openDetail(a); main.scrollTop = 210; openDetail(b); travel(-1);');
  assert.equal(f.run('currentTab().item.key'), 'danbooru:1');
  assert.equal(f.context.main.scrollTop, 210);
  f.run('travel(-1)');
  assert.equal(f.run('currentTab().kind'), 'bookmarks');
  assert.equal(f.context.main.scrollTop, 640);
  f.run('travel(1); travel(1)');
  assert.equal(f.run('currentTab().item.key'), 'gelbooru:2');
});

test('pinned preview stays open and the same artwork is not duplicated', () => {
  const f = fixture(); f.context.a = a; f.context.b = b;
  f.run('createTab("home", "Главная"); openDetail(a); pinTab(activeId); openDetail(b); openDetail(a);');
  assert.equal(f.context.tabs.length, 3);
  assert.equal(f.run('currentTab().item.key'), 'danbooru:1');
  assert.equal(f.run('currentTab().pinned'), true);
});

test('explicit background opening keeps the feed active and marks viewing only on activation', () => {
  const f = fixture(); f.context.a = a;
  f.run('createTab("bookmarks", "Закладки"); openDetail(a, { separate: true, background: true });');
  assert.equal(f.run('currentTab().kind'), 'bookmarks');
  assert.equal(f.visits.length, 0);
  f.run('activate(tabs[1].id)');
  assert.deepEqual(f.visits, ['danbooru:1']);
});

test('identical searches and sections reuse tabs while changed filters stay separate', () => {
  const f = fixture();
  f.run('createTab("follows", "Подписки"); createTab("follows", "Подписки"); createTab("search", "cats", { query: "cats", rating: "all", selectedSources: ["danbooru", "gelbooru"] }); createTab("search", "cats", { query: "cats", rating: "all", selectedSources: ["gelbooru", "danbooru"] }); createTab("search", "cats", { query: "cats", rating: "general", selectedSources: ["danbooru", "gelbooru"] });');
  assert.equal(f.context.tabs.length, 3);
});

test('bulk closing preserves pinned tabs and leaves usable navigation', () => {
  const f = fixture();
  f.run('createTab("home", "Главная"); pinTab(activeId); createTab("bookmarks", "Закладки"); createTab("follows", "Подписки"); closeOtherTabs(tabs[1].id, "others");');
  assert.equal(f.context.tabs.length, 2);
  assert.equal(f.run('tabs.some(tab => tab.kind === "home" && tab.pinned)'), true);
  assert.equal(f.run('currentTab().kind'), 'bookmarks');
});

test('clear all cancels pending work and persists one fresh home without changing personal storage', () => {
  const f = fixture();
  f.values.set('artcatalog-recent', '["keep-history"]');
  f.values.set('artcatalog-favorite-tags', '["keep-tag"]');
  f.run('createTab("bookmarks", "Закладки"); pinTab(activeId); createTab("follows", "Подписки"); main.scrollTop = 800;');
  const controllers = f.context.tabs.map(tab => tab.relatedController = new AbortController());
  f.run('clearTabs()');
  assert.equal(f.context.tabs.length, 1);
  assert.equal(f.run('currentTab().kind'), 'home');
  assert.equal(f.context.navigation.length, 1);
  assert.equal(f.context.main.scrollTop, 0);
  assert(controllers.every(controller => controller.signal.aborted));
  assert.equal(JSON.parse(f.values.get('artcatalog-session')).tabs.length, 1);
  assert.equal(f.values.get('artcatalog-recent'), '["keep-history"]');
  assert.equal(f.values.get('artcatalog-favorite-tags'), '["keep-tag"]');
});

test('session restores more than sixteen tabs, the active work, pins and preview preference', () => {
  const f = fixture();
  f.run('for (let i = 0; i < 24; i++) createTab("search", "tag" + i, { query: "tag" + i }); pinTab(activeId); tabPreferences.artworkTabs = "new"; saveSession();');
  const saved = JSON.parse(f.values.get('artcatalog-session'));
  assert.equal(saved.tabs.length, 24);
  f.run('tabs.length = 0; activeId = null; restoreSession();');
  assert.equal(f.context.tabs.length, 24);
  assert.equal(f.run('currentTab().query'), 'tag23');
  assert.equal(f.run('currentTab().pinned'), true);
});

test('late detail response cannot overwrite a replacement preview', async () => {
  const f = fixture(); f.context.a = a; f.context.b = b;
  f.run('createTab("home", "Главная"); openDetail(a);');
  const old = f.run('currentTab()');
  let finish;
  f.context.request = () => new Promise(resolve => { finish = resolve; });
  f.context.savedKeys = new Set(); f.context.likedKeys = new Set(); f.context.loadCreatorWorks = () => {}; f.context.loadRelated = () => {};
  vm.runInContext(slice('async function loadDetail(', '\nasync function loadCreatorWorks('), f.context);
  const pending = f.context.loadDetail(old);
  f.run('openDetail(b);');
  finish({ ...a, title: 'Late old work' }); await pending;
  assert.equal(f.run('currentTab().item.key'), 'gelbooru:2');
  assert.equal(f.run('currentTab().title'), 'Two');
});

test('leaving Following preserves its bounded pending load and returning does not restart it', () => {
  const f=fixture();let reloads=0;f.context.loadFollowFeed=()=>reloads++;
  f.run('createTab("follows", "Following"); currentTab().loading = true; currentTab().followController = new AbortController();');
  const tab=f.run('currentTab()');
  f.run('createTab("home", "Home"); activate(tabs[0].id);');
  assert.equal(tab.followController.signal.aborted,false);assert.equal(reloads,0);
  f.run('closeTab(tabs[0].id)');assert.equal(tab.followController.signal.aborted,true);
});

test('returning to a minute-old Following snapshot keeps its content and scroll without reloading', () => {
  const f=fixture();let reloads=0;f.context.loadFollowFeed=()=>reloads++;
  f.run('createTab("follows", "Following"); currentTab().items = [{key:"work:1"}]; currentTab().lastLoadedAt = Date.now()-61000; main.scrollTop = 730; createTab("home", "Home"); activate(tabs[0].id);');
  assert.equal(reloads,0);assert.equal(f.context.main.scrollTop,730);
  assert.equal(f.run('currentTab().items.length'),1);assert.equal(f.run('currentTab().resumePrefetchAt'),730);
});

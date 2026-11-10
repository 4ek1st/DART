const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('./helpers/viewer-vm.cjs');
const CatalogLogic = require('../wwwroot/catalog-logic.js');
const source = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');

function slice(start, end) { return source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start))); }
function fixture() {
  const values = new Map();
  const context = vm.createContext({ CatalogLogic, URLSearchParams, AbortController, contentPreferences: {},
    tabs: [], nextId: 1, activeId: null, navigation: [], navPosition: -1,
    main: { scrollTop: 0, dataset: {}, querySelectorAll: () => [] },
    searchInput: { value: '' }, hidePopover() {},
    defaultSources: ['danbooru', 'gelbooru', 'rule34'],
    names: { danbooru: 'Danbooru', gelbooru: 'Gelbooru', rule34: 'Rule34' },
    tabPreferences: { artworkTabs: 'preview' }, recent: [], recommendationExposure: [], recommendationExposureGroups: [],
    detailImageDeduper: { duplicates: { entries: () => [] }, verified: new Set() },
    clientStateWriter: { save() { return Promise.resolve(true); } },
    localStorage: { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) },
    fetch: async () => ({}), getSearchHistory: () => [], rememberItem: item => item, retainFeedWork() {},
    ratingFilterFor: () => 'all', recordViewedWorks: async () => {},
    favoritesController: () => ({ record() {}, metadata() {} }),
    hideTabPanels() {}, closeQuickPreview() {}, pauseDetailVideos() {}, loadFollowFeed() {}, scheduleFollowRetry() {},
    renderChrome() {}, loadCreatorWorks() {}, loadRelated() {},
    clearTimeout, setTimeout, toast() {}, startTab(tab) { if (tab) tab.started = true; },
    createArtworkRoute: () => null, pruneArtworkRoutes() {}, warmArtworkRoute() {},
    render() { this.main.dataset.tabId = String(this.activeId); }
  });
  vm.runInContext('function findTab(id) { return tabs.find(tab => tab.id === id); } function currentTab() { return findTab(activeId); }', context);
  vm.runInContext(slice('function captureClientState(', '\nasync function saveRecommendationTagPreference('), context);
  vm.runInContext(slice('function restoreSession(', '\nfunction getSearchHistory('), context);
  vm.runInContext(slice('function openDetail(', '\nfunction isSavedWork('), context);
  context.render = () => { context.main.dataset.tabId = String(context.activeId); };
  context.hideTabPanels = () => {};
  return { context, values, run: code => vm.runInContext(code, context) };
}
const art = { key: 'danbooru:1', source: 'danbooru', id: '1', title: 'One', rating: 'g' };
const artTwo = { key: 'gelbooru:2', source: 'gelbooru', id: '2', title: 'Two', rating: 'g' };
const open = (f, query, flags = '{ temporary: true }') => f.run(`openSearch(${JSON.stringify(query)}, ${flags})`);

test('tag searches opened from an artwork reuse one temporary tab', () => {
  const f = fixture(); f.context.art = art;
  f.run('createTab("home", "Главная"); openDetail(art);');
  open(f, 'cats'); open(f, 'dogs'); open(f, 'birds');
  assert.equal(f.context.tabs.filter(tab => tab.kind === 'search').length, 1);
  assert.equal(f.run('currentTab().query'), 'birds');
  assert.equal(f.run('currentTab().preview'), true);
});

test('searches typed or opened outside an artwork stay permanent', () => {
  const f = fixture(); f.context.art = art;
  f.run('createTab("home", "Главная"); openDetail(art);');
  open(f, 'cats', '{}'); open(f, 'dogs', '{}');
  assert.equal(f.context.tabs.filter(tab => tab.kind === 'search').length, 2);
  assert(f.context.tabs.filter(tab => tab.kind === 'search').every(tab => !tab.preview));
});

test('Shift+click and the middle button keep a permanent tab beside the temporary one', () => {
  const f = fixture(); f.context.art = art;
  f.run('createTab("home", "Главная"); openDetail(art);');
  open(f, 'cats'); open(f, 'dogs', '{ temporary: true, separate: true }');
  open(f, 'birds', '{ separate: true, background: true }');
  const searches = f.context.tabs.filter(tab => tab.kind === 'search');
  assert.deepEqual(searches.map(tab => [tab.query, !!tab.preview]), [['cats', true], ['dogs', false], ['birds', false]]);
  assert.equal(f.run('currentTab().query'), 'dogs');
});

test('searches and profiles share one temporary slot and an identical page is reused', () => {
  const f = fixture(); f.context.art = art;
  f.run('createTab("home", "Главная"); openDetail(art);');
  const ref = artist => `{ profileRef: { source: "danbooru", artist: "${artist}" }, rating: "all" }`;
  f.run(`openTemporaryTab("profile", "One", ${ref('one')}, { temporary: true });`);
  f.run(`openTemporaryTab("profile", "Two", ${ref('two')}, { temporary: true });`);
  assert.equal(f.context.tabs.filter(tab => tab.kind === 'profile').length, 1);
  open(f, 'cats');
  assert.equal(f.context.tabs.filter(tab => tab.kind === 'profile' || tab.kind === 'search').length, 1);
  assert.equal(f.run('currentTab().kind'), 'search');
  f.run(`openTemporaryTab("profile", "Two", ${ref('two')}, { temporary: true });`);
  assert.equal(f.context.tabs.filter(tab => tab.kind === 'profile').length, 1);
  assert.equal(f.run('currentTab().profileRef.artist'), 'two');
  assert.equal(f.context.tabs.filter(tab => tab.kind === 'profile' || tab.kind === 'search').length, 1);
});

test('Back restores the replaced search with its own content, Forward returns to the newer one', () => {
  const f = fixture(); f.context.art = art;
  f.run('createTab("home", "Главная"); openDetail(art);');
  open(f, 'cats'); f.run('currentTab().items = [{ key: "danbooru:9" }]');
  open(f, 'dogs');
  assert.equal(f.run('currentTab().query'), 'dogs');
  assert.equal(f.run('currentTab().items.length'), 0);
  f.run('travel(-1)');
  assert.equal(f.run('currentTab().query'), 'cats');
  assert.equal(f.run('currentTab().items.length'), 1);
  f.run('travel(-1)');
  assert.equal(f.run('currentTab().kind'), 'detail');
  f.run('travel(1); travel(1)');
  assert.equal(f.run('currentTab().query'), 'dogs');
  assert.equal(f.context.tabs.filter(tab => tab.kind === 'search').length, 1);
});

test('a pinned temporary search stays and the next one gets a new temporary tab', () => {
  const f = fixture(); f.context.art = art;
  f.run('createTab("home", "Главная"); openDetail(art);');
  open(f, 'cats'); f.run('pinTab(activeId)');
  f.run('activate(tabs.find(tab => tab.kind === "detail").id)');
  open(f, 'dogs');
  const searches = f.context.tabs.filter(tab => tab.kind === 'search');
  assert.deepEqual(searches.map(tab => [tab.query, !!tab.pinned, !!tab.preview]), [['cats', true, false], ['dogs', false, true]]);
});

test('switching to separate tabs keeps every search permanent', () => {
  const f = fixture(); f.context.art = art;
  f.run('tabPreferences.artworkTabs = "new"; createTab("home", "Главная"); openDetail(art);');
  open(f, 'cats'); open(f, 'dogs');
  assert.equal(f.context.tabs.filter(tab => tab.kind === 'search').length, 2);
});

test('closing searches and profiles keeps pinned tabs, artworks and other sections', () => {
  const f = fixture(); f.context.art = art; f.context.artTwo = artTwo;
  f.run('createTab("home", "Главная"); createTab("bookmarks", "Закладки"); openDetail(art);');
  for (const query of ['a', 'b', 'c']) open(f, query, '{ separate: true }');
  f.run('pinTab(tabs.find(tab => tab.query === "b").id)');
  f.run('createTab("profile", "Artist", { profileRef: { source: "danbooru", artist: "x" } });');
  const closed = f.run('closeSearchAndProfileTabs()');
  assert.equal(closed, 3);
  assert.deepEqual(f.context.tabs.map(tab => tab.kind), ['home', 'bookmarks', 'detail', 'search']);
  assert.equal(f.run('tabs.at(-1).query'), 'b');
  assert(f.context.navigation.every(entry => f.run(`!!findTab(${entry.id})`)));
  assert.equal(f.run('closeSearchAndProfileTabs()'), 0);
});

test('closing the active search moves to home and never leaves no tab', () => {
  const f = fixture();
  f.run('createTab("home", "Главная"); createTab("search", "a", { query: "a" }); createTab("search", "b", { query: "b" });');
  f.run('closeSearchAndProfileTabs()');
  assert.deepEqual(f.context.tabs.map(tab => tab.kind), ['home']);
  assert.equal(f.run('currentTab().kind'), 'home');
  const g = fixture();
  g.run('createTab("search", "a", { query: "a" }); closeSearchAndProfileTabs();');
  assert.deepEqual(g.context.tabs.map(tab => tab.kind), ['home']);
});

test('the session restores one temporary artwork and one temporary search or profile', () => {
  const f = fixture(); f.context.art = art;
  f.run('createTab("home", "Главная"); openDetail(art);');
  open(f, 'cats');
  f.run('openTemporaryTab("profile", "One", { profileRef: { source: "danbooru", artist: "one" }, rating: "all" }, { temporary: true }); saveSession();');
  const saved = JSON.parse(f.values.get('artcatalog-session'));
  assert.equal(saved.tabs.filter(tab => tab.preview).length, 2);
  f.run('tabs.length = 0; activeId = null; restoreSession();');
  assert.equal(f.context.tabs.filter(tab => tab.preview).map(tab => tab.kind).sort().join(','), 'detail,profile');
  // A damaged file with several temporary search or profile tabs restores only the first.
  saved.tabs.push({ ...saved.tabs.find(tab => tab.kind === 'search'), query: 'extra' });
  f.values.set('artcatalog-session', JSON.stringify(saved));
  f.run('tabs.length = 0; activeId = null; restoreSession();');
  assert.equal(f.context.tabs.filter(tab => (tab.kind === 'search' || tab.kind === 'profile') && tab.preview).length, 1);
});

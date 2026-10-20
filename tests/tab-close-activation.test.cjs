const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const CatalogLogic = require('../wwwroot/catalog-logic.js');
const Navigation = require('../wwwroot/artwork-navigation.js');
const source = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
const block = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));

function fixture() {
  const storage = new Map(), viewed = [];
  const context = vm.createContext({ CatalogLogic, URLSearchParams, AbortController, AbortSignal,
    contentPreferences: {}, tabs: [], nextId: 1, activeId: null, navigation: [], navPosition: -1,
    main: { scrollTop: 0, dataset: {}, querySelectorAll: () => [] },
    defaultSources: ['danbooru'], names: { danbooru: 'Danbooru' },
    tabPreferences: { artworkTabs: 'preview' }, recent: [], recommendationExposure: [],
    detailImageDeduper: { duplicates: { entries: () => [] }, verified: new Set() },
    clientStateWriter: { save: () => Promise.resolve(true) },
    localStorage: { getItem: key => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value) },
    getSearchHistory: () => [], rememberItem: item => item, retainFeedWork() {},
    ratingFilterFor: () => 'all', recordViewedWorks: async items => viewed.push(...items.map(item => item.key)),
    closeQuickPreview() {}, pauseDetailVideos() {}, loadFollowFeed() {}, scheduleFollowRetry() {},
    renderChrome() {}, loadCreatorWorks() {}, loadRelated() {}, clearTimeout, setTimeout,
    startTab(tab) { if (tab) tab.started = true; }, createArtworkRoute: () => null,
    pruneArtworkRoutes() {}, warmArtworkRoute() {}, toast() {}, render() {}
  });
  vm.runInContext('function findTab(id) { return tabs.find(tab => tab.id === id); }\n' +
    'function currentTab() { return findTab(activeId); }', context);
  vm.runInContext(block('function captureClientState(', '\nasync function saveRecommendationTagPreference('), context);
  vm.runInContext(block('function restoreSession(', '\nfunction openSearch('), context);
  vm.runInContext(block('function openDetail(', '\nfunction isSavedWork('), context);
  context.render = () => { context.main.dataset.tabId = String(context.activeId); };
  context.hideTabPanels = () => {};
  context.art = { key: 'danbooru:100', source: 'danbooru', id: '100', title: 'Background art', rating: 'g' };
  return { context, storage, viewed, run: code => vm.runInContext(code, context) };
}

function chrome(f) {
  const controls = new Map(['back-button', 'forward-button', 'tab-list-button']
    .map(id => [id, { disabled: false, setAttribute() {} }]));
  Object.assign(f.context, { renderedTabsMarkup: '', escapeHtml: String, svg: () => '',
    tabsNode: { querySelector: () => null, getBoundingClientRect: () => ({ left: 0, right: 900 }) },
    tabHasCatalogTitle: () => false, alignTabStrip() {}, renderTabList() {}, searchInput: { value: '' },
    document: { getElementById: id => controls.get(id), querySelectorAll: () => [] } });
  vm.runInContext(block('function renderChrome(', '\nfunction pauseDetailVideos('), f.context);
  return controls;
}

test('closing the current feed records a background artwork when it first becomes visible', () => {
  const f = fixture();
  f.run('createTab("bookmarks", "Saved"); openDetail(art, { separate: true, background: true });');
  assert.deepEqual(f.viewed, []);
  assert.equal(f.run('currentTab().kind'), 'bookmarks');

  f.run('closeTab(activeId)');

  assert.equal(f.run('currentTab().item.key'), 'danbooru:100');
  assert.deepEqual(f.viewed, ['danbooru:100']);
  assert.equal(f.context.recent[0]?.key, 'danbooru:100');
  assert.equal(JSON.parse(f.storage.get('artcatalog-recent'))[0].key, 'danbooru:100');
});

test('closing the current tab preserves the successor scroll and exact back and forward destinations', () => {
  const f = fixture();
  f.run('createTab("home", "Home"); main.scrollTop = 640; openDetail(art, { separate: true }); ' +
    'main.scrollTop = 210; createTab("settings", "Settings"); main.scrollTop = 900; closeTab(activeId);');

  assert.equal(f.run('currentTab().item.key'), 'danbooru:100');
  assert.equal(f.context.main.scrollTop, 210);
  assert.equal(f.context.navigation.length, 2);
  assert.equal(f.context.navPosition, 1);

  f.run('travel(-1)');
  assert.equal(f.run('currentTab().kind'), 'home');
  assert.equal(f.context.main.scrollTop, 640);

  f.run('travel(1)');
  assert.equal(f.run('currentTab().item.key'), 'danbooru:100');
  assert.equal(f.context.main.scrollTop, 210);
  assert.equal(f.context.navigation.length, 2);
  assert.equal(f.context.navPosition, 1);
});

test('Back skips duplicate visits to the same view and cancels a pending artwork switch', async () => {
  const f = fixture(), context = f.context;
  const works = [1, 2].map(id => ({ key: `danbooru:${id}`, source: 'danbooru', id: String(id),
    title: `Art ${id}`, thumbnail: `https://fixture.test/${id}.jpg` }));
  context.art = works[0];
  context.route = { warmed: new Map(), engine: Navigation.create({ items: works, current: works[0] }) };
  f.run('createTab("home", "Home"); createTab("detail", "Art 1", { item: art, artworkRoute: route }); ' +
    'createTab("settings", "Settings"); activate(tabs[1].id); closeTab(tabs[2].id);');
  let release, signal;
  Object.assign(context, { quickPreview: { open: false }, quickPreviewGeneration: 0,
    galleryImages: () => [],
    imageLoader: { cached: () => undefined, pin: () => () => {},
      rememberBlob: () => ({ blobUrl: 'blob:ready' }), decode: async () => {} },
    readMediaBlob: (_url, consumerSignal) => {
      signal = consumerSignal;
      return new Promise(resolve => { release = resolve; });
    } });
  context.main.querySelector = () => null;
  vm.runInContext(block('function warmArtworkRoute(', '\nfunction openDetail('), context);
  context.warmArtworkRoute = () => {};

  const pending = context.moveArtwork(1);
  await new Promise(resolve => setImmediate(resolve));
  f.run('travel(-1)');
  const destination = f.run('currentTab().kind');
  const cancelled = signal.aborted;
  release({});
  await pending;

  assert.equal(destination, 'home', 'The previous distinct visit is Home, after the intermediary Settings tab was closed');
  assert.equal(cancelled, true, 'Back must cancel the media consumer of the abandoned artwork switch');
  assert.equal(f.run('currentTab().kind'), 'home', 'The completed stale media read must not reopen a detail view');
});

test('closing a search aligns history with the displayed snapshot of a reused artwork tab', () => {
  const f = fixture(), controls = chrome(f);
  f.context.otherArt = { ...f.context.art, key: 'danbooru:101', id: '101', title: 'Next art' };
  f.run('createTab("home", "Home"); openDetail(art); ' +
    'createTab("search", "cats", { query: "cats" }); openDetail(otherArt); ' +
    'travel(-1); closeTab(activeId); renderChrome();');

  assert.equal(f.run('currentTab().item.key'), 'danbooru:101');
  assert.equal(f.run('navigation[navPosition].view === currentTab()'), true);
  assert.equal(controls.get('back-button').disabled, false);
  assert.equal(controls.get('forward-button').disabled, true);

  f.run('travel(-1)');
  assert.equal(f.run('currentTab().item.key'), 'danbooru:100');
  assert.equal(controls.get('forward-button').disabled, false);
  f.run('travel(-1)');
  assert.equal(f.run('currentTab().kind'), 'home');
  assert.equal(controls.get('back-button').disabled, true);
  f.run('travel(1); travel(1)');
  assert.equal(f.run('currentTab().item.key'), 'danbooru:101');
});

test('history buttons are disabled when only identical visits remain in either direction', () => {
  const f = fixture(), controls = chrome(f);
  f.run('createTab("detail", "Art", { item: art }); createTab("settings", "Settings"); ' +
    'activate(tabs[0].id); closeTab(tabs[1].id); renderChrome();');

  assert.equal(controls.get('back-button').disabled, true);
  assert.equal(controls.get('forward-button').disabled, true);
  f.run('navPosition = 0; renderChrome();');
  assert.equal(controls.get('back-button').disabled, true);
  assert.equal(controls.get('forward-button').disabled, true);
});

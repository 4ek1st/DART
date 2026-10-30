const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const CatalogLogic = require('../wwwroot/catalog-logic.js');
const source = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
const block = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const work = (source, id, extra = {}) => ({ source, id: String(id), key: `${source}:${id}`,
  images: [`https://fixture.test/${source}-${id}.png`], tags: ['landscape'], rating: 'g', ...extra });

function fixture(kind = 'search') {
  const first = work('danbooru', 1), second = work('gelbooru', 2);
  const tab = { id: 1, kind, items: [first, second], selectedSources: ['danbooru'],
    sourcePages: { danbooru: 1 }, pausedSources: {}, hasMore: true, errors: {}, page: 0 };
  const grid = kind === 'detail' ? 'related' : kind;
  const context = vm.createContext({ CatalogLogic, Map, Set, URLSearchParams, AbortController,
    contentPreferences: { hideViewedAndSaved: true }, viewedTokens: new Set(), viewedPending: new Set(),
    likes: [], bookmarks: [], recent: [], itemIndex: new Map([[first.key, first], [second.key, second]]),
    currentTab: () => tab, activeId: tab.id, findTab: id => id === tab.id ? tab : null,
    main: { dataset: { tabId: '1' }, scrollTop: 0, clientHeight: 500,
      getBoundingClientRect: () => ({ top: 0, bottom: 500 }), querySelectorAll: () => [] },
    escapeHtml: String, rememberItems() {},
    renderCard: item => `<article class="card" data-key="${item.key}"><img src="${item.images?.[0] || ''}"></article>`,
    request: async () => ({ items: [first, second], errors: {}, hasMoreSources: [] })
  });
  vm.runInContext(block('function knownWorkTokens(', '\nfunction measureVirtualGrids(') + '\n' +
    block('async function loadSearch(', '\nfunction setSavedWorks('), context);
  context.render = () => { context.html = context.renderGrid(tab.items, grid); };
  return { context, tab, first, second, grid, draw: () => context.renderGrid(tab.items, grid) };
}

test('rendered cards stay in the current search, home, recommendations and related generation after viewed or saved', () => {
  for (const kind of ['search', 'home', 'recommendations', 'detail']) {
    for (const state of ['viewed', 'liked', 'bookmarked']) {
      const f = fixture(kind);
      assert.match(f.draw(), /data-key="danbooru:1"/);
      if (state === 'viewed') f.context.viewedPending.add('key:' + f.first.key);
      if (state === 'liked') f.context.likes.push(f.first);
      if (state === 'bookmarked') f.context.bookmarks.push(f.first);
      assert.match(f.draw(), /data-key="danbooru:1"/, `${kind}/${state}`);
      assert.match(f.draw(), /data-key="gelbooru:2"/);
      assert.doesNotMatch(f.draw(), /feed-placeholder/);
    }
  }
});

test('scrolling away and returning to the same result keeps the actual card without an expiry', () => {
  const f = fixture(); f.draw();
  f.context.viewedTokens.add('key:' + f.first.key);
  f.context.main.scrollTop = 40000;
  f.context.expireRetainedFeedWorks(f.tab);
  f.context.main.dataset.tabId = 'detail';
  f.context.main.dataset.tabId = '1';
  f.context.main.scrollTop = 0;
  assert.match(f.draw(), /data-key="danbooru:1"/);
  assert.doesNotMatch(f.draw(), /feed-placeholder/);
});

test('a new result generation and an explicit refresh hide already viewed cards', async () => {
  const f = fixture(); f.draw();
  f.context.viewedTokens.add('key:' + f.first.key);
  const next = { ...f.tab, id: 2, retainedFeedWorks: new Map() };
  assert.deepEqual(Array.from(f.context.filterFeedWorks(next.items, next), item => item.key), ['gelbooru:2']);
  await f.context.loadSearch(f.tab);
  assert.doesNotMatch(f.context.html, /data-key="danbooru:1"/);
  assert.match(f.context.html, /data-key="gelbooru:2"/);
});

test('a rendered card does not grant a new standalone catalog copy another retained slot', () => {
  const f = fixture(); f.draw();
  f.context.likes.push(f.first);
  const copy = work('rule34', 3, { images: f.first.images });
  assert.deepEqual(Array.from(f.context.filterFeedWorks([copy, f.second], f.tab), item => item.key), ['gelbooru:2']);
  f.tab.items.push(copy);
  const html = f.draw();
  assert.equal((html.match(/<article/g) || []).length, 2);
  assert.match(html, /data-key="danbooru:1"/);
});

test('retention records only materialized virtual cards and stays scoped to their page', () => {
  const f = fixture();
  f.tab.items = Array.from({ length: 300 }, (_, index) => work('danbooru', index + 10));
  const html = f.draw();
  const rendered = (html.match(/<article/g) || []).length;
  assert(rendered < 300);
  assert.equal(f.tab.retainedFeedWorks?.size, rendered);
  const unseen = f.tab.items[299];
  f.context.viewedTokens.add('key:' + unseen.key);
  assert.equal(f.context.isRetainedFeedWork(f.tab, unseen), false);
  assert.equal(f.context.filterFeedWorks([unseen], f.tab).length, 0);
});

test('pagination preserves the viewed card and its order while merging an incoming copy once', async () => {
  const f = fixture(); f.draw();
  f.context.viewedTokens.add('key:' + f.first.key);
  const copy = work('rule34', 3, { images: f.first.images });
  const fresh = work('danbooru', 4);
  f.context.request = async () => ({ items: [copy, fresh], errors: {}, hasMoreSources: [] });
  await f.context.loadSearch(f.tab, true);
  assert.deepEqual(Array.from(f.context.filterFeedWorks(f.tab.items, f.tab), item => item.key),
    ['danbooru:1', 'gelbooru:2', 'danbooru:4']);
  assert.equal((f.context.html.match(/<article/g) || []).length, 3);
});

test('liking a rendered recommendation preserves that card even when known-work hiding is disabled', async () => {
  const f = fixture('recommendations');
  f.context.contentPreferences.hideViewedAndSaved = false;
  const initial = f.context.html = f.draw();
  f.context.render = () => assert.fail('A like must keep the existing recommendation grid');
  Object.assign(f.context, { savedWorkPending: new Set(), likedKeys: new Set(), savedKeys: new Set(),
    tabs: [f.tab], syncSavedWorkButtons() {}, toast() {},
    recordViewedWorks: async () => {}, refreshSavedWorks: async () => true,
    request: async () => ({ saved: true }),
    setSavedWorks(collection, items) {
      f.context[collection] = items;
      f.context[collection === 'likes' ? 'likedKeys' : 'savedKeys'] = new Set(items.map(item => item.key));
    }
  });
  vm.runInContext(block('function isSavedWork(', '\nfunction quickPreviewShortcutAllowed(') + '\n' +
    block('async function toggleSavedWork(', '\nfunction syncSavedWorkButtons('), f.context);
  await f.context.toggleSavedWork(f.first, 'likes');
  assert.equal(f.context.likes.length, 1);
  assert.deepEqual(Array.from(f.tab.items, item => item.key), ['danbooru:1', 'gelbooru:2']);
  assert.equal(f.context.html, initial);
  assert.match(f.context.html, /data-key="danbooru:1"/);
  assert.match(f.draw(), /data-key="danbooru:1"/, 'The retained card also survives a later layout update');
});

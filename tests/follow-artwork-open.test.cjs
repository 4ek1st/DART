const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const CatalogLogic = require('../wwwroot/catalog-logic.js');
const DartArtworkNavigation = require('../wwwroot/artwork-navigation.js');
const source = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
const block = (start, end) => {
  const first = source.indexOf(start), last = source.indexOf(end, first);
  assert.ok(first >= 0 && last > first, `Missing application block: ${start}`);
  return source.slice(first, last);
};
const settle = () => new Promise(resolve => setImmediate(resolve));
const work = (catalog, id) => ({ key: `${catalog}:${id}`, source: catalog,
  id: String(id), title: `Artwork ${id}`, rating: 'g', tags: ['landscape'],
  images: [`https://example.org/${catalog}/${id}.jpg`], published: '2025-01-01T00:00:00Z' });

function fixture() {
  const follow = { key: 'danbooru::fixture_artist', source: 'danbooru',
    artistId: 'fixture_artist', name: 'Fixture artist', followedAt: '2024-01-01T00:00:00Z' };
  const tab = { id: 1, kind: 'follows', rating: 'general', started: true, items: [] };
  const tabs = [tab], opened = [], handlers = new Map(), timers = new Map();
  let nextTimer = 0, finishSource, finishSave;
  const slowSource = new Promise(resolve => { finishSource = resolve; });
  const slowSave = new Promise(resolve => { finishSave = resolve; });
  const context = vm.createContext({
    CatalogLogic, DartArtworkNavigation, structuredClone, AbortController, URLSearchParams,
    setTimeout: callback => { timers.set(++nextTimer, callback); return nextTimer; },
    clearTimeout: id => timers.delete(id), follows: [follow], followedKeys: new Set(),
    contentPreferences: {}, activeId: 1, recent: [], tabs, itemIndex: new Map(),
    tabPreferences: { artworkTabs: 'new' }, defaultSources: ['danbooru', 'gelbooru', 'rule34'],
    settings: { hasApiKey: true, hasRule34ApiKey: true, sankakuAvailable: false },
    main: { addEventListener: (name, handler) => handlers.set(name, handler) },
    findTab: id => tabs.find(entry => entry.id === id), currentTab: () => tab,
    refreshFollows: async () => true, render() {}, retainFeedWork() {},
    filterFeedWorks: items => items, isExpiredFeedWork: () => false,
    ratingFilterFor: () => 'general',
    createTab(kind, title, state, options) {
      const viewer = { id: tabs.length + 1, kind, title, ...state };
      tabs.push(viewer); opened.push({ viewer, options });
      return viewer;
    },
    request: async (url, options = {}) => {
      if (url.startsWith('/api/follows/cache?'))
        return options.method === 'POST' ? slowSave : { groups: [] };
      if (url === '/api/follows/seen') return [follow];
      const query = new URL(url, 'https://example.org').searchParams;
      const catalog = query.get('sources') || query.get('source');
      if (catalog === 'rule34') return slowSource;
      assert.ok(['danbooru', 'gelbooru'].includes(catalog), `Unexpected request: ${url}`);
      return { items: [work(catalog, catalog === 'danbooru' ? 1 : 2)],
        errors: {}, hasMore: false, hasMoreSources: [] };
    }
  });
  vm.runInContext(
    block('const rememberedInputs = new WeakMap();', '\nfunction creatorActionData(') +
    block('function itemForControl(', '\nfunction captureClientState(') +
    block('function decorateFollowItems(', '\nasync function loadBookmarks(') +
    block('const artworkRoutes = new Set();', '\nfunction pruneArtworkRoutes(') +
    block('function openDetail(', '\nfunction isSavedWork(') +
    block("main.addEventListener('mousedown',", "\nwindow.addEventListener('online',"), context);
  return { context, tab, opened, handlers, finishSave,
    finishSource: () => finishSource({ items: [], errors: {}, hasMoreSources: [] }),
    click(key, modifiers = {}) {
      const control = { dataset: { action: 'open', key }, closest: () => null };
      const event = { target: { closest: () => control }, ...modifiers };
      handlers.get('click')(event);
    } };
}

for (const [state, modifiers, background] of [
  ['pending preview save', {}, false],
  ['completed preview save', { ctrlKey: true }, true],
  ['completed feed refresh', { ctrlKey: true, shiftKey: true }, false]
]) {
  test(`Following card click opens its viewer with a ${state}`, async () => {
    const f = fixture(), loading = f.context.loadFollowFeed(f.tab);
    await settle();
    try {
      assert.equal(f.tab.loading, true, 'Rule34 is still loading after regular sources publish');
      assert.equal(f.tab.items.length, 2, 'Ready cards are visible before Rule34 finishes');
      assert.equal(f.tab.followCacheWrites.size, 1, 'The regular-source preview has started saving');
      if (state !== 'pending preview save') {
        f.finishSave({});
        await f.tab.followCacheSaveTail;
      }
      if (state === 'completed feed refresh') {
        f.finishSource();
        await loading;
        assert.equal(f.tab.loading, false);
      }
      f.click('danbooru:1', modifiers);
      assert.equal(f.opened.length, 1);
      const { viewer, options } = f.opened[0];
      assert.equal(viewer.kind, 'detail');
      assert.equal(viewer.item.key, 'danbooru:1');
      assert.equal(options.background, background, 'Regular and modified clicks retain tab-opening behavior');
      const route = viewer.artworkRoute;
      assert.equal(route.engine.items[route.engine.state.index].key, 'danbooru:1');
      assert.equal((await route.engine.move(1)).key, 'gelbooru:2');
      assert.equal(route.backup.rating, 'general');
      assert.deepEqual(Array.from(route.backup.newKeys), ['danbooru:1', 'gelbooru:2']);
      assert.equal(f.tab.followCacheWrites.size, 1, 'Opening does not discard the live save state');
    } finally {
      f.finishSave({}); f.finishSource();
      await loading;
      await f.tab.followCacheSaveTail;
    }
  });
}

test('a detached Following snapshot retains pending page cursors and shared group references', () => {
  const f = fixture(), follow = { key: 'gelbooru::fixture_artist', source: 'gelbooru', artistId: 'fixture_artist' };
  const first = work('gelbooru', 1), buffered = work('gelbooru', 2);
  const group = { follow, items: [first] };
  const paging = { follow, source: 'gelbooru', group, buffer: [buffered], nextPage: 3 };
  const queued = { follow, source: 'danbooru', group, buffer: [], nextPage: 4 };
  Object.assign(f.tab, { followVersion: 4, followLoadingMore: true, items: [first],
    followGroups: [group], followPagingStreams: [paging], followStreams: [queued],
    followController: new AbortController(), newKeys: new Set([first.key]),
    followCacheWrites: new Map([['general', { body: '{}', promise: Promise.resolve() }]]),
    followComputed: { version: 4, feed: { items: [first] } },
    followPublication: { signature: 'old publication' } });
  const copy = f.context.copyArtworkSource(f.tab);
  paging.buffer.length = 0;
  group.items.push(work('gelbooru', 3));
  assert.equal(copy.artworkDetached, true);
  assert.equal(copy.followLoadingMore, false);
  assert.equal(copy.followStreams.length, 2);
  assert.equal(copy.followStreams[0].nextPage, 3);
  assert.equal(copy.followStreams[0].buffer[0].key, 'gelbooru:2');
  assert.equal(copy.followStreams[1].nextPage, 4);
  assert.equal(copy.followStreams[0].group, copy.followGroups[0]);
  assert.equal(copy.followStreams[1].group, copy.followGroups[0]);
  assert.equal(copy.followStreams[0].follow, copy.followGroups[0].follow);
  assert.equal(copy.followGroups[0].items.length, 1);
  assert.equal(copy.items[0], copy.followGroups[0].items[0]);
  assert.deepEqual(Array.from(copy.newKeys), ['gelbooru:1']);
  assert.equal(copy.rating, 'general');
  assert.equal(copy.followController, undefined);
  assert.equal(copy.followCacheWrites, undefined);
  assert.equal(copy.followComputed, undefined);
  assert.equal(copy.followPublication, undefined);
});

test('artwork snapshots preserve independent pagination for the other pageable feeds', () => {
  for (const kind of ['home', 'search', 'recommendations', 'profile']) {
    const f = fixture();
    const live = { id: 7, kind, rating: 'general', query: 'landscape', loading: true,
      selectedSources: ['danbooru', 'gelbooru'], items: [work('danbooru', 1)],
      sourcePages: { danbooru: 3, gelbooru: 4 }, pausedSources: { rule34: { retryAt: 1000 } },
      recommendationPools: { character: [{ streams: [{ nextPage: 5, sources: ['gelbooru'] }] }] },
      profileRef: { source: 'gelbooru', artist: 'fixture_artist' }, page: 6, hasMore: true };
    const copy = f.context.copyArtworkSource(live);
    live.sourcePages.danbooru = 30;
    live.selectedSources.pop();
    live.recommendationPools.character[0].streams[0].nextPage = 50;
    assert.equal(copy.sourcePages.danbooru, 3, kind);
    assert.equal(copy.sourcePages.gelbooru, 4, kind);
    assert.deepEqual(Array.from(copy.selectedSources), ['danbooru', 'gelbooru'], kind);
    assert.equal(copy.recommendationPools.character[0].streams[0].nextPage, 5, kind);
    assert.equal(copy.profileRef.artist, 'fixture_artist', kind);
    assert.equal(copy.page, 6, kind);
    assert.equal(copy.hasMore, true, kind);
    assert.equal(copy.loading, false, kind);
    assert.notEqual(copy.items[0], live.items[0], kind);
  }
});

test('an unexpected uncloneable field is surfaced without replacing the feed with an items-only snapshot', () => {
  const f = fixture();
  const live = { kind: 'follows', followStreams: [{ nextPage: 3, buffer: [] }],
    unexpected: { promise: Promise.resolve() } };
  assert.throws(() => f.context.copyArtworkSource(live), { name: 'DataCloneError' });
  assert.equal(live.followStreams[0].nextPage, 3);
});

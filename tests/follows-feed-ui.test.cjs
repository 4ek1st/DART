const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const CatalogLogic = require('../wwwroot/catalog-logic.js');

const source = fs.readFileSync(path.join(__dirname, '..', 'wwwroot', 'app.js'), 'utf8');

test('follow feed loads every page and keeps works beyond 120', async () => {
  const start = source.indexOf('function decorateFollowItems(');
  const end = source.indexOf('\nasync function loadBookmarks(', start);
  assert.ok(start >= 0 && end > start);
  const follow = { key: 'gelbooru::123', source: 'gelbooru', service: '',
    artistId: '123', name: 'Artist', followedAt: '2024-01-01T00:00:00Z' };
  const tab = { id: 1, kind: 'follows', rating: 'all', items: [] };
  const pages = [];
  const seen = [];
  const context = { CatalogLogic, AbortController, URLSearchParams, setTimeout, clearTimeout,
    contentPreferences: { aiMode: 'all', excludedTags: [] },
    follows: [follow], followedKeys: new Set(), activeId: 1,
    settings: { hasApiKey: false }, names: { gelbooru: 'Gelbooru' },
    findTab: id => id === 1 ? tab : undefined,
    refreshFollows: async () => true,
    rememberItems: () => {}, render: () => {},
    request: async (url, options) => {
      if (url === '/api/follows/seen') {
        seen.push(JSON.parse(options.body));
        return [follow];
      }
      const page = Number(new URL(url, 'http://localhost').searchParams.get('page'));
      pages.push(page);
      return { items: Array.from({ length: 50 }, (_, index) => ({
        key: `gelbooru:${page}:${index}`, source: 'gelbooru', rating: 'e',
        published: new Date(Date.UTC(2025, 0, 1 + page * 50 + index)).toISOString(),
        images: [`https://example.com/${page}/${index}.jpg`] })),
      hasMore: page < 2 };
    }
  };
  const loaders = vm.runInNewContext(source.slice(start, end) +
    '\n({ loadFollowFeed, loadMoreFollows })', context);
  await loaders.loadFollowFeed(tab);
  assert.equal(tab.items.length, 24);
  assert.equal(tab.hasMore, true);
  for (let round = 0; tab.hasMore && round < 10; round++)
    await loaders.loadMoreFollows(tab);
  assert.equal(tab.hasMore, false);
  assert.equal(tab.items.length, 150);
  assert.deepEqual(pages, [0, 1, 2]);
  assert.equal(seen.reduce((sum, batch) => sum +
    batch.workKeys[follow.key].length, 0), 150);
});

test('followed author cards start collapsed and can be opened', () => {
  const start = source.indexOf('function renderFollowArtist(');
  const end = source.indexOf('\nfunction renderProfile(', start);
  assert.ok(start >= 0 && end > start);
  const follow = { key: 'danbooru::artist', source: 'danbooru',
    artistId: 'artist', name: 'Artist' };
  const context = { CatalogLogic, follows: [follow], settings: { hasApiKey: true },
    names: { danbooru: 'Danbooru' }, escapeHtml: value => String(value),
    renderGrid: () => '<grid>', skeletons: () => '<skeletons>', authorContextData: () => '' };
  const render = vm.runInNewContext(source.slice(start, end) + '\nrenderFollows', context);
  const tab = { id: 1, rating: 'all', items: [], loading: false };
  assert.match(render(tab), /Управление подписками · 1/);
  assert.doesNotMatch(render(tab), /class="followed-artists"/);
  tab.followManageOpen = true;
  assert.match(render(tab), /class="followed-artists"/);
});

test('reaching the follow feed tail requests the next page', () => {
  const start = source.indexOf('const autoFeed = {');
  const end = source.indexOf('\nlet virtualScrollPending', start);
  const calls = [];
  class IntersectionObserver {
    constructor(callback) { this.callback = callback; }
    unobserve() {}
    observe() {}
    disconnect() {}
  }
  const tab = { id: 5, kind: 'follows', loading: false, followLoadingMore: false,
    followLoadError: false, hasMore: true };
  const marker = { dataset: { tabId: '5', autoLoad: 'follows' } };
  const context = { IntersectionObserver, main: { clientHeight: 1330,
    querySelector: () => marker }, currentTab: () => tab,
    loadMoreFollows: () => calls.push('more') };
  const autoFeed = vm.runInNewContext(source.slice(start, end) + '\nautoFeed', context);
  autoFeed.mount();
  autoFeed.observer.callback([{ isIntersecting: true, target: marker }]);
  assert.deepEqual(calls, ['more']);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const CatalogLogic = require('../wwwroot/catalog-logic.js');

test('scrolling recommendations requests the next recommendation page', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'wwwroot', 'app.js'), 'utf8');
  const start = source.indexOf('const autoFeed = {');
  const end = source.indexOf('\nlet virtualScrollPending', start);
  assert.ok(start >= 0 && end > start, 'auto feed handler exists');

  const calls = [];
  class IntersectionObserver {
    constructor(callback) { this.callback = callback; }
    unobserve() {}
    observe() {}
    disconnect() {}
  }
  const tab = { id: 7, kind: 'recommendations', loading: false,
    hasMore: true, loadError: false };
  const marker = { dataset: { tabId: '7', autoLoad: 'recommendations' } };
  const context = { IntersectionObserver, main: { clientHeight: 1330,
    querySelector: () => marker }, currentTab: () => tab,
    loadProfile: () => calls.push('profile'),
    loadRelated: () => calls.push('related'),
    loadSearch: () => calls.push('search'),
    loadRecommendations: (_, append) => calls.push(`recommendations:${append}`) };
  const autoFeed = vm.runInNewContext(source.slice(start, end) + '\nautoFeed', context);
  autoFeed.mount();
  autoFeed.observer.callback([{ isIntersecting: true, target: marker }]);

  assert.deepEqual(calls, ['recommendations:true']);
});

test('recommendations search both names and Other and continue past 120 cards', async () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'wwwroot', 'app.js'), 'utf8');
  const start = source.indexOf('function createRecommendationPools(');
  const end = source.indexOf('async function loadFollowFeed(', start);
  assert.ok(start >= 0 && end > start, 'recommendation loader exists');
  const bookmarks = [1, 2, 3].map(id => ({ key: `saved:${id}`,
    source: 'danbooru', title: 'holo', relatedQuery: 'holo',
    tags: ['holo', 'cum'] }));
  const tab = { id: 7, kind: 'recommendations', rating: 'explicit',
    selectedSources: ['danbooru'], items: [], errors: {}, loading: false };
  const queries = [];
  const context = {
    CatalogLogic, likes: bookmarks, bookmarks: [], recommendationTagPreferences: {},
    recommendationVisitCount: 0,
    localStorage: { setItem() {} },
    contentPreferences: { aiMode: 'all', excludedTags: [] },
    findTab: id => id === tab.id ? tab : undefined, activeId: tab.id,
    render: () => {}, rememberItems: () => {}, AbortController, URLSearchParams,
    request: async (path, options) => {
      assert.equal(options.skipVisualHashes, true);
      const params = new URL(path, 'http://localhost').searchParams;
      const tag = params.get('q');
      const page = Number(params.get('page'));
      queries.push(tag);
      return { items: Array.from({ length: 24 }, (_, index) => ({
        key: `${tag}:${page}:${index}`, source: 'danbooru', rating: 'e',
        tags: [tag] })), errors: {}, hasMoreSources: ['danbooru'] };
    }
  };
  const load = vm.runInNewContext(source.slice(start, end) + '\nloadRecommendations', context);
  await load(tab);
  await load(tab, true);
  await load(tab, true);
  assert.ok(queries.includes('holo'));
  assert.ok(queries.includes('cum'));
  assert.equal(tab.items.length, 144);
  assert.equal(tab.hasMore, true);
});

test('opening recommendations again starts with another frequent tag', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'wwwroot', 'app.js'), 'utf8');
  const start = source.indexOf('function createRecommendationPools(');
  const end = source.indexOf('async function loadFollowFeed(', start);
  const liked = [1, 2].map(id => ({ key: `liked:${id}`,
    source: 'danbooru', title: 'holo', tags: ['holo', 'latex', 'catsuit'] }));
  const context = { CatalogLogic, likes: liked, bookmarks: [], recommendationTagPreferences: {},
    recommendationVisitCount: 0, localStorage: { setItem() {} },
    contentPreferences: { aiMode: 'all', excludedTags: [] } };
  const prepare = vm.runInNewContext(source.slice(start, end) +
    '\nprepareRecommendationProfile', context);
  const tab = { selectedSources: ['danbooru'] };
  prepare(tab, liked);
  const first = tab.recommendationCursors.other;
  prepare(tab, liked);
  assert.ok(tab.recommendationPools.other.length >= 2);
  assert.notEqual(tab.recommendationCursors.other, first);
});

test('refresh starts fresh searches and does not repeat the same first tag', async () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'wwwroot', 'app.js'), 'utf8');
  const start = source.indexOf('function createRecommendationPools(');
  const end = source.indexOf('async function loadFollowFeed(', start);
  const bookmarks = [1, 2, 3].map(index => ({ key: `liked:${index}`,
    tags: ['latex', 'catsuit', 'group_sex'] }));
  const tab = { id: 11, kind: 'recommendations', rating: 'general',
    selectedSources: ['danbooru'], items: [], errors: {} };
  const queried = [];
  const context = { CatalogLogic, likes: bookmarks, bookmarks: [], recommendationTagPreferences: {},
    recommendationVisitCount: 0, localStorage: { setItem() {} },
    contentPreferences: { aiMode: 'all', excludedTags: [] },
    findTab: id => id === tab.id ? tab : undefined, activeId: tab.id,
    render: () => {}, rememberItems: () => {}, AbortController, URLSearchParams,
    request: async path => {
      const tag = new URL(path, 'http://localhost').searchParams.get('q');
      queried.push(tag);
      return { items: [{ key: `work:${tag}`, source: 'danbooru',
        rating: 'g', tags: [tag] }], errors: {}, hasMoreSources: [] };
    }
  };
  const load = vm.runInNewContext(source.slice(start, end) + '\nloadRecommendations', context);
  await load(tab);
  const first = queried[0];
  const firstCards = tab.items.map(item => item.key);
  await load(tab);
  assert.notEqual(queried[2], first);
  assert.notDeepEqual(tab.items.map(item => item.key), firstCards);
  assert.equal(tab.loading, false);
});

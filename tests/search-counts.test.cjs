const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const CatalogLogic = require('../wwwroot/catalog-logic.js');
const source = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');

test('search counts distinguish source records, grouped works and user filters', () => {
  const items = [
    { key: 'danbooru:1', source: 'danbooru', contentHash: 'a'.repeat(32), tags: ['rui_arneb'], images: ['one.jpg'] },
    { key: 'gelbooru:2', source: 'gelbooru', contentHash: 'a'.repeat(32), tags: ['rui_arneb'], images: ['two.jpg'] },
    { key: 'danbooru:3', source: 'danbooru', tags: ['rui_arneb', 'ai_generated'] },
    { key: 'danbooru:4', source: 'danbooru', tags: ['rui_arneb'] }
  ];
  const result = CatalogLogic.searchResultCounts(items,
    { aiMode: 'generated', hideViewedAndSaved: true }, new Set(['key:danbooru:4']));
  assert.deepEqual(result, { records: 4, works: 3, shown: 1,
    grouped: 1, hiddenContent: 1, hiddenKnown: 1 });
  assert.equal(CatalogLogic.searchResultCounts(items, { aiMode: 'all' }).shown, 3);
});

test('retrying the same page replaces its statistics instead of inflating counts', () => {
  const first = CatalogLogic.rememberSearchPageStats({}, { danbooru: { received: 24, unavailable: 10 } },
    { danbooru: 0 }, {});
  const retried = CatalogLogic.rememberSearchPageStats(first,
    { danbooru: { received: 24, unavailable: 3 }, rule34: { received: 48 } },
    { danbooru: 0, rule34: 0 }, { rule34: 'HTTP 429' });
  assert.equal(Object.keys(retried).length, 1);
  assert.equal(retried['danbooru:0'].unavailable, 3);
  assert.equal(retried['danbooru:0'].received, 24);
});

test('search summary includes records whose files the catalog API withheld', () => {
  const start = source.indexOf('function renderSearchSummary(');
  const end = source.indexOf('\nfunction renderRecommendationTagChips(', start);
  const render = vm.runInNewContext(source.slice(start, end) + '\nrenderSearchSummary', {
    CatalogLogic, viewedTokens: new Set(), likes: [], bookmarks: [], contentPreferences: {},
    names: { danbooru: 'Danbooru' }, escapeHtml: String
  });
  const html = render({ items: [{ key: 'danbooru:1' }],
    searchPageStats: { 'danbooru:0': { source: 'danbooru', received: 2, unavailable: 1 } } });
  assert.match(html, /Показано работ: 1/);
  assert.match(html, /Загружено записей: 2/);
  assert.match(html, /Доступно записей: 1/);
  assert.match(html, /Danbooru: записей без доступного файла в API — 1/);
});

test('empty inaccessible pages continue searching and retain their count', async () => {
  let number = 0;
  const tab = { id: 1, kind: 'search', query: 'rui_arneb', selectedSources: ['danbooru'],
    rating: 'all', feed: 'illustrations' };
  const context = { CatalogLogic, AbortController, URLSearchParams,
    activeId: 1, findTab: () => tab, render() {}, rememberItems() {},
    request: async () => ++number === 1 ? {
      items: [], errors: {}, hasMoreSources: ['danbooru'],
      sourceStats: { danbooru: { received: 24, unavailable: 24 } }
    } : { items: [{ key: 'danbooru:next' }], errors: {}, hasMoreSources: [],
      sourceStats: { danbooru: { received: 1, unavailable: 0 } } }
  };
  const start = source.indexOf('async function loadSearch(');
  const end = source.indexOf('\nasync function refreshBookmarks(', start);
  const loadSearch = vm.runInNewContext(source.slice(start, end) + '\nloadSearch', context);
  await loadSearch(tab);
  assert.equal(tab.hasMore, true);
  await loadSearch(tab, true);
  assert.equal(tab.items.length, 1);
  assert.equal(tab.hasMore, false);
  assert.equal(tab.searchPageStats['danbooru:0'].unavailable, 24);
  assert.equal(tab.searchPageStats['danbooru:1'].received, 1);
});

test('Sensitive and legacy Safe labels keep ordinary author and related feeds', () => {
  const start = source.indexOf('function ratingLabel(');
  const end = source.indexOf('\nfunction formatDate(', start);
  const helpers = vm.runInNewContext(source.slice(start, end) + '\n({ratingLabel,ratingFilterFor})');
  for (const rating of ['s', 'sensitive', 'safe']) {
    assert.equal(helpers.ratingLabel(rating), 'SFW');
    assert.equal(helpers.ratingFilterFor({ rating }), 'general');
  }
  assert.equal(helpers.ratingLabel('q'), 'Q');
  assert.equal(helpers.ratingFilterFor({ rating: 'e' }), 'explicit');
});

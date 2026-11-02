'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('./helpers/viewer-vm.cjs');
const logic = require('../wwwroot/catalog-logic.js');
const artworkActions = require('../wwwroot/artwork-actions.js');
const app = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
const block = (a, b) => app.slice(app.indexOf(a), app.indexOf(b, app.indexOf(a)));
const work = (id, extra = {}) => ({ key: `danbooru:${id}`, id: String(id), source: 'danbooru',
  title: `Artwork ${id}`, creatorTag: `artist_${id}`, rating: 'q', tags: ['landscape'],
  images: [`https://cdn.donmai.us/${id}.jpg`], ...extra });

function fixture(items, preferences = {}, hidden = []) {
  let curationReads = 0, historyReads = 0;
  const controller = artworkActions.create({ tokens: logic.workHistoryTokens });
  controller.restore(hidden);
  const known = new Set();
  const tab = { kind: 'search', rating: 'explicit', items, retainedFeedWorks: new Map() };
  const context = vm.createContext({ CatalogLogic: logic, contentPreferences: preferences, follows: [],
    artworkActionsController: () => controller, knownWorkTokens() { historyReads++; return known; },
    curateFeedWorks(items) { curationReads++; return items; }, isExpiredFeedWork: () => false,
    names: { danbooru: 'Danbooru' }, escapeHtml: String,
    viewerPreferences: { nsfwRatings: { q: true, e: false } } });
  vm.runInContext(block('function isHideableFeed(', '\nfunction visibleFeedCard(') +
    block('function isRetainedFeedWork(', '\nfunction expiredFeedSlot(') +
    block('function filterFeedWorks(', '\nfunction emptyFeedMessage(') +
    block('function renderSearchSummary(', '\nfunction renderRecommendationTagChips('), context);
  return { tab, context, controller, known, summary: () => context.renderSearchSummary(tab),
    grid: () => context.filterFeedWorks(items, tab, false, 'search', true),
    curationReads: () => curationReads, historyReads: () => historyReads };
}

test('Q-only summary counts the displayed rating without labelling the excluded E artwork as viewed', () => {
  for (const hideViewedAndSaved of [false, true]) {
    const f = fixture([work(1), work(2, { rating: 'e' })], { hideViewedAndSaved });
    assert.equal(f.grid().length, 1);
    const html = f.summary();
    assert.match(html, /Показано работ: 1/);
    assert.match(html, /Скрыто фильтрами: 1/);
    assert.doesNotMatch(html, /Просмотренные и сохранённые/);
  }
});

test('manually hidden artwork is excluded from shown counts even when viewed hiding is off', () => {
  const first = work(1), f = fixture([first, work(2)], { hideViewedAndSaved: false }, [first]);
  f.tab.rating = 'all';
  const html = f.summary();
  assert.equal(f.grid().length, 1);
  assert.match(html, /Показано работ: 1/);
  assert.match(html, /Скрыто фильтрами: 1/);
  assert.doesNotMatch(html, /Просмотренные и сохранённые/);
  assert.equal(f.historyReads(), 0, 'disabled history filtering must not merge the personal history');
});

test('summary separates rating, manual, content and followed-artist exclusions from real known works', () => {
  const items = [work(1), work(2, { rating: 'e' }), work(3), work(4),
    work(5, { tags: ['excluded_fixture'] }), work(6)];
  const f = fixture(items, { hideViewedAndSaved: true, hideFollowedArtists: true,
    excludedTags: ['excluded_fixture'] }, [items[2]]);
  f.context.follows = [{ source: 'danbooru', artistId: 'artist_6' }];
  f.known.add('key:danbooru:4');
  assert.equal(f.grid().length, 1);
  const html = f.summary();
  assert.match(html, /Показано работ: 1/);
  assert.match(html, /Скрыто фильтрами: 4/);
  assert.match(html, /Просмотренные и сохранённые: 1/);
  assert.equal(f.curationReads(), 0, 'summary counting must not rank or reposition the existing cards');
});

test('a retained viewed card remains counted until a fresh result generation clears its slot', () => {
  const f = fixture([work(1), work(2, { rating: 'e' })], { hideViewedAndSaved: true });
  f.known.add('key:danbooru:1');
  f.tab.retainedFeedWorks.set('danbooru:1', true);
  assert.match(f.summary(), /Показано работ: 1/);
  assert.doesNotMatch(f.summary(), /Просмотренные и сохранённые/);
  f.tab.retainedFeedWorks.clear();
  assert.match(f.summary(), /Показано работ: 0/);
  assert.match(f.summary(), /Просмотренные и сохранённые: 1/);
});

test('summary preserves raw grouping and inaccessible-record counts alongside exact displayed eligibility', () => {
  const hash = 'a'.repeat(32), first = work(1, { contentHash: hash });
  const mirror = work(2, { source: 'gelbooru', key: 'gelbooru:2', contentHash: hash });
  const hidden = work(3), f = fixture([first, mirror, hidden, work(4, { rating: 'e' }), work(5)],
    { hideViewedAndSaved: true }, [hidden]);
  f.known.add('key:danbooru:1');
  f.tab.searchPageStats = { 'danbooru:0': { source: 'danbooru', received: 6, unavailable: 1 } };
  const html = f.summary();
  assert.equal(f.grid().length, 1);
  assert.match(html, /Показано работ: 1/);
  assert.match(html, /Загружено записей: 6/);
  assert.match(html, /Доступно записей: 5/);
  assert.match(html, /Объединено: 1/);
  assert.match(html, /Скрыто фильтрами: 2/);
  assert.match(html, /Просмотренные и сохранённые: 1/);
  assert.match(html, /Danbooru: записей без доступного файла в API — 1/);
});

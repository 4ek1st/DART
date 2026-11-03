'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('./helpers/viewer-vm.cjs');
const logic = require('../wwwroot/catalog-logic.js');
const artworkActions = require('../wwwroot/artwork-actions.js');
const app = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
const block = (a, b) => app.slice(app.indexOf(a), app.indexOf(b, app.indexOf(a)));
const keys = items => Array.from(items, item => item.key);
const flush = async () => { for (let index = 0; index < 4; index++) await new Promise(setImmediate); };
const work = (id, creatorTag = 'fixture_artist') => ({ key: `danbooru:${id}`, id: String(id), source: 'danbooru',
  creatorTag, title: 'Neutral landscape', rating: 'g', tags: ['landscape', 'watercolor'],
  images: [`https://example.test/${id}.jpg`] });

function fixture(mode = 'fresh') {
  const candidates = Array.from({ length: 100 }, (_, index) => work(1000 + index));
  const tab = { id: 1, kind: 'recommendations', rating: 'general', selectedSources: ['danbooru'],
    items: [], errors: {}, started: true };
  const actions = artworkActions.create({ tokens: logic.workHistoryTokens });
  if (mode === 'manual') actions.restore(candidates);
  const context = vm.createContext({ CatalogLogic: logic,
    likes: Array.from({ length: 8 }, (_, index) => work(9000 + index, 'liked_artist')),
    bookmarks: mode === 'bookmark' ? candidates : [], recent: [],
    follows: [{ source: 'danbooru', artistId: mode === 'followed' ? 'fixture_artist' : 'unrelated_artist' }],
    viewedTokens: new Set(), viewedPending: new Set(mode === 'pending' ? candidates.flatMap(logic.workHistoryTokens) : []),
    recommendationTagPreferences: { landscape: 'priority' }, recommendationVisitCount: 0,
    localStorage: { setItem() {} }, contentPreferences: { hideViewedAndSaved: true, hideFollowedArtists: true,
      curation: { enabled: true } }, AbortController, URLSearchParams,
    findTab: id => id === tab.id ? tab : null, activeId: tab.id, rememberItems() {}, render() {},
    setTimeout, clearTimeout, artworkActionsController: () => actions });
  let requests = 0;
  context.request = async () => ({ items: [candidates[requests++]], errors: {}, hasMoreSources: ['danbooru'] });
  vm.runInContext(block('function createRecommendationPools(', '\nfunction decorateFollowItems(') +
    block('function knownWorkTokens(', '\nfunction emptyFeedMessage(') +
    block('function renderRecommendationTail(', '\nfunction renderRecommendations('), context);
  return { context, tab, candidates, requests: () => requests, visible: () => context.filterFeedWorks(tab.items, tab),
    load: append => context.loadRecommendations(tab, append) };
}

for (const mode of ['pending', 'bookmark', 'manual', 'followed']) {
  test(`recommendations pause after four rounds containing only ${mode} hidden works`, async () => {
    const f = fixture(mode);
    let rounds = 0;
    for (; rounds < 6;) {
      await f.load(rounds++ > 0);
      assert.equal(f.visible().length, 0);
      if (f.tab.recommendationPaused) break;
    }
    assert.equal(rounds, 4, 'Invisible records must not count as newly displayed recommendations');
    assert.equal(f.requests(), 8);
    assert.equal(f.tab.items.length, 0);
    assert.equal(f.tab.emptyRecommendationRounds, 4);
    assert.equal(f.tab.hasMore, true, 'The user can continue explicitly without losing source cursors');
    assert.doesNotMatch(f.context.renderRecommendationTail(f.tab), /data-auto-load=/);
  });
}

test('a retained recommendation stays in its current visit after viewing while new pages keep its prefix', async () => {
  const f = fixture();
  f.context.render = () => {
    for (const item of f.visible()) f.context.rememberRenderedFeedWork(f.tab, item, 'recommendations');
  };
  await f.load(false);
  const prefix = keys(f.tab.items);
  f.context.viewedTokens.add(`key:${prefix[0]}`);
  await f.load(true);
  assert.deepEqual(keys(f.tab.items.slice(0, prefix.length)), prefix);
  assert.equal(f.tab.emptyRecommendationRounds, 0);
  assert(f.tab.items.length > prefix.length);
  assert.equal(f.visible().length, f.tab.items.length);
});

test('a fresh recommendation generation discards an older pending rank and keeps the replacement cursors', async () => {
  const f = fixture(), ranks = [];
  f.context.mergeRecommendationsAsync = (...args) => new Promise(resolve => {
    ranks.push(() => resolve(logic.mergeRecommendations(...args)));
  });
  const obsolete = f.load(false);
  await flush();
  assert.equal(ranks.length, 1);
  const fresh = f.load(false);
  await flush();
  assert.equal(ranks.length, 2);
  ranks[1](); await fresh;
  const replacement = keys(f.tab.items);
  assert(replacement.length > 0);
  const version = f.tab.recommendationVersion;
  ranks[0](); await obsolete;
  assert.deepEqual(keys(f.tab.items), replacement);
  assert.equal(f.tab.recommendationVersion, version);
  assert.equal(f.tab.loading, false);
  const committed = Object.values(f.tab.recommendationPools).flat().flatMap(group => group.streams)
    .filter(stream => stream.nextPage > 0);
  assert(committed.length > 0);
  assert(committed.every(stream => stream.nextPage === 1));
});

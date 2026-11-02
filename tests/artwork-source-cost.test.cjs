'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('./helpers/viewer-vm.cjs');
const logic = require('../wwwroot/catalog-logic.js');
const navigation = require('../wwwroot/artwork-navigation.js');
const app = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
const block = (a, b) => app.slice(app.indexOf(a), app.indexOf(b, app.indexOf(a)));

function fixture(kind = 'likes', withRevision = false, count = 240) {
  const groupSizes = [];
  const items = Array.from({ length: count }, (_, index) => ({ key: `danbooru:${index + 1}`,
    id: String(index + 1), source: 'danbooru', title: `Artwork ${index + 1}`, rating: 'g',
    creatorTag: `artist_${index % 20}`, tags: ['landscape'], images: [`https://cdn.donmai.us/${index + 1}.jpg`] }));
  const tab = { id: 1, kind, items, rating: 'all', started: true };
  const context = vm.createContext({ CatalogLogic: { ...logic, groupWorks(items) {
      groupSizes.push(items.length); return logic.groupWorks(items); } }, DartArtworkNavigation: navigation,
    likes: kind === 'likes' ? items : [], bookmarks: kind === 'bookmarks' ? items : [], recent: [],
    tabs: [tab], itemIndex: new Map(), currentTab: () => tab, findTab: () => tab, structuredClone,
    contentPreferences: { curation: { enabled: true } }, recommendationTagPreferences: {}, defaultSources: ['danbooru'],
    rememberItems() {}, scheduleRelatedKnownRefresh() {}, isExpiredFeedWork: () => false });
  vm.runInContext(block('function curationContext(', '\nasync function loadSearch(') +
    block('function setSavedWorks(', '\nasync function loadFavoriteTags(') +
    block('function knownWorkTokens(', '\nfunction emptyFeedMessage(') +
    block('const artworkRoutes = new Set();', '\nfunction pruneArtworkRoutes('), context);
  if (withRevision) logic.invalidateGrouping(items);
  const route = context.createArtworkRoute(tab, items[0]);
  route.engine.sync(); groupSizes.length = 0;
  return { tab, context, route, groupSizes, original: items, update(index) {
    context.refreshSavedDetail({ ...items[index], title: `Detail ${index + 1}`, tags: ['landscape', 'learned_tag'] });
    route.engine.sync();
  } };
}

for (const kind of ['likes', 'bookmarks']) test(`one ${kind} detail update groups only that changed work despite global curation`, () => {
  const f = fixture(kind);
  for (let index = 0; index < 3; index++) f.update(index);
  assert(f.groupSizes.every(size => size <= 1), `Single details regrouped these source sizes: ${f.groupSizes}`);
  assert.equal(f.route.engine.items.length, 240);
  assert.deepEqual(f.route.engine.items.slice(0, 3).map(item => item.title), ['Detail 1', 'Detail 2', 'Detail 3']);
  assert.equal(f.route.engine.items[3].key, 'danbooru:4');
});

test('replacing a previously refined saved array keeps its conservative first refresh and later updates incremental', () => {
  const f = fixture('likes', true);
  for (let index = 0; index < 3; index++) f.update(index);
  assert.notEqual(f.tab.items, f.original);
  assert.equal(f.groupSizes.filter(size => size === 240).length, 1,
    'A revision transition can require one full refresh, but subsequent independent details must stay incremental');
  assert.deepEqual(f.route.engine.items.slice(0, 3).map(item => item.title), ['Detail 1', 'Detail 2', 'Detail 3']);
  assert.equal(f.route.engine.items.length, 240);
});

test('discovery source replacements still reconsider the whole feed for enabled curation', () => {
  const f = fixture('search');
  f.tab.items = f.tab.items.map((item, index) => index ? item : { ...item, popularityCount: 5000 });
  f.route.engine.sync();
  assert(f.groupSizes.includes(240), 'Discovery curation still needs the complete candidate pool');
  assert.equal(f.route.engine.items.length, 240);
});

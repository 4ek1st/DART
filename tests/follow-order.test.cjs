'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('./helpers/viewer-vm.cjs');
const logic = require('../wwwroot/catalog-logic.js');
const navigation = require('../wwwroot/artwork-navigation.js');
const app = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
const block = (a, b) => app.slice(app.indexOf(a), app.indexOf(b, app.indexOf(a)));
const keys = works => Array.from(works, item => item.key);
const work = (artist, id, published = '2026-10-01T12:00:00Z', extra = {}) => ({
  key: `danbooru:${id}`, id: String(id), source: 'danbooru', creatorTag: artist,
  title: `Artwork ${id}`, rating: 'g', published, tags: ['landscape'],
  images: [`https://cdn.donmai.us/${id}.jpg`], ...extra });
function pool(artists = 5, perArtist = 20) {
  return Array.from({ length: artists }, (_, artist) => Array.from({ length: perArtist }, (_, i) =>
    work(`artist_${artist}`, artist * 1000 + i + 1, i % 2 ? '2026-11-02T12:00:00Z' : '2025-01-01T12:00:00Z'))).flat();
}

test('Random interleaves artists and older/newer works deterministically across the loaded pool', () => {
  const incoming = pool(), random = logic.randomFollowFeedItems([], incoming, 12345);
  assert.deepEqual(new Set(keys(random)), new Set(keys(incoming)));
  assert.deepEqual(keys(logic.randomFollowFeedItems([], incoming, 12345)), keys(random));
  assert.notDeepEqual(keys(logic.randomFollowFeedItems([], incoming, 54321)), keys(random));
  for (let index = 1; index < random.length; index++)
    assert.notEqual(random[index].creatorTag, random[index - 1].creatorTag);
  assert.equal(new Set(random.slice(0, 10).map(item => item.creatorTag)).size, 5);
  const dates = new Set(random.slice(0, 20).map(item => item.published));
  assert.equal(dates.size, 2, 'New status and publication age must not partition Random');
});

test('Random spreads a larger artist bucket instead of appending a long same-artist tail', () => {
  const incoming = [...pool(1, 30), ...Array.from({ length: 10 }, (_, i) => work('second', 2000 + i)),
    ...Array.from({ length: 10 }, (_, i) => work('third', 3000 + i))];
  const ordered = logic.randomFollowFeedItems([], incoming, 7);
  let run = 0, longest = 0, previous;
  for (const item of ordered) { run = item.creatorTag === previous ? run + 1 : 1; previous = item.creatorTag; longest = Math.max(longest, run); }
  assert(longest <= 3, `One dominant artist produced ${longest} consecutive cards`);
});

test('random pagination preserves its published prefix while merging a later source mirror once', () => {
  const incoming = logic.groupWorks(pool(3, 4));
  const first = logic.randomFollowFeedItems([], incoming, 2468);
  first[0].contentHash = 'a'.repeat(32);
  logic.invalidateGrouping(first);
  const mirror = { ...work('artist_0', 9001), source: 'gelbooru', key: 'gelbooru:9001', contentHash: 'a'.repeat(32) };
  const additions = Array.from({ length: 6 }, (_, index) => work(`artist_${index % 2}`, 4000 + index));
  const updated = logic.groupWorks([...first, mirror, ...additions]);
  const appended = logic.randomFollowFeedItems(first, updated, 2468);
  assert.deepEqual(keys(appended.slice(0, first.length)), keys(first));
  assert.equal(appended.filter(item => item.memberKeys.includes('gelbooru:9001')).length, 1);
  assert.equal(appended.length, first.length + 6);
});

function feedFixture() {
  const incoming = pool(4, 6), follow = { key: 'danbooru::fixture', followedAt: '2026-11-01T00:00:00Z' };
  const tab = { id: 1, kind: 'follows', rating: 'general', followVersion: 1, followUpdateRevision: 1,
    followStreams: [], followGroups: [{ follow, items: incoming }], items: [], started: true };
  const context = vm.createContext({ CatalogLogic: logic, DartArtworkNavigation: navigation, structuredClone,
    tabs: [tab], recent: [], contentPreferences: {}, activeId: 1, findTab: id => id === 1 ? tab : null,
    currentTab: () => tab, rememberItems() {}, render() {}, saveSession() {},
    main: { scrollTop: 1500 }, defaultSources: ['danbooru'], filterFeedWorks: items => items,
    isExpiredFeedWork: () => false, artworkActionsController: () => ({ isHidden: () => false }) });
  vm.runInContext(block('async function updateFollowFeed(', '\nasync function flushFollowUpdate(') +
    block('const artworkRoutes = new Set();', '\nfunction pruneArtworkRoutes('), context);
  return { incoming, tab, context };
}

test('Date preserves existing New/date order while Random and its viewer share one stable order', async () => {
  const f = feedFixture();
  await f.context.updateFollowFeed(f.tab);
  assert(f.tab.items.slice(0, 12).every(item => item.published.startsWith('2026-11')));
  const originalNew = new Set(f.tab.newKeys);
  await f.context.setFollowOrder(f.tab, 'random');
  assert.equal(f.tab.followOrder, 'random');
  assert.deepEqual(new Set(f.tab.newKeys), originalNew, 'sorting must not change New status');
  const mixed = keys(f.tab.items);
  assert.equal(new Set(f.tab.items.slice(0, 10).map(item => item.published)).size, 2);
  const route = f.context.createArtworkRoute(f.tab, f.tab.items[0]);
  assert.deepEqual(keys(route.engine.items), mixed);
  assert.equal((await route.engine.move(1)).key, mixed[1]);
  assert.equal((await route.engine.move(-1)).key, mixed[0]);
  const seed = f.tab.followRandomSeed;
  await f.context.updateFollowFeed(f.tab);
  assert.deepEqual(keys(f.tab.items), mixed);
  assert.equal(f.tab.followRandomSeed, seed);
  assert.deepEqual(keys(f.context.copyArtworkSource(f.tab).items), mixed);
  f.tab.followGroups[0].items.push(work('later_artist', 8000, '2026-11-03T12:00:00Z'),
    work('older_artist', 8001, '2024-01-01T12:00:00Z'));
  f.tab.followUpdateRevision++;
  await f.context.updateFollowFeed(f.tab);
  assert.deepEqual(keys(f.tab.items.slice(0, mixed.length)), mixed, 'later New works must not move Random cards');
  route.engine.sync();
  assert.deepEqual(keys(route.engine.items), keys(f.tab.items), 'keyboard navigation appends in the displayed Random order');
  await f.context.setFollowOrder(f.tab, 'date');
  assert(f.tab.items.slice(0, 13).every(item => item.published.startsWith('2026-11')));
  assert.equal(f.context.artworkRouteSource(route).artworkDetached, true, 'old viewers keep their source generation');
});

test('mode changes initialize a new seed once and ignore repeated or invalid mode actions', async () => {
  const f = feedFixture();
  await f.context.updateFollowFeed(f.tab);
  await f.context.setFollowOrder(f.tab, 'random');
  const seed = f.tab.followRandomSeed, order = keys(f.tab.items);
  f.context.main.scrollTop = f.tab.scrollTop = 2400;
  await f.context.setFollowOrder(f.tab, 'random');
  await f.context.setFollowOrder(f.tab, 'unsupported');
  assert.equal(f.context.main.scrollTop, 2400);
  assert.equal(f.tab.followRandomSeed, seed);
  assert.deepEqual(keys(f.tab.items), order);
  await f.context.setFollowOrder(f.tab, 'date');
  await f.context.setFollowOrder(f.tab, 'random');
  assert.notEqual(f.tab.followRandomSeed, seed);
  assert.equal(f.context.main.scrollTop, 0);
});

test('Following order control uses the shared segmented buttons and declares its selected mode', () => {
  const f = feedFixture();
  Object.assign(f.context, { follows: [{ key: 'fixture' }], settings: { hasApiKey: true }, names: {},
    renderFollowArtist: () => '', renderErrors: () => '', escapeHtml: String,
    renderGrid: () => '', followSourceNeedsSettings: () => false });
  vm.runInContext(block('function renderFollows(', '\nfunction selectLoadedProfileImage('), f.context);
  const date = f.context.renderFollows(f.tab);
  assert.match(date, /control-group[^>]*aria-label="Following order"/);
  assert.match(date, /class="filter-button active"[^>]*data-action="follow-order"[^>]*data-order="date"[^>]*aria-pressed="true"/);
  f.tab.followOrder = 'random';
  assert.match(f.context.renderFollows(f.tab), /class="filter-button active"[^>]*data-action="follow-order"[^>]*data-order="random"[^>]*aria-pressed="true"/);
});

test('Random startup preserves its restored seed while explicit refresh initializes a new generation', async () => {
  const savedSeeds = [];
  const tab = { id: 1, kind: 'follows', followOrder: 'random', followRandomSeed: 12345,
    rating: 'general', items: [] };
  const context = vm.createContext({ CatalogLogic: logic, AbortController, URLSearchParams,
    setTimeout: () => 1, clearTimeout() {}, follows: [], followedKeys: new Set(),
    contentPreferences: {}, settings: {}, activeId: 1, findTab: () => tab,
    refreshFollows: async () => true, rememberItems() {}, render() {},
    saveSession: () => savedSeeds.push(tab.followRandomSeed),
    request: async () => ({ groups: [] }) });
  vm.runInContext(block('function decorateFollowItems(', '\nasync function loadBookmarks('), context);
  await context.loadFollowFeed(tab);
  assert.equal(tab.followRandomSeed, 12345, 'Saved Random seed must survive startup and session restoration');
  assert.equal(savedSeeds.length, 0, 'Restoring a valid seed does not rewrite client state');
  await context.loadFollowFeed(tab, true);
  assert.notEqual(tab.followRandomSeed, 12345, 'Explicit Refresh can reshuffle the loaded feed');
  assert.equal(savedSeeds.at(-1), tab.followRandomSeed, 'A refreshed seed must persist before another action or unload');
  const refreshed = tab.followRandomSeed;
  await context.loadFollowFeed(tab);
  assert.equal(tab.followRandomSeed, refreshed);
  tab.followRandomSeed = 0;
  await context.loadFollowFeed(tab);
  assert(tab.followRandomSeed > 0, 'An older session without an initialized seed gets one');
});

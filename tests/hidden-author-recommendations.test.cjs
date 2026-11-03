'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('./helpers/viewer-vm.cjs');
const CatalogLogic = require('../wwwroot/catalog-logic.js');
const app = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
const block = (start, end) => app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start)));
const tick = () => new Promise(resolve => setImmediate(resolve));
const author = { source: 'artist', artistId: 'hidden_artist', name: 'Hidden fixture artist' };
const work = (id, creatorTag) => ({ key: `danbooru:${id}`, source: 'danbooru', id: String(id),
  title: `Neutral landscape ${id}`, rating: 'g', creatorTag, tags: ['watercolor'],
  images: [`https://fixture.test/${id}.png`] });

async function fixture({ manualChoices = true } = {}) {
  const hidden = work(1, author.artistId), eligible = work(2, 'eligible_artist');
  const tab = { id: 1, kind: 'recommendations', rating: 'general', started: true,
    selectedSources: ['danbooru'], items: [], errors: {}, loading: false };
  const initial = { language: 'en', aiMode: 'all', hideFurry: false, hideViewedAndSaved: false,
    hideFollowedArtists: false, hiddenAuthors: [], excludedTags: [], curation: CatalogLogic.normalizeCurationPreferences() };
  let persisted = structuredClone(initial), hold = false, failSave = false, active = tab;
  const reads = [], mutations = [], delayed = [], frames = [], messages = [];
  const context = vm.createContext({ CatalogLogic, AbortController, URLSearchParams, structuredClone,
    setTimeout, clearTimeout, contentPreferences: initial, contentPreferencesSaving: false, contentPreferencesRevision: 0,
    likes: Array.from({ length: 8 }, (_, index) => work(100 + index, 'liked_artist')),
    bookmarks: [], recent: [], tabs: [tab], activeId: 1, recommendationVisitCount: 0,
    recommendationTagPreferences: manualChoices ? { watercolor: 'priority' } : {},
    localStorage: { setItem() {} }, findTab: id => context.tabs.find(value => value.id === id),
    currentTab: () => active, main: { scrollTop: 0, querySelectorAll: () => [], querySelector: () => null },
    rememberItems() {}, saveSession() {}, isRetainedFeedWork: () => false,
    knownWorkTokens: () => new Set(),
    render: () => frames.push({ started: tab.started, loading: tab.loading, keys: tab.items.map(item => item.key) }),
    toast: message => messages.push(message),
    request: async (url, options = {}) => {
      if (url === '/api/hidden-authors') {
        const update = JSON.parse(options.body); mutations.push(update);
        if (failSave) throw Error('Fixture save unavailable');
        const key = CatalogLogic.hiddenAuthorKey(update.author);
        const remaining = persisted.hiddenAuthors.filter(value => CatalogLogic.hiddenAuthorKey(value) !== key);
        persisted = { ...persisted, hiddenAuthors: update.hidden ? [...remaining, update.author] : remaining };
        return structuredClone(persisted);
      }
      if (url === '/api/content-preferences') {
        if (failSave) throw Error('Fixture save unavailable');
        persisted = { ...persisted, ...JSON.parse(options.body) }; return structuredClone(persisted);
      }
      assert(url.startsWith('/api/search?'), url);
      reads.push({ url, signal: options.signal });
      const response = { items: [hidden, eligible], errors: {}, hasMoreSources: ['danbooru'] };
      return hold ? new Promise(resolve => delayed.push(() => resolve(response))) : response;
    }
  });
  vm.runInContext(block('function createRecommendationPools(', '\nfunction decorateFollowItems(') + '\n' +
    block('function startTab(', '\nfunction restoreSession(') + '\n' +
    block('function applyContentPreferences(', '\nasync function loadDetail('), context);
  await context.loadRecommendations(tab);
  assert.equal(tab.loadError, false, 'The fixture must begin with a successful recommendation load');
  assert.deepEqual(new Set(tab.items.map(item => item.key)), new Set([hidden.key, eligible.key]));
  return { context, tab, hidden, eligible, reads, mutations, frames, messages,
    setHold: value => { hold = value; }, setFail: value => { failSave = value; },
    deactivate() { active = { id: 2, kind: 'settings' }; context.tabs.push(active); context.activeId = 2; },
    activate() { active = tab; context.activeId = tab.id; context.startTab(tab); },
    release() { delayed.splice(0).forEach(resolve => resolve()); },
    async settle() { for (let attempt = 0; attempt < 20; attempt++) { await tick(); if (!tab.loading) return; } }
  };
}

for (const phase of ['idle', 'paused', 'exhausted', 'pending append']) {
  test(`hiding an author restarts active Recommendations without a reload from ${phase}`, async () => {
    const f = await fixture(); let older;
    try {
      if (phase === 'paused') { f.tab.recommendationPaused = true; f.tab.loadError = true; }
      if (phase === 'exhausted') f.tab.hasMore = false;
      if (phase === 'pending append') {
        f.setHold(true); older = f.context.loadRecommendations(f.tab, true); await tick(); f.setHold(false);
      }
      const previous = f.tab.recommendationController, count = f.reads.length;
      await f.context.setAuthorHidden(author, true); await f.settle();
      assert.equal(previous.signal.aborted, true);
      assert(f.reads.length > count, 'The successful preference mutation must start a new active recommendation generation');
      assert.equal(f.tab.started, true);
      assert.equal(f.tab.loading, false, 'The old request must not leave the replacement generation loading forever');
      assert.equal(f.tab.loadError, false);
      assert.deepEqual(f.tab.items.map(item => item.key), [f.eligible.key]);
      f.release(); await older;
      assert.deepEqual(f.tab.items.map(item => item.key), [f.eligible.key], 'Late pre-hide replies cannot restore the hidden author');
    } finally { f.release(); await older; }
  });
}

test('inactive recommendation tabs reset loading and rebuild only when activated', async () => {
  const f = await fixture(); f.tab.loading = true; f.deactivate();
  const count = f.reads.length;
  await f.context.setAuthorHidden(author, true);
  assert.equal(f.reads.length, count);
  assert.equal(f.tab.started, false);
  assert.equal(f.tab.loading, false);
  f.activate(); await f.settle();
  assert.deepEqual(f.tab.items.map(item => item.key), [f.eligible.key]);
});

test('failed author saves keep the current preferences, controller and feed usable', async () => {
  const f = await fixture(), before = f.context.contentPreferences, items = f.tab.items;
  const controller = f.tab.recommendationController, version = f.tab.recommendationVersion, count = f.reads.length;
  f.setFail(true); await f.context.setAuthorHidden(author, true);
  assert.equal(f.context.contentPreferences, before);
  assert.equal(f.tab.items, items); assert.equal(controller.signal.aborted, false);
  assert.equal(f.tab.recommendationVersion, version); assert.equal(f.reads.length, count);
  assert.equal(f.context.contentPreferencesSaving, false);
  assert.match(f.messages.at(-1), /Failed/);
});

test('repeated hides are idempotent and unhide restores an active recommendation generation', async () => {
  const f = await fixture();
  await f.context.setAuthorHidden(author, true); await f.settle();
  const count = f.reads.length, version = f.tab.recommendationVersion;
  await f.context.setAuthorHidden(author, true); await f.settle();
  assert.equal(f.reads.length, count); assert.equal(f.tab.recommendationVersion, version);
  await f.context.setAuthorHidden(author, false); await f.settle();
  assert.deepEqual(new Set(f.tab.items.map(item => item.key)), new Set([f.hidden.key, f.eligible.key]));
});

test('generic content saves also restart active Recommendations while failed saves retain the existing feed', async () => {
  const f = await fixture(); const count = f.reads.length;
  await f.context.saveContentPreferences({ ...f.context.contentPreferences, hideFurry: true }); await f.settle();
  assert(f.reads.length > count); assert.equal(f.tab.started, true); assert.equal(f.tab.loading, false);
  const items = f.tab.items, version = f.tab.recommendationVersion;
  f.setFail(true); await f.context.saveContentPreferences({ ...f.context.contentPreferences, hideFurry: false });
  assert.equal(f.context.contentPreferences.hideFurry, true);
  assert.equal(f.tab.items, items); assert.equal(f.tab.recommendationVersion, version);
});

test('hiding all liked authors with no manual choices settles as an empty nonloading generation', async () => {
  const f = await fixture({ manualChoices: false });
  const count = f.reads.length;
  await f.context.setAuthorHidden({ source: 'artist', artistId: 'liked_artist', name: 'Liked fixture artist' }, true);
  await f.settle();
  assert.equal(f.tab.started, true); assert.equal(f.tab.loading, false); assert.equal(f.tab.hasMore, false);
  assert.equal(f.reads.length, count, 'An empty taste profile must not poll providers');
  assert.equal(f.tab.items.length, 0);
});

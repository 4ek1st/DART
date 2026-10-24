const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const CatalogLogic = require('../wwwroot/catalog-logic.js');
const I18n = require('../wwwroot/i18n.js');
const source = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
const block = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const work = (source, id, creatorTag) => ({ source, id: String(id), key: `${source}:${id}`,
  title: 'Artwork', images: [`https://fixture.test/${source}-${id}.png`], tags: ['landscape'],
  creatorTag, rating: 'g' });

function fixture(kind = 'search', gridKey = '') {
  const subscribed = work('sankaku', 1, 'followed_artist'), fresh = work('rule34', 2, 'other_artist');
  const tab = { id: 1, kind, items: [subscribed, fresh] };
  const context = vm.createContext({ CatalogLogic, Map, Set, contentPreferences: {
    language: 'en', aiMode: 'all', hideFurry: false, hideViewedAndSaved: false,
    hideFollowedArtists: true, excludedTags: [], hiddenAuthors: [], curation: CatalogLogic.normalizeCurationPreferences() },
    follows: [{ source: 'danbooru', artistId: 'followed_artist' }],
    viewedTokens: new Set(), viewedPending: new Set(), likes: [], bookmarks: [], recent: [],
    currentTab: () => tab, main: { dataset: { tabId: '1' }, clientHeight: 500 },
    escapeHtml: String, names: {},
    renderCard: item => `<article data-key="${item.key}"></article>` });
  vm.runInContext(block('function knownWorkTokens(', '\nfunction measureVirtualGrids('), context);
  return { context, tab, subscribed, fresh,
    keys: () => Array.from(context.filterFeedWorks(tab.items, tab, false, gridKey), item => item.key) };
}

test('followed works are hidden only in search, illustrations, recommendations and related works', () => {
  for (const [kind, grid] of [['home', ''], ['search', 'search'], ['recommendations', 'recommendations'], ['detail', 'related']]) {
    const f = fixture(kind, grid);
    assert.deepEqual(f.keys(), [f.fresh.key], kind);
  }
  for (const [kind, grid] of [['follows', 'follows'], ['likes', 'likes'], ['bookmarks', 'bookmarks'],
    ['recent', 'recent'], ['profile', 'profile'], ['detail', 'creator']]) {
    const f = fixture(kind, grid);
    assert.deepEqual(f.keys(), [f.subscribed.key, f.fresh.key], kind);
  }
});

test('switching off hiding restores works and empty follow lists do not hide anyone', () => {
  const f = fixture();
  f.context.contentPreferences.hideFollowedArtists = false;
  assert.equal(f.keys().length, 2);
  f.context.contentPreferences.hideFollowedArtists = true; f.context.follows = [];
  assert.equal(f.keys().length, 2);
});

test('following an artist preserves their rendered card until the result generation changes', () => {
  const f = fixture(); f.context.follows = [];
  assert.equal(f.keys().length, 2);
  f.context.rememberRenderedFeedWork(f.tab, f.subscribed, 'search');
  f.context.follows = [{ source: 'danbooru', artistId: 'followed_artist' }];
  assert.equal(f.keys().length, 2);
  const next = { ...f.tab, retainedFeedWorks: new Map() };
  assert.deepEqual(Array.from(f.context.filterFeedWorks(next.items, next), item => item.key), [f.fresh.key]);
});

test('the positive Show toggle is checked by default, inverted when hidden and disabled while saving', () => {
  const context = { currentTab: () => ({ kind: 'settings', settingsSection: 'content' }),
    contentPreferences: { aiMode: 'all', hideFollowedArtists: false }, contentPreferencesSaving: false,
    escapeHtml: String, svg: () => '' };
  const render = vm.runInNewContext(block('function renderSettings()', '\nconst sankakuMediaRecovery =') + '\nrenderSettings', context);
  assert.match(render(), /Feed personalization/);
  assert.match(render(), /name="showFollowedArtists"[^>]*aria-describedby="followed-artists-hint"[^>]*checked/);
  context.contentPreferences.hideFollowedArtists = true; context.contentPreferencesSaving = true;
  assert.match(render(), /name="showFollowedArtists"[^>]*disabled/);
  assert.doesNotMatch(render(), /name="showFollowedArtists"[^>]*checked/);
  for (const [language, heading, label] of [
    ['en', 'Feed personalization', 'Show works by followed artists'],
    ['ru', 'Персонализация ленты', 'Показывать работы авторов из подписок'],
    ['de', 'Feed personalisieren', 'Werke abonnierter Künstler anzeigen']]) {
    I18n.setLanguage(language);
    assert.equal(I18n.translate('Feed personalization'), heading);
    assert.equal(I18n.translate('Show works by followed artists'), label);
  }
  I18n.setLanguage('en');
});

test('saving persists the hide flag, while a failed request keeps the previous preference', async () => {
  let reject = false; const payloads = [], inputs = [{ disabled: false }];
  const context = { CatalogLogic, contentPreferencesSaving: false, contentPreferencesRevision: 0,
    contentPreferences: { hideFollowedArtists: false },
    main: { querySelectorAll: () => inputs }, toast() {}, render() {},
    request: async (_, options) => { const saved = JSON.parse(options.body); payloads.push(saved);
      if (reject) throw Error('fixture'); return saved; },
    applyContentPreferences: saved => { context.contentPreferences = saved; } };
  const save = vm.runInNewContext(block('async function saveContentPreferences(', '\nasync function loadDetail(') + '\nsaveContentPreferences', context);
  await save({ hideFollowedArtists: true });
  assert.equal(payloads[0].hideFollowedArtists, true);
  assert.equal(context.contentPreferences.hideFollowedArtists, true);
  reject = true; await save({ hideFollowedArtists: false });
  assert.equal(context.contentPreferences.hideFollowedArtists, true);
  assert.equal(context.contentPreferencesSaving, false);
});

test('changing this filter invalidates discovery only and preserves Following and library state', () => {
  const f = fixture(); f.context.contentPreferences.hideFollowedArtists = false;
  const keep = { kind: 'follows', retainedFeedWorks: new Map([['kept', true]]), followGroups: [], followStreams: [] };
  const profile = { kind: 'profile', retainedFeedWorks: new Map([['kept', true]]) };
  let aborted = 0, updated = 0;
  const recommendation = { kind: 'recommendations', started: true, items: [f.subscribed],
    recommendationVersion: 2, recommendationController: { abort() { aborted++; } } };
  Object.assign(f.context, { tabs: [f.tab, keep, profile, recommendation], updateFollowFeed() { updated++; } });
  vm.runInContext(block('function applyContentPreferences(', '\nasync function saveCurationPreferences('), f.context);
  f.context.applyContentPreferences({ ...f.context.contentPreferences, hideFollowedArtists: true });
  assert.equal(aborted, 1); assert.equal(recommendation.started, false);
  assert.equal(keep.retainedFeedWorks.size, 1); assert.equal(profile.retainedFeedWorks.size, 1);
  assert.equal(updated, 0);
});

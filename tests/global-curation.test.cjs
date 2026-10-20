const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const CatalogLogic = require('../wwwroot/catalog-logic.js');
const app = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
const popularity = { enabled: true, popularity: true, personal: false, freshness: false, resolution: false };
const work = (id, score) => ({ key: `danbooru:${id}`, source: 'danbooru', id: String(id),
  title: `QA work ${id}`, rating: 'g', tags: ['watercolor'], popularityCount: score });
const keys = works => Array.from(works, item => item.key);
function feedFixture() {
  const start = app.indexOf('function curateFeedWorks(') >= 0
    ? app.indexOf('function curateFeedWorks(') : app.indexOf('function filterFeedWorks(');
  const end = app.indexOf('\nfunction emptyFeedMessage(', start);
  const context = { CatalogLogic, contentPreferences: { curation: { ...popularity } },
    request: () => { throw new Error('Ranking must not make requests'); } };
  context.curationContext = () => ({ liked: [], curation: context.contentPreferences.curation });
  vm.createContext(context);
  vm.runInContext(app.slice(start, end), context);
  return context;
}

test('one curation preference applies to every ordinary artwork list and both catalog sorts', () => {
  for (const [kind, gridKey] of [['home', ''], ['search', 'search'], ['profile', 'profile'],
    ['follows', 'follows'], ['likes', 'likes'], ['bookmarks', 'bookmarks'], ['recent', 'recent']]) {
    for (const sort of ['recent', 'popular']) {
      const context = feedFixture(), items = [work(1, 0), work(2, 30)];
      const tab = { kind, sort, rating: 'general', items };
      assert.deepEqual(keys(context.filterFeedWorks(items, tab, false, gridKey)),
        ['danbooru:2', 'danbooru:1'], `${kind}/${sort}`);
      assert.deepEqual(keys(items), ['danbooru:1', 'danbooru:2'], 'ranking must not rewrite the stored list');
    }
  }
});

test('following keeps New first and ranks within the new and older groups', () => {
  const context = feedFixture(), items = [work(1, 0), work(2, 10), work(3, 100)];
  const tab = { kind: 'follows', rating: 'general', newKeys: new Set(['danbooru:1', 'danbooru:2']) };
  assert.deepEqual(keys(context.filterFeedWorks(items, tab, false, 'follows')),
    ['danbooru:2', 'danbooru:1', 'danbooru:3']);
});

test('global curation preserves existing feed positions when a better next page arrives', () => {
  const context = feedFixture(), tab = { kind: 'search', sort: 'recent' };
  const first = [work(1, 0), work(2, 10)];
  assert.deepEqual(keys(context.filterFeedWorks(first, tab, false, 'search')), ['danbooru:2', 'danbooru:1']);
  assert.deepEqual(keys(context.filterFeedWorks([...first, work(3, 100)], tab, false, 'search')),
    ['danbooru:2', 'danbooru:1', 'danbooru:3']);
});

test('a settings change reranks cached views and disabling restores each original order', () => {
  const context = feedFixture(), tab = { kind: 'bookmarks' }, items = [work(1, 0), work(2, 10)];
  assert.deepEqual(keys(context.filterFeedWorks(items, tab, false, 'bookmarks')), ['danbooru:2', 'danbooru:1']);
  context.contentPreferences.curation = { ...popularity, enabled: false };
  assert.deepEqual(keys(context.filterFeedWorks(items, tab, false, 'bookmarks')), ['danbooru:1', 'danbooru:2']);
  context.contentPreferences.curation = { ...popularity, popularity: false };
  assert.deepEqual(keys(context.filterFeedWorks(items, tab, false, 'bookmarks')), ['danbooru:1', 'danbooru:2']);
});

test('the home row slices retain the order already chosen for the complete home feed', () => {
  const context = feedFixture(), tab = { kind: 'home' }, items = [work(1, 0), work(2, 10), work(3, 20)];
  const ranked = context.filterFeedWorks(items, tab);
  assert.deepEqual(keys(ranked), ['danbooru:3', 'danbooru:2', 'danbooru:1']);
  context.filterFeedWorks(ranked.slice(0, 1), tab, true, '', true);
  context.filterFeedWorks(ranked.slice(1), tab, true, 'home-rest', true);
  assert.deepEqual(keys(context.filterFeedWorks(items, tab)), ['danbooru:3', 'danbooru:2', 'danbooru:1']);
});

test('recommendation and related relevance scores are not applied twice by grid rendering', () => {
  const context = feedFixture(), items = [work(1, 0), work(2, 10)];
  for (const [kind, gridKey] of [['recommendations', 'recommendations'], ['detail', 'related']])
    assert.deepEqual(keys(context.filterFeedWorks(items, { kind }, false, gridKey)), ['danbooru:1', 'danbooru:2']);
});

test('the creator strip selects from all available works using the same global setting', () => {
  const context = feedFixture();
  const start = app.indexOf('function selectCreatorWorks('), end = app.indexOf('\nasync function loadRelated(', start);
  const select = vm.runInContext(app.slice(start, end) + '\nselectCreatorWorks', context);
  const items = Array.from({ length: 16 }, (_, index) => work(index + 1, index));
  const tab = { kind: 'detail' }, current = work(99, 0);
  const selected = select(current, items, tab);
  assert.equal(selected.length, 12);
  assert.equal(selected[0].key, 'danbooru:16');
});

test('legacy Curated sessions migrate back to ordinary sorting without losing the settings section', () => {
  const state = CatalogLogic.cleanClientState({ session: { savedWorksVersion: 1, activeIndex: 0, tabs: [
    { kind: 'search', sort: 'curated', curationBaseSort: 'popular' },
    { kind: 'home', sort: 'curated' }, { kind: 'settings', settingsSection: 'curation' }
  ] } });
  assert.equal(state.session.tabs[0].sort, 'popular');
  assert.equal(state.session.tabs[1].sort, 'recent');
  assert.equal('curationBaseSort' in state.session.tabs[0], false);
  assert.equal(state.session.tabs[2].settingsSection, 'curation');
});

test('the catalog has only New and Popular even when global curation is enabled', () => {
  const start = app.indexOf('function renderSearch(tab)'), end = app.indexOf('\nfunction renderRecommendationTagChips(', start);
  const render = vm.runInNewContext(app.slice(start, end) + '\nrenderSearch', {
    CatalogLogic, contentPreferences: { curation: popularity }, favoriteTags: [], names: { danbooru: 'Danbooru' },
    sourceKeyHint: () => '', escapeHtml: value => value, queryBlockedByFilters: () => false,
    renderErrors: () => '', renderFeedTail: () => '', hasResultError: () => false,
    renderGrid: () => '<div></div>'
  });
  const html = render({ query: '', rating: 'general', sort: 'recent', selectedSources: ['danbooru'], items: [], errors: {} });
  assert.match(html, /data-sort="recent"/);
  assert.match(html, /data-sort="popular"/);
  assert.doesNotMatch(html, /data-sort="curated"|>Curated</);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const CatalogLogic = require('../wwwroot/catalog-logic.js');
const source = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
const between = (start, end) => {
  const first = source.indexOf(start);
  const last = source.indexOf(end, first);
  assert(first >= 0 && last > first);
  return source.slice(first, last);
};
function fixture({ hidden = true, bookmarks = [], viewed = [], tab = {} } = {}) {
  const current = { id: 1, kind: 'detail', feed: 'illustrations', ...tab };
  const serverBookmarks = [...bookmarks];
  const context = vm.createContext({
    CatalogLogic, Set, Map, contentPreferences: { hideViewedAndSaved: hidden },
    bookmarks: [...bookmarks], viewedTokens: new Set(viewed), viewedPending: new Set(), savedKeys: new Set(),
    bookmarkPending: new Set(), tabs: [current], activeId: 1,
    main: { querySelectorAll: () => [] }, currentTab: () => current,
    escapeHtml: value => String(value),
    renderCard: item => `<article data-key="${item.key}"></article>`,
    syncBookmarkButtons() {}, rememberItems() {}, toast() {},
    request: async (path, options) => {
      if (path === '/api/bookmarks' && options?.method === 'POST') {
        serverBookmarks.push(JSON.parse(options.body));
        return { saved: true };
      }
      if (path === '/api/bookmarks') return [...serverBookmarks];
      if (path === '/api/viewed-identities') return [];
      throw new Error(`Unexpected fixture request: ${path}`);
    }
  });
  vm.runInContext(between('function filterFeedWorks(', '\nfunction measureVirtualGrids(') + '\n' +
    between('async function refreshBookmarks(', '\nasync function loadFavoriteTags(') + '\n' +
    between('async function recordViewedWorks(', '\nasync function refreshFollows(') + '\n' +
    between('async function toggleBookmark(', '\nfunction syncBookmarkButtons('), context);
  return context;
}
const saved = { key: 'danbooru:saved', source: 'danbooru', contentHash: 'a'.repeat(32) };
const copy = { key: 'gelbooru:copy', source: 'gelbooru', contentHash: saved.contentHash };
const fresh = { key: 'rule34:fresh', source: 'rule34' };

test('related grid hides saved copies, grouped members and viewed works', () => {
  const context = fixture({ bookmarks: [saved, { key: 'danbooru:member' }],
    viewed: ['key:danbooru:viewed'] });
  const html = context.renderGrid([copy, fresh,
    { key: 'rule34:group', source: 'rule34', memberKeys: ['rule34:group', 'danbooru:member'] },
    { key: 'danbooru:viewed', source: 'danbooru' }], 'related');
  assert.match(html, /rule34:fresh/);
  assert.doesNotMatch(html, /gelbooru:copy|rule34:group|danbooru:viewed/);
});

test('disabled hiding still displays saved related works', () => {
  const context = fixture({ hidden: false, bookmarks: [saved] });
  assert.match(context.renderGrid([copy], 'related'), /gelbooru:copy/);
});

test('bookmarks, history, profile and the open artwork are not filtered as related', () => {
  for (const kind of ['bookmarks', 'recent', 'profile', 'detail']) {
    const context = fixture({ bookmarks: [saved], viewed: ['hash:' + saved.contentHash], tab: { kind } });
    assert.match(context.renderGrid([copy], 'main'), /gelbooru:copy/);
  }
});

test('saving a related work hides it immediately and hides its later source copy', async () => {
  const context = fixture();
  let html = context.renderGrid([copy, fresh], 'related');
  context.render = () => { html = context.renderGrid([copy, fresh], 'related'); };
  await context.toggleBookmark(copy);
  assert.doesNotMatch(html, /gelbooru:copy/);
  assert.match(html, /rule34:fresh/);
  assert.doesNotMatch(context.renderGrid([saved, fresh], 'related'), /danbooru:saved/);
});

test('a fully hidden related page explains hiding and keeps the continuation marker', () => {
  const context = fixture({ bookmarks: [saved] });
  const html = context.renderGrid([copy], 'related');
  assert.match(html, /нет новых для вас работ/);
  vm.runInContext(between('function renderRelatedTail(', '\nfunction filterFeedWorks('), context);
  assert.match(context.renderRelatedTail({ id: 1, relatedStarted: true, relatedQuery: 'tag',
    related: [copy], relatedHasMore: true }), /data-auto-load="related"/);
});

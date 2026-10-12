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
function fixture({ hidden = true, bookmarks = [], likes = [], viewed = [], recent = [], tab = {} } = {}) {
  const current = { id: 1, kind: 'detail', feed: 'illustrations', ...tab };
  const serverBookmarks = [...bookmarks];
  const context = vm.createContext({
    CatalogLogic, Set, Map, contentPreferences: { hideViewedAndSaved: hidden },
    bookmarks: [...bookmarks], likes: [...likes], recent, likedKeys: new Set(), viewedTokens: new Set(viewed), viewedPending: new Set(), savedKeys: new Set(),
    savedWorkPending: new Set(), tabs: [current], activeId: 1,
    main: { querySelectorAll: () => [] }, currentTab: () => current,
    escapeHtml: value => String(value),
    renderCard: item => `<article data-key="${item.key}"></article>`,
    syncSavedWorkButtons() {}, rememberItems() {}, toast() {},
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
  vm.runInContext(between('function knownWorkTokens(', '\nfunction measureVirtualGrids(') + '\n' +
    between('function setSavedWorks(', '\nasync function loadFavoriteTags(') + '\n' +
    between('async function recordViewedWorks(', '\nasync function refreshFollows(') + '\n' +
    between('function isSavedWork(', '\nfunction syncSavedWorkButtons('), context);
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

test('unloaded viewed work holds an empty slot without changing later artwork positions', () => {
  const context = fixture({ viewed: ['key:rule34:fresh'] });
  const tab = context.currentTab();
  tab.expiredFeedWorks = new Map([[fresh.key, { height: 260 }]]);
  tab.expiredFeedTokens = new Map([['key:rule34:fresh', fresh.key]]);
  const html = context.renderGrid([fresh, copy], 'related');
  assert.match(html, /class="card feed-placeholder" data-work-key="rule34:fresh"[^>]*height:260px/);
  assert.match(html, /data-key="gelbooru:copy"/);
  assert.doesNotMatch(html, /data-image-url="[^"]*fresh/);
});

test('liked copies are also hidden in discovery feeds when hiding is enabled', () => {
  const context = fixture({ likes: [saved] });
  assert.doesNotMatch(context.renderGrid([copy, fresh], 'related'), /gelbooru:copy/);
});

test('a visible retained related card cannot bypass the viewed or liked filter on return',()=>{
 for(const savedState of [{viewed:['key:'+copy.key]},{likes:[saved]}]){
  const context=fixture(savedState),tab=context.currentTab();
  tab.retainedFeedWorks=new Map([[copy.key,new Set(CatalogLogic.workHistoryTokens(copy))]]);
  assert.doesNotMatch(context.renderGrid([copy,fresh],'related'),/data-key="gelbooru:copy"/);
  assert.match(context.renderGrid([copy,fresh],'related'),/data-key="rule34:fresh"/);
 }
});

test('a related work is hidden while its viewed identities are still being saved',()=>{
 const context=fixture();context.viewedPending.add('key:'+copy.key);
 assert.doesNotMatch(context.renderGrid([copy,fresh],'related'),/data-key="gelbooru:copy"/);
});

test('recently opened copies stay hidden when history persistence is delayed or unavailable',()=>{
 const context=fixture({recent:[saved]});
 assert.doesNotMatch(context.renderGrid([copy,fresh],'related'),/data-key="gelbooru:copy"/);
});

test('all four catalogs hide confirmed liked file copies in related results',()=>{
 for(const source of CatalogLogic.supportedSources){
  const owner={...saved,key:source+':owner',source};
  const context=fixture({likes:[owner]});
  for(const other of CatalogLogic.supportedSources){
   const mirror={...copy,key:other+':mirror',source:other};
   assert.doesNotMatch(context.renderGrid([mirror,fresh],'related'),/data-key="[^"]*:mirror"/);
  }
 }
});

test('view recording refreshes loaded related results before the write finishes, with one update per frame',async()=>{
 const context=fixture({tab:{related:[copy,fresh]}}),frames=[];
 context.main.dataset={tabId:'1'};context.requestAnimationFrame=fn=>frames.push(fn);
 let html=context.renderGrid([copy,fresh],'related'),finish;
 context.render=()=>{html=context.renderGrid([copy,fresh],'related');};
 context.request=()=>new Promise(resolve=>{finish=resolve;});
 const write=context.recordViewedWorks([copy]);
 context.scheduleRelatedKnownRefresh();
 assert.equal(frames.length,1);
 frames.shift()();assert.doesNotMatch(html,/data-key="gelbooru:copy"/);
 assert.match(html,/data-key="rule34:fresh"/);
 finish({saved:true});await write;frames.shift()();
 assert.doesNotMatch(html,/data-key="gelbooru:copy"/);
});

test('likes, bookmarks, history, profile and the open artwork are not filtered as related', () => {
  for (const kind of ['likes', 'bookmarks', 'recent', 'profile', 'detail']) {
    const context = fixture({ bookmarks: [saved], viewed: ['hash:' + saved.contentHash], tab: { kind } });
    assert.match(context.renderGrid([copy], 'main'), /gelbooru:copy/);
  }
});

test('saving a related work hides it immediately and hides its later source copy', async () => {
  const context = fixture();
  let html = context.renderGrid([copy, fresh], 'related');
  context.render = () => { html = context.renderGrid([copy, fresh], 'related'); };
  await context.toggleSavedWork(copy, 'bookmarks');
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

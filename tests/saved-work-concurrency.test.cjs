const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const CatalogLogic = require('../wwwroot/catalog-logic.js');
const source = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
const block = (a, b) => source.slice(source.indexOf(a), source.indexOf(b, source.indexOf(a)));
const tick = () => new Promise(resolve => setImmediate(resolve));

function fixture() {
  const first = { key: 'danbooru:1', source: 'danbooru', id: '1',
    images: ['https://fixture.test/one.png'], memberKeys: ['danbooru:1', 'gelbooru:2'] };
  const mirror = { ...first, key: 'gelbooru:2', source: 'gelbooru', id: '2' };
  const other = { key: 'rule34:3', source: 'rule34', id: '3', images: ['https://fixture.test/other.png'] };
  const controls = [first, mirror, other].map(item => ({
    dataset: { action: 'like', key: item.key }, attributes: {}, disabled: false,
    setAttribute(name, value) { this.attributes[name] = value; }, classList: { toggle() {}, contains: () => false }
  }));
  const writes = [], messages = [];
  const context = vm.createContext({ CatalogLogic, savedWorkPending: new Set(),
    likes: [], bookmarks: [], likedKeys: new Set(), savedKeys: new Set(), tabs: [],
    itemIndex: new Map([first, mirror, other].map(item => [item.key, item])),
    main: { querySelectorAll: () => controls }, quickPreview: { querySelectorAll: () => [] },
    currentTab: () => null, visibleFeedCard: () => null, contentPreferences: {},
    recordViewedWorks: async () => {}, refreshSavedWorks: async () => true,
    escapeHtml: String, svg: () => '', toast: message => messages.push(message),
    request: (url, options) => new Promise((resolve, reject) => writes.push({ url, options, resolve, reject }))
  });
  context.setSavedWorks = (collection, items) => {
    context[collection] = items;
    context[collection === 'likes' ? 'likedKeys' : 'savedKeys'] = new Set(items.flatMap(item => [item.key, ...(item.memberKeys || [])]));
  };
  vm.runInContext(block('function isSavedWork(', '\nfunction quickPreviewShortcutAllowed(') +
    block('async function toggleSavedWork(', '\nasync function toggleFollow('), context);
  return { context, first, mirror, other, controls, writes, messages };
}

test('two controls for one grouped work cannot toggle the same like twice while saving', async () => {
  const f = fixture();
  const first = f.context.toggleSavedWork(f.first, 'likes');
  const mirror = f.context.toggleSavedWork(f.mirror, 'likes');
  assert.equal(f.writes.length, 1, 'One pending logical work must have one mutation');
  assert.equal(f.controls[0].disabled, true);
  assert.equal(f.controls[1].disabled, true, 'Mirrored controls must reflect the same pending state');
  assert.equal(f.controls[2].disabled, false);
  f.writes[0].resolve({ saved: true }); await Promise.all([first, mirror]);
  assert.equal(f.context.likes.length, 1);
  assert.equal(f.controls[0].disabled, false); assert.equal(f.controls[1].disabled, false);
});

test('same-file catalog copies without shared post keys share the pending mutation', async () => {
  const f = fixture();
  f.first.memberKeys = []; f.mirror.memberKeys = [];
  const first = f.context.toggleSavedWork(f.first, 'bookmarks');
  const mirror = f.context.toggleSavedWork(f.mirror, 'bookmarks');
  assert.equal(f.writes.length, 1);
  assert.match(f.context.savedWorkButton(f.mirror, 'bookmarks'), / disabled/);
  f.writes[0].resolve({ saved: true }); await Promise.all([first, mirror]);
  assert.equal(f.context.isSavedWork(f.mirror, 'bookmarks'), true, 'A saved exact file is saved through its other catalog too');
});

test('unrelated works and independent collections can save concurrently and errors release their controls', async () => {
  const f = fixture();
  const first = f.context.toggleSavedWork(f.first, 'likes');
  const other = f.context.toggleSavedWork(f.other, 'likes');
  const bookmark = f.context.toggleSavedWork(f.mirror, 'bookmarks');
  assert.equal(f.writes.length, 3);
  f.writes[0].reject(new Error('Offline')); f.writes[1].resolve({ saved: true }); f.writes[2].resolve({ saved: true });
  await Promise.all([first, other, bookmark]);
  assert.equal(f.context.savedWorkPending.size, 0);
  const retry = f.context.toggleSavedWork(f.first, 'likes'); await tick();
  assert.equal(f.writes.length, 4);
  f.writes[3].resolve({ saved: true }); await retry;
});

test('unliking a confirmed file copy removes its already-saved catalog alias', async () => {
  const f = fixture();
  f.first.memberKeys = []; f.mirror.memberKeys = [];
  f.context.setSavedWorks('likes', [f.first]);
  assert.equal(f.context.isSavedWork(f.mirror, 'likes'), true);
  const pending = f.context.toggleSavedWork(f.mirror, 'likes');
  const sent = JSON.parse(f.writes[0].options.body);
  assert(sent.memberKeys.includes(f.first.key), 'Native key-based mutation must receive the saved alias');
  f.writes[0].resolve({ saved: false }); await pending;
  assert.equal(f.context.likes.length, 0);
  assert.equal(f.context.isSavedWork(f.mirror, 'likes'), false);
});

test('different fresh variants resolving to one saved group cannot remove and re-add it concurrently', async () => {
  const f = fixture();
  f.first.memberKeys = [];
  const saved = { key: 'gelbooru:10', source: 'gelbooru', id: '10',
    memberKeys: ['gelbooru:10', 'sankaku:11'], images: [...f.first.images, ...f.other.images] };
  f.context.setSavedWorks('likes', [saved]);
  const first = f.context.toggleSavedWork(f.first, 'likes');
  const second = f.context.toggleSavedWork(f.other, 'likes');
  assert.equal(f.writes.length, 1);
  assert.equal(f.controls[2].disabled, true);
  f.writes[0].resolve({ saved: false }); await Promise.all([first, second]);
  assert.equal(f.context.likes.length, 0);
  assert.equal(f.context.savedWorkPending.size, 0);
});

test('removing a legacy overlapping saved series includes every connected saved alias', async () => {
  const f = fixture(); f.first.memberKeys = [];
  const shared = 'https://fixture.test/shared.png';
  const original = { key: 'gelbooru:10', source: 'gelbooru', images: [shared, ...f.other.images] };
  const bridge = { key: 'sankaku:11', source: 'sankaku', images: [...f.first.images, shared] };
  f.context.setSavedWorks('likes', [original, bridge]);
  const pending = f.context.toggleSavedWork(f.first, 'likes');
  const sent = JSON.parse(f.writes[0].options.body);
  assert(sent.memberKeys.includes(original.key)); assert(sent.memberKeys.includes(bridge.key));
  f.writes[0].resolve({ saved: false }); await pending;
  assert.equal(f.context.likes.length, 0);
});

test('a pending like changes all mirrored hearts immediately and rolls back on failure', async () => {
  const f = fixture();
  const pending = f.context.toggleSavedWork(f.first, 'likes');
  assert.equal(f.context.isSavedWork(f.first, 'likes'), true);
  assert.equal(f.context.isSavedWork(f.mirror, 'likes'), true);
  assert.equal(f.controls[0].attributes['aria-pressed'], 'true');
  assert.equal(f.context.likes.length, 0, 'An unconfirmed intent must not enter the persisted library');
  f.writes[0].reject(new Error('Disk unavailable')); await pending;
  assert.equal(f.context.isSavedWork(f.first, 'likes'), false);
  assert.equal(f.controls[0].attributes['aria-pressed'], 'false');
  assert.equal(f.context.savedWorkPending.size, 0);
});

test('a pending unlike is immediate, remains independent of bookmarks and restores on failure', async () => {
  const f = fixture(); f.context.setSavedWorks('likes', [f.first]);
  f.context.setSavedWorks('bookmarks', [f.first]);
  const pending = f.context.toggleSavedWork(f.mirror, 'likes');
  assert.equal(f.context.isSavedWork(f.first, 'likes'), false);
  assert.equal(f.context.isSavedWork(f.first, 'bookmarks'), true);
  f.writes[0].reject(new Error('Disk unavailable')); await pending;
  assert.equal(f.context.isSavedWork(f.first, 'likes'), true);
});

test('a matching native acknowledgement avoids rereading the entire library', async () => {
  const f = fixture(); let refreshes = 0;
  f.context.refreshSavedWorks = async () => { refreshes++; };
  f.context.refreshSavedWorks.states = { likes: { serverRevision: 'before' } };
  const pending = f.context.toggleSavedWork(f.first, 'likes');
  f.writes[0].resolve({ saved: true, previousRevision: 'before', revision: 'after' }); await pending;
  assert.equal(refreshes, 0);
  assert.equal(f.context.refreshSavedWorks.states.likes.serverRevision, 'after');
  assert.equal(f.context.isSavedWork(f.first, 'likes'), true);
});

test('a changed native library is reconciled rather than hiding writes from another window', async () => {
  const f = fixture(); let refreshes = 0;
  f.context.refreshSavedWorks = async () => { refreshes++; };
  f.context.refreshSavedWorks.states = { likes: { serverRevision: 'old' } };
  const pending = f.context.toggleSavedWork(f.first, 'likes');
  f.writes[0].resolve({ saved: true, previousRevision: 'other-window', revision: 'after' }); await pending;
  assert.equal(refreshes, 1);
  assert.equal(f.context.savedWorkPending.size, 0);
});

test('a confirmed local like does not invalidate the unchanged bookmark snapshot', async () => {
  const f = fixture(); let refreshes = 0;
  f.context.refreshSavedWorks = async () => { refreshes++; };
  f.context.refreshSavedWorks.states = { likes: { serverRevision: 'before' }, bookmarks: { serverRevision: 'before' } };
  const like = f.context.toggleSavedWork(f.first, 'likes');
  f.writes[0].resolve({ saved: true, previousRevision: 'before', revision: 'middle' }); await like;
  const bookmark = f.context.toggleSavedWork(f.first, 'bookmarks');
  f.writes[1].resolve({ saved: true, previousRevision: 'middle', revision: 'after' }); await bookmark;
  assert.equal(refreshes, 0);
  assert.equal(f.context.refreshSavedWorks.states.likes.serverRevision, 'after');
  assert.equal(f.context.refreshSavedWorks.states.bookmarks.serverRevision, 'after');
});

test('liking Sankaku does not wait for a remote metadata request before persisting', async () => {
  const f = fixture();
  const item = { ...f.first, key: 'sankaku:sample', source: 'sankaku', id: 'sample', memberKeys: [] };
  const pending = f.context.toggleSavedWork(item, 'likes');
  assert.equal(f.writes[0].url, '/api/likes');
  f.writes[0].resolve({ saved: true }); await pending;
  assert.equal(f.context.isSavedWorkPending(item, 'likes'), false);
  const detail = f.writes.find(entry => entry.url.startsWith('/api/detail?'));
  assert.ok(detail, 'Available metadata still refreshes after saving');
  detail.reject(new Error('Provider unavailable')); await tick();
  assert.equal(f.context.isSavedWork(item, 'likes'), true);
});

test('a like during recommendation pagination restores its tail without rebuilding the grid', async () => {
  const f = fixture(); let mounts = 0;
  const tab = { id: 1, kind: 'recommendations', items: [f.first], loading: true, hasMore: true,
    recommendationController: new AbortController() };
  const tail = { innerHTML: 'Подбираем ещё…' };
  f.context.tabs = [tab]; f.context.activeId = 1; f.context.currentTab = () => tab;
  f.context.main.querySelector = selector => selector === '[data-recommendation-tail]' ? tail : null;
  f.context.autoFeed = { mount() { mounts++; } };
  f.context.refreshSavedWorks.states = { likes: { serverRevision: 'before' } };
  f.context.render = () => assert.fail('The existing recommendation grid must not be rebuilt for a like');
  const start = source.indexOf('function renderRecommendationTail(');
  if (start >= 0) vm.runInContext(source.slice(start, source.indexOf('\nfunction renderRecommendations(', start)), f.context);
  const pending = f.context.toggleSavedWork(f.first, 'likes');
  f.writes[0].resolve({ saved: true, previousRevision: 'before', revision: 'after' }); await pending;
  assert.equal(tab.loading, false);
  assert.equal(tab.recommendationController.signal.aborted, true);
  assert.match(tail.innerHTML, /data-auto-load="recommendations"/);
  assert.equal(mounts, 1);
});

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

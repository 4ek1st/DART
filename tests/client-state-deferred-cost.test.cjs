'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const State = require('../wwwroot/client-state.js');
const source = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
const block = source.slice(source.indexOf('function captureClientState('), source.indexOf('\nasync function saveRecommendationTagPreference('));
const tick = () => new Promise(setImmediate);
function fixture(send = async () => {}) {
  const values = new Map(), timers = new Map(), writes = [];
  let nextTimer = 0;
  const storage = { getItem: key => values.get(key), removeItem: key => values.delete(key),
    setItem(key, body) { values.set(key, body); writes.push([key, body]); } };
  const writer = State.createWriter({ storage, send,
    schedule(fn, ms) { const id = ++nextTimer; timers.set(id, { fn, ms }); return id; },
    cancel: id => timers.delete(id) });
  return { writer, values, writes, timers, run() {
    const [id, timer] = timers.entries().next().value;
    timers.delete(id); timer.fn();
  } };
}

test('240-tab activity bursts capture once after yielding and serialize the full session only once', async () => {
  const sent = [], f = fixture(async body => sent.push(JSON.parse(body)));
  let tagsRead = 0;
  const tags = Array.from({ length: 150 }, (_, i) => `neutral_dense_topic_${i}`);
  const tabs = Array.from({ length: 240 }, (_, i) => ({ id: i + 1, kind: 'detail', title: `Landscape ${i}`,
    item: { key: `danbooru:${i}`, source: 'danbooru', get tags() { tagsRead++; return tags; } },
    rating: 'all', pinned: i % 3 === 0, preview: false, scrollTop: i * 5, selectedSources: ['danbooru', 'sankaku'] }));
  const outbox = [{ eventId: 'neutral-event', item: { key: 'danbooru:1' }, viewedAt: '2026-11-01T10:00:00Z' }];
  const favoritesController = () => ({});
  favoritesController.instance = { outboxSnapshot: () => outbox };
  const context = vm.createContext({ tabs, activeId: 1, main: { dataset: { tabId: '1' }, scrollTop: 55 },
    currentTab: () => tabs.find(tab => tab.id === context.activeId), favoritesController,
    CatalogLogic: { catalogSort: tab => tab.sort || 'recent' }, DartClientState: State,
    clientStateWriter: f.writer, localStorage: { setItem: f.values.set.bind(f.values) },
    getSearchHistory: () => ['neutral_search'], recent: [], recommendationExposure: [], recommendationExposureGroups: [],
    tabPreferences: { artworkTabs: 'preview' }, viewerPreferences: { sound: false },
    detailImageDeduper: { duplicates: { entries: () => [] }, verified: new Set() },
    fingerprintCache: { snapshot: () => ({ images: [], videos: [] }) } });
  vm.runInContext(block, context);
  const pending = [];
  for (let i = 0; i < 40; i++) { context.activeId = i + 1; pending.push(context.saveSession()); }
  assert.equal(tagsRead, 0, 'ordinary view callbacks must yield before walking 240 detail records');
  assert.equal(sent.length, 0); assert.equal(f.timers.size, 1);
  f.run(); await Promise.all(pending);
  assert.equal(tagsRead, 240, 'local backup and native envelope must reuse one exact session serialization');
  assert.equal(sent.length, 1); assert.equal(sent[0].session.tabs.length, 240);
  assert.equal(sent[0].session.activeIndex, 39);
  assert.deepEqual(sent[0].favoriteActivityOutbox, outbox);
  assert.equal(sent[0].session.tabs[3].pinned, true);
  assert.equal(sent[0].session.tabs[3].scrollTop, 15);
  assert.equal(JSON.parse(f.values.get('artcatalog-session')).activeIndex, 39);
});

test('explicit flush captures the newest pending view immediately and waits for native acknowledgement', async () => {
  const sent = []; let finish, selected = 'old';
  const f = fixture(body => new Promise(resolve => { sent.push(JSON.parse(body)); finish = resolve; }));
  const ordinary = f.writer.saveLater(() => ({ session: { selected }, favoriteActivityOutbox: [selected] }));
  selected = 'latest';
  const flushed = f.writer.flush();
  assert.equal(f.timers.size, 0); assert.equal(sent.length, 1);
  assert.equal(sent[0].session.selected, 'latest');
  let completed = false; flushed.then(() => { completed = true; });
  await tick(); assert.equal(completed, false);
  finish(); assert.equal(await ordinary, true); assert.equal(await flushed, true);
});

test('an explicit snapshot supersedes a scheduled capture without executing or losing its waiter', async () => {
  const sent = [], f = fixture(async body => sent.push(JSON.parse(body)));
  const ordinary = f.writer.saveLater(() => { throw new Error('Superseded capture must not run'); });
  assert.equal(await f.writer.save({ session: { selected: 'native-close' }, favoriteActivityOutbox: ['latest-event'] }), true);
  assert.equal(await ordinary, true); assert.equal(f.timers.size, 0);
  assert.equal(sent[0].session.selected, 'native-close');
});

test('a queued view arriving as the previous acknowledgement resolves belongs to the same flush', async () => {
  const sent = []; let writer;
  const f = fixture(async body => {
    sent.push(JSON.parse(body));
    if (sent.length === 1) queueMicrotask(() => queueMicrotask(() => {
      writer.saveLater(() => ({ session: { selected: 'final' } }));
    }));
  }); writer = f.writer;
  assert.equal(await writer.save({ session: { selected: 'first' } }), true);
  assert.equal(sent.length, 2); assert.equal(sent[1].session.selected, 'final');
  assert(sent[1].clientRevision > sent[0].clientRevision);
});

test('teardown before the delayed capture persists the full latest outbox even if its patch exceeds quota', async () => {
  const f = fixture(), ordinary = f.writer.saveLater(() => ({ session: { title: 'old' } }));
  const latest = { session: { tabs: [{ title: 'ä'.repeat(30000) }] },
    favoriteActivityOutbox: [{ eventId: 'latest-unsent', item: { key: 'danbooru:123' } }], recent: ['keep'] };
  assert.equal(f.writer.unloadPatch(latest), null);
  assert.equal(await ordinary, false); assert.equal(f.timers.size, 0);
  assert.deepEqual(f.writer.readPending().favoriteActivityOutbox, latest.favoriteActivityOutbox);
  assert.deepEqual(f.writer.readPending().session, latest.session);
  const restored = [], next = State.createWriter({ storage: {
    getItem: key => f.values.get(key), setItem: (key, value) => f.values.set(key, value), removeItem: key => f.values.delete(key)
  }, send: async body => restored.push(JSON.parse(body)) });
  await next.save(next.readPending());
  assert.deepEqual(restored[0].favoriteActivityOutbox, latest.favoriteActivityOutbox);
});

test('deferred failures retain retry data and redundant identical saves avoid another local write', async () => {
  let fail = true; const sent = [], f = fixture(async body => {
    if (fail) throw new Error('Controlled offline'); sent.push(JSON.parse(body));
  });
  const value = { session: { tabs: [{ kind: 'home' }] }, favoriteActivityOutbox: ['durable-event'] };
  const ordinary = f.writer.saveLater(() => value);
  f.run(); assert.equal(await ordinary, false);
  assert.deepEqual(f.writer.readPending().favoriteActivityOutbox, value.favoriteActivityOutbox);
  fail = false; assert.equal(await f.writer.flush(), true);
  const writes = f.writes.length;
  assert.equal(await f.writer.save(value), true);
  assert.equal(f.writes.length, writes); assert.equal(sent.length, 1);
});

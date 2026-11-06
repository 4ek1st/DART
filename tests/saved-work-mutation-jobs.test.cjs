'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const Logic = require('../wwwroot/catalog-logic.js');
const source = fs.readFileSync(process.env.DART_SAVED_MUTATION_APP || require.resolve('../wwwroot/app.js'), 'utf8');
const block = (first, last) => source.slice(source.indexOf(first), source.indexOf(last, source.indexOf(first)));
const tick = () => new Promise(resolve => setImmediate(resolve));
const plain = value => JSON.parse(JSON.stringify(value));
const work = (id, extra = {}) => ({ key: 'danbooru:' + id, source: 'danbooru', id: String(id),
  title: 'Neutral artwork ' + id, creatorTag: 'fixture_artist_' + id, rating: 'g', tags: ['rain'],
  images: ['https://example.test/' + id + '.jpg'], ...extra });

function fixture({ jobs = true, fail = false, rejectCache = false } = {}) {
  const writes = [], tasks = [], cached = [], commits = [], messages = [], controls = [];
  const context = vm.createContext({ CatalogLogic: { ...Logic,
    cacheGroupedWorks(input, grouped) { cached.push([input, grouped]); return rejectCache ? null : Logic.cacheGroupedWorks(input, grouped); } },
    likes: [], bookmarks: [], likedKeys: new Set(), savedKeys: new Set(), savedWorkPending: new Set(), tabs: [], itemIndex: new Map(),
    currentTab: () => null, visibleFeedCard: () => null, contentPreferences: {},
    main: { querySelectorAll: () => controls }, quickPreview: { querySelectorAll: () => [] },
    escapeHtml: String, svg: () => '', toast: value => messages.push(value), recordViewedWorks: async () => {},
    request: (url, options) => new Promise((resolve, reject) => writes.push({ url, options, resolve, reject })),
    refreshSavedWorks: async () => true });
  context.refreshSavedWorks.states = { likes: { revision: 0, serverRevision: 'v0' }, bookmarks: { revision: 0, serverRevision: 'v0' } };
  context.setSavedWorks = (collection, items, changed) => {
    context[collection] = items;
    context[collection === 'likes' ? 'likedKeys' : 'savedKeys'] = new Set(items.flatMap(item => [item.key, ...(item.memberKeys || [])]));
    context.refreshSavedWorks.states[collection].revision++;
    for (const item of changed || items) context.itemIndex.set(item.key, item);
    commits.push({ collection, items, changed });
  };
  if (jobs) context.DartCatalogJobs = { run(operation, args, fallback) {
    assert.equal(operation, 'groupWorks');
    if (fail) return Promise.reject(new Error('Neutral unavailable worker'));
    return new Promise(resolve => tasks.push({ args, resolve, fallback }));
  } };
  vm.runInContext(block('function isSavedWork(', '\nfunction quickPreviewShortcutAllowed(') +
    block('async function toggleSavedWork(', '\nasync function toggleFollow('), context);
  const control = item => {
    context.itemIndex.set(item.key, item);
    const button = { dataset: { action: 'like', key: item.key }, attributes: {}, disabled: false,
      setAttribute(name, value) { this.attributes[name] = value; }, classList: { toggle() {}, contains: () => false } };
    controls.push(button); return button;
  };
  const finish = index => {
    const task = tasks[index]; assert(task, 'shared grouping job must exist');
    const grouped = Logic.groupWorks(structuredClone(task.args[0])); task.resolve(grouped); return grouped;
  };
  return { context, writes, tasks, cached, commits, messages, control, finish };
}

test('a saved acknowledgement keeps optimistic hearts usable while exact grouping warms outside the interaction', async () => {
  const f = fixture(), existing = [work(1), work(2)], added = work(3), button = f.control(added);
  f.context.setSavedWorks('likes', existing); f.commits.length = 0;
  const pending = f.context.toggleSavedWork(added, 'likes');
  assert.equal(button.attributes['aria-pressed'], 'true'); assert.equal(button.disabled, true);
  f.writes[0].resolve({ saved: true, previousRevision: 'v0', revision: 'v1' }); await tick();
  assert.equal(f.tasks.length, 1); assert.equal(f.context.likes, existing);
  assert.equal(f.commits.length, 0, 'a render must never observe the uncached replacement');
  const grouped = f.finish(0); await pending;
  assert.equal(f.context.likes[0].key, added.key); assert.equal(f.cached.length, 1);
  assert.equal(Logic.groupWorks(f.context.likes), grouped, 'the next render and viewer reuse exact shared grouping');
  assert.equal(button.disabled, false); assert.equal(button.attributes['aria-pressed'], 'true');
  assert.equal(f.context.refreshSavedWorks.states.likes.serverRevision, 'v1');
});

test('concurrent independent likes serialize confirmed publication without losing either mutation or regrouping quadratically', async () => {
  const f = fixture(), first = work(10), second = work(11);
  f.control(first); f.control(second); f.context.setSavedWorks('likes', [work(1)]); f.commits.length = 0;
  const a = f.context.toggleSavedWork(first, 'likes'), b = f.context.toggleSavedWork(second, 'likes');
  f.writes[0].resolve({ saved: true }); f.writes[1].resolve({ saved: true }); await tick();
  assert.equal(f.tasks.length, 1); f.finish(0); await a; await tick();
  assert.equal(f.tasks.length, 2, 'each confirmed delta needs one grouping against its current serialized snapshot');
  f.finish(1); await b;
  assert.deepEqual(Array.from(f.context.likes, item => item.key), [second.key, first.key, 'danbooru:1']);
  assert.equal(f.context.savedWorkPending.size, 0);
  assert.deepEqual(plain(Logic.groupWorks(f.context.likes)), plain(Logic.groupWorks(structuredClone(f.context.likes))));
});

test('same-item detail enrichment during an acknowledged save cannot publish the captured stale metadata', async () => {
  const f = fixture(), original = work(77, { title: 'Old neutral metadata', memberKeys: ['danbooru:77', 'gelbooru:5'] });
  f.control(original); f.context.setSavedWorks('bookmarks', [original]);
  const pending = f.context.toggleSavedWork(original, 'likes');
  f.writes[0].resolve({ saved: true, previousRevision: 'v0', revision: 'v1' }); await tick();
  const enriched = { ...original, title: 'New neutral metadata', tags: ['learned_neutral_tag'],
    images: ['https://example.test/enriched-77.jpg'], memberKeys: ['danbooru:77', 'rule34:77'] };
  f.context.itemIndex.set(original.key, enriched);
  f.context.setSavedWorks('bookmarks', [enriched]);
  f.finish(0); await tick(); assert.equal(f.tasks.length, 2); assert.equal(f.cached.length, 0);
  f.finish(1); await pending;
  const saved = f.context.likes[0];
  assert.equal(saved.title, enriched.title); assert.deepEqual(Array.from(saved.tags), enriched.tags);
  assert.deepEqual(Array.from(saved.images), enriched.images);
  for (const key of ['danbooru:77', 'gelbooru:5', 'rule34:77']) assert(saved.memberKeys.includes(key));
  assert.equal(f.cached.length, 1);
});

test('a burst of independent acknowledged saves queues linear grouping work', async () => {
  const f = fixture(), pending = [];
  f.context.setSavedWorks('likes', [work(1)]);
  for (let index = 0; index < 6; index++) {
    const item = work(index + 10); f.control(item); pending.push(f.context.toggleSavedWork(item, 'likes'));
  }
  for (const write of f.writes) write.resolve({ saved: true });
  await tick(); assert.equal(f.tasks.length, 1, 'only one confirmed publication owns this collection at a time');
  for (let index = 0; index < pending.length; index++) { f.finish(index); await pending[index]; await tick(); }
  assert.equal(f.tasks.length, pending.length); assert.equal(f.context.likes.length, 7);
  assert.equal(f.context.savedWorkPending.size, 0);
});

test('in-place fingerprint and signed-media enrichment of a plain indexed work invalidates its pending analysis', async () => {
  const f = fixture(), item = work(80); f.control(item);
  const pending = f.context.toggleSavedWork(item, 'likes'); f.writes[0].resolve({ saved: true }); await tick();
  Object.assign(item, { visualHash: 'a'.repeat(16), visualPHash: 'b'.repeat(16), visualAspectRatio: 1,
    thumbnail: 'https://example.test/renewed-80.jpg', images: ['https://example.test/renewed-80.jpg'] });
  f.finish(0); await tick(); assert.equal(f.tasks.length, 2); assert.equal(f.cached.length, 0);
  f.finish(1); await pending;
  assert.equal(f.context.likes[0].visualPHash, item.visualPHash);
  assert.equal(f.context.likes[0].thumbnail, item.thumbnail);
  assert.deepEqual(Array.from(f.context.likes[0].images), item.images);
});

test('newly learned saved aliases replace matching raw records instead of leaving duplicate saved members', async () => {
  const f = fixture(), item = work(81), alias = work(82, { key: 'rule34:82', source: 'rule34' });
  f.control(item); f.context.setSavedWorks('likes', [alias]);
  const pending = f.context.toggleSavedWork(item, 'likes'); f.writes[0].resolve({ saved: true }); await tick();
  const current = { ...item, memberKeys: [item.key, alias.key] }; f.context.itemIndex.set(item.key, current);
  f.finish(0); await tick(); f.finish(1); await pending;
  assert.equal(f.context.likes.length, 1); assert(f.context.likes[0].memberKeys.includes(alias.key));
});

test('continuous metadata replacement bounds reanalysis and publishes the newest delta without seeding obsolete grouping', async () => {
  const f = fixture(), item = work(90); f.control(item); f.context.setSavedWorks('likes', [work(1)]);
  const pending = f.context.toggleSavedWork(item, 'likes'); f.writes[0].resolve({ saved: true }); await tick();
  for (let index = 0; index < 3; index++) {
    const current = { ...item, title: `Neutral revision ${index + 1}`, tags: [`neutral_revision_${index + 1}`] };
    f.context.itemIndex.set(item.key, current); f.finish(index); await tick();
  }
  await pending;
  assert.equal(f.tasks.length, 3, 'an acknowledged save must not retry worker grouping indefinitely');
  assert.equal(f.cached.length, 0); assert.equal(f.context.likes[0].title, 'Neutral revision 3');
  assert.equal(f.context.savedWorkPending.size, 0);
  assert.deepEqual(plain(Logic.groupWorks(f.context.likes)), plain(Logic.groupWorks(structuredClone(f.context.likes))));
});

test('same-size metadata replacement during grouping survives the confirmed delta', async () => {
  const f = fixture(), existing = work(1), added = work(2); f.control(added);
  f.context.setSavedWorks('bookmarks', [existing]);
  const pending = f.context.toggleSavedWork(added, 'bookmarks');
  f.writes[0].resolve({ saved: true }); await tick();
  const corrected = { ...existing, title: 'Corrected neutral metadata', tags: ['forest'] };
  f.context.setSavedWorks('bookmarks', [corrected]); f.finish(0); await tick();
  assert.equal(f.tasks.length, 2); f.finish(1); await pending;
  assert.equal(f.context.bookmarks.find(item => item.key === existing.key), corrected);
  assert.equal(f.cached.length, 1);
});

test('in-place grouping invalidation forces fresh worker evidence before publication', async () => {
  const f = fixture(), existing = [work(1)], added = work(2); f.control(added);
  f.context.setSavedWorks('likes', existing);
  const pending = f.context.toggleSavedWork(added, 'likes'); f.writes[0].resolve({ saved: true }); await tick();
  Logic.invalidateGrouping(existing); f.finish(0); await tick();
  assert.equal(f.tasks.length, 2); assert.equal(f.cached.length, 0);
  f.finish(1); await pending; assert.equal(f.cached.length, 1);
});

test('removing a bridge uses exact grouping so remaining artwork groups can split', async () => {
  const f = fixture(), tags = Array.from({ length: 16 }, (_, index) => 'neutral_feature_' + index);
  const variant = (id, visualHash) => work(id, { creatorTag: 'fixture_artist', tags,
    visualHash, visualPHash: visualHash, visualAspectRatio: 1 });
  // Both complementary fingerprints connect each adjacent pair, but the
  // residual endpoints exceed the threshold after the middle one is removed.
  const left = variant(1, '0000000000000000'), bridge = variant(3, '0000000000000fff'),
    right = variant(2, '0000000000ffffff');
  const old = [left, bridge, right];
  assert.equal(Logic.groupWorks(old).length, 1); assert.equal(Logic.groupWorks([left, right]).length, 2);
  f.context.setSavedWorks('likes', old); f.control(bridge);
  const pending = f.context.toggleSavedWork(bridge, 'likes');
  f.writes[0].resolve({ saved: false }); await tick();
  assert.equal(f.tasks.length, 1); f.finish(0); await pending;
  assert.deepEqual(Array.from(f.context.likes, item => item.key), [left.key, right.key]);
  assert.deepEqual(plain(Logic.groupWorks(f.context.likes)), plain(Logic.groupWorks(structuredClone([left, right]))));
});

test('empty removals, unavailable workers and rejected warm results preserve ordinary mutations', async () => {
  for (const options of [{ jobs: false }, { fail: true }, { rejectCache: true }]) {
    const f = fixture(options), added = work(1); f.control(added);
    const pending = f.context.toggleSavedWork(added, 'likes'); f.writes[0].resolve({ saved: true }); await tick();
    if (f.tasks.length) f.finish(0); await pending;
    assert.equal(f.context.likes[0].key, added.key); assert.equal(f.context.savedWorkPending.size, 0);
    const removing = f.context.toggleSavedWork(added, 'likes'); f.writes[1].resolve({ saved: false }); await removing;
    assert.equal(f.context.likes.length, 0); assert.equal(f.messages.filter(value => /Не удалось/.test(value)).length, 0);
  }
});

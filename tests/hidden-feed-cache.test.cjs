'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('./helpers/viewer-vm.cjs');
const logic = require('../wwwroot/catalog-logic.js');
const actions = require('../wwwroot/artwork-actions.js');
const app = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
const start = app.indexOf('function filterFeedWorks(');
const end = app.indexOf('\nfunction emptyFeedMessage(', start);
const work = (id, extra = {}) => ({ key: `danbooru:${id}`, id: String(id), source: 'danbooru',
  title: `Artwork ${id}`, rating: 'g', creatorTag: `artist_${id}`, tags: ['landscape'],
  images: [`https://cdn.donmai.us/${id}.jpg`], ...extra });
const keys = items => Array.from(items, item => item.key);

function fixture(hidden = [], request = async () => []) {
  const controller = actions.create({ request, tokens: logic.workHistoryTokens });
  controller.restore(hidden);
  const context = vm.createContext({ CatalogLogic: logic, artworkActionsController: () => controller,
    contentPreferences: {}, curateFeedWorks: items => items, isHideableFeed: () => false });
  vm.runInContext(app.slice(start, end), context);
  return { controller, context, filter: (items, tab = { kind: 'search' }) => context.filterFeedWorks(items, tab) };
}

test('unchanged discovery feeds keep grouped object identities when no artworks are hidden', () => {
  for (const kind of ['home', 'search', 'recommendations', 'profile', 'detail']) {
    const f = fixture(), items = [work(1), work(2)], tab = { kind };
    const first = f.filter(items, tab);
    assert.strictEqual(f.filter(items, tab), first, `${kind} must reuse its warm grouping result`);
    assert.deepEqual(keys(first), ['danbooru:1', 'danbooru:2']);
  }
});

test('a feed with a real hidden removal reuses its grouped objects without exposing that artwork', () => {
  const f = fixture([work(1)]), items = [work(1), work(2)];
  const first = f.filter(items);
  assert.deepEqual(keys(first), ['danbooru:2']);
  assert.strictEqual(f.filter(items), first, 'a nonempty hidden subset also keeps its warm grouping input');
});

test('loading or restoring a different hidden list invalidates warm visibility without a local action revision', async () => {
  const f = fixture([work(1)], async () => [work(2)]), items = [work(1), work(2)];
  assert.deepEqual(keys(f.filter(items)), ['danbooru:2']);
  const revision = f.controller.revision;
  await f.controller.load();
  assert.equal(f.controller.revision, revision);
  assert.deepEqual(keys(f.filter(items)), ['danbooru:1']);
  f.controller.restore([]);
  assert.deepEqual(keys(f.filter(items)), ['danbooru:1', 'danbooru:2']);
});

test('an optimistic hide and failed save invalidate warmed feeds and restore their original cards', async () => {
  let reject;
  const f = fixture([], () => new Promise((resolve, fail) => { reject = fail; }));
  const items = [work(1), work(2)], original = f.filter(items);
  const pending = f.controller.setHidden(items[0], true);
  assert.deepEqual(keys(f.filter(items)), ['danbooru:2']);
  await Promise.resolve();
  reject(new Error('Fixture save failed'));
  assert.equal(await pending, false);
  assert.deepEqual(keys(f.filter(items)), ['danbooru:1', 'danbooru:2']);
  assert.strictEqual(f.filter(items), original, 'rollback can reuse the unchanged complete source grouping');
});

test('source hydration aliases and explicit metadata revisions recheck hidden identity', () => {
  const hash = 'a'.repeat(32), f = fixture([work(9, { contentHash: hash })]);
  const items = [work(1), work(2)];
  assert.deepEqual(keys(f.filter(items)), ['danbooru:1', 'danbooru:2']);
  items[0].contentHash = hash;
  logic.invalidateGrouping(items);
  assert.deepEqual(keys(f.filter(items)), ['danbooru:2'], 'a newly learned mirror must be hidden');
  items[0] = work(3);
  logic.invalidateGrouping(items);
  assert.deepEqual(keys(f.filter(items)), ['danbooru:3', 'danbooru:2'], 'same-length source replacement must be visible');
  items[0].memberKeys = ['danbooru:3', 'danbooru:9'];
  logic.refineGrouping(items, [items[0]]);
  assert.deepEqual(keys(f.filter(items)), ['danbooru:2'], 'a learned member alias must also be hidden');
});

test('in-place pagination growth invalidates hidden filtering while saved collections keep hidden works', () => {
  const f = fixture([work(1)]), items = [work(1), work(2)];
  assert.deepEqual(keys(f.filter(items)), ['danbooru:2']);
  items.push(work(3));
  assert.deepEqual(keys(f.filter(items)), ['danbooru:2', 'danbooru:3']);
  for (const kind of ['likes', 'bookmarks', 'recent'])
    assert.deepEqual(keys(f.filter(items, { kind })), ['danbooru:1', 'danbooru:2', 'danbooru:3']);
});

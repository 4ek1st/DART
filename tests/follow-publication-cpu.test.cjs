const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const CatalogLogic = require('../wwwroot/catalog-logic.js');
const app = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
const block = (start, end) => app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start)));

function fixture(count = 800, preferences = {}) {
  let merges = 0;
  const tab = { id: 1, kind: 'follows', rating: 'general', followVersion: 1,
    followUpdateRevision: 1, followStreams: [], items: [], followGroups: [] };
  for (let index = 0; index < count; index++) {
    const id = String(100001 + index), groupIndex = index % Math.min(93, count);
    tab.followGroups[groupIndex] ||= { follow: { key: `gelbooru::${groupIndex}`, source: 'gelbooru',
      artistId: String(groupIndex), followedAt: '2024-01-01T00:00:00Z' }, items: [] };
    tab.followGroups[groupIndex].items.push({
      key: `gelbooru:${id}`, source: 'gelbooru', id, rating: 'g', title: `Artwork ${id}`,
      creatorTag: `artist_${index}`, tags: ['landscape'],
      images: [`https://example.org/${id}.jpg`], published: '2025-01-01T00:00:00Z'
    });
  }
  const itemIndex = new Map();
  const context = vm.createContext({
    CatalogLogic: { ...CatalogLogic, mergeWorkMetadata(previous, incoming) {
      merges++; return CatalogLogic.mergeWorkMetadata(previous, incoming);
    } }, itemIndex, contentPreferences: preferences,
    activeId: 1, render() {}, clearTimeout,
    DartCatalogJobs: { async run(operation, args) {
      assert.equal(operation, 'followFeed');
      // A worker re-creates every object, including unchanged source responses.
      return structuredClone(CatalogLogic.groupFollowFeed(...structuredClone(args)));
    } }
  });
  vm.runInContext(block('const rememberedInputs = new WeakMap();', '\nfunction creatorActionData(') +
    block('function followStreamRetryAt(', '\nfunction scheduleFollowRetry(') +
    block('async function updateFollowFeed(', '\nfunction queueFollowUpdate('), context);
  return { tab, context, itemIndex, flush: () => context.flushFollowUpdate(tab),
    get merges() { return merges; } };
}

test('one changed Following work preserves the other 799 objects and their learned metadata', async () => {
  const f = fixture();
  await f.flush();
  const original = new Map(f.tab.items.map(item => [item.key, item]));
  original.get('gelbooru:100002').visualHash = '0123456789abcdef';
  const initialMerges = f.merges;
  f.tab.followGroups[0].items[0].title = 'Updated artwork';
  f.tab.followUpdateRevision++;
  await f.flush();
  assert.equal(f.tab.items.length, 800);
  assert.equal(f.tab.items.filter(item => item === original.get(item.key)).length, 799,
    'Unchanged worker records must retain warm filter, attribution and curation identities');
  assert.equal(f.merges - initialMerges, 1, 'Only the changed work needs another metadata merge');
  assert.equal(f.tab.items.find(item => item.key === 'gelbooru:100001').title, 'Updated artwork');
  assert.equal(f.itemIndex.get('gelbooru:100001').title, 'Updated artwork');
  assert.equal(f.tab.items.find(item => item.key === 'gelbooru:100002').visualHash, '0123456789abcdef');
});

test('unchanged Following records stay warm across revisions while New and source status still update', async () => {
  const f = fixture(2);
  await f.flush();
  const original = [...f.tab.items], initialMerges = f.merges;
  f.tab.followGroups[0].follow.seenKeys = { general: ['gelbooru:100001'] };
  f.tab.followStreams.push({ source: 'gelbooru', follow: f.tab.followGroups[0].follow,
    buffer: [], error: 'Temporarily unavailable', retryAt: Date.now() + 60000 });
  f.tab.followVersion++;
  f.tab.followUpdateRevision++;
  await f.flush();
  assert.ok(f.tab.items.every(item => original.includes(item)));
  assert.equal(f.merges, initialMerges);
  assert.deepEqual([...f.tab.newKeys], ['gelbooru:100002']);
  assert.equal(f.tab.followSourceErrors.gelbooru, 'Temporarily unavailable');
  assert.equal(f.tab.hasMore, false);
});

test('a previously filtered Following work is remembered when preferences reveal it', async () => {
  const preferences = { excludedTags: ['hidden_fixture'] }, f = fixture(2, preferences);
  f.tab.followGroups[0].items[0].tags = ['hidden_fixture'];
  await f.flush();
  assert.equal(f.tab.items.length, 1);
  assert.equal(f.itemIndex.has('gelbooru:100001'), false);
  preferences.excludedTags = [];
  await f.flush();
  assert.equal(f.tab.items.length, 2);
  assert.equal(f.itemIndex.get('gelbooru:100001').key, 'gelbooru:100001');
  assert.equal(f.merges, 2, 'Revealing one work must not merge the already visible work again');
});

test('later Following mirrors still regroup globally across subscriptions', async () => {
  const f = fixture(2);
  f.tab.followGroups[0].items[0].contentHash = 'a'.repeat(32);
  await f.flush();
  f.tab.followGroups[1].items.push({ key: 'rule34:900001', source: 'rule34', id: '900001',
    title: 'Mirror', rating: 'g', contentHash: 'a'.repeat(32),
    published: '2025-01-01T00:00:00Z', images: ['https://example.org/mirror.jpg'] });
  f.tab.followUpdateRevision++;
  await f.flush();
  assert.equal(f.tab.items.length, 2);
  const merged = f.tab.items.find(item => item.key === 'gelbooru:100001');
  assert.deepEqual(new Set(merged.memberKeys), new Set(['gelbooru:100001', 'rule34:900001']));
  assert.ok(f.tab.newKeys.has('gelbooru:100001'));
  assert.ok(f.tab.newKeys.has('rule34:900001'));
});

test('concurrent reads of one Following revision reuse the publication that finishes first', async () => {
  const f = fixture(2);
  await Promise.all([f.context.updateFollowFeed(f.tab), f.context.updateFollowFeed(f.tab)]);
  assert.equal(f.tab.items.length, 2);
  assert.equal(f.merges, 2, 'An overlapping completed worker result must not merge the whole feed again');
});

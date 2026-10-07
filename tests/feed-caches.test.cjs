const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const logic = require('../wwwroot/catalog-logic.js');

test('only the correct illustrations section is active for each rating', () => {
  for (const rating of ['general', 'all', 'explicit'])
    assert.equal(logic.navigationSection({ kind: 'search', rating }), rating === 'explicit' ? 'adult' : 'search');
  for (const kind of ['home', 'profile', 'detail', 'follows', 'likes', 'settings'])
    assert.equal(logic.navigationSection({ kind }), kind);
});

test('warm attribution and filters remain current after new artist, tag and visual evidence', () => {
  const item = { key: 'sankaku:1', source: 'sankaku', creatorTag: 'first', tags: ['landscape'], images: [] };
  const preferences = { hiddenAuthors: [{ source: 'artist', artistId: 'second' }], aiMode: 'generated' };
  assert.equal(logic.workAttribution(item).creator.tag, 'first');
  assert.equal(logic.isWorkHidden(item, preferences), false);
  item.creatorTag = 'second';
  assert.equal(logic.workAttribution(item).creator.tag, 'second');
  assert.equal(logic.isWorkHidden(item, preferences), true);
  preferences.hiddenAuthors = []; item.tags.push('ai-created');
  assert.equal(logic.isWorkHidden(item, preferences), true);
  item.tags[1] = 'blue_hair'; logic.invalidateGrouping([item]);
  assert.equal(logic.isWorkHidden(item, preferences), false);
});

test('thumbnail enrichment updates only the connected groups and matches a full regroup', () => {
  const tags = Array.from({ length: 14 }, (_, i) => `tag_${i}`);
  const items = Array.from({ length: 200 }, (_, i) => ({ key: `rule34:${i + 1}`, source: 'rule34',
    creatorTag: `artist_${i}`, tags, images: [`https://example.test/${i}.jpg`] }));
  const previous = logic.groupWorks(items);
  const patch = { creatorTag: 'artist_1', visualHash: '0123456789abcdef', visualPHash: 'abcdabcdabcdabcd', visualAspectRatio: 1 };
  Object.assign(items[1], patch); Object.assign(items[2], patch);
  logic.refineGrouping(items, [items[1], items[2]]);
  const updated = logic.groupWorks(items);
  assert.equal(updated.length, 199);
  assert.equal(updated.find(item => item.key === 'rule34:1'), previous[0]);
  assert.deepEqual(updated.map(item => [...item.memberKeys].sort()).sort(),
    logic.groupWorks(structuredClone(items)).map(item => [...item.memberKeys].sort()).sort());
});

test('a later Following response supersedes pending worker results without losing New or source mirrors', async () => {
  const source = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
  const start = source.indexOf('async function updateFollowFeed('), end = source.indexOf('\nfunction queueFollowUpdate(', start);
  const finishes = [], draws = [];
  const tab = { id: 1, followVersion: 1, followUpdateRevision: 1, rating: 'all', followStreams: [], items: [],
    followGroups: [{ follow: { followedAt: '2020-01-01' }, items: [{ key: 'rule34:1', source: 'rule34', published: '2026-10-01', rating: 'e', contentHash: 'a'.repeat(32) }] }] };
  const context = { CatalogLogic: logic, clearTimeout, contentPreferences: {}, activeId: 1,
    rememberItems() {}, render: () => draws.push(tab.items.map(item => item.key)),
    DartCatalogJobs: { run: (op, args) => new Promise(resolve => finishes.push(() => resolve(logic.groupFollowFeed(...structuredClone(args))))) } };
  vm.runInNewContext(source.slice(start, end) + '\nthis.flush = flushFollowUpdate;', context);
  const pending = context.flush(tab);
  tab.followGroups[0].items.push({ key: 'sankaku:mirror', source: 'sankaku', contentHash: 'a'.repeat(32), rating: 'e', published: '2026-10-01' });
  tab.followUpdateRevision++; context.flush(tab);
  finishes.shift()(); await new Promise(resolve => setImmediate(resolve));
  finishes.shift()(); await pending;
  assert.equal(tab.items.length, 1);
  assert.deepEqual(new Set(tab.items[0].memberKeys), new Set(['rule34:1', 'sankaku:mirror']));
  assert(tab.newKeys.has('rule34:1')); assert(tab.newKeys.has('sankaku:mirror'));
});

test('unverified gallery counts do not promise four pages; learned copies and true variants survive reload', () => {
  const source = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
  const start = source.indexOf('const detailImageDeduper = {'), end = source.indexOf('\nfunction ratingLabel(', start);
  const context = { CatalogLogic: logic, DartMediaDuplicates: require('../wwwroot/media-duplicates.js'),
    setTimeout: () => 1, clearTimeout() {}, saveSession() {} };
  const deduper = vm.runInNewContext(source.slice(start, end) + '\ndetailImageDeduper', context);
  const urls = ['a','b','c','d'].map(id => `https://cdn.donmai.us/${id}.jpg`);
  assert.equal(deduper.isCountConfirmed(urls), false);
  deduper.duplicates.add(urls[0], urls[2]); deduper.duplicates.add(urls[1], urls[3]);
  deduper.verified.add(urls[0]); deduper.verified.add(urls[1]);
  const media = deduper.unique(urls);
  assert.equal(media.length, 2); assert.equal(deduper.isCountConfirmed(media), true);
  const saved = JSON.parse(JSON.stringify({ pairs: deduper.duplicates.entries(), verified: [...deduper.verified] }));
  deduper.duplicates = context.DartMediaDuplicates.createDuplicateIndex(saved.pairs);
  deduper.verified = new Set(saved.verified); deduper.verifiedResolved = null;
  assert.equal(deduper.unique(urls).length, 2);
  assert.equal(deduper.isCountConfirmed(deduper.unique(urls)), true);
  assert.equal(deduper.isCountConfirmed([...media, 'https://cdn.donmai.us/new.jpg']), false);
});

'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const Logic = require('../wwwroot/catalog-logic.js');
const app = fs.readFileSync(process.env.DART_ARTWORK_SOURCE_APP || require.resolve('../wwwroot/app.js'), 'utf8');
const start = app.indexOf('function artworkSourceItems(');
const source = app.slice(start, app.indexOf('\nfunction artworkRouteMedia(', start));
const work = (id, more = {}) => ({ key: `danbooru:${id}`, id: String(id), source: 'danbooru',
  title: `Neutral work ${id}`, rating: 'g', tags: ['forest', 'watercolor'],
  creatorTag: `fixture_artist_${id}`, images: [`https://example.test/${id}.jpg`], ...more });
const plain = value => JSON.parse(JSON.stringify(value));
function fixture(raw, buffered = raw, { kind = 'likes', hidden = () => false,
  preferences = {}, expired = () => false } = {}) {
  const merges = [], tab = { kind, items: raw, artworkDetached: true };
  const filter = items => Logic.filterWorks(Logic.groupWorks(Logic.filterCatalogItems(items).filter(item => !hidden(item))), preferences);
  const bufferedKeys = new Set(buffered.flatMap(item => [item.key, ...(item.memberKeys || [])]));
  const expected = Logic.mergeGroupedWorks(filter(raw), Logic.filterCatalogItems(raw)
    .filter(item => [item.key, ...(item.memberKeys || [])].some(key => bufferedKeys.has(key))))
    .filter(item => !expired(item));
  const context = vm.createContext({ CatalogLogic: { ...Logic, mergeGroupedWorks(previous, incoming) {
      merges.push({ previous, incoming }); return Logic.mergeGroupedWorks(previous, incoming);
    } }, contentPreferences: preferences, artworkRouteSource: route => route.source,
    artworkFollowItems: value => value.items, filterFeedWorks: filter,
    isExpiredFeedWork: (_, item) => expired(item), recent: raw });
  vm.runInContext(source, context);
  const route = { source: tab, list: kind, readVersions: new Map(), engine: { items: buffered } };
  return { context, route, merges, expected, read: () => context.artworkSourceItems(route) };
}

for (const kind of ['likes', 'bookmarks', 'recommendations', 'follows'])
  test(`${kind} route reuses complete visible metadata instead of regrouping the same buffered publication`, () => {
    const raw = Array.from({ length: 96 }, (_, index) => work(index + 1, {
      tags: Array.from({ length: 40 }, (_, tag) => `neutral_topic_${tag}`),
      characterTags: [`fixture_character_${index % 4}`], copyrightTags: ['fixture_series'],
      contentHash: (index + 1).toString(16).padStart(32, '0') }));
    const f = fixture(raw, raw, { kind }), actual = f.read();
    assert.equal(f.merges.length, 0, 'the entire already-visible source was needlessly merged a second time');
    assert.deepEqual(plain(actual), plain(f.expected));
    assert.equal(f.read(), actual, 'an unchanged source must keep its stable read result');
  });

test('visible grouped aliases retain exact media, attribution, tags and member identities without a duplicate merge', () => {
  const first = work(1, { contentHash: 'a'.repeat(32), tags: ['forest'], creatorName: 'Fixture creator',
    imageRecords: [{ url: 'https://example.test/1.jpg', hash: 'a'.repeat(32), owner: 'danbooru:1' }],
    originalUrl: 'https://example.test/source/1', thumbnail: 'https://example.test/thumb/1.jpg' });
  const second = work(2, { key: 'gelbooru:2', source: 'gelbooru', contentHash: first.contentHash,
    tags: ['forest', 'watercolor'], characterTags: ['fixture_hero'],
    imageRecords: [{ url: 'https://example.test/2.jpg', hash: first.contentHash, owner: 'gelbooru:2' }] });
  const f = fixture([first, second]), actual = f.read();
  assert.equal(f.merges.length, 0); assert.equal(actual.length, 1);
  assert.deepEqual(plain(actual), plain(f.expected));
  assert.deepEqual(actual[0].memberKeys, ['danbooru:1', 'gelbooru:2']);
  assert(actual[0].allTags.includes('watercolor'));
});

test('filtered buffered metadata still joins a visible mirror so the viewer can retire the stale duplicate', () => {
  const first = work(1, { contentHash: 'b'.repeat(32), creatorName: 'Learned creator', tags: ['forest', 'learned_detail'] });
  const mirror = work(2, { key: 'gelbooru:2', source: 'gelbooru', contentHash: first.contentHash });
  const f = fixture([mirror, first], [first], { hidden: item => item.key === first.key });
  const actual = f.read();
  assert.equal(f.merges.length, 1); assert.equal(f.merges[0].incoming[0], first);
  assert.equal(actual.length, 1); assert(actual[0].memberKeys.includes(mirror.key));
  assert(actual[0].allTags.includes('learned_detail')); assert.equal(actual[0].creatorName, 'Learned creator');
  assert.deepEqual(plain(actual), plain(f.expected));
});

test('overlapping raw keys remain conservative when a hidden response has different metadata', () => {
  const visible = work(1, { tags: ['forest'] }), hidden = { ...visible, tags: ['learned_detail'], creatorName: 'Later creator' };
  const f = fixture([visible, hidden], [visible], { hidden: item => item === hidden });
  const actual = f.read();
  assert.equal(f.merges.length, 1); assert.equal(f.merges[0].incoming.length, 2);
  assert.deepEqual(plain(actual), plain(f.expected));
  assert(actual[0].tags.includes('learned_detail'));
});

test('content filtering and expired slots retain their existing route behavior', () => {
  const visible = work(1), filtered = work(2, { tags: ['blocked_topic'] }), expired = work(3);
  const f = fixture([visible, filtered, expired], [visible], {
    preferences: { aiMode: 'all', excludedTags: ['blocked_topic'] }, expired: item => item.key === expired.key });
  const actual = f.read();
  assert.equal(f.merges.length, 0); assert.deepEqual(plain(actual), plain(f.expected));
  assert.deepEqual(actual.map(item => item.key), [visible.key]);
});

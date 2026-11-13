'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const Logic = require('../wwwroot/catalog-logic.js');
const source = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
const block = source.slice(source.indexOf('function setSavedWorks('), source.indexOf('\nasync function refreshBookmarks('));
const clone = value => JSON.parse(JSON.stringify(value));
const work = (id, extra = {}) => ({ key: `danbooru:${id}`, id: String(id), source: 'danbooru',
  title: `Neutral landscape ${id}`, creatorTag: 'neutral_artist', artistId: 'neutral_artist',
  rating: 'g', tags: ['forest', 'landscape'], thumbnail: `https://fixture.test/${id}.jpg`,
  images: [`https://fixture.test/${id}.jpg`], ...extra });

function fixture(likes = [], bookmarks = []) {
  const remembered = [], scheduled = [], context = vm.createContext({ likes, bookmarks,
    CatalogLogic: Logic, likedKeys: new Set(), savedKeys: new Set(), tabs: [
      { kind: 'likes', items: likes }, { kind: 'bookmarks', items: bookmarks }],
    rememberItems: items => remembered.push(items), scheduleRelatedKnownRefresh: () => scheduled.push(true) });
  vm.runInContext(block, context);
  return { context, remembered, scheduled, refresh: detail => context.refreshSavedDetail(detail) };
}

test('repeated identical detail retains saved collection, record, membership, revision and tab references', () => {
  const detail = work(1), other = work(2), f = fixture([detail, other], [clone(detail)]);
  f.refresh(clone(detail)); // Initial hydration may add normalized media/attribution evidence.
  const { likes, bookmarks, likedKeys, savedKeys } = f.context;
  const likedRecord = likes[0], bookmarkedRecord = bookmarks[0];
  const revisions = ['likes', 'bookmarks'].map(name => f.context.refreshSavedWorks.states[name].revision);
  const rememberedCount = f.remembered.length, scheduledCount = f.scheduled.length;
  for (let index = 0; index < 20; index++) f.refresh(clone(detail));
  assert.strictEqual(f.context.likes, likes);
  assert.strictEqual(f.context.bookmarks, bookmarks);
  assert.strictEqual(f.context.likes[0], likedRecord);
  assert.strictEqual(f.context.bookmarks[0], bookmarkedRecord);
  assert.strictEqual(f.context.likes[1], other);
  assert.strictEqual(f.context.likedKeys, likedKeys);
  assert.strictEqual(f.context.savedKeys, savedKeys);
  assert.strictEqual(f.context.tabs[0].items, likes);
  assert.strictEqual(f.context.tabs[1].items, bookmarks);
  assert.deepEqual(['likes', 'bookmarks'].map(name => f.context.refreshSavedWorks.states[name].revision), revisions);
  assert.equal(f.remembered.length, rememberedCount);
  assert.equal(f.scheduled.length, scheduledCount);
});

test('real tag, participant and media changes still publish once and invalidate dependent saved state', () => {
  const detail = work(1), other = work(2), f = fixture([detail, other]);
  f.refresh(detail);
  const previous = f.context.likes, revision = f.context.refreshSavedWorks.states.likes.revision;
  const changed = { ...detail, title: 'Updated landscape', tags: ['forest', 'river'],
    characterTags: ['neutral_character'], copyrightTags: ['neutral_series'],
    creatorTag: 'corrected_artist', creatorName: 'Corrected artist',
    participants: [{ tag: 'corrected_artist', name: 'Corrected artist', role: 'artist', source: 'danbooru' }],
    images: [...detail.images, 'https://fixture.test/variant.png'] };
  f.refresh(changed);
  assert.notStrictEqual(f.context.likes, previous);
  assert.strictEqual(f.context.likes[1], other);
  assert.equal(f.context.likes[0].title, 'Updated landscape');
  assert(f.context.likes[0].tags.includes('river'));
  assert(f.context.likes[0].images.includes('https://fixture.test/variant.png'));
  assert(f.context.likes[0].characterTags.includes('neutral_character'));
  assert(f.context.likes[0].copyrightTags.includes('neutral_series'));
  assert.equal(f.context.likes[0].creatorTag, 'corrected_artist');
  assert.equal(f.context.refreshSavedWorks.states.likes.revision, revision + 1);
  const current = f.context.likes;
  f.refresh(clone(changed));
  assert.strictEqual(f.context.likes, current);
});

test('group member details retain other versions and catalog membership', () => {
  const first = work(1, { groupKey: 'series:neutral', characterTags: ['neutral_character'] });
  const second = { ...work(2), source: 'gelbooru', key: 'gelbooru:2', groupKey: first.groupKey };
  const [group] = Logic.groupWorks([first, second]);
  const f = fixture([group]);
  const detail = { ...second, tags: ['forest', 'rain'], images: [...second.images, 'https://fixture.test/version3.png'] };
  f.refresh(detail);
  assert(f.context.likes[0].images.includes(first.images[0]));
  assert(f.context.likes[0].images.includes('https://fixture.test/version3.png'));
  assert(f.context.likes[0].allTags.includes('rain'));
  assert(f.context.likedKeys.has(first.key));
  assert(f.context.likedKeys.has(second.key));
  const current = f.context.likes;
  f.refresh(clone(detail));
  assert.strictEqual(f.context.likes, current);
});

test('fresh signed Sankaku URLs are real changes, while repeating the same signature is a no-op', () => {
  const oldUrl = 'https://s.sankakucomplex.com/data/neutral.png?e=1&m=old';
  const newUrl = oldUrl.replace('e=1&m=old', 'e=2&m=new');
  const item = { ...work('opaque'), key: 'sankaku:opaque', source: 'sankaku', images: [oldUrl] };
  const f = fixture([item]), detail = { ...item, images: [newUrl] };
  f.refresh(detail);
  assert.deepEqual(Array.from(f.context.likes[0].images), [newUrl]);
  const current = f.context.likes;
  f.refresh(clone(detail));
  assert.strictEqual(f.context.likes, current);
});

test('large-library repeat touches metadata only for the matching work and never copies the library', () => {
  const detail = work(4000), normalized = Logic.mergeDetailPages(detail, detail);
  let unrelatedMetadataReads = 0, merges = 0, copies = 0;
  const items = Array.from({ length: 8000 }, (_, index) => {
    if (index === 4000) return normalized;
    return { key: `danbooru:other${index}`, get tags() { unrelatedMetadataReads++; return ['unused']; } };
  });
  Object.defineProperty(items, 'slice', { value() { copies++; throw new Error('No-op must not copy the library'); } });
  const f = fixture(items);
  f.context.CatalogLogic = { ...Logic, mergeDetailPages(...args) { merges++; return Logic.mergeDetailPages(...args); } };
  for (let index = 0; index < 30; index++) f.refresh(clone(detail));
  assert.equal(merges, 30, 'only the single matching work needs detail hydration');
  assert.equal(unrelatedMetadataReads, 0);
  assert.equal(copies, 0);
  assert.strictEqual(f.context.likes, items);
  assert.equal(f.remembered.length, 0);
  assert.equal(f.scheduled.length, 0);
});

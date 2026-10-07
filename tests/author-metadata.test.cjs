const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const CatalogLogic = require('../wwwroot/catalog-logic.js');
const source = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');

function cacheFixture() {
  const calls = [], messages = [];
  const context = vm.createContext({ CatalogLogic, itemIndex: new Map(), rememberedInputs: new WeakMap(),
    ratingFilterFor: () => 'explicit', createTab: (...args) => calls.push(args),
    toast: message => messages.push(message) });
  const start = source.indexOf('function rememberItem');
  const end = source.indexOf('\nfunction saveSession(', start);
  vm.runInContext(source.slice(start, end), context);
  const creatorStart = source.indexOf('function openCreator(');
  const creatorEnd = source.indexOf('\nfunction openUploader(', creatorStart);
  vm.runInContext(source.slice(creatorStart, creatorEnd), context);
  return { context, calls, messages };
}

const known = { key: 'rule34:18818643', source: 'rule34', id: '18818643',
  creatorTag: 'maguro27', creatorName: 'maguro27',
  artistId: 'thistlsprout', artist: 'thistlsprout',
  uploaderId: 'thistlsprout', uploaderName: 'thistlsprout', rating: 'q' };
const partial = { ...known, creatorTag: '', creatorName: '' };

test('search refresh preserves confirmed character names and title', () => {
  const confirmed = { ...known, title: 'aisha belka',
    tags: ['aisha_belka', 'original_character'], characterTags: ['aisha_belka'] };
  const listing = { ...confirmed, title: 'Работа #18818643', characterTags: [] };
  const { context } = cacheFixture();
  context.rememberItems([confirmed]);
  context.rememberItems([listing]);
  const refreshed = context.itemIndex.get(confirmed.key);
  assert.deepEqual(refreshed.characterTags, ['aisha_belka']);
  assert.equal(refreshed.title, 'aisha belka');
  assert.equal(CatalogLogic.artworkTagKind(refreshed, 'aisha_belka'), 'character');
});

test('character metadata does not leak to another post and confirmed correction wins', () => {
  const confirmed = { ...known, title: 'aisha belka', characterTags: ['aisha_belka'] };
  const other = { ...partial, key: 'rule34:other', title: 'Работа #2', characterTags: [] };
  assert.deepEqual(CatalogLogic.mergeWorkMetadata(confirmed, other).characterTags, []);
  const corrected = CatalogLogic.mergeWorkMetadata(confirmed,
    { ...partial, title: 'Работа #18818643', characterTags: ['correct_character'] });
  assert.deepEqual(corrected.characterTags, ['correct_character']);
  assert.equal(corrected.title, 'correct character');
});

test('previously cached generic character category is removed from generated titles', () => {
  const legacy = { ...known, title: 'aisha belka, original character',
    characterTags: ['aisha_belka', 'original_character'] };
  const cached = CatalogLogic.mergeWorkMetadata(legacy, { ...legacy });
  assert.equal(cached.title, 'aisha belka');
  assert.deepEqual(cached.characterTags, ['aisha_belka']);
});

test('a background response cannot erase the confirmed artist before profile navigation', () => {
  const { context, calls, messages } = cacheFixture();
  context.rememberItems([known]);
  context.rememberItems([partial]);
  context.openCreator(context.itemIndex.get(known.key));
  assert.equal(calls.length, 1, `Artist profile did not open: ${messages}`);
  assert.equal(calls[0][2].profileRef.artist, 'maguro27');
  assert.equal(context.itemIndex.get(known.key).uploaderId, 'thistlsprout');
});

test('a partial mirror preserves the artist inherited by a grouped work', () => {
  const grouped = { ...known, memberKeys: [known.key, 'danbooru:1229410'],
    images: ['page-1.jpg', 'page-2.jpg'] };
  const merged = CatalogLogic.mergeWorkMetadata(grouped, partial);
  assert.equal(CatalogLogic.creatorProfileRef(merged).artist, 'maguro27');
  assert.deepEqual(merged.memberKeys, grouped.memberKeys);
  assert.equal(CatalogLogic.workAttribution(merged).uploader.name, 'thistlsprout');
});

test('a corrected artist replaces the identifier and display name together', () => {
  const merged = CatalogLogic.mergeWorkMetadata(known, {
    ...partial, creatorTag: 'corrected_artist', creatorName: '' });
  assert.equal(merged.creatorTag, 'corrected_artist');
  assert.equal(merged.creatorName, 'corrected artist');
  assert.equal(CatalogLogic.creatorProfileRef(merged).artist, 'corrected_artist');
});

test('a name without an artist identifier cannot replace a confirmed creator', () => {
  const merged = CatalogLogic.mergeWorkMetadata(known, { ...partial, creatorName: 'Unconfirmed' });
  assert.equal(merged.creatorTag, 'maguro27');
  assert.equal(merged.creatorName, 'maguro27');
});

test('a uploader and arbitrary matching tag never become a verified artist', () => {
  const merged = CatalogLogic.mergeWorkMetadata(partial, {
    ...partial, tags: ['maguro27'], followedArtistTag: 'maguro27' });
  assert.equal(CatalogLogic.workAttribution(merged).creator, null);
  assert.equal(CatalogLogic.creatorProfileRef(merged), null);
});

test('artist metadata is not carried across other works', () => {
  const other = { ...partial, key: 'rule34:other', id: 'other' };
  assert.equal(CatalogLogic.workAttribution(CatalogLogic.mergeWorkMetadata(known, other)).creator, null);
});

test('detail hydration keeps a corrected artist identifier and name consistent', () => {
  const merged = CatalogLogic.mergeDetailPages({ ...known, memberKeys: [known.key] },
    { ...partial, creatorTag: 'corrected_artist' });
  assert.equal(merged.creatorTag, 'corrected_artist');
  assert.equal(merged.creatorName, 'corrected artist');
});

test('grouping uses a confirmed mirror rather than a name without artist identity', () => {
  const hash = 'a'.repeat(32);
  const grouped = CatalogLogic.groupWorks([
    { ...partial, creatorName: 'Unconfirmed', contentHash: hash, images: ['first.jpg'] },
    { ...known, key: 'gelbooru:mirror', source: 'gelbooru', contentHash: hash, images: ['second.jpg'] }
  ]);
  assert.equal(grouped.length, 1);
  assert.equal(CatalogLogic.creatorProfileRef(grouped[0])?.artist, 'maguro27');
  assert.equal(CatalogLogic.workAttribution(grouped[0]).creator?.name, 'maguro27');
});

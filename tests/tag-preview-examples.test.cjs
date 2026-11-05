'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Preview = require(process.env.DART_TAG_PREVIEW_TEST_MODULE || '../wwwroot/tag-preview.js');
const Logic = require('../wwwroot/catalog-logic.js');
const work = (id, more = {}) => ({ key: `danbooru:${id}`, source: 'danbooru', id: String(id),
  title: 'Neutral geometric example', tags: ['fern'], characterTags: ['fern'], rating: 'g',
  thumbnail: `https://example.test/thumbnail-${id}.jpg`, images: [`https://example.test/original-${id}.jpg`], ...more });
const tokens = item => new Set(Preview.exclusionTokens(item, Logic));
const scope = { key: 'general:character:current-art', rating: 'general', tagKind: 'character' };
const score = (item, tag = 'fern', context = scope) => Preview.exampleScore(item, tag, context);

test('the opened work and every actual grouped member are excluded even when their versions have different files', () => {
  const first = work(1, { contentHash: 'a'.repeat(32) }), second = work(2, { contentHash: 'b'.repeat(32) });
  const opened = { ...first, memberKeys: [first.key, second.key], groupMembers: [first, second] };
  const excluded = tokens(opened);
  assert.equal(Preview.excludes(first, excluded, Logic), true);
  assert.equal(Preview.excludes(second, excluded, Logic), true);
  assert.equal(Preview.excludes(work(3), excluded, Logic), false);
});

test('known file hashes exclude mirrors from a different catalog, including a non-cover grouped version', () => {
  const opened = work(1, { contentHash: 'a'.repeat(32), groupMembers: [work(2, { contentHash: 'B'.repeat(32) })] });
  const excluded = tokens(opened);
  const mirror = work(8, { key: 'rule34:8', source: 'rule34', contentHash: 'b'.repeat(32) });
  assert.equal(Preview.excludes(mirror, excluded, Logic), true);
  assert.equal(Preview.excludes(work(9, { contentHash: 'c'.repeat(32) }), excluded, Logic), false);
});

test('owned image-record hashes exclude a mirror even without a root content hash', () => {
  const opened = work(1, { images: ['https://example.test/page-a.jpg', 'https://example.test/page-b.jpg'],
    imageRecords: [{ url: 'https://example.test/page-b.jpg', hash: 'b'.repeat(32) }] });
  const mirror = work(9, { key: 'gelbooru:9', source: 'gelbooru', contentHash: 'b'.repeat(32) });
  assert.equal(Preview.excludes(mirror, tokens(opened), Logic), true);
});

test('an exact owned media URL and a renewed Sankaku signature exclude the same picture', () => {
  const original = 'https://s.sankakucomplex.com/data/neutral.jpg?e=1&m=old';
  const renewed = 'https://s.sankakucomplex.com/data/neutral.jpg?e=4102444800&m=fresh';
  const opened = work(1, { images: [original] });
  assert.equal(Preview.excludes(work(2, { images: [renewed] }), tokens(opened), Logic), true);
  assert.equal(Preview.excludes(work(3, { images: ['https://example.test/different.jpg'] }), tokens(opened), Logic), false);
});

test('shared weak parent, publication, artist, character and upload-time evidence do not hide a different scene', () => {
  for (const shared of [
    { groupKey: 'danbooru:parent:1' },
    { groupKey: 'pixiv:123456', pixivGroupKey: 'pixiv:123456', originalUrl: 'https://www.pixiv.net/artworks/123456' },
    { originalUrl: 'https://x.com/neutral/status/123456789' },
    { creatorTag: 'same_artist', characterTags: ['fern'], published: '2026-11-05T12:00:00Z' }
  ]) {
    const opened = work(1, { ...shared, contentHash: 'a'.repeat(32) });
    const other = work(2, { ...shared, contentHash: 'b'.repeat(32) });
    assert.equal(Preview.excludes(other, tokens(opened), Logic), false, JSON.stringify(shared));
  }
});

test('invalid hashes cannot create a false copy identity', () => {
  const opened = work(1, { contentHash: 'unknown' }), other = work(2, { contentHash: 'unknown' });
  assert.equal(Preview.excludes(other, tokens(opened), Logic), false);
  assert.equal(Preview.excludes(other, new Set(), Logic), false);
});

test('a grouped preview uses the matching version own thumbnail rather than its unrelated group cover', () => {
  const cover = work(1, { tags: ['forest'], characterTags: [] });
  const match = work(2, { tags: ['rain'], characterTags: [] });
  const grouped = { ...cover, tags: ['forest', 'rain'], allTags: ['forest', 'rain'], groupMembers: [cover, match] };
  const candidates = Preview.representativeCandidates(grouped, 'rain');
  assert.equal(candidates.length, 1); assert.equal(candidates[0].thumbnail, match.thumbnail);
  assert.equal(Preview.matchesTag(candidates[0], 'rain'), true);
  assert.equal(Preview.matchesTag(candidates[0], 'forest'), false, 'member metadata must not borrow another version tags');
});

test('group union metadata alone cannot invent a representative when no owned member confirms the tag', () => {
  const grouped = work(1, { tags: ['rain'], groupMembers: [work(2, { tags: ['forest'], characterTags: [] })] });
  assert.deepEqual(Preview.representativeCandidates(grouped, 'rain'), []);
  assert.deepEqual(Preview.representativeCandidates(work(3, { title: 'rain', tags: ['forest'], characterTags: [] }), 'rain'), []);
  assert.equal(Preview.representativeCandidates(work(4, { tags: ['rain'], characterTags: [] }), 'rain').length, 1);
});

test('invalid requested tags never match invalid metadata as a representative', () => {
  const item = work(1, { tags: ['', 'rating:explicit'], characterTags: [] });
  for (const tag of ['', 'rating:explicit', '-forest', 'forest*'])
    assert.deepEqual(Preview.representativeCandidates(item, tag), [], tag);
});

test('a sole confirmed requested character is clearer than an ensemble, even if the ensemble also says solo', () => {
  const ensemble = work(1, { characterTags: ['fern', 'other_character'], tags: ['fern', 'solo'] });
  const single = work(2, { characterTags: ['fern'], tags: ['fern'] });
  assert(score(single) > score(ensemble));
  const legacyGeneric = work(3, { characterTags: ['fern', 'original_character', 'character_request'], tags: ['fern'] });
  assert.equal(score(legacyGeneric), score(single), 'generic placeholders are not other characters');
});

test('multi-person evidence lowers character clarity without discarding the only available example', () => {
  const single = work(1, { tags: ['fern', 'solo'] });
  const crowd = work(2, { tags: ['fern', '2girls'] });
  assert(score(single) > score(crowd)); assert(Number.isFinite(score(crowd)));
});

test('only a focus marker relevant to the requested feature improves that example', () => {
  const base = work(1, { tags: ['tattoo'], characterTags: [] });
  const focused = { ...base, tags: ['tattoo', 'tattoo_focus'] };
  const unrelated = { ...base, tags: ['tattoo', 'eye_focus', 'foot_focus'] };
  assert(score(focused, 'tattoo', {}) > score(base, 'tattoo', {}));
  assert.equal(score(unrelated, 'tattoo', {}), score(base, 'tattoo', {}));
});

test('foot focus clarifies feet while a generic face close-up does not', () => {
  const base = work(1, { tags: ['feet'], characterTags: [] });
  const focused = { ...base, tags: ['feet', 'foot_focus'] };
  const portrait = { ...base, tags: ['feet', 'portrait', 'close_up', 'face_focus'] };
  assert(score(focused, 'feet', {}) > score(base, 'feet', {}));
  assert(score(portrait, 'feet', {}) <= score(base, 'feet', {}));
});

test('a plain background and usable resolution are modest tie-breakers below specific feature focus', () => {
  const base = work(1, { tags: ['eyes'], characterTags: [], width: 256, height: 256 });
  const plain = { ...base, tags: ['eyes', 'simple_background'] };
  const larger = { ...base, width: 1400, height: 1400 };
  const focused = { ...base, tags: ['eyes', 'eye_focus'] };
  assert(score(plain, 'eyes', {}) > score(base, 'eyes', {}));
  assert(score(larger, 'eyes', {}) > score(base, 'eyes', {}));
  assert(score(focused, 'eyes', {}) > score({ ...larger, tags: plain.tags }, 'eyes', {}));
});

test('the resolver can select an older clearer viewed example without searching or changing library order', async () => {
  const viewed = [work(1, { characterTags: ['fern', 'other_character'] }), work(2, { tags: ['fern', 'solo'] })];
  const before = JSON.stringify(viewed); let searches = 0;
  const resolver = Preview.createResolver({ getViewed: () => viewed,
    search: async () => { searches++; return [work(3)]; }, score: Preview.exampleScore });
  const result = await resolver.resolve('fern', scope);
  assert.equal(result.item.key, 'danbooru:2'); assert.equal(result.origin, 'viewed');
  assert.equal(searches, 0); assert.equal(JSON.stringify(viewed), before);
});

test('a valid viewed example retains priority over a potentially clearer unseen search result', async () => {
  let searches = 0;
  const viewed = work(1, { characterTags: ['fern', 'other_character'] });
  const resolver = Preview.createResolver({ getViewed: () => [viewed],
    search: async () => { searches++; return [work(2, { tags: ['fern', 'solo'] })]; }, score: Preview.exampleScore });
  const result = await resolver.resolve('fern', scope);
  assert.equal(result.item.key, viewed.key); assert.equal(result.origin, 'viewed'); assert.equal(searches, 0);
});

test('current-copy exclusion and ordinary filters apply before clarity selection and search caching', async () => {
  const opened = work(1, { contentHash: 'a'.repeat(32) }), excluded = tokens(opened);
  const mirror = work(2, { contentHash: 'a'.repeat(32), tags: ['fern', 'solo'] });
  const blocked = work(3, { tags: ['fern', 'solo'], hidden: true });
  const available = work(4, { characterTags: ['fern', 'other_character'] });
  const resolver = Preview.createResolver({ getViewed: () => [], search: async () => [mirror, blocked, available],
    allowed: item => !item.hidden && !Preview.excludes(item, excluded, Logic), score: Preview.exampleScore });
  assert.equal((await resolver.resolve('fern', scope)).item.key, available.key);
});

test('default and scored ties retain the original candidate order', async () => {
  const first = work(1), second = work(2);
  for (const scoreFn of [undefined, () => 7]) {
    const resolver = Preview.createResolver({ getViewed: () => [], search: async () => [first, second],
      ...(scoreFn ? { score: scoreFn } : {}) });
    assert.equal((await resolver.resolve('fern', scope)).item.key, first.key);
  }
});

test('copy identities, representative extraction and clarity scoring do not rewrite artwork metadata', () => {
  const first = work(1), second = work(2, { tags: ['rain'], characterTags: [] });
  const grouped = { ...first, tags: ['fern', 'rain'], groupMembers: [first, second] };
  const before = JSON.stringify(grouped);
  for (const item of [first, second, grouped]) {
    Object.freeze(item.tags); Object.freeze(item.characterTags); Object.freeze(item.images); Object.freeze(item);
  }
  tokens(grouped); Preview.representativeCandidates(grouped, 'rain'); score(first);
  assert.equal(JSON.stringify(grouped), before);
});

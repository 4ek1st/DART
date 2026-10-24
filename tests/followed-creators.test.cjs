const test = require('node:test');
const assert = require('node:assert/strict');
const logic = require('../wwwroot/catalog-logic.js');

const work = (source, extra = {}) => ({ source, key: `${source}:1`, ...extra });

test('a confirmed subscribed creator matches works from every catalog', () => {
  const matches = logic.followedWorkMatcher([{ source: 'danbooru', artistId: 'sample_artist' }]);
  for (const source of logic.supportedSources) {
    assert.equal(matches(work(source, { creatorTag: 'sample_artist' })), true, source);
    assert.equal(matches(work(source, { participants: [{ tag: 'sample_artist', role: 'artist' }] })), true, source);
    assert.equal(matches(work(source, { followedArtistTag: 'sample_artist' })), true, source);
  }
  assert.equal(matches(work('danbooru', { artistId: 'sample_artist' })), true,
    'Danbooru artistId is a creator tag');
});

test('matching normalizes Unicode, casing and spaces while preserving distinct tags', () => {
  const matches = logic.followedWorkMatcher([{ source: 'danbooru', artistId: ' ＳＡＭＰＬＥ Artist ' }]);
  assert.equal(matches(work('sankaku', { creatorTag: 'sample_artist' })), true);
  assert.equal(matches(work('rule34', { creatorTag: 'SAMPLE Artist' })), true);
  assert.equal(matches(work('gelbooru', { creatorTag: 'sample-artist' })), false);
  assert.equal(matches(work('sankaku', { creatorName: 'Sample Artist' })), false,
    'Display names alone are not identity evidence');
});

test('an explicit Gelbooru alias supplements the cross-catalog canonical creator tag', () => {
  const matches = logic.followedWorkMatcher([{ source: 'danbooru', artistId: 'canonical_artist',
    gelbooruTag: 'other spelling' }]);
  assert.equal(matches(work('gelbooru', { creatorTag: 'other_spelling' })), true);
  assert.equal(matches(work('rule34', { creatorTag: 'canonical_artist' })), true);
  assert.equal(matches(work('sankaku', { creatorTag: 'other_spelling' })), false,
    'The source-specific override must not invent aliases on other catalogs');
});

test('creators never match a same-named repost uploader or an ordinary raw tag', () => {
  const matches = logic.followedWorkMatcher([{ source: 'danbooru', artistId: 'sample_artist' }]);
  for (const source of ['gelbooru', 'rule34', 'sankaku']) {
    assert.equal(matches(work(source, { artistId: 'sample_artist', artist: 'Sample Artist',
      uploaderId: 'sample_artist', uploaderName: 'Sample Artist', tags: ['sample_artist'] })), false, source);
  }
  assert.equal(matches(work('danbooru', { tags: ['sample_artist'] })), false);
});

test('legacy uploader subscriptions match only the same catalog uploader identity', () => {
  for (const source of ['gelbooru', 'rule34', 'sankaku']) {
    const matches = logic.followedWorkMatcher([{ source, artistId: 'Uploader Name' }]);
    assert.equal(matches(work(source, { uploaderId: 'uploader_name' })), true, source);
    assert.equal(matches(work(source, { uploaderId: '123', uploaderName: 'Uploader Name' })), true, source);
    assert.equal(matches(work(source, { artistId: 'uploader_name' })), true, 'Legacy uploader field');
    assert.equal(matches(work(source, { creatorTag: 'uploader_name' })), false, 'Artist is not the subscribed uploader');
    assert.equal(matches(work(source === 'rule34' ? 'sankaku' : 'rule34', { uploaderId: 'uploader_name' })), false);
  }
});

test('all confirmed participants and merged source members retain subscription evidence', () => {
  const byCreator = logic.followedWorkMatcher([{ source: 'danbooru', artistId: 'credited_voice_(voice_actor)' }]);
  assert.equal(byCreator(work('sankaku', { participants: [
    { tag: 'different_artist', role: 'artist' },
    { tag: 'credited_voice_(voice_actor)', role: 'voice_actor' }
  ] })), true);
  const byUploader = logic.followedWorkMatcher([{ source: 'sankaku', artistId: 'reposter' }]);
  const group = work('danbooru', { creatorTag: 'different_artist', groupMembers: [
    work('rule34', { creatorTag: 'different_artist' }),
    work('sankaku', { uploaderName: 'reposter' })
  ] });
  assert.equal(byUploader(group), true);
  group.groupMembers[1].uploaderName = 'other_uploader';
  assert.equal(byUploader(group), false, 'In-place provenance updates must not leave stale cached matches');
  group.groupMembers.push(work('gelbooru', { participants: [{ tag: 'credited_voice_(voice_actor)' }] }));
  assert.equal(byCreator(group), true);
  group.groupMembers.push(group);
  assert.equal(byUploader(group), false, 'Malformed cyclic provenance must not loop forever');
});

test('unknown, malformed and unsupported records remain unmatched', () => {
  for (const follows of [[], undefined, null, [{ source: 'unknown', artistId: 'artist' }]]) {
    const matches = logic.followedWorkMatcher(follows);
    for (const item of [null, undefined, {}, work('sankaku'), work('unknown', { creatorTag: 'artist' })])
      assert.equal(matches(item), false);
  }
  assert.equal(logic.followedWorkMatcher([{ source: 'danbooru', artistId: 'artist' }])(
    work('sankaku', { participants: [null, {}, { tag: 123 }], tags: ['artist'] })), false);
  assert.equal(logic.followedWorkMatcher([{ source: 'danbooru', artistId: 'artist' }])(
    work('sankaku', { groupMembers: { length: 1 } })), false);
});

test('subscription identities are indexed once rather than scanned per candidate', () => {
  let reads = 0;
  const follows = Array.from({ length: 93 }, (_, index) => ({ source: 'danbooru',
    get artistId() { reads++; return `artist_${index}`; } }));
  const matches = logic.followedWorkMatcher(follows);
  const afterIndex = reads;
  for (let index = 0; index < 800; index++)
    assert.equal(matches(work('sankaku', { creatorTag: 'artist_92' })), true);
  assert.equal(reads, afterIndex);
  assert.ok(afterIndex >= follows.length);
});

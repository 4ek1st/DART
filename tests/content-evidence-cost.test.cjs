'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../wwwroot/catalog-logic.js'), 'utf8');

function fixture() {
  let tagConversions = 0;
  const countedString = value => {
    if (typeof value === 'string' && value.startsWith('neutral_tag_')) tagConversions++;
    return String(value);
  };
  Object.setPrototypeOf(countedString, String);
  const context = { module: { exports: {} }, String: countedString, TextEncoder, TextDecoder, URL };
  vm.runInNewContext(source, context);
  return { logic: context.module.exports, conversions: () => tagConversions };
}
const work = (extra = {}) => ({ key: 'danbooru:1', source: 'danbooru', id: '1',
  tags: [], allTags: [], ...extra });

test('cold content evidence converts each distinct raw tag at most once per normalization purpose', () => {
  for (const count of [30, 70, 100]) for (const source of ['danbooru', 'gelbooru', 'rule34', 'sankaku']) {
    const f = fixture(), tags = Array.from({ length: count }, (_, index) => `neutral_tag_${index % 25}`);
    const item = work({ key: `${source}:1`, source, tags, allTags: [...tags, ...tags] });
    const preferences = { hiddenAuthors: [{ source: 'artist', artistId: 'missing_neutral_artist' }] };
    assert.equal(f.logic.isWorkHidden(item, preferences), false);
    const distinct = new Set([...item.tags, ...item.allTags]).size;
    assert(f.conversions() <= distinct * 2,
      `${source}/${count}: ${f.conversions()} raw-tag conversions for ${distinct} distinct tags`);
    const warm = f.conversions();
    assert.equal(f.logic.isWorkHidden(item, preferences), false);
    assert.equal(f.conversions(), warm, 'Warm evidence remains reusable');
  }
});

test('raw-tag deduplication preserves case, underscore, Unicode and typed participant filtering', () => {
  const { logic } = fixture();
  const item = work({ tags: ['NEUTRAL_ARTIST', 'NEUTRAL_ARTIST', 'Ｗａｌｄ＿Äｓｔｈｅｔｉｋ'],
    allTags: ['neutral artist', 'NEUTRAL_ARTIST', 'wald_ästhetik'],
    participants: [{ tag: 'typed_neutral_artist', role: 'animator' },
      { tag: 'typed_neutral_voice', role: 'voice_actor' }], followedArtistTag: 'followed_neutral_artist' });
  for (const artistId of ['neutral_artist', 'wald_ästhetik', 'typed_neutral_artist',
    'typed_neutral_voice', 'followed_neutral_artist'])
    assert.equal(logic.isWorkHidden(item, { hiddenAuthors: [{ source: 'artist', artistId }] }), true, artistId);
  for (const tag of ['neutral_artist', 'WALD ÄSTHETIK'])
    assert.equal(logic.isWorkHidden(item, { excludedTags: [tag] }), true, tag);
  assert.equal(logic.isWorkHidden(item, { hiddenAuthors: [{ source: 'artist', artistId: 'missing_neutral' }] }), false);
  assert.equal(logic.isWorkHidden(item, { excludedTags: ['missing_neutral'] }), false);
});

test('deduplicated evidence retains catalog-scoped uploader and nested mirror filtering', () => {
  const { logic } = fixture();
  const item = work({ source: 'sankaku', key: 'sankaku:1', uploaderId: 'neutral_uploader',
    tags: ['neutral_tag_1'], allTags: ['neutral_tag_1', 'neutral_tag_1'],
    groupMembers: [{ source: 'gelbooru', key: 'gelbooru:2', uploaderId: 'mirror_neutral_uploader' }] });
  assert.equal(logic.isWorkHidden(item, { hiddenAuthors: [{ source: 'sankaku', artistId: 'neutral_uploader' }] }), true);
  assert.equal(logic.isWorkHidden(item, { hiddenAuthors: [{ source: 'gelbooru', artistId: 'neutral_uploader' }] }), false);
  assert.equal(logic.isWorkHidden(item, { hiddenAuthors: [{ source: 'gelbooru', artistId: 'mirror_neutral_uploader' }] }), true);
  item.groupMembers[0].uploaderId = 'corrected_mirror_uploader';
  assert.equal(logic.isWorkHidden(item, { hiddenAuthors: [{ source: 'gelbooru', artistId: 'mirror_neutral_uploader' }] }), false);
});

test('tag growth, array replacement, explicit invalidation and participant updates refresh evidence', () => {
  const { logic } = fixture(), item = work({ tags: ['neutral_tag_1'], allTags: ['neutral_tag_1'] });
  const excluded = { excludedTags: ['late_neutral'] };
  assert.equal(logic.isWorkHidden(item, excluded), false);
  item.tags.push('late_neutral');
  assert.equal(logic.isWorkHidden(item, excluded), true);
  item.tags = ['replacement_neutral'];
  assert.equal(logic.isWorkHidden(item, excluded), false);
  assert.equal(logic.isWorkHidden(item, { excludedTags: ['replacement_neutral'] }), true);
  item.tags[0] = 'corrected_neutral';
  logic.invalidateGrouping([item]);
  assert.equal(logic.isWorkHidden(item, { excludedTags: ['replacement_neutral'] }), false);
  assert.equal(logic.isWorkHidden(item, { excludedTags: ['corrected_neutral'] }), true);
  item.participants = [{ tag: 'late_neutral_artist', role: 'artist' }];
  const hidden = { hiddenAuthors: [{ source: 'artist', artistId: 'late_neutral_artist' }] };
  assert.equal(logic.isWorkHidden(item, hidden), true);
  item.participants[0].tag = 'corrected_neutral_artist';
  logic.invalidateGrouping([item]);
  assert.equal(logic.isWorkHidden(item, hidden), false);
  assert.equal(logic.isWorkHidden(item, { hiddenAuthors: [{ source: 'artist', artistId: 'corrected_neutral_artist' }] }), true);
});

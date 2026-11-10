const test = require('node:test');
const assert = require('node:assert/strict');
const logic = require('../wwwroot/catalog-logic.js');
const work = (id, tags, extra = {}) => ({ key: `danbooru:${id}`, source: 'danbooru', id: String(id),
  rating: 'e', tags, artistId: `artist-${id}`, ...extra });

test('related works prefer a shared character over shared common attributes', () => {
  const anchor = work(1, ['alice_(sample)', 'sample_series', 'sword', 'blush', 'thighhighs', 'breasts'],
    { characterTags: ['alice_(sample)'], copyrightTags: ['sample_series'] });
  const common = Array.from({ length: 30 }, (_, i) => work(100 + i, ['blush', 'thighhighs', 'breasts', 'solo_focus', `extra_${i}`]));
  const sameCharacter = work(50, ['alice_(sample)', 'sample_series', 'castle'],
    { characterTags: ['alice_(sample)'], copyrightTags: ['sample_series'] });
  const ranked = logic.rankRelated(anchor, [...common, sameCharacter], 5);
  assert.equal(ranked[0].key, sameCharacter.key);
});

test('related works use every tag field of a candidate, not only tags', () => {
  const anchor = work(1, ['alice_(sample)', 'sword'], { characterTags: ['alice_(sample)'] });
  const typedOnly = work(2, [], { characterTags: ['alice_(sample)'] });
  assert.deepEqual(logic.rankRelated(anchor, [typedOnly], 5).map(item => item.key), [typedOnly.key]);
});

test('related works exclude the anchor and limit one artist before showing others', () => {
  const anchor = work(1, ['alice_(sample)'], { characterTags: ['alice_(sample)'] });
  const sameArtist = Array.from({ length: 6 }, (_, i) => work(10 + i, ['alice_(sample)'], { artistId: 'shared' }));
  const other = work(30, ['alice_(sample)'], { artistId: 'other' });
  const ranked = logic.rankRelated(anchor, [anchor, ...sameArtist, other], 24);
  assert.ok(!ranked.some(item => item.key === anchor.key));
  assert.ok(ranked.slice(0, 4).some(item => item.key === other.key), 'a fourth work by one artist must not precede another artist');
});

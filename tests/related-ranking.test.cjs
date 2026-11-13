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

test('related author diversity follows confirmed creators across catalogs and uploaders', () => {
  const anchor = work(1, ['landscape'], { creatorTag: 'anchor_artist', artistId: 'shared_uploader' });
  const repeated = Array.from({ length: 6 }, (_, i) => work(100 + i, ['landscape'], {
    source: ['gelbooru', 'rule34', 'sankaku'][i % 3], creatorTag: 'repeat_artist', artistId: `uploader_${i}`
  }));
  const other = work(200, ['landscape'], { source: 'rule34', creatorTag: 'other_artist', artistId: 'shared_uploader' });
  const ranked = logic.rankRelated(anchor, [...repeated, other], 4);
  assert.ok(ranked.some(item => item.key === other.key));
  assert.equal(ranked.filter(item => item.creatorTag === 'repeat_artist').length, 3);
});

test('related ranking penalizes the anchor creator across sources, not its uploader', () => {
  const anchor = work(1, ['landscape'], { source: 'gelbooru', creatorTag: 'same_artist', artistId: 'shared_uploader' });
  const same = work(2, ['landscape'], { source: 'sankaku', creatorTag: 'same_artist', artistId: 'different_uploader' });
  const other = work(3, ['landscape'], { source: 'gelbooru', creatorTag: 'other_artist', artistId: 'shared_uploader' });
  assert.equal(logic.rankRelated(anchor, [same, other], 1)[0].key, other.key);
});

test('related diversity counts all visual collaborators but does not group uncredited uploaders or voice actors', () => {
  const anchor = work(1, ['landscape']);
  const repeated = Array.from({ length: 4 }, (_, i) => work(100 + i, ['landscape'], {
    source: 'rule34', artistId: `uploader_${i}`, participants: [
      { tag: `first_${i}`, role: 'artist' }, { tag: 'shared_animator', role: 'animator' }
    ]
  }));
  const independent = work(200, ['landscape'], { source: 'gelbooru', artistId: 'unknown' });
  assert.ok(logic.rankRelated(anchor, [...repeated, independent], 4).some(item => item.key === independent.key));
  const uncredited = Array.from({ length: 5 }, (_, i) => work(300 + i, ['landscape'], {
    source: 'sankaku', artistId: 'same_uploader', participants: [{ tag: 'same_voice', role: 'voice_actor' }]
  }));
  assert.equal(logic.rankRelated(anchor, uncredited, 5).length, 5);
});

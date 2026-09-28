const test = require('node:test');
const assert = require('node:assert/strict');
const logic = require('../wwwroot/catalog-logic.js');

const hiddenAuthors = [{ source: 'artist', artistId: 'sample_artist', name: 'Sample artist' }];

test('hiding an artist filters every source, contributors and uncategorized artist tags', () => {
  for (const source of logic.supportedSources) {
    const base = { key: `${source}:1`, source, tags: [], rating: 'g' };
    for (const detail of [
      { creatorTag: 'Sample_Artist' },
      { participants: [{ tag: 'sample_artist', role: 'voice_actor' }] },
      { tags: ['sample_artist'] },
      { allTags: ['sample_artist'] },
      { followedArtistTag: 'sample_artist' }
    ]) {
      const item = { ...base, ...detail };
      assert.equal(logic.isWorkHidden(item, { hiddenAuthors }), true, JSON.stringify(item));
      assert.deepEqual(logic.filterWorks([item], { hiddenAuthors }), []);
    }
  }
});

test('author matching keeps distinct names and uploaders separate', () => {
  for (const item of [
    { source: 'rule34', creatorTag: 'sample_artist_2', tags: ['landscape'] },
    { source: 'gelbooru', creatorTag: 'sample-artist', tags: [] },
    { source: 'sankaku', artistId: 'sample_artist', artist: 'Sample artist', tags: [] },
    { source: 'danbooru', tags: [], creatorName: 'Автор не указан' }
  ]) assert.equal(logic.isWorkHidden(item, { hiddenAuthors }), false);
  const uploader = { source: 'rule34', artistId: '42', name: 'Uploader' };
  assert.equal(logic.isWorkHidden({ source: 'rule34', uploaderId: '42' }, { hiddenAuthors: [uploader] }), true);
  assert.equal(logic.isWorkHidden({ source: 'gelbooru', uploaderId: '42' }, { hiddenAuthors: [uploader] }), false);
  assert.equal(logic.isWorkHidden({ source: 'danbooru', creatorTag: '42' }, { hiddenAuthors: [uploader] }), false);
});

test('a hidden participant in any mirror hides the grouped artwork and unhide restores it', () => {
  const items = [
    { key: 'danbooru:1', source: 'danbooru', contentHash: 'a'.repeat(32), creatorTag: 'other_artist', tags: [] },
    { key: 'sankaku:2', source: 'sankaku', contentHash: 'a'.repeat(32), creatorTag: 'sample_artist', tags: [] }
  ];
  const groups = logic.groupWorks(items);
  assert.equal(groups.length, 1);
  assert.deepEqual(logic.filterWorks(groups, { hiddenAuthors }), []);
  assert.equal(logic.filterWorks(groups, { hiddenAuthors: [] }).length, 1);
  assert.equal(items.length, 2);
});

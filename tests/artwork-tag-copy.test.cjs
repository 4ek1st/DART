const test = require('node:test');
const assert = require('node:assert/strict');
const logic = require('../wwwroot/catalog-logic.js');

test('copy exports artist, copyright and characters before every remaining raw tag', () => {
  const item = { source: 'danbooru', creatorTag: 'popqn',
    copyrightTags: ['blue_archive'],
    characterTags: ['azusa_(blue_archive)', 'azusa_(racing)_(blue_archive)'],
    tags: ['1girl', 'armpits', 'arms_behind_head', 'wings', 'azusa_(blue_archive)',
      'azusa_(racing)_(blue_archive)', 'blue_archive', 'popqn', 'commentary_request', 'official_artist_extra'] };
  const original = structuredClone(item);
  assert.equal(logic.artworkTagText(item),
    'popqn, blue_archive, azusa_(blue_archive), azusa_(racing)_(blue_archive), 1girl, armpits, arms_behind_head, wings, commentary_request, official_artist_extra');
  assert.deepEqual(item, original, 'Copy must not rewrite source metadata');
});

test('copy includes collapsed and grouped tags once, with underscores and intact punctuation', () => {
  const item = { source: 'gelbooru', creatorTag: 'known_artist', artistId: 'upload_account',
    tags: ['#long hair', "artist's_note", 'goddess_of_victory:_nikke', 'long_hair'],
    allTags: ['long_hair', ...Array.from({ length: 55 }, (_, i) => `tag_${i}`), 'other/source'],
    copyrightTags: ['goddess of victory: nikke'], characterTags: ['character (series)'] };
  const text = logic.artworkTagText(item);
  const tags = text.split(', ');
  assert.equal(tags.length, 61);
  assert.equal(tags[0], 'known_artist');
  assert.equal(tags[1], 'goddess_of_victory:_nikke');
  assert.equal(tags[2], 'character_(series)');
  assert.equal(tags.filter(tag => tag === 'long_hair').length, 1);
  assert.ok(tags.includes('tag_54'));
  assert.ok(tags.includes("artist's_note"));
  assert.ok(tags.includes('other/source'));
  assert.ok(!text.includes('upload_account'));
  assert.ok(!text.includes('#'));
});

test('copy does not invent uploader, title, query or missing attribution as tags', () => {
  assert.equal(logic.artworkTagText({ source: 'sankaku', artist: 'Uploader display',
    artistId: 'uploader', uploaderName: 'Uploader display', title: 'Not a tag', tags: ['forest'] }), 'forest');
  assert.equal(logic.artworkTagText(null), '');
  assert.equal(logic.artworkTagText({ source: 'rule34', tags: [null, '', '  '] }), '');
});

test('Copy reads current full metadata when detail finishes while its menu is open', async () => {
  const fs = require('node:fs'), vm = require('node:vm');
  const source = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
  const begin = source.indexOf('async function copyArtworkTags(');
  const end = source.indexOf('function filteredRecommendationOtherTags(', begin);
  assert.ok(begin >= 0 && end > begin);
  const listing = { key: 'danbooru:1', source: 'danbooru', tags: ['listing_tag'] };
  const itemIndex = new Map([[listing.key, listing]]), copied = [];
  const copy = vm.runInNewContext(source.slice(begin, end) + '\ncopyArtworkTags', {
    CatalogLogic: logic, itemIndex, navigator: { clipboard: { async writeText(value) { copied.push(value); } } }, toast() {}
  });
  const menuContext = { item: listing };
  itemIndex.set(listing.key, { ...listing, creatorTag: 'known_artist', copyrightTags: ['series'],
    characterTags: ['character'], allTags: ['listing_tag', 'detail_only_tag'] });
  await copy(menuContext.item);
  assert.deepEqual(copied, ['known_artist, series, character, listing_tag, detail_only_tag']);
});

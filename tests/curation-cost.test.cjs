const test = require('node:test');
const assert = require('node:assert/strict');
const logic = require('../wwwroot/catalog-logic.js');
const resolution = { enabled: true, popularity: false, personal: false, freshness: false, resolution: true };

test('resolution curation inspects tag evidence once without sorting unrelated display tags', () => {
  let characterReads = 0;
  const item = { key: 'danbooru:1', source: 'danbooru', width: 3600, height: 3600,
    tags: Array.from({ length: 100 }, (_, i) => `tag_${i}`),
    get characterTags() { characterReads++; return ['character_b', 'character_a']; } };
  assert(logic.curationBoosts([item], resolution).get(item.key) > 1);
  assert(characterReads <= 2, `${characterReads} character scans for one resolution decision`);
});

test('resolution exemptions keep all four tag fields and exact canonical aliases', () => {
  for (const field of ['tags', 'allTags', 'characterTags', 'copyrightTags']) {
    for (const tag of ['pixel_art', 'pixel perfect', 'sketch', 'lineart', 'line_art', 'oekaki']) {
      const item = { key: 'danbooru:1', source: 'danbooru', width: 3600, height: 3600, [field]: [tag] };
      assert.equal(logic.curationBoosts([item], resolution).get(item.key), 1, `${field}: ${tag}`);
    }
  }
  const item = { key: 'danbooru:1', source: 'danbooru', width: 3600, height: 3600, tags: ['sketchbook', 'pixel_artist'] };
  assert(logic.curationBoosts([item], resolution).get(item.key) > 1);
  item.tags.push('SKETCH');
  assert.equal(logic.curationBoosts([item], resolution).get(item.key), 1, 'in-place metadata changes apply immediately');
});

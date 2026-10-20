const test = require('node:test');
const assert = require('node:assert/strict');
const logic = require('../wwwroot/catalog-logic.js');

const work = (source, id, extra = {}) => ({
  source, id: String(id), key: `${source}:${id}`, rating: 'g',
  images: [`https://fixture.test/${source}-${id}.png`], tags: ['landscape'], ...extra
});
const ordinaryRatings = ['g', 'general', 's', 'sensitive', 'safe', 'sfw'];

test('ordinary following retains every ordinary rating accepted by the catalog search', () => {
  const items = [...ordinaryRatings, 'q', 'e', 'unrated'].map((rating, index) =>
    work('danbooru', index + 1, { rating, published: '2026-10-20T12:00:00Z' }));
  const group = { follow: { source: 'danbooru', artistId: 'fixture_artist',
    followedAt: '2026-10-19T12:00:00Z' }, items };
  assert.deepEqual(logic.buildFollowFeed([group], 'explicit').items.map(item => item.rating), ['q', 'e']);
  assert.deepEqual(logic.buildFollowFeed([group], 'general').items.map(item => item.rating), ordinaryRatings);
  assert.deepEqual([...logic.groupFollowFeed([group], 'general').newKeys],
    ['danbooru:1', 'danbooru:2', 'danbooru:3', 'danbooru:4', 'danbooru:5', 'danbooru:6']);
});

test('ordinary recommendations retain Sensitive and legacy Safe works from source results', () => {
  const liked = [work('danbooru', 100)];
  const candidates = [...ordinaryRatings, 'q', 'e', 'unrated'].map((rating, index) =>
    work('danbooru', index + 1, { rating }));
  const explicit = logic.rankRecommendations(liked, candidates, 'explicit', 96, { landscape: 'priority' });
  assert.deepEqual(explicit.map(item => item.rating), ['q', 'e']);
  const ordinary = logic.rankRecommendations(liked, candidates, 'general', 96, { landscape: 'priority' });
  assert.deepEqual(ordinary.map(item => item.rating), ordinaryRatings);
});

test('ordinary rating aliases preserve the existing upload-batch grouping boundary', () => {
  for (const rating of ordinaryRatings) {
    const items = [1, 2].map(id => work('danbooru', id, { rating,
      creatorTag: 'fixture_artist', uploaderId: 'fixture_uploader',
      published: '2026-10-20T12:00:00Z', characterTags: ['fixture_character'],
      tags: Array.from({ length: 12 }, (_, index) => `fixture_detail_${index}`) }));
    assert.equal(logic.groupWorks(items).length, 1, rating);
    assert.equal(logic.groupWorks([items[0], { ...items[1], rating: 'e' }]).length, 2,
      'The ordinary and adult batches remain separate');
  }
});

test('a hidden uploader in an exact catalog mirror keeps the grouped work hidden', () => {
  for (const source of ['gelbooru', 'rule34', 'sankaku']) {
    const hiddenAuthors = [{ source, artistId: 'fixture_uploader' }];
    const preferred = work('danbooru', 1, { contentHash: 'a'.repeat(32) });
    const mirror = work(source, 2, { contentHash: 'a'.repeat(32),
      uploaderId: 'fixture_uploader', uploaderName: 'Fixture uploader' });
    assert.equal(logic.isWorkHidden(mirror, { hiddenAuthors }), true);
    assert.equal(logic.isWorkHidden(work('danbooru', 3, { uploaderId: 'fixture_uploader' }),
      { hiddenAuthors }), false, 'Uploader IDs stay scoped to their catalog');
    const grouped = JSON.parse(JSON.stringify(logic.groupWorks([preferred, mirror])));
    assert.equal(grouped.length, 1);
    assert.deepEqual(logic.filterWorks(grouped, { hiddenAuthors }), [], source);
    assert.equal(logic.filterWorks(grouped, { hiddenAuthors: [] }).length, 1);
  }
});

test('corrected nested uploader metadata is reflected by an already checked saved group', () => {
  const preferred = work('danbooru', 1, { contentHash: 'a'.repeat(32) });
  const mirror = work('sankaku', 2, { contentHash: 'a'.repeat(32), uploaderId: 'original_uploader' });
  const [grouped] = logic.groupWorks([preferred, mirror]);
  const hiddenAuthors = [{ source: 'sankaku', artistId: 'blocked_uploader' }];
  assert.equal(logic.filterWorks([grouped], { hiddenAuthors }).length, 1);
  grouped.groupMembers.find(member => member.source === 'sankaku').uploaderId = 'blocked_uploader';
  assert.deepEqual(logic.filterWorks([grouped], { hiddenAuthors }), []);
});

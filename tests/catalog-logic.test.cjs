const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeSearch, completeTag, pickRelatedAnchor, rankRelated,
  removeNavigationEntry, groupWorks, recommendationTags,
  recommendationTagGroups, orderRecommendationOtherTags, recommendationQueryGroups, mergeRecommendations,
  rankRecommendations, followKey, followFeedRequests, buildFollowFeed,
  artworkTags, artworkTagKind, mergeWorkMetadata } = require('../wwwroot/catalog-logic.js');

test('grouping preserves confirmed character names from every source', () => {
  const characters = ['cecilia_immergreen', 'gigi_murin', 'mori_calliope'];
  const [work] = groupWorks([
    { key: 'danbooru:1', source: 'danbooru', title: 'Работа #1',
      contentHash: 'a'.repeat(32), images: ['https://example.test/a.jpg'], characterTags: [] },
    { key: 'rule34:18783728', source: 'rule34', title: 'Работа #18783728',
      contentHash: 'a'.repeat(32), images: ['https://example.test/a.jpg'], characterTags: characters }
  ]);
  assert.deepEqual(work.characterTags, characters);
  assert.equal(work.title, 'cecilia immergreen, gigi murin, mori calliope');
});

test('a partial detail response cannot erase known names or grouped pages', () => {
  const { mergeDetailPages } = require('../wwwroot/catalog-logic.js');
  const characters = ['cecilia_immergreen', 'gigi_murin', 'mori_calliope'];
  const merged = mergeDetailPages({ key: 'rule34:18783728',
    title: 'cecilia immergreen, gigi murin, mori calliope',
    characterTags: characters, images: ['one.jpg', 'two.jpg'] },
  { key: 'rule34:18783728', title: 'Работа #18783728', characterTags: [], images: ['one.jpg'] });
  assert.deepEqual(merged.characterTags, characters);
  assert.equal(merged.title, 'cecilia immergreen, gigi murin, mori calliope');
  assert.deepEqual(merged.images, ['one.jpg', 'two.jpg']);
});

test('character tags and original precede search matches and remain unique', () => {
  const tags = artworkTags({ tags: ['1girl', 'latex', 'original', 'eris_greyrat',
    'eris_greyrat_(adult)', 'sex'], allTags: ['latex', 'original'],
    characterTags: ['eris_greyrat', 'eris_greyrat_(adult)'] }, 'latex');
  assert.deepEqual(tags, ['eris_greyrat', 'eris_greyrat_(adult)', 'original',
    'latex', '1girl', 'sex']);
});

test('a descriptive tag is not treated as a character without source metadata', () => {
  assert.deepEqual(artworkTags({ tags: ['sex', 'original', '1girl'],
    characterTags: [] }), ['original', 'sex', '1girl']);
});

test('confirmed copyright tags are purple category tags before ordinary content tags', () => {
  const item = { tags: ['1girl', 'goddess_of_victory:_nikke', 'original', 'riding'],
    copyrightTags: ['goddess_of_victory:_nikke'] };
  assert.equal(artworkTagKind(item, 'goddess_of_victory:_nikke'), 'copyright');
  assert.deepEqual(artworkTags(item, 'riding').slice(0, 2),
    ['goddess_of_victory:_nikke', 'original']);
  assert.equal(artworkTagKind({ tags: item.tags }, 'goddess_of_victory:_nikke'), '');
});

test('copyright categories survive grouped mirrors and partial detail refreshes', () => {
  const hash = 'b'.repeat(32);
  const [grouped] = groupWorks([
    { key: 'danbooru:1', source: 'danbooru', contentHash: hash,
      tags: ['goddess_of_victory:_nikke'], copyrightTags: [] },
    { key: 'sankaku:2', source: 'sankaku', contentHash: hash,
      tags: ['goddess_of_victory:_nikke'], copyrightTags: ['goddess_of_victory:_nikke'] }
  ]);
  assert.deepEqual(grouped.copyrightTags, ['goddess_of_victory:_nikke']);
  const refreshed = mergeWorkMetadata(grouped, { ...grouped, copyrightTags: [] });
  assert.deepEqual(refreshed.copyrightTags, ['goddess_of_victory:_nikke']);
});

test('linked Danbooru variants form one card even across result pages', () => {
  const results = groupWorks([
    { key: 'danbooru:12252787', groupKey: 'danbooru:parent:12252777',
      source: 'danbooru', rating: 'e', images: ['https://example.test/a.gif'] },
    { key: 'danbooru:999', groupKey: '', source: 'danbooru', images: ['https://example.test/c.jpg'] },
    { key: 'danbooru:12252786', groupKey: 'danbooru:parent:12252777',
      source: 'danbooru', rating: 'e', images: ['https://example.test/b.gif'] }
  ]);
  assert.equal(results.length, 2);
  assert.equal(results[0].groupCount, 2);
  assert.deepEqual(results[0].images, ['https://example.test/a.gif', 'https://example.test/b.gif']);
  assert.equal(results[1].key, 'danbooru:999');
});

test('a group containing questionable art keeps its adult rating', () => {
  const results = groupWorks([
    { key: 'danbooru:1', source: 'danbooru', groupKey: 'danbooru:pixiv:42',
      rating: 'g', images: ['https://example.test/a.jpg'] },
    { key: 'danbooru:2', source: 'danbooru', groupKey: 'danbooru:pixiv:42',
      rating: 'q', images: ['https://example.test/b.jpg'] }
  ]);
  assert.equal(results.length, 1);
  assert.equal(results[0].rating, 'q');
});

test('exact Danbooru and Gelbooru copies join an already linked variant set', () => {
  const imageHash = '1234567890abcdef1234567890abcdef';
  const results = groupWorks([
    { key: 'gelbooru:1', source: 'gelbooru', contentHash: imageHash,
      images: ['https://example.test/gel.jpg'] },
    { key: 'danbooru:2', source: 'danbooru', contentHash: imageHash,
      groupKey: 'danbooru:parent:1', images: ['https://example.test/dan.jpg'] },
    { key: 'danbooru:3', source: 'danbooru', contentHash: 'abcdefabcdefabcdefabcdefabcdefab',
      groupKey: 'danbooru:parent:1', images: ['https://example.test/variant.jpg'] },
    { key: 'danbooru:4', source: 'danbooru', contentHash: '44444444444444444444444444444444',
      images: ['https://example.test/other.jpg'] }
  ]);
  assert.equal(results.length, 2);
  assert.equal(results[0].key, 'danbooru:2');
  assert.deepEqual(results[0].images,
    ['https://example.test/dan.jpg', 'https://example.test/variant.jpg']);
  assert.equal(results[0].groupCount, 2);
  assert.equal(results[1].key, 'danbooru:4');
});

test('three booru copies consume one card and one page in a linked artwork', () => {
  const sameFile = '1234567890abcdef1234567890abcdef';
  const otherFile = 'abcdefabcdefabcdefabcdefabcdefab';
  const results = groupWorks([
    { key: 'rule34:10', source: 'rule34', contentHash: sameFile,
      groupKey: 'pixiv:1234', images: ['https://example.test/r34.jpg'] },
    { key: 'gelbooru:20', source: 'gelbooru', contentHash: sameFile,
      images: ['https://example.test/gel.jpg'] },
    { key: 'danbooru:30', source: 'danbooru', contentHash: sameFile,
      groupKey: 'pixiv:1234', images: ['https://example.test/dan.jpg'] },
    { key: 'rule34:11', source: 'rule34', contentHash: otherFile,
      groupKey: 'pixiv:1234', images: ['https://example.test/second.jpg'] }
  ]);
  assert.equal(results.length, 1);
  assert.equal(results[0].key, 'danbooru:30');
  assert.equal(results[0].groupCount, 2);
  assert.deepEqual(results[0].images,
    ['https://example.test/dan.jpg', 'https://example.test/second.jpg']);
  assert.deepEqual(new Set(results[0].memberKeys),
    new Set(['rule34:10', 'gelbooru:20', 'danbooru:30', 'rule34:11']));
});

test('Danbooru parent grouping also joins reencoded Pixiv copies from other boorus', () => {
  const results = groupWorks([
    { key: 'danbooru:1', source: 'danbooru', groupKey: 'danbooru:parent:1',
      pixivGroupKey: 'pixiv:777', contentHash: 'a'.repeat(32),
      images: ['https://example.test/dan.jpg'] },
    { key: 'danbooru:2', source: 'danbooru', groupKey: 'danbooru:parent:1',
      contentHash: 'b'.repeat(32), images: ['https://example.test/variant.jpg'] },
    { key: 'rule34:3', source: 'rule34', groupKey: 'pixiv:777',
      contentHash: 'c'.repeat(32), images: ['https://example.test/r34.jpg'] },
    { key: 'gelbooru:4', source: 'gelbooru', groupKey: 'pixiv:777',
      contentHash: 'd'.repeat(32), images: ['https://example.test/gel.jpg'] }
  ]);
  assert.equal(results.length, 1);
  assert.deepEqual(new Set(results[0].memberKeys),
    new Set(['danbooru:1', 'danbooru:2', 'rule34:3', 'gelbooru:4']));
});

test('Danbooru and Rule34 copies of one X post share a card and matching files use one page', () => {
  const sharedSource = 'https://x.com/fuji_ysd/status/2101930207880134692';
  const firstHash = 'd264bfcb4b8e96a8bf38bf97147b15e2';
  const secondHash = '36b96e8ae5f696c6c653d596062370fb';
  const works = groupWorks([
    { key: 'danbooru:12236781', source: 'danbooru', groupKey: 'danbooru:parent:12236757',
      originalUrl: sharedSource, contentHash: firstHash, images: ['https://example.test/d1.jpg'] },
    { key: 'danbooru:12236779', source: 'danbooru', groupKey: 'danbooru:parent:12236757',
      originalUrl: sharedSource, contentHash: secondHash, images: ['https://example.test/d2.jpg'] },
    { key: 'rule34:18855435', source: 'rule34', originalUrl: sharedSource,
      contentHash: firstHash, images: ['https://example.test/r1.jpg'] },
    { key: 'rule34:18855433', source: 'rule34', originalUrl: sharedSource,
      contentHash: secondHash, images: ['https://example.test/r2.jpg'] },
    { key: 'rule34:other', source: 'rule34',
      originalUrl: 'https://x.com/fuji_ysd/status/2101930054758584816',
      images: ['https://example.test/other.jpg'] }
  ]);
  assert.equal(works.length, 2);
  assert.equal(works[0].groupCount, 2);
  assert.deepEqual(works[0].images, ['https://example.test/d1.jpg', 'https://example.test/d2.jpg']);
  assert.deepEqual(new Set(works[0].memberKeys), new Set([
    'danbooru:12236781', 'danbooru:12236779',
    'rule34:18855435', 'rule34:18855433'
  ]));
});

test('one X publication links cross-source variants even when file hashes differ', () => {
  const works = groupWorks([
    { key: 'danbooru:1', source: 'danbooru',
      originalUrl: 'https://x.com/fuji_ysd/status/2101930207880134692',
      contentHash: 'a'.repeat(32), images: ['https://example.test/d.jpg'] },
    { key: 'rule34:2', source: 'rule34',
      originalUrl: 'https://twitter.com/other_name/status/2101930207880134692?s=20',
      images: ['https://example.test/r.jpg'] }
  ]);
  assert.equal(works.length, 1);
  assert.deepEqual(new Set(works[0].memberKeys),
    new Set(['danbooru:1', 'rule34:2']));
});

test('Pixiv CDN pages form one publication while different artwork IDs stay separate', () => {
  const prefix = 'https://i.pximg.net/img-original/img/2025/12/16/23/22/09/';
  const works = groupWorks([
    { key: 'gelbooru:14964513', source: 'gelbooru',
      originalUrl: prefix + '138685648-e538f050d756c05258ba31c9b063975b_p1.jpg',
      contentHash: 'a'.repeat(32), images: ['https://example.test/p1.jpg'] },
    { key: 'gelbooru:14964514', source: 'gelbooru',
      originalUrl: prefix + '138685648-e538f050d756c05258ba31c9b063975b_p0.jpg',
      contentHash: 'b'.repeat(32), images: ['https://example.test/p0.jpg'] },
    { key: 'gelbooru:unrelated', source: 'gelbooru',
      originalUrl: prefix + '138685649-e538f050d756c05258ba31c9b063975b_p0.jpg',
      images: ['https://example.test/other.jpg'] }
  ]);
  assert.equal(works.length, 2);
  assert.equal(works[0].groupCount, 2);
  assert.deepEqual(new Set(works[0].memberKeys),
    new Set(['gelbooru:14964513', 'gelbooru:14964514']));
});

test('generic artist profile links are not treated as publication identities', () => {
  const works = groupWorks([
    { key: 'rule34:1', source: 'rule34', originalUrl: 'https://x.com/fuji_ysd',
      images: ['https://example.test/one.jpg'] },
    { key: 'rule34:2', source: 'rule34', originalUrl: 'https://x.com/fuji_ysd',
      images: ['https://example.test/two.jpg'] }
  ]);
  assert.equal(works.length, 2);
});

test('nearby unlinked variants from one creator form one multi-page work in every feed', () => {
  const common = Array.from({ length: 22 }, (_, index) => `specific_tag_${index}`);
  const make = (id, seconds, extra) => ({
    key: `gelbooru:${id}`, source: 'gelbooru', id: String(id),
    creatorTag: 'sample_artist', uploaderId: 'same_uploader', rating: 'e',
    published: `2026-07-28T14:${seconds}:00Z`,
    tags: [...common, extra], contentHash: String(id).padStart(32, '0'),
    images: [`https://example.test/${id}.jpg`]
  });
  const works = groupWorks([
    make(181, '57', 'outfit_a'), make(180, '56', 'outfit_b'),
    make(177, '55', 'outfit_c'), make(175, '54', 'outfit_d')
  ]);
  assert.equal(works.length, 1);
  assert.equal(works[0].groupCount, 4);
  assert.deepEqual(new Set(works[0].memberKeys), new Set([
    'gelbooru:181', 'gelbooru:180', 'gelbooru:177', 'gelbooru:175'
  ]));
});

test('inferred series do not merge different creators, upload batches or known works', () => {
  const tags = Array.from({ length: 20 }, (_, index) => `specific_tag_${index}`);
  const base = { source: 'gelbooru', creatorTag: 'sample_artist',
    uploaderId: 'same_uploader', rating: 'g', tags,
    published: '2026-07-28T14:57:00Z' };
  const works = groupWorks([
    { ...base, key: 'gelbooru:100', id: '100', images: ['https://example.test/1.jpg'] },
    { ...base, key: 'gelbooru:99', id: '99', creatorTag: 'other_artist',
      images: ['https://example.test/2.jpg'] },
    { ...base, key: 'gelbooru:98', id: '98', uploaderId: 'other_uploader',
      images: ['https://example.test/3.jpg'] },
    { ...base, key: 'gelbooru:97', id: '97', published: '2026-07-27T14:57:00Z',
      images: ['https://example.test/4.jpg'] },
    { ...base, key: 'gelbooru:80', id: '80',
      images: ['https://example.test/5.jpg'] },
    { ...base, key: 'gelbooru:96', id: '96', groupKey: 'pixiv:123456',
      images: ['https://example.test/6.jpg'] },
    { ...base, key: 'gelbooru:95', id: '95', groupKey: 'pixiv:123457',
      images: ['https://example.test/7.jpg'] },
    { ...base, key: 'gelbooru:94', id: '94', creatorTag: '',
      images: ['https://example.test/8.jpg'] }
  ]);
  assert.equal(works.length, 8);
});

test('later pages extend an inferred group without chaining into a distant batch', () => {
  const make = id => ({ key: `gelbooru:${id}`, source: 'gelbooru', id: String(id),
    creatorTag: 'sample_artist', uploaderId: 'same_uploader', rating: 'g',
    published: '2026-07-28T14:57:00Z',
    tags: Array.from({ length: 20 }, (_, index) => `specific_tag_${index}`),
    images: [`https://example.test/${id}.jpg`] });
  const initial = groupWorks([make(181), make(180)]);
  const extended = groupWorks([...initial, make(177), make(175)]);
  assert.equal(extended.length, 1);
  assert.equal(extended[0].images.length, 4);
  assert.equal(groupWorks([...extended, make(167)]).length, 2);
  const newer = groupWorks([...extended, make(185)]);
  assert.equal(newer.length, 1);
  assert.equal(groupWorks([...newer, make(187)]).length, 1);
  assert.equal(groupWorks([...newer, make(188)]).length, 2);
});

test('related results do not spend their limit on copies from three boorus', () => {
  const hash = '1234567890abcdef1234567890abcdef';
  const selected = rankRelated({ key: 'danbooru:open', tags: ['latex', 'catsuit'] }, [
    { key: 'rule34:1', source: 'rule34', contentHash: hash, tags: ['latex'],
      images: ['https://example.test/r.jpg'] },
    { key: 'gelbooru:2', source: 'gelbooru', contentHash: hash, tags: ['latex'],
      images: ['https://example.test/g.jpg'] },
    { key: 'danbooru:3', source: 'danbooru', contentHash: hash, tags: ['latex'],
      images: ['https://example.test/d.jpg'] },
    { key: 'danbooru:4', source: 'danbooru', tags: ['catsuit'],
      images: ['https://example.test/other.jpg'] }
  ], 2);
  assert.deepEqual(selected.map(item => item.key), ['danbooru:3', 'danbooru:4']);
});

test('recommendations reserve slots for distinct works across boorus', () => {
  const hash = '1234567890abcdef1234567890abcdef';
  const liked = [{ key: 'danbooru:liked', source: 'danbooru', tags: ['latex'], rating: 'e' }];
  const result = rankRecommendations(liked, [
    { key: 'rule34:1', source: 'rule34', contentHash: hash,
      tags: ['latex'], rating: 'e', images: ['https://example.test/r.jpg'] },
    { key: 'gelbooru:2', source: 'gelbooru', contentHash: hash,
      tags: ['latex'], rating: 'e', images: ['https://example.test/g.jpg'] },
    { key: 'danbooru:3', source: 'danbooru', contentHash: hash,
      tags: ['latex'], rating: 'e', images: ['https://example.test/d.jpg'] },
    { key: 'danbooru:4', source: 'danbooru', tags: ['latex'], rating: 'e',
      images: ['https://example.test/other.jpg'] }
  ], 'explicit', 2);
  assert.deepEqual(result.map(item => item.key), ['danbooru:3', 'danbooru:4']);
});

test('closing an earlier tab keeps Back aligned with the current tab', () => {
  assert.deepEqual(removeNavigationEntry([1, 2, 3], 1, 1),
    { history: [2, 3], position: 0 });
});



test('a pasted hashtag list becomes searchable tags for every source', () => {
  assert.equal(normalizeSearch('  #Latex,  #catsuit   latex  '), 'latex catsuit');
});

test('choosing a suggestion completes the last tag without losing earlier tags', () => {
  assert.equal(completeTag('latex #cat', 'catsuit'), 'latex catsuit');
});

test('related search selects the artwork theme instead of generic tags', () => {
  assert.equal(pickRelatedAnchor({ title: 'latex suit', tags: ['1girl', 'original', 'catsuit', 'latex'] }), 'latex');
});

test('related works admit partial tag overlap and rank stronger matches first', () => {
  const artwork = { key: 'danbooru:1', source: 'danbooru', artistId: 'a',
    rating: 'g', tags: ['latex', 'catsuit', '1girl'] };
  const candidates = [
    { key: 'danbooru:1', source: 'danbooru', artistId: 'a', rating: 'g', tags: ['latex', 'catsuit'] },
    { key: 'danbooru:2', source: 'danbooru', artistId: 'b', rating: 'g', tags: ['latex'] },
    { key: 'gelbooru:3', source: 'gelbooru', artistId: 'c', rating: 'general', tags: ['latex', 'catsuit'] },
    { key: 'danbooru:4', source: 'danbooru', artistId: 'd', rating: 'g', tags: ['1girl', 'original'] }
  ];
  assert.deepEqual(rankRelated(artwork, candidates).map(item => item.key), ['gelbooru:3', 'danbooru:2']);
});

test('related works show other artists ahead of near duplicates from the same creator', () => {
  const artwork = { key: 'gelbooru:a:1', source: 'gelbooru', artistId: 'a',
    rating: 'unrated', tags: ['latex', 'catsuit'] };
  const candidates = [
    { key: 'gelbooru:a:2', source: 'gelbooru', artistId: 'a', tags: ['latex', 'catsuit'] },
    { key: 'gelbooru:a:3', source: 'gelbooru', artistId: 'a', tags: ['latex', 'catsuit'] },
    { key: 'danbooru:b:4', source: 'danbooru', artistId: 'b', tags: ['latex'] },
    { key: 'gelbooru:c:5', source: 'gelbooru', artistId: 'c', tags: ['latex'] }
  ];
  assert.deepEqual(rankRelated(artwork, candidates, 3).map(item => item.key),
    ['danbooru:b:4', 'gelbooru:c:5', 'gelbooru:a:2']);
});

test('related works exclude other variants of the open illustration', () => {
  const artwork = { key: 'danbooru:1', source: 'danbooru',
    groupKey: 'danbooru:parent:1', contentHash: '1234567890abcdef1234567890abcdef',
    tags: ['latex', 'catsuit'] };
  const candidates = [
    { key: 'danbooru:2', source: 'danbooru', groupKey: artwork.groupKey,
      tags: ['latex', 'catsuit'] },
    { key: 'gelbooru:3', source: 'gelbooru', contentHash: artwork.contentHash,
      tags: ['latex', 'catsuit'] },
    { key: 'danbooru:4', source: 'danbooru', tags: ['latex', 'catsuit'] }
  ];
  assert.deepEqual(rankRelated(artwork, candidates).map(item => item.key), ['danbooru:4']);
});

test('recommendations learn recurring specific tags from liked images', () => {
  assert.equal(typeof recommendationTags, 'function');
  const liked = [
    { key: 'd:1', tags: ['1girl', 'latex', 'catsuit', 'latex'] },
    { key: 'd:2', tags: ['solo', 'latex', 'boots'] },
    { key: 'k:3', tags: ['sfw', 'catsuit', 'latex'] }
  ];
  assert.deepEqual(recommendationTags(liked, 3), [
    { tag: 'latex', count: 3 }, { tag: 'catsuit', count: 2 },
    { tag: 'boots', count: 1 }
  ]);
});

test('recommendation tag groups keep recurring character names apart from content tags', () => {
  const liked = [
    { key: 'danbooru:1', source: 'danbooru', title: 'holo',
      tags: ['1girl', 'holo', 'group_sex', 'cum', 'one_off_detail'] },
    { key: 'danbooru:2', source: 'danbooru', title: 'holo',
      tags: ['holo', 'group_sex', 'cum'] },
    { key: 'gelbooru:3', source: 'gelbooru', title: 'Group Sex',
      tags: ['group_sex'] }
  ];
  assert.deepEqual(recommendationTagGroups(liked), {
    names: [{ tag: 'holo', count: 2 }],
    copyright: [],
    other: [{ tag: 'group sex', count: 3 }, { tag: 'cum', count: 2 }]
  });
});

test('Other shows priority tags, then disabled tags, before ordinary frequent tags', () => {
  const tags = [{ tag: 'ordinary', count: 90 }, { tag: 'off', count: 3 },
    { tag: 'favorite', count: 2 }, { tag: 'ordinary two', count: 40 },
    { tag: 'favorite two', count: 1 }];
  const preferences = { favorite: 'priority', 'favorite two': 'priority', off: 'disabled' };
  assert.deepEqual(orderRecommendationOtherTags(tags, preferences).map(item => item.tag),
    ['favorite', 'favorite two', 'off', 'ordinary', 'ordinary two']);
  assert.equal(tags[0].tag, 'ordinary');
});

test('recommendation searches include content tags and honor disabled and priority choices', () => {
  const liked = [
    { key: 'd:1', source: 'danbooru', title: 'holo', relatedQuery: 'holo',
      tags: ['holo', 'breasts', 'sex', 'cum', 'group_sex'] },
    { key: 'd:2', source: 'danbooru', title: 'holo', relatedQuery: 'holo',
      tags: ['holo', 'breasts', 'sex', 'cum', 'group_sex'] },
    { key: 'd:3', source: 'danbooru', title: 'roxy', relatedQuery: 'roxy',
      tags: ['roxy', 'breasts', 'sex', 'cum'] },
    { key: 'd:4', source: 'danbooru', title: 'roxy', relatedQuery: 'roxy',
      tags: ['roxy', 'breasts', 'sex'] }
  ];
  const groups = recommendationQueryGroups(liked, { holo: 'disabled', cum: 'priority' });
  assert.deepEqual(groups.priority.map(entry => entry.tag), ['cum']);
  assert.deepEqual(groups.names.map(entry => entry.tag), []);
  assert.deepEqual(groups.other.map(entry => entry.tag), ['group sex']);
  const forced = recommendationQueryGroups(liked, { sex: 'priority' });
  assert.ok(forced.priority.some(entry => entry.tag === 'sex'));
  assert.deepEqual(recommendationQueryGroups(liked, { roxy: 'priority' })
    .priority.map(entry => entry.tag), ['roxy']);
});

test('priority content can lead recommendations and disabled tags add no score', () => {
  const liked = [
    { key: 'd:1', title: 'holo', relatedQuery: 'holo', tags: ['holo', 'cum'] },
    { key: 'd:2', title: 'holo', relatedQuery: 'holo', tags: ['holo', 'cum'] }
  ];
  const candidates = [
    { key: 'd:name', rating: 'e', tags: ['holo'] },
    { key: 'd:content', rating: 'e', tags: ['cum'] }
  ];
  assert.deepEqual(rankRecommendations(liked, candidates, 'explicit', 20,
    { cum: 'priority' }).map(item => item.key), ['d:content', 'd:name']);
  assert.deepEqual(rankRecommendations(liked, candidates, 'explicit', 20,
    { cum: 'priority' }, 12345).map(item => item.key), ['d:content', 'd:name']);
  assert.deepEqual(rankRecommendations(liked, candidates, 'explicit', 20,
    { holo: 'disabled' }).map(item => item.key), ['d:content']);
  assert.deepEqual(rankRecommendations(liked,
    [...candidates, { key: 'd:mixed', rating: 'e', tags: ['holo', 'cum'] }],
    'explicit', 20, { holo: 'disabled' }).map(item => item.key), ['d:content']);
  const likedWithSex = liked.map(item => ({ ...item, tags: [...item.tags, 'sex'] }));
  const sexCandidate = { key: 'd:sex', rating: 'e', tags: ['sex'] };
  assert.equal(rankRecommendations(likedWithSex, [...candidates, sexCandidate],
    'explicit').some(item => item.key === 'd:sex'), false);
  assert.equal(rankRecommendations(likedWithSex, [...candidates, sexCandidate],
    'explicit', 20, { sex: 'priority' })[0].key, 'd:sex');
});

test('a recurring distinctive tag beats several one-off details without a hard percentage cutoff', () => {
  const liked = Array.from({ length: 10 }, (_, index) => ({
    key: `liked:${index}`, tags: [
      ...(index < 2 ? ['latex'] : []),
      ...(index === 2 ? ['odd_gloves'] : []),
      ...(index === 3 ? ['odd_boots'] : []),
      ...(index === 4 ? ['odd_hat'] : [])
    ]
  }));
  const candidates = [
    { key: 'detail-mix', rating: 'g', tags: ['odd_gloves', 'odd_boots', 'odd_hat'] },
    { key: 'recurring', rating: 'g', tags: ['latex'] }
  ];
  assert.deepEqual(rankRecommendations(liked, candidates).map(item => item.key),
    ['recurring', 'detail-mix']);
});

test('incidental body and count tags cannot become recommendation anchors without priority', () => {
  const liked = Array.from({ length: 10 }, (_, index) => ({
    key: `liked:${index}`, tags: [
      ...(index < 3 ? ['anus', 'large_breasts', '1girls', '2boys'] : []),
      ...(index < 2 ? ['latex'] : [])
    ]
  }));
  const normal = recommendationQueryGroups(liked);
  assert.deepEqual(normal.other.map(({ tag }) => tag), ['latex']);
  assert.deepEqual(normal.names, []);
  assert.deepEqual(rankRecommendations(liked, [
    { key: 'body-only', rating: 'g', tags: ['anus', 'large_breasts', '1girls', '2boys'] },
    { key: 'specific', rating: 'g', tags: ['latex'] }
  ]).map(item => item.key), ['specific']);
  const prioritized = recommendationQueryGroups(liked, { anus: 'priority' });
  assert.equal(prioritized.priority[0].tag, 'anus');
  assert.equal(rankRecommendations(liked, [
    { key: 'body-only', rating: 'g', tags: ['anus'] },
    { key: 'specific', rating: 'g', tags: ['latex'] }
  ], 'general', 20, { anus: 'priority' })[0].key, 'body-only');
});

test('two likes of one character keep its chip but do not make it a search stream', () => {
  const liked = Array.from({ length: 10 }, (_, index) => ({
    key: `danbooru:${index}`, source: 'danbooru',
    title: index < 2 ? 'holo' : `Work ${index}`,
    tags: [index < 2 ? 'holo' : `character_${index}`, 'latex']
  }));
  assert.deepEqual(recommendationTagGroups(liked).names, [{ tag: 'holo', count: 2 }]);
  assert.deepEqual(recommendationQueryGroups(liked).names, []);
  assert.deepEqual(recommendationQueryGroups(liked, { holo: 'priority' })
    .priority.map(({ tag }) => tag), ['holo']);
});

test('a repeated character yields places to other characters and content', () => {
  const liked = [
    ...Array.from({ length: 7 }, (_, index) => ({
      key: `liked:holo:${index}`, source: 'danbooru', title: 'holo',
      tags: ['holo', ...(index < 4 ? ['group_sex'] : [])]
    })),
    { key: 'liked:other', tags: ['latex'] }
  ];
  const candidates = [
    ...Array.from({ length: 8 }, (_, index) => ({
      key: `work:holo:${index}`, source: 'danbooru', rating: 'e', tags: ['holo']
    })),
    ...Array.from({ length: 4 }, (_, index) => ({
      key: `work:content:${index}`, source: 'rule34', rating: 'e',
      tags: ['group_sex']
    }))
  ];
  const result = rankRecommendations(liked, candidates, 'explicit');
  assert.equal(result.length, 12);
  assert.ok(result.slice(0, 6).filter(item => item.key.startsWith('work:content')).length >= 3);
});

test('a very frequent distinctive content tag stays ahead of rarer content tags', () => {
  const liked = Array.from({ length: 10 }, (_, index) => ({
    key: `liked:${index}`, tags: [
      ...(index < 8 ? ['group_sex'] : []),
      ...(index < 3 ? ['latex'] : [])
    ]
  }));
  assert.deepEqual(recommendationQueryGroups(liked).other.map(({ tag }) => tag),
    ['group sex', 'latex']);
});

test('new recommendation pages keep old cards and mix name and content results beyond 120', () => {
  const hash = '1234567890abcdef1234567890abcdef';
  const liked = [{ key: 'd:saved', title: 'holo', relatedQuery: 'holo',
    tags: ['holo', 'cum'] }];
  const existing = [{ key: 'd:old', source: 'danbooru', rating: 'e',
    contentHash: hash, tags: ['holo'] }];
  const names = [{ key: 'g:copy', source: 'gelbooru', rating: 'e',
    contentHash: hash, tags: ['holo'] },
    ...Array.from({ length: 65 }, (_, index) => ({ key: `d:name${index}`,
      source: 'danbooru', rating: 'e', tags: ['holo'] }))];
  const other = Array.from({ length: 65 }, (_, index) => ({ key: `d:content${index}`,
    source: 'danbooru', rating: 'e', tags: ['cum'] }));
  const result = mergeRecommendations(liked, existing, [
    { kind: 'names', items: names }, { kind: 'other', items: other }
  ], 'explicit');
  assert.equal(result.length, 131);
  assert.equal(result[0].key, 'd:old');
  assert.equal(result[1].key, 'd:content0');
  assert.ok(result.some(item => item.key === 'd:name0'));
  assert.ok(result.some(item => item.key === 'd:content64'));
  assert.equal(result.some(item => item.key === 'g:copy'), false);
});

test('a single liked work starts with its subject instead of metadata tags', () => {
  const liked = [{ key: 'danbooru:1', title: 'rumia', relatedQuery: 'rumia',
    tags: ['1girl', 'alt_text', 'ascot', 'black_vest', 'rumia', 'touhou'] }];
  assert.deepEqual(recommendationTags(liked, 2),
    [{ tag: 'rumia', count: 1 }, { tag: 'ascot', count: 1 }]);
});

function likesWithUbiquitousTags() {
  return Array.from({ length: 40 }, (_, index) => {
    const subject = index < 5 ? 'north_star' :
      index < 9 ? 'silver_moon' : `other_subject_${index}`;
    return { key: `d:${index}`, title: subject, relatedQuery: subject,
      tags: ['long_hair', 'looking_at_viewer', 'red_eyes', 'blush', subject] };
  });
}

test('recurring subjects lead recommendation searches ahead of ubiquitous appearance tags', () => {
  assert.deepEqual(recommendationTags(likesWithUbiquitousTags(), 2), [
    { tag: 'north star', count: 5 }, { tag: 'silver moon', count: 4 }
  ]);
});

test('a subject match remains relevant while broad shared tags alone do not', () => {
  const candidates = [
    { key: 'd:broad', rating: 'g', tags: [
      'long_hair', 'looking_at_viewer', 'red_eyes', 'blush'] },
    { key: 'd:subject', rating: 'g', tags: ['north_star'] }
  ];
  assert.deepEqual(rankRecommendations(likesWithUbiquitousTags(), candidates)
    .map(item => item.key), ['d:subject']);
});

test('recommendations prefer shared liked tags and exclude saved and wrong-rating works', () => {
  assert.equal(typeof rankRecommendations, 'function');
  const liked = [{ key: 'd:saved', tags: ['latex', 'catsuit'] },
    { key: 'k:saved', tags: ['latex', 'boots'] }];
  const candidates = [
    { key: 'd:saved', rating: 'g', tags: ['latex', 'catsuit'] },
    { key: 'd:boots', rating: 'g', tags: ['boots'] },
    { key: 'd:both', rating: 'g', tags: ['latex', 'catsuit'] },
    { key: 'd:generic', rating: 'g', tags: ['1girl', 'solo'] },
    { key: 'd:adult', rating: 'e', tags: ['latex', 'catsuit'] },
    { key: 'd:both', rating: 'g', tags: ['latex', 'catsuit'] }
  ];
  assert.deepEqual(rankRecommendations(liked, candidates, 'general').map(item => item.key),
    ['d:both', 'd:boots']);
  assert.deepEqual(rankRecommendations(liked, candidates, 'all').map(item => item.key),
    ['d:both', 'd:adult', 'd:boots']);
});

test('a fresh recommendation seed varies equally relevant works without losing matches', () => {
  const liked = [{ key: 'saved', source: 'danbooru', title: 'holo',
    tags: ['holo'], rating: 'g' }];
  const candidates = Array.from({ length: 16 }, (_, index) => ({
    key: `work:${index}`, source: 'danbooru', title: `work ${index}`,
    tags: ['holo'], rating: 'g' }));
  const first = rankRecommendations(liked, candidates, 'general', 16, {}, 101)
    .map(item => item.key);
  const again = rankRecommendations(liked, candidates, 'general', 16, {}, 101)
    .map(item => item.key);
  const next = rankRecommendations(liked, candidates, 'general', 16, {}, 202)
    .map(item => item.key);
  assert.deepEqual(first, again);
  assert.notDeepEqual(first, next);
  assert.deepEqual(new Set(first), new Set(candidates.map(item => item.key)));
});

test('a followed creator is identified by catalog and artist identifier', () => {
  assert.equal(followKey({ source: 'danbooru', artistId: 'Artist_One' }), 'danbooru::artist_one');
  assert.notEqual(followKey({ source: 'gelbooru', artistId: '42' }),
    followKey({ source: 'rule34', artistId: '42' }));
});

test('one artist subscription searches both Danbooru and the matching Gelbooru tag', () => {
  const follow = { source: 'danbooru', artistId: 'sample_artist',
    service: '', name: 'Sample Artist' };
  assert.deepEqual(followFeedRequests(follow, 'explicit', true), [
    { source: 'danbooru', path: '/api/profile?source=danbooru&artist=sample_artist&rating=explicit&page=0' },
    { source: 'gelbooru', path: '/api/search?q=sample_artist&page=0&sources=gelbooru&rating=explicit&sort=recent&kind=illustrations' }
  ]);
  assert.deepEqual(followFeedRequests(follow, 'general', false).map(request => request.source),
    ['danbooru']);
  assert.deepEqual(followFeedRequests(follow, 'explicit', true, false, 2), [
    { source: 'danbooru', path: '/api/profile?source=danbooru&artist=sample_artist&rating=explicit&page=2' },
    { source: 'gelbooru', path: '/api/search?q=sample_artist&page=2&sources=gelbooru&rating=explicit&sort=recent&kind=illustrations' }
  ]);
  assert.deepEqual(followFeedRequests(follow, 'explicit', true, true, 2)
    .map(request => request.source), ['danbooru', 'gelbooru', 'rule34']);
});

test('a long follow feed can retain works beyond the initial 120 when paging', () => {
  const follow = { source: 'danbooru', artistId: 'artist', followedAt: '2026-01-01T00:00:00Z' };
  const items = Array.from({ length: 150 }, (_, index) => ({
    key: `danbooru:${index}`, source: 'danbooru', rating: 'e',
    published: new Date(Date.UTC(2026, 0, 2, 0, index)).toISOString()
  }));
  assert.equal(buildFollowFeed([{ follow, items }], 'explicit', Number.MAX_SAFE_INTEGER).items.length, 150);
});

test('an alternate Gelbooru artist tag is used without following the uploader', () => {
  const artist = { source: 'danbooru', artistId: 'sample_artist',
    gelbooruTag: 'sample_artist_(circle)', service: '' };
  const uploader = { source: 'gelbooru', artistId: 'uploader_name', service: '' };
  assert.equal(followFeedRequests(artist, 'all', true)[1].path,
    '/api/search?q=sample_artist_%28circle%29&page=0&sources=gelbooru&rating=all&sort=recent&kind=illustrations');
  assert.deepEqual(followFeedRequests(uploader, 'all', true).map(request => request.source),
    ['gelbooru']);
});

test('follow feed sorts newest works and marks only unseen work in the active rating', () => {
  assert.equal(typeof buildFollowFeed, 'function');
  const groups = [
    { follow: { source: 'danbooru', artistId: 'a', followedAt: '2026-01-01T00:00:00Z',
        seenAt: { general: '2026-01-10T00:00:00Z' } }, items: [
      { key: 'd:new', rating: 'g', published: '2026-01-11T00:00:00Z' },
      { key: 'd:old', rating: 'g', published: '2026-01-09T00:00:00Z' },
      { key: 'd:adult', rating: 'e', published: '2026-01-12T00:00:00Z' }
    ] },
    { follow: { source: 'gelbooru', artistId: 'b',
        followedAt: '2026-01-01T00:00:00Z', seenAt: {} }, items: [
      { key: 'k:unrated', rating: 'unrated', published: '2026-01-13T00:00:00Z' },
      { key: 'k:general', rating: 'general', published: '2026-01-08T00:00:00Z' }
    ] }
  ];
  const general = buildFollowFeed(groups, 'general');
  assert.deepEqual(general.items.map(item => item.key), ['d:new', 'k:general', 'd:old']);
  assert.deepEqual([...general.newKeys], ['d:new', 'k:general']);
  const all = buildFollowFeed(groups, 'all');
  assert.deepEqual(all.items.map(item => item.key),
    ['k:unrated', 'd:adult', 'd:new', 'd:old', 'k:general']);
});

test('incremental feed preserves displayed order and keeps newly found works first', () => {
  const old = [{ key: 'danbooru:old', memberKeys: ['danbooru:old'] },
    { key: 'sankaku:copy', memberKeys: ['sankaku:copy'] }];
  const next = [{ key: 'danbooru:new', memberKeys: ['danbooru:new'] },
    { key: 'danbooru:copy', memberKeys: ['danbooru:copy', 'sankaku:copy'] },
    old[0]];
  const result = require('../wwwroot/catalog-logic.js').stableFeedItems(old, next,
    new Set(['danbooru:new']));
  assert.deepEqual(result.map(item => item.key),
    ['danbooru:new', 'danbooru:old', 'danbooru:copy']);
});

test('viewed work keys do not hide older unseen works or another rating', () => {
  const follow = { followedAt: '2026-01-01T00:00:00Z',
    seenAt: { general: '2026-01-01T00:00:00Z', all: '2026-01-01T00:00:00Z' },
    seenKeys: { general: ['d:newest'] } };
  const items = [
    { key: 'd:newest', rating: 'g', published: '2026-01-20T00:00:00Z' },
    { key: 'd:older-unseen', rating: 'g', published: '2026-01-10T00:00:00Z' }
  ];
  assert.deepEqual([...buildFollowFeed([{ follow, items }], 'general').newKeys],
    ['d:older-unseen']);
  assert.deepEqual([...buildFollowFeed([{ follow, items }], 'all').newKeys],
    ['d:newest', 'd:older-unseen']);
});

test('grouping keeps member keys so a new variant marks its card', () => {
  const works = groupWorks([
    { key: 'danbooru:old', source: 'danbooru', groupKey: 'series:1',
      images: ['https://example.test/old.jpg'] },
    { key: 'danbooru:new', source: 'danbooru', groupKey: 'series:1',
      images: ['https://example.test/new.jpg'] }
  ]);
  assert.deepEqual(works[0].memberKeys, ['danbooru:old', 'danbooru:new']);
});

test('recommendations exclude a cross-source copy linked through another variant', () => {
  const liked = [{ key: 'danbooru:saved', source: 'danbooru', rating: 'g',
    groupKey: 'parent:42', contentHash: 'a'.repeat(32), tags: ['catsuit'] }];
  const candidates = [
    { key: 'danbooru:variant', source: 'danbooru', rating: 'g',
      groupKey: 'parent:42', contentHash: 'b'.repeat(32), tags: ['catsuit'] },
    { key: 'gelbooru:copy', source: 'gelbooru', rating: 'g',
      contentHash: 'b'.repeat(32), tags: ['catsuit'] },
    { key: 'danbooru:other', source: 'danbooru', rating: 'g', tags: ['catsuit'] }
  ];
  assert.deepEqual(rankRecommendations(liked, candidates).map(item => item.key),
    ['danbooru:other']);
});

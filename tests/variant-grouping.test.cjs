const test = require('node:test');
const assert = require('node:assert/strict');
const logic = require('../wwwroot/catalog-logic.js');
const fixture = require('./fixtures/reported-variant-groups.json');
const copy = name => structuredClone(fixture[name]);

test('a child joins its parent even when has_children was absent, across all catalogs and pages', () => {
  for (const source of logic.supportedSources) {
    const make = (id, parent) => ({ source, id, key: `${source}:${id}`,
      groupKey: parent ? `${source}:parent:${parent}` : '', images: [`https://example.test/${id}.jpg`] });
    const children = logic.groupWorks([make('child', 'parent'), make('grandchild', 'child')]);
    const [work, unrelated] = logic.groupWorks([...children, make('parent'), make('other')]);
    assert.equal(work.memberKeys.length, 3, source);
    assert.equal(work.images.length, 3);
    assert.equal(unrelated.key, `${source}:other`);
  }
});

test('the reported Rule34 parent relation combines both differently framed scene images', () => {
  const works = logic.groupWorks(copy('zaidcos'));
  assert.equal(works.length, 1);
  assert.equal(works[0].images.length, 2);
});

test('Discord attachment identity joins reencoded mirrors and preserves distinct attachment pages', () => {
  const items = copy('veka');
  items[2].originalUrl = items[2].originalUrl.replace('cdn.discordapp.com', 'media.discordapp.net') + '?ex=updated&amp;hm=new';
  const works = logic.groupWorks(items);
  assert.equal(works.length, 2);
  assert.equal(works[0].memberKeys.length, 6);
  assert.deepEqual(new Set(logic.workSources(works[0]).map(x => x.source)), new Set(['danbooru', 'gelbooru', 'rule34']));
  const different = { ...items[2], key: 'rule34:separate', groupKey: '', contentHash: '',
    visualHash: '', visualSamples: [], originalUrl: items[2].originalUrl.replace('1550829244970704996', '1550829244970704997') };
  assert.equal(logic.groupWorks([items[2], different]).length, 2);
});

test('two complementary fingerprints join the reported outfit variants and retain all images', () => {
  const items = copy('nekroz7');
  assert.equal(logic.groupWorks(items).length, 1);
  const first = JSON.parse(JSON.stringify(logic.groupWorks(items.slice(0, 1))));
  const [work] = logic.groupWorks([...first, ...items.slice(1)]);
  assert.equal(work.memberKeys.length, 3);
  assert.equal(work.images.length, 3);
});

test('confirmed creator evidence works across uploaders and catalogs', () => {
  for (const source of logic.supportedSources) {
    const [base, variant] = copy('nekroz7');
    variant.source = source; variant.key = `${source}:variant`; variant.id = 'variant';
    variant.artistId = variant.uploaderId = 'different_uploader';
    assert.equal(logic.groupWorks([base, variant]).length, 1, source);
  }
});

test('one weak fingerprint, conflicting artists, characters or publications cannot merge variants', () => {
  for (const patch of [
    { visualPHash: '0'.repeat(16) },
    { visualPHash: '' },
    { visualAspectRatio: 2 },
    { creatorTag: 'another_artist', participants: [{ tag: 'another_artist', role: 'artist' }] },
    { characterTags: ['unrelated_character'] },
    { originalUrl: 'https://x.com/artist/status/999999999999' },
    { tags: ['1girl', 'solo', 'blue_eyes'] }
  ]) {
    const [base, variant] = copy('nekroz7');
    Object.assign(variant, patch);
    assert.equal(logic.groupWorks([base, variant]).length, 2, JSON.stringify(patch));
  }
});

test('a confirmed short Sankaku scene batch shares one card and retains its distinct frames', () => {
  const items = copy('dera');
  const works = logic.groupWorks(items);
  assert.equal(works.length, 18);
  const scene = works.find(item => item.memberKeys.includes(items[0].key));
  assert.equal(scene.memberKeys.length, 2);
  assert.equal(scene.images.length, 2);
  const restored = JSON.parse(JSON.stringify(logic.groupWorks(items.slice(0, 1))));
  assert.equal(logic.groupWorks([...restored, items[1]])[0].images.length, 2);
});

test('scene grouping requires reliable author, uploader, character, time and dense tag evidence', () => {
  for (const patch of [
    { uploaderId: 'another_uploader' },
    { uploaderId: 'anonymous' },
    { published: '2025-09-28T10:22:15+02:00' },
    { characterTags: ['hataya_misuzu', 'another_character'] },
    { tags: ['hataya_misuzu', 'kaya_rinha', 'monochrome'] },
    { creatorTag: '', participants: [] }
  ]) {
    const [base, second] = copy('dera');
    Object.assign(second, patch);
    assert.equal(logic.groupWorks([base, second]).length, 2, JSON.stringify(patch));
  }
  const [base, second] = copy('dera');
  base.originalUrl = 'https://x.com/artist/status/1234567';
  second.originalUrl = 'https://x.com/artist/status/7654321';
  assert.equal(logic.groupWorks([base, second]).length, 2);
});

test('scene batches use a total time bound and cannot chain across later pages', () => {
  const [first, second] = copy('dera');
  const later = { ...first, key: 'sankaku:later', id: 'later', contentHash: '', visualHash: '',
    visualSamples: [{ hash: '8888888888888888', creator: 'dera self', owner: 'creator:dera self',
      source: 'sankaku', tags: first.tags, characters: first.characterTags,
      uploader: first.uploaderId.toLowerCase(), published: '2026-09-28T10:22:59+02:00',
      perceptualHash: '7777777777777777', aspectRatio: 3 }],
    published: '2026-09-28T10:22:59+02:00', images: ['https://example.test/later.jpg'] };
  const group = logic.groupWorks([first, second]);
  assert.equal(logic.groupWorks([...JSON.parse(JSON.stringify(group)), later]).length, 1);
  const distant = { ...later, key: 'sankaku:distant', id: 'distant',
    visualSamples: [{ ...later.visualSamples[0], hash: 'f0f0f0f0f0f0f0f0',
      perceptualHash: 'a5a5a5a5a5a5a5a5', published: '2026-09-28T10:23:20+02:00' }],
    images: ['https://example.test/distant.jpg'] };
  assert.equal(logic.groupWorks([...logic.groupWorks([...group, later]), distant]).length, 2);
});

test('single-character scene batches require very close tags in all four catalogs', () => {
  for (const source of logic.supportedSources) {
    const [first, second] = copy('dera');
    for (const item of [first, second]) {
      item.source = source; item.key = `${source}:${item.id}`;
      item.characterTags = ['hataya_misuzu'];
    }
    // Sharing one character and only broadly similar tags is insufficient.
    assert.equal(logic.groupWorks([first, second]).length, 2, source);
    second.tags = [...first.tags, 'alternate_frame'];
    const works = logic.groupWorks([first, second]);
    assert.equal(works.length, 1, source);
    assert.equal(works[0].images.length, 2);
  }
});

test('neighboring numeric upload IDs cannot join different known characters', () => {
  for (const source of logic.supportedSources) {
    const [first, second] = copy('dera');
    for (const [index, item] of [first, second].entries()) {
      item.source = source; item.id = String(1000 + index); item.key = `${source}:${item.id}`;
      item.characterTags = [index ? 'another_character' : 'hataya_misuzu'];
      item.tags = [...first.tags];
    }
    assert.equal(logic.groupWorks([first, second]).length, 2, source);
  }
});

test('saved creator evidence cannot masquerade as a missing uploader or precise upload time', () => {
  for (const patch of [{ uploaderId: '', artistId: '' }, { published: '2026-09-28' }]) {
    const [first, second] = copy('dera');
    Object.assign(first, patch); Object.assign(second, patch);
    const saved = [...logic.groupWorks([first]), ...logic.groupWorks([second])];
    for (const item of saved) item.visualHash = '';
    assert.equal(logic.groupWorks(JSON.parse(JSON.stringify(saved))).length, 2,
      JSON.stringify(patch));
  }
});

test('overlapping saved groups and fresh page results cannot split into duplicate cards', () => {
  const items = copy('veka');
  const oldGroup = logic.groupWorks(items.slice(0, 2))[0];
  const duplicate = { ...oldGroup, key: items[1].key, source: items[1].source,
    groupKey: '', identityKeys: [], contentHash: '', originalUrl: '' };
  assert.equal(logic.groupWorks([oldGroup, duplicate]).length, 1);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const logic = require('../wwwroot/catalog-logic.js');

const work = (source, id, images, extra = {}) => ({
  source, id: String(id), key: `${source}:${id}`, images, ...extra
});

test('catalog and incremental feeds show one card for the same full file without an MD5', () => {
  const url = 'https://media.example.test/artwork.png';
  const first = work('danbooru', 1, [url]);
  const mirror = work('gelbooru', 2, [url]);
  const distinct = work('rule34', 3, ['https://media.example.test/other.png']);
  for (const items of [logic.groupWorks([first, mirror, distinct]),
    logic.mergeGroupedWorks(logic.groupWorks([first, distinct]), [mirror])]) {
    assert.equal(items.length, 2);
    assert.deepEqual(new Set(items[0].memberKeys), new Set(['danbooru:1', 'gelbooru:2']));
    assert.deepEqual(items[0].images, [url]);
  }
  assert.equal(logic.searchResultCounts([first, mirror, distinct]).works, 2);
});

test('viewed history recognizes a later catalog copy of the same full file', () => {
  const url = 'https://media.example.test/artwork.png';
  const first = work('danbooru', 1, [url]);
  const mirror = work('gelbooru', 2, [url + '#download']);
  const distinct = work('rule34', 3, [url + '?version=2']);
  const known = new Set(JSON.parse(JSON.stringify(logic.workHistoryTokens(first))));
  assert.deepEqual(logic.hideViewedWorks([mirror, distinct], known), [distinct]);
});

test('full-media identity uses a compact SHA-256 digest, including URLs longer than the history limit', () => {
  for (const path of ['art.png', 'a'.repeat(64) + '.png', 'a'.repeat(1000) + '.png', '作品.png']) {
    const url = new URL(`https://media.example.test/${path}`).href;
    const tokens = logic.workHistoryTokens(work('danbooru', 1, [url]));
    const expected = 'group:media:' + createHash('sha256').update(url).digest('hex');
    assert(tokens.includes(expected));
    assert(tokens.every(token => token.length <= 250));
    assert.equal(logic.hideViewedWorks([work('gelbooru', 2, [url])], new Set(tokens)).length, 0);
  }
});

test('media identity ignores renewed Sankaku signatures and retains stable file query parameters', () => {
  const first = work('sankaku', 1, ['https://v.sankakucomplex.com/custom/art.png?e=100&m=first&version=1']);
  const renewed = work('sankaku', 2, ['https://v.sankakucomplex.com/custom/art.png?e=200&m=renewed&version=1']);
  const variant = work('sankaku', 3, ['https://v.sankakucomplex.com/custom/art.png?e=200&m=renewed&version=2']);
  const known = new Set(logic.workHistoryTokens(first));
  assert.equal(logic.groupWorks([first, renewed, variant]).length, 2);
  assert.deepEqual(logic.hideViewedWorks([renewed, variant], known), [variant]);
  assert([...known].every(token => !token.includes('first')));
});

test('shared thumbnails, artist and tags do not identify different full files', () => {
  const extra = { thumbnail: 'https://media.example.test/preview.png',
    creatorTag: 'fixture_artist', tags: ['fixture_character'] };
  const items = [work('danbooru', 1, ['https://media.example.test/first.png'], extra),
    work('gelbooru', 2, ['https://media.example.test/second.png'], extra)];
  assert.equal(logic.groupWorks(items).length, 2);
  assert.deepEqual(logic.hideViewedWorks([items[1]], new Set(logic.workHistoryTokens(items[0]))), [items[1]]);
});

test('an exact full file remains one work when a catalog attributes it to another publication', () => {
  const url = 'https://media.example.test/artwork.png';
  const first = work('danbooru', 1, [url], { originalUrl: 'https://www.pixiv.net/artworks/100001' });
  const mirror = work('gelbooru', 2, [url], { originalUrl: 'https://www.pixiv.net/artworks/100002' });
  assert.equal(logic.groupWorks([first, mirror]).length, 1);
  assert.equal(logic.hideViewedWorks([mirror], new Set(logic.workHistoryTokens(first))).length, 0);
});

test('a partial listing cannot split a confirmed MD5 group on the next page', () => {
  const first = work('danbooru', 1, ['https://media.example.test/first.png'], { contentHash: 'a'.repeat(32) });
  const mirror = work('gelbooru', 2, ['https://media.example.test/mirror.png'], { contentHash: 'a'.repeat(32) });
  const initial = logic.groupWorks([first, mirror]);
  for (const partial of [{ ...first, contentHash: '' },
    { ...first, contentHash: '', images: [] }]) {
    const next = logic.mergeGroupedWorks(initial, [partial]);
    assert.equal(next.length, 1);
    assert.deepEqual(new Set(next[0].memberKeys), new Set(['danbooru:1', 'gelbooru:2']));
    assert.equal(next[0].images.length, 1);
  }
});

test('remembered post metadata retains its verified MD5 when the same file listing omits it', () => {
  const first = work('danbooru', 1, ['https://media.example.test/first.png'], { contentHash: 'a'.repeat(32) });
  const partial = { ...first, contentHash: '' };
  const remembered = logic.mergeWorkMetadata(first, partial);
  assert.equal(remembered.contentHash, 'a'.repeat(32));
  assert.equal(logic.hideViewedWorks([work('gelbooru', 2,
    ['https://media.example.test/mirror.png'], { contentHash: 'a'.repeat(32) })],
    new Set(logic.workHistoryTokens(remembered))).length, 0);
});

test('an explicitly replaced source file can leave an old mirror group', () => {
  const first = work('danbooru', 1, ['https://media.example.test/first.png'], { contentHash: 'a'.repeat(32) });
  const mirror = work('gelbooru', 2, ['https://media.example.test/mirror.png'], { contentHash: 'a'.repeat(32) });
  const initial = logic.groupWorks([first, mirror]);
  for (const contentHash of ['', 'b'.repeat(32)]) {
    const replacement = { ...first, contentHash, images: ['https://media.example.test/replaced.png'] };
    const next = logic.mergeGroupedWorks(initial, [replacement]);
    assert.equal(next.length, 2);
    assert.deepEqual(next.find(item => item.key === first.key).images, replacement.images);
  }
});

test('remembering a replaced singleton drops the former file and its identity evidence', () => {
  const first = work('danbooru', 1, ['https://media.example.test/first.png'], {
    contentHash: 'a'.repeat(32), visualHash: '0123456789abcdef',
    visualPHash: 'fedcba9876543210', visualAspectRatio: 1,
    creatorTag: 'fixture_artist', tags: Array.from({ length: 12 }, (_, index) => `detail_${index}`)
  });
  const initial = logic.groupWorks([first])[0];
  const oldTokens = new Set(logic.workHistoryTokens(initial).filter(token =>
    token.startsWith('hash:') || token.startsWith('group:media:')));
  for (const contentHash of ['', 'b'.repeat(32)]) {
    const replacement = work('danbooru', 1, ['https://media.example.test/replaced.png'], { contentHash });
    const remembered = logic.mergeWorkMetadata(initial, replacement);
    assert.deepEqual(remembered.images, replacement.images);
    assert.equal(remembered.visualHash, '');
    assert.equal(remembered.visualPHash, '');
    assert.deepEqual(remembered.visualSamples, []);
    assert(logic.workHistoryTokens(remembered).every(token => !oldTokens.has(token)));
    const oldCopy = work('gelbooru', 2, first.images, { contentHash: first.contentHash });
    assert.equal(logic.groupWorks([remembered, oldCopy]).length, 2);
  }
});

test('identity reuse observes in-place URL, record hash and saved identity changes', () => {
  const first = work('danbooru', 1, ['https://media.example.test/first.png'], {
    imageRecords: [{ url: 'https://media.example.test/first.png', hash: 'a'.repeat(32) }],
    identityKeys: ['group:pixiv:100001'], memberKeys: ['gelbooru:2']
  });
  const initial = new Set(logic.workHistoryTokens(first));
  first.images[0] = 'https://media.example.test/replaced.png';
  first.imageRecords[0].url = first.images[0];
  first.imageRecords[0].hash = 'b'.repeat(32);
  first.identityKeys[0] = 'group:pixiv:100002';
  first.memberKeys[0] = 'gelbooru:3';
  const next = new Set(logic.workHistoryTokens(first));
  assert(next.has('hash:' + 'b'.repeat(32)));
  assert(!next.has('hash:' + 'a'.repeat(32)));
  assert(next.has('group:pixiv:100002'));
  assert(!next.has('group:pixiv:100001'));
  assert(next.has('key:gelbooru:3'));
  assert(!next.has('key:gelbooru:2'));
  assert([...next].filter(token => token.startsWith('group:media:')).every(token => !initial.has(token)));
});

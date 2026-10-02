const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const CatalogLogic = require('../wwwroot/catalog-logic.js');
// Real metadata and thumbnail fingerprints; media URLs are replaced with fixtures.
const fixture = require('./fixtures/sankaku-variants.json');
const series = () => structuredClone(fixture.slice(0, 18));

test('Sankaku alphanumeric posts form two visual series and retain all 18 versions', () => {
  const grouped = CatalogLogic.groupWorks(series());
  assert.equal(grouped.length, 2);
  assert.deepEqual(grouped.map(item => item.images.length).sort(), [9, 9]);
  assert.equal(new Set(grouped.flatMap(item => item.memberKeys)).size, 18);
});

test('later pages extend Sankaku groups and retain their visual evidence after JSON reload', () => {
  const initial = CatalogLogic.groupWorks(series().slice(0, 8));
  const reloaded = JSON.parse(JSON.stringify(initial));
  const grouped = CatalogLogic.groupWorks([...reloaded, ...series().slice(8)]);
  assert.equal(grouped.length, 2);
  assert.equal(grouped.reduce((sum, item) => sum + item.images.length, 0), 18);
  assert.equal(CatalogLogic.groupWorks(structuredClone(fixture)).length, 7);
});

test('a confirmed mirror joins a Sankaku series without losing its variants or provenance', () => {
  const items = series();
  const mirror = { key: 'danbooru:123', source: 'danbooru', id: '123',
    creatorTag: 'anteiru', contentHash: items[0].contentHash,
    images: ['https://example.test/mirror.webp'] };
  const grouped = CatalogLogic.groupWorks([mirror, ...items]);
  assert.equal(grouped.length, 2);
  const mirrored = grouped.find(item => item.source === 'danbooru');
  assert.equal(mirrored.images.length, 9);
  assert.deepEqual([...new Set(CatalogLogic.workSources(mirrored).map(item => item.source))], ['danbooru', 'sankaku']);
  assert.equal(CatalogLogic.groupWorks(JSON.parse(JSON.stringify(grouped))).length, 2);
});

test('visual similarity alone cannot join different artists, characters, batches or publications', () => {
  const make = (id, changes = {}) => ({ ...series()[0], key: `sankaku:${id}`, id,
    contentHash: '', groupKey: '', images: [`https://example.test/${id}.webp`],
    ...changes });
  const base = make('base');
  const changedHash = series()[10].visualHash;
  for (const changes of [
    { creatorTag: 'different_artist', participants: [{ tag: 'different_artist', role: 'artist' }] },
    { creatorTag: '', participants: [], artistId: 'anteiru' },
    { characterTags: ['another_character'] },
    { visualHash: '0000000000000000' },
    { visualHash: changedHash, published: '2026-08-30T19:02:01+02:00' },
    { visualHash: changedHash, uploaderId: 'different_uploader' },
    { tags: ['1girl', 'solo', 'original'] }
  ]) assert.equal(CatalogLogic.groupWorks([base, make('other', changes)]).length, 2,
    `must keep separate: ${JSON.stringify(changes)}`);
  assert.equal(CatalogLogic.groupWorks([
    { ...base, originalUrl: 'https://x.com/artist/status/1234567' },
    make('other', { originalUrl: 'https://x.com/artist/status/7654321' })
  ]).length, 2);
});

test('AI-created and AI-assisted use the existing independent filter modes in every source', () => {
  for (const source of CatalogLogic.supportedSources) {
    for (const marker of ['ai-created', 'ai_created', 'AI created', 'ai-created_audio']) {
      const item = { source, tags: [marker] };
      assert.equal(CatalogLogic.isWorkHidden(item, { aiMode: 'all' }), false);
      assert.equal(CatalogLogic.isWorkHidden(item, { aiMode: 'generated' }), true);
      assert.equal(CatalogLogic.isWorkHidden(item, { aiMode: 'generated-and-assisted' }), true);
    }
    const assisted = { source, tags: ['ai-assisted'] };
    assert.equal(CatalogLogic.isWorkHidden(assisted, { aiMode: 'generated' }), false);
    assert.equal(CatalogLogic.isWorkHidden(assisted, { aiMode: 'generated-and-assisted' }), true);
    assert.equal(CatalogLogic.isWorkHidden({ source, tags: ['ordinary_art'] },
      { aiMode: 'generated-and-assisted' }), false);
  }
});

test('a grouped work keeps an AI marker from any of its variants', () => {
  const items = series();
  items[10].tags.push('ai-created');
  const grouped = CatalogLogic.groupWorks(items);
  assert.equal(CatalogLogic.filterWorks(grouped, { aiMode: 'generated' }).length, 1);
});

test('a partial native response keeps visual evidence and the grouped AI marker', () => {
  const items = series(); items[10].tags.push('ai-created');
  const [group] = CatalogLogic.groupWorks(items);
  const merged = CatalogLogic.mergeWorkMetadata(group, { key: group.key, source: group.source,
    tags: group.tags, allTags: [], visualHash: '', visualSamples: [] });
  assert.equal(merged.visualSamples.length, group.visualSamples.length);
  assert.equal(CatalogLogic.isWorkHidden(merged, { aiMode: 'generated' }), true);
  assert.equal(CatalogLogic.groupWorks([merged, ...series().slice(8)]).length, 2);
});

function requestFixture(items, pauseImages = false) {
  const source = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
  const start = source.indexOf('async function request(');
  const end = source.indexOf('\nfunction toast(', start);
  let active = 0, maximum = 0;
  const imageRequests = [];
  const context = vm.createContext({ CatalogLogic, visualHashCache: new Map(),
    AbortSignal, AbortController, setTimeout, clearTimeout, URL, URLSearchParams, console, structuredClone,
    DartResourceCache: require('../wwwroot/resource-cache.js'),
    document: { createElement: () => ({ getContext: () => ({ drawImage() {},
      getImageData: (_x, _y, width, height) => ({ data: new Uint8ClampedArray(width * height * 4) }) }) }) },
    createImageBitmap: async () => ({ width: 160, height: 240, close() {} }),
    fetch: async path => {
      if (path.startsWith('/api/image?')) {
        imageRequests.push(path); active++; maximum = Math.max(maximum, active);
        if (pauseImages) await new Promise(resolve => setTimeout(resolve, 5));
        active--;
        return { ok: true, blob: async () => ({}) };
      }
      return { ok: true, json: async () => ({ items: structuredClone(items) }) };
    }
  });
  vm.runInContext(source.slice(start, end), context);
  return { context, imageRequests, maximum: () => maximum };
}

test('recommendations and search fingerprint eligible works from all four sources', async () => {
  const sankaku = series()[0]; delete sankaku.visualHash;
  const items = CatalogLogic.supportedSources.map(source => ({ ...sankaku, source,
    key: `${source}:1`, thumbnail: `https://example.test/${source}.jpg` }));
  const probe = requestFixture(items);
  const response = await probe.context.request('/api/search?q=anteiru');
  for (const item of response.items) {
    assert.match(item.visualHash, /^[a-f0-9]{16}$/);
    assert.match(item.visualPHash, /^[a-f0-9]{16}$/);
    assert.equal(item.visualAspectRatio, 160 / 240);
  }
  assert.equal(probe.imageRequests.length, 4);
});

test('parallel Sankaku feed requests share a bounded thumbnail queue and cache', async () => {
  const items = series().map(item => { delete item.visualHash; return item; });
  const probe = requestFixture(items, true);
  const [search, profile] = await Promise.all([
    probe.context.request('/api/search?q=anteiru'),
    probe.context.request('/api/profile?artistId=anteiru')
  ]);
  assert.equal(probe.imageRequests.length, 18);
  assert.ok(probe.maximum() <= 4);
  assert.ok(probe.maximum() > 1);
  assert.ok([...search.items, ...profile.items].every(item => /^[a-f0-9]{16}$/.test(item.visualHash)));
});

test('renewed Sankaku thumbnail signatures do not repeat visual fingerprint downloads', async () => {
  const first = series()[0];
  const second = { ...first, key: 'sankaku:second', id: 'second',
    thumbnail: first.thumbnail.replace(/([?&])e=[^&]+/, '$1e=renewed')
      .replace(/([?&])m=[^&]+/, '$1m=renewed') };
  if (second.thumbnail === first.thumbnail) {
    first.thumbnail = 'https://s.sankakucomplex.com/a.jpg?e=1&m=old';
    second.thumbnail = 'https://s.sankakucomplex.com/a.jpg?e=2&m=new';
  }
  delete first.visualHash; delete second.visualHash;
  const probe = requestFixture([first, second], true);
  const result = await probe.context.request('/api/search?q=anteiru');
  assert.equal(probe.imageRequests.length, 1);
  assert.equal(result.items[0].visualHash, result.items[1].visualHash);
});

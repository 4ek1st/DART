const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const CatalogLogic = require('../wwwroot/catalog-logic.js');
const samples = require('./fixtures/sankaku-variants.json').slice(0, 18);

function probe() {
  const fingerprints = new Map(samples.map(item => [item.thumbnail, {
    hash: item.visualHash, perceptualHash: 'f0f0f0f0f0f0f0f0', aspectRatio: item.visualAspectRatio || 1
  }]));
  const raw = () => samples.map(item => {
    const copy = structuredClone(item);
    for (const field of ['visualHash', 'visualPHash', 'visualSamples', 'visualAspectRatio']) delete copy[field];
    return copy;
  });
  const computed = raw();
  const tab = { id: 'follow-visual', kind: 'follows', followVersion: 7, rating: 'all',
    items: raw(), followGroups: [{ follow: { key: 'artist:fixture_artist' }, items: raw() }],
    followComputed: { feed: { items: computed }, records: new Map(computed.map(item => [item.key, { item }])) } };
  const timers = new Map(), writes = [];
  let nextTimer = 0, renders = 0;
  const context = vm.createContext({ CatalogLogic, tabs: [tab], likes: [], bookmarks: [], recent: [],
    visualFingerprintValues: new Map(),
    itemIndex: new Map(tab.items.map(item => [item.key, item])),
    catalogThumbnailFingerprint: async url => fingerprints.get(url),
    currentTab: () => tab, findTab: id => id === tab.id ? tab : null,
    setTimeout: callback => { timers.set(++nextTimer, callback); return nextTimer; },
    clearTimeout: id => timers.delete(id),
    request: async (_url, options) => { writes.push(JSON.parse(options.body)); return {}; },
    main: { getBoundingClientRect: () => ({ top: 0 }), querySelectorAll: () => [] },
    render: () => renders++
  });
  const source = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
  vm.runInContext(source.slice(source.indexOf('let cardFingerprintTimer;'),
    source.indexOf('\nfunction addCatalogVisualHashes(')), context);
  const add = source.indexOf('function addCatalogVisualHashes(');
  vm.runInContext(source.slice(add, source.indexOf('\nfunction toast(', add)), context);
  const save = source.indexOf('function saveFollowPreview(');
  vm.runInContext(source.slice(save, source.indexOf('\nasync function markFollowItemsSeen(', save)), context);
  return { tab, context, writes, timers, raw, renders: () => renders,
    async loadVisible() {
      for (const item of [...tab.items]) await context.rememberCardFingerprint({
        closest: () => ({ dataset: { workKey: item.key } }), naturalWidth: 160,
        dataset: {}, isConnected: true
      });
    },
    async settle() {
      for (const callback of [...timers.values()]) callback();
      timers.clear();
      await tab.followCacheSaveTail;
    }
  };
}

test('visible Sankaku versions stay grouped after Following rebuilds from source records', async () => {
  const state = probe();
  await state.loadVisible();
  assert.equal(CatalogLogic.groupWorks(state.tab.items).length, 2);
  assert.equal(CatalogLogic.groupWorks(state.tab.followGroups.flatMap(group => group.items)).length, 2);
  assert.equal(CatalogLogic.groupWorks(state.tab.followComputed.feed.items).length, 2);
  assert.equal(CatalogLogic.groupWorks([...state.tab.followComputed.records.values()].map(record => record.item)).length, 2);
});

test('Following thumbnail evidence is saved once after a visible batch and survives cache reload', async () => {
  const state = probe();
  await state.loadVisible();
  assert.equal(state.writes.length, 0, 'thumbnail callbacks must not each serialize and save the feed');
  await state.settle();
  assert.equal(state.renders(), 1);
  assert.equal(state.writes.length, 1);
  assert.equal(CatalogLogic.groupWorks(state.writes[0].groups.flatMap(group => group.items)).length, 2);
});

test('cached Following evidence also applies to a fresh provider response without downloading its thumbnails', async () => {
  const state = probe();
  await state.loadVisible();
  state.context.visualFingerprintValues.clear();
  const cached = JSON.parse(JSON.stringify(state.tab.followGroups.flatMap(group => group.items)));
  state.context.addCatalogVisualHashes(cached);
  const refreshed = state.raw();
  state.context.addCatalogVisualHashes(refreshed);
  assert.equal(CatalogLogic.groupWorks(refreshed).length, 2);
  const unrelated = { ...state.raw()[0], thumbnail: 'https://example.test/a-different-file.jpg' };
  state.context.addCatalogVisualHashes([unrelated]);
  assert.equal(unrelated.visualHash, undefined, 'an artwork ID cannot lend a different image its fingerprint');
});

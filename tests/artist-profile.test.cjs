const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const CatalogLogic = require('../wwwroot/catalog-logic.js');

const source = fs.readFileSync(path.join(__dirname, '..', 'wwwroot', 'app.js'), 'utf8');

function extract(startMarker, endMarker, name, context) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start);
  return vm.runInNewContext(source.slice(start, end) + `\n${name}`, context);
}

test('opening the creator of a Rule34 post creates a profile tab', () => {
  const item = { source: 'rule34', key: 'rule34:15341948',
    creatorTag: 'horosuke', creatorName: 'horosuke',
    uploaderId: 'bot', uploaderName: 'bot', rating: 'e' };
  const calls = [];
  const openCreator = extract('function openCreator(', '\nfunction openUploader(',
    'openCreator', { CatalogLogic, ratingFilterFor: () => 'explicit',
      createTab: (...args) => calls.push(args), toast() {} });
  openCreator(item);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'profile');
  assert.equal(calls[0][1], 'horosuke');
  assert.equal(calls[0][2].profileRef.source, 'artist');
  assert.equal(calls[0][2].profileRef.artist, 'horosuke');
});

test('artist profile requests all four catalogs with the creator tag', async () => {
  const requests = [];
  const loadProfile = extract('async function loadProfile(', '\nfunction openCreator(',
    'loadProfile', { CatalogLogic, loadSearch: async (...args) => requests.push(args) });
  const tab = { title: 'horosuke', profileRef: { source: 'artist', artist: 'horosuke' } };
  await loadProfile(tab);
  assert.equal(tab.query, 'horosuke');
  assert.deepEqual(Array.from(tab.selectedSources), CatalogLogic.supportedSources);
  assert.equal(tab.profile.role, 'Художник');
  assert.equal(requests.length, 1);
  assert.equal(requests[0][0], tab);
});

function creatorFixture(respond, preferences = {}) {
  const tab = { id: 1, item: { key: 'danbooru:11731485', source: 'danbooru',
    id: '11731485', creatorTag: 'mokoyamo', creatorName: 'mokoyamo',
    rating: 'e', contentHash: 'a'.repeat(32), tags: ['mokoyamo'], images: ['current.jpg'] } };
  const requests = [];
  const context = { CatalogLogic, URLSearchParams, AbortController, Map, Set,
    activeId: 1, contentPreferences: preferences, findTab: id => id === tab.id ? tab : null,
    ratingFilterFor: () => 'explicit', render() {}, rememberItems() {},
    request: async (url, options) => {
      const parsed = new URL(url, 'http://fixture');
      requests.push(parsed);
      return respond(parsed, requests.length, options);
    } };
  const load = extract('async function loadCreatorWorks(', '\nasync function loadRelated(',
    'loadCreatorWorks', context);
  return { tab, requests, load, context };
}

const works = (source, prefix, count) => Array.from({ length: count }, (_, index) => ({
  key: `${source}:${prefix}-${index}`, source, id: `${prefix}-${index}`,
  creatorTag: 'mokoyamo', creatorName: 'mokoyamo', rating: 'e',
  tags: ['mokoyamo'], images: [`${prefix}-${index}.jpg`] }));

test('more works under a Danbooru artwork uses the same four catalogs as the profile', async () => {
  const fixture = creatorFixture(url => {
    const source = url.searchParams.get('sources');
    return { items: works(source, source, source === 'danbooru' ? 2 : 6),
      errors: {}, hasMoreSources: [] };
  });
  await fixture.load(fixture.tab);
  assert.equal(fixture.requests[0].pathname, '/api/search');
  assert.deepEqual(fixture.requests.map(url => url.searchParams.get('sources')),
    CatalogLogic.supportedSources);
  assert.equal(fixture.requests[0].searchParams.get('q'), 'mokoyamo');
  assert.equal(fixture.requests[0].searchParams.get('rating'), 'explicit');
  assert.equal(fixture.tab.creatorWorks.length, 12);
  assert.ok(fixture.tab.creatorWorks.some(item => item.source === 'gelbooru'));
  assert.ok(fixture.tab.creatorWorks.some(item => item.source === 'rule34'));
});

test('author strip fills from later pages after filtering and grouping current-work mirrors', async () => {
  const fixture = creatorFixture(url => {
    const source = url.searchParams.get('sources');
    if (source === 'gelbooru') return { items: [
      { ...works('gelbooru', 'mirror', 1)[0], contentHash: 'a'.repeat(32) }],
      errors: {}, hasMoreSources: [] };
    if (source === 'rule34' || source === 'sankaku') return { items: [], errors: {}, hasMoreSources: [] };
    return url.searchParams.get('page') === '0' ? {
      items: works('danbooru', 'hidden', 14).map(item => ({ ...item, tags: ['mokoyamo', 'excluded'] })),
      errors: {}, hasMoreSources: ['danbooru']
    } : { items: works('danbooru', 'visible', 12), errors: {}, hasMoreSources: [] };
  }, { excludedTags: ['excluded'] });
  await fixture.load(fixture.tab);
  assert.equal(fixture.requests.length, 5);
  assert.equal(fixture.requests[4].searchParams.get('sources'), 'danbooru');
  assert.equal(fixture.requests[4].searchParams.get('pages'), 'danbooru:1');
  assert.equal(fixture.tab.creatorWorks.length, 12);
  assert.ok(fixture.tab.creatorWorks.every(item => item.key.startsWith('danbooru:visible-')));
});

test('the fastest catalog does not fill the author strip ahead of other ready catalogs', async () => {
  const fixture = creatorFixture(url => {
    const source = url.searchParams.get('sources');
    return { items: works(source, source, 24), errors: {}, hasMoreSources: [] };
  });
  await fixture.load(fixture.tab);
  assert.equal(fixture.tab.creatorWorks.length, 12);
  for (const source of CatalogLogic.supportedSources)
    assert.equal(fixture.tab.creatorWorks.filter(item => item.source === source).length, 3);
});

test('one failed author source does not stop other pages and retries without losing results', async () => {
  let gelbooruCalls = 0;
  const fixture = creatorFixture(url => {
    const source = url.searchParams.get('sources');
    if (source === 'gelbooru') return ++gelbooruCalls === 1
      ? { items: [], errors: { gelbooru: 'Temporarily unavailable' }, hasMoreSources: [] }
      : { items: works('gelbooru', 'recovered', 2), errors: {}, hasMoreSources: [] };
    if (source === 'rule34' || source === 'sankaku') return { items: [], errors: {}, hasMoreSources: [] };
    return url.searchParams.get('page') === '0'
      ? { items: works('danbooru', 'first', 2), errors: {}, hasMoreSources: ['danbooru'] }
      : { items: works('danbooru', 'second', 10), errors: {}, hasMoreSources: [] };
  });
  await fixture.load(fixture.tab);
  assert.equal(fixture.requests.length, 5);
  assert.equal(fixture.tab.creatorWorks.length, 12);
  assert.equal(fixture.tab.creatorErrors.gelbooru, 'Temporarily unavailable');
  await fixture.load(fixture.tab, true);
  assert.equal(fixture.requests[5].searchParams.get('sources'), 'gelbooru');
  assert.equal(fixture.requests[5].searchParams.get('pages'), 'gelbooru:0');
  assert.equal(fixture.tab.creatorWorks.length, 12);
  assert.deepEqual(Object.keys(fixture.tab.creatorErrors), []);
});

test('Danbooru and Gelbooru appear before a stalled Rule34 request finishes', async () => {
  let finishRule34;
  const rule34Response = new Promise(resolve => { finishRule34 = resolve; });
  const fixture = creatorFixture(url => {
    const source = url.searchParams.get('sources');
    if (source.includes('rule34')) return rule34Response;
    return { items: works(source, source, 3), errors: {}, hasMoreSources: [] };
  });
  const pending = fixture.load(fixture.tab);
  await new Promise(resolve => setImmediate(resolve));
  try {
    assert.equal(fixture.tab.creatorLoading, true);
    assert.equal(fixture.tab.creatorWorks.length, 9);
    assert.deepEqual([...new Set(fixture.tab.creatorWorks.map(item => item.source))].sort(),
      ['danbooru', 'gelbooru', 'sankaku']);
  } finally {
    finishRule34({ items: [], errors: { rule34: 'Источник сейчас недоступен.' }, hasMoreSources: [] });
    await pending;
  }
  assert.equal(fixture.tab.creatorWorks.length, 9);
  assert.equal(fixture.tab.creatorPaused.rule34, true);
});

test('a rejected Rule34 request does not stop later Danbooru and Gelbooru pages', async () => {
  let failRule34 = true;
  const fixture = creatorFixture(url => {
    const source = url.searchParams.get('sources');
    if (source.includes('rule34')) {
      if (failRule34) throw new Error('HTTP 503');
      return { items: [], errors: {}, hasMoreSources: [] };
    }
    const first = url.searchParams.get('page') === '0';
    return { items: works(source, `${source}-${first ? 'first' : 'second'}`, 2),
      errors: {}, hasMoreSources: first ? [source] : [] };
  });
  await fixture.load(fixture.tab);
  assert.equal(fixture.tab.creatorWorks.length, 12);
  assert.equal(fixture.tab.creatorPaused.rule34, true);
  assert.deepEqual(Object.keys(fixture.tab.creatorErrors), ['rule34']);
  assert.equal(fixture.requests.filter(url => url.searchParams.get('sources') === 'rule34').length, 1);
  failRule34 = false;
  const previousRequests = fixture.requests.length;
  await fixture.load(fixture.tab, true);
  assert.equal(fixture.requests.length, previousRequests + 1);
  assert.equal(fixture.requests.at(-1).searchParams.get('sources'), 'rule34');
  assert.equal(fixture.tab.creatorWorks.length, 12);
  assert.deepEqual(Object.keys(fixture.tab.creatorErrors), []);
});

test('author work requests stop when the detail tab is closed', async () => {
  const fixture = creatorFixture(() => {
    fixture.context.findTab = () => null;
    return { items: [], errors: {}, hasMoreSources: ['danbooru'] };
  });
  await fixture.load(fixture.tab);
  assert.equal(fixture.requests.length, 1);
  assert.equal(fixture.tab.creatorLoading, false);
});

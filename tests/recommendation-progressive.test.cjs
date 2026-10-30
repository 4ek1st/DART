'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const logic = require('../wwwroot/catalog-logic.js');
const source = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
const loader = source.slice(source.indexOf('function createRecommendationPools('),
  source.indexOf('\nfunction decorateFollowItems('));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const flush = async () => { for (let index = 0; index < 4; index++) await new Promise(setImmediate); };
const work = (key, provider = 'danbooru') => ({ key, source: provider, rating: 'g',
  tags: ['landscape', 'watercolor'], title: 'Neutral landscape' });
function fixture(respond, count = 8) {
  const tab = { id: 1, kind: 'recommendations', rating: 'general',
    selectedSources: ['danbooru', 'rule34'], items: [], errors: {} };
  const calls = [], publications = [];
  const context = { CatalogLogic: logic, likes: Array.from({ length: count }, (_, index) => work(`liked:${index}`)),
    recommendationTagPreferences: { landscape: 'priority' }, recommendationVisitCount: 0,
    localStorage: { setItem() {} }, contentPreferences: {}, AbortController, URLSearchParams,
    findTab: id => id === tab.id ? tab : null, activeId: tab.id, rememberItems() {},
    render() { publications.push(tab.items.map(item => item.key)); }, setTimeout, clearTimeout,
    request: async (url, options) => {
      const query = new URL(url, 'http://fixture').searchParams;
      const call = { query: query.get('q'), page: Number(query.get('page')),
        sources: query.get('sources').split(','), signal: options.signal, priority: options.priority };
      calls.push(call); return respond(call);
    }
  };
  const api = vm.runInNewContext(loader + '\n({loadRecommendations, retryRecommendationSources})', context);
  return { ...api, context, tab, calls, publications,
    streams: () => Object.values(tab.recommendationPools).flat().flatMap(group => group.streams) };
}

test('ready source publishes cards and commits only its cursor while a peer remains pending', async () => {
  const slow = deferred();
  const f = fixture(call => call.sources.includes('rule34') ? slow.promise : {
    items: [work(`danbooru:${call.query === 'landscape' ? 101 : 102}`)],
    errors: {}, hasMoreSources: ['danbooru'] });
  const pending = f.loadRecommendations(f.tab);
  try {
    await flush();
    assert(f.tab.items.length > 0, 'a held source cannot withhold ready artwork');
    assert(f.calls.every(call => call.sources.length === 1), 'requests are independently deliverable');
    assert.equal(f.tab.loading, true);
    assert(f.streams().some(stream => stream.sources.includes('danbooru') && stream.nextPage === 1));
    assert(f.streams().some(stream => stream.sources.includes('rule34') && stream.nextPage === 0));
    const prefix = f.tab.items.map(item => item.key);
    slow.resolve({ items: [work('rule34:201', 'rule34')], errors: {}, hasMoreSources: [] });
    await pending;
    assert.deepEqual(f.tab.items.slice(0, prefix.length).map(item => item.key), prefix);
    assert.equal(f.tab.loading, false);
  } finally {
    slow.resolve({ items: [], errors: {}, hasMoreSources: [] }); await pending;
  }
});

test('fresh background calibration starts after ready cards and cannot gate their publication', async () => {
  const background = deferred(); let backgroundStartedAfterCards = false;
  const f = fixture(call => {
    if (!call.query) { backgroundStartedAfterCards = f.tab.items.length > 0; return background.promise; }
    return { items: [work(`${call.sources[0]}:${call.query === 'landscape' ? 301 : 302}`, call.sources[0])],
      errors: {}, hasMoreSources: [] };
  }, 24);
  const pending = f.loadRecommendations(f.tab);
  try {
    await flush();
    assert(f.tab.items.length > 0, 'optional calibration cannot hold the first row');
    assert.equal(backgroundStartedAfterCards, true);
    assert.equal(f.calls.find(call => !call.query)?.priority, 'background');
  } finally {
    background.resolve({ items: [], errors: {}, hasMoreSources: [] }); await pending;
  }
});

test('cancelling after a partial publication retains committed cards and the unresolved peer page', async () => {
  const slow = deferred();
  const f = fixture(call => call.sources.includes('rule34') ? slow.promise : {
    items: [work(`danbooru:${call.query === 'landscape' ? 401 : 402}`)],
    errors: {}, hasMoreSources: ['danbooru'] });
  const pending = f.loadRecommendations(f.tab);
  try {
    await flush();
    assert(f.tab.items.length > 0);
    const prefix = f.tab.items.map(item => item.key);
    f.retryRecommendationSources(f.tab, ['rule34'], false);
    slow.resolve({ items: [work('rule34:499', 'rule34')], errors: {}, hasMoreSources: ['rule34'] });
    await pending;
    assert.deepEqual(f.tab.items.map(item => item.key), prefix);
    assert(f.streams().some(stream => stream.sources.includes('danbooru') && stream.nextPage === 1));
    assert(f.streams().some(stream => stream.sources.includes('rule34') && stream.nextPage === 0));
  } finally {
    slow.resolve({ items: [], errors: {}, hasMoreSources: [] }); await pending;
  }
});

test('a transport rejection pauses only that source and leaves healthy pagination usable', async () => {
  const f = fixture(call => {
    if (call.sources[0] === 'rule34') throw Object.assign(new Error('HTTP 503'), { status: 503 });
    return { items: [work(`danbooru:${call.query === 'landscape' ? 501 : 502}`)], errors: {}, hasMoreSources: ['danbooru'] };
  });
  await f.loadRecommendations(f.tab);
  assert(f.tab.items.length > 0);
  assert.equal(f.tab.loadError, false);
  assert(f.streams().some(stream => stream.sources.includes('rule34') && stream.retryAt > Date.now()));
  assert(f.streams().some(stream => stream.sources.includes('danbooru') && stream.nextPage === 1));
  assert.equal(f.tab.emptyRecommendationRounds, 0);
});

test('a later successful query cannot clear another query source outage in the same round', async () => {
  const later = deferred();
  const f = fixture(call => call.query === 'landscape'
    ? { items: [], errors: { danbooru: 'HTTP 503' }, hasMoreSources: [] } : later.promise);
  f.tab.selectedSources = ['danbooru'];
  const pending = f.loadRecommendations(f.tab);
  await flush();
  assert(f.streams().some(stream => stream.error));
  later.resolve({ items: [work('danbooru:601')], errors: {}, hasMoreSources: ['danbooru'] });
  await pending;
  assert.equal(f.tab.items[0].key, 'danbooru:601');
  assert.match(f.tab.errors.danbooru, /503/);
  assert(f.streams().filter(stream => stream.sources.length).every(stream => stream.retryAt > Date.now()));
});

test('multiple empty source completions count as one empty round', async () => {
  const f = fixture(call => ({ items: [], errors: {}, hasMoreSources: call.sources }));
  await f.loadRecommendations(f.tab);
  assert(f.calls.length > 1);
  assert.equal(f.tab.emptyRecommendationRounds, 1);
  assert.equal(f.tab.recommendationPaused, false);
});

test('a changed published prefix during asynchronous ranking is retained by reranking', async () => {
  const held = deferred(); let firstArgs, ranks = 0;
  const f = fixture(call => ({ items: [work(`danbooru:${call.query === 'landscape' ? 701 : 702}`)],
    errors: {}, hasMoreSources: [] }));
  f.tab.selectedSources = ['danbooru'];
  f.context.mergeRecommendationsAsync = (...args) => {
    ranks++;
    if (!firstArgs) { firstArgs = args; return held.promise; }
    return logic.mergeRecommendations(...args);
  };
  const pending = f.loadRecommendations(f.tab);
  await flush();
  f.tab.items = [work('danbooru:799')];
  held.resolve(logic.mergeRecommendations(...firstArgs));
  await pending;
  assert(ranks >= 2);
  assert.equal(f.tab.items[0].key, 'danbooru:799');
});

test('failed ranking preserves retryable pages and ends the current load safely', async () => {
  const f = fixture(() => ({ items: [work('danbooru:801')], errors: {}, hasMoreSources: ['danbooru'] }));
  f.context.mergeRecommendationsAsync = async () => { throw new Error('Neutral ranking failure'); };
  await f.loadRecommendations(f.tab);
  assert.equal(f.tab.loading, false);
  assert.equal(f.tab.loadError, true);
  assert.equal(f.tab.recommendationController.signal.aborted, true);
  assert(f.streams().every(stream => stream.nextPage === 0));
  assert.equal(f.tab.items.length, 0);
});

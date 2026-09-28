const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const CatalogLogic = require('../wwwroot/catalog-logic.js');
const source = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');

test('recommendations retain a failed Rule34 page and resume it without skipping or losing healthy works', async () => {
  let now = 100000;
  let unavailable = true;
  const requests = [];
  const tab = { id: 1, kind: 'recommendations', selectedSources: ['danbooru', 'rule34'],
    rating: 'all', items: [], errors: {} };
  const context = { CatalogLogic, AbortController, URLSearchParams,
    Date: class extends Date { static now() { return now; } },
    likes: [1, 2, 3].map(id => ({ key: `danbooru:${id}`, source: 'danbooru', tags: ['latex'] })),
    contentPreferences: {}, recommendationTagPreferences: {}, recommendationVisitCount: 0,
    localStorage: { setItem() {} }, findTab: id => id === 1 ? tab : null, activeId: 1,
    render() {}, rememberItems() {},
    request: async path => {
      const params = new URL(path, 'http://fixture').searchParams;
      const sources = params.get('sources').split(',');
      requests.push({ sources, page: Number(params.get('page')) });
      return { items: sources.filter(name => name !== 'rule34' || !unavailable)
        .map(name => ({ key: `${name}:1000`, source: name, rating: 'e', tags: ['latex'] })),
        errors: sources.includes('rule34') && unavailable ? { rule34: 'HTTP 429' } : {},
        retryAt: sources.includes('rule34') && unavailable ? { rule34: now + 60000 } : {},
        hasMoreSources: [] };
    }
  };
  const start = source.indexOf('function createRecommendationPools(');
  const end = source.indexOf('\nfunction decorateFollowItems(', start);
  vm.runInNewContext(source.slice(start, end), context);
  await context.loadRecommendations(tab);
  assert.equal(tab.items.length, 1);
  assert.equal(tab.hasMore, true, 'Temporary source failure must not end the recommendation pool');
  const pending = Object.values(tab.recommendationPools).flat().flatMap(group => group.streams)
    .find(stream => stream.sources.includes('rule34'));
  assert.equal(pending.nextPage, 0, 'A failed page must not advance');
  assert.equal(pending.retryAt, now + 60000);
  await context.loadRecommendations(tab, true);
  assert.equal(requests.length, 1, 'Do not retry Rule34 during its cooldown');
  unavailable = false;
  now += 60001;
  await context.loadRecommendations(tab, true);
  assert.deepEqual(requests.at(-1), { sources: ['rule34'], page: 0 });
  assert.equal(tab.items.length, 2, 'Healthy results must survive recovery');
  assert.equal(tab.errors.rule34, undefined);
});

test('one recovery timer retries only Rule34 on the active search and never resurrects a closed tab', async () => {
  let now = 100000;
  let open = true;
  let callback;
  let scheduled;
  const calls = [];
  const tab = { id: 7, kind: 'search', loading: false, pausedSources: { rule34: true }, rule34RetryAt: now + 60000 };
  const start = source.indexOf('function scheduleRule34Recovery(');
  const end = source.indexOf('\nasync function loadSearch(', start);
  assert(start >= 0 && end > start, 'Rule34 automatic recovery scheduler exists');
  const context = { Date: class extends Date { static now() { return now; } },
    findTab: id => open && id === 7 ? tab : null, activeId: 7,
    setTimeout: (fn, delay) => { callback = fn; scheduled = delay; return 1; }, clearTimeout() {},
    loadSearch: async (...args) => calls.push(args), loadRecommendations() {} };
  vm.runInNewContext(source.slice(start, end), context);
  context.scheduleRule34Recovery(tab);
  assert.equal(scheduled, 60000);
  now += 60001;
  await callback();
  assert.deepEqual(Array.from(calls[0][3]), ['rule34']);
  assert.equal(calls[0][1], true, 'Recovery appends to existing works');
  context.scheduleRule34Recovery(tab);
  open = false;
  await callback();
  assert.equal(calls.length, 1, 'A closed tab must not restart a request');
});

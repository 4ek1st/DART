const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const CatalogLogic = require('../wwwroot/catalog-logic.js');
const source = fs.readFileSync(path.join(__dirname, '../wwwroot/app.js'), 'utf8');
const artwork = { key: 'danbooru:current', source: 'danbooru', title: 'Lily (maker)',
  creatorTag: 'maker', artistId: 'maker', characterTags: ['lily_(maker)', 'tsuki'],
  relatedQuery: 'lily_(maker)', tags: ['maker', 'lily_(maker)', 'tsuki', 'latex', 'catsuit', 'highres'] };
const works = (prefix, count = 1, extra = {}) => Array.from({ length: count }, (_, index) => ({
  key: `danbooru:${prefix}-${index}`, source: 'danbooru', tags: ['latex', 'catsuit'], ...extra }));
function fixture(respond, sources = ['danbooru']) {
  const tab = { id: 1, kind: 'detail', item: artwork }, requests = [];
  const context = { CatalogLogic, URLSearchParams, AbortController, Map, Set,
    defaultSources: sources, activeId: 1, findTab: () => tab,
    ratingFilterFor: () => 'explicit', render() {}, rememberItems() {},
    filterFeedWorks: items => items,
    request: async (url, options) => { const parsed = new URL(url, 'http://fixture');
      requests.push(parsed); return respond(parsed, requests.length, options); } };
  const start = source.indexOf('async function loadRelated(');
  const end = source.indexOf('\nasync function loadProfile(', start);
  const controls = vm.runInNewContext(source.slice(start, end) +
    '\n({ load: loadRelated, retry: typeof retryRelatedSearch === "function" ? retryRelatedSearch : null })', context);
  return { tab, requests, ...controls, context };
}

test('related anchor uses the character instead of the artist inside its name', () => {
  assert.equal(CatalogLogic.pickRelatedAnchor(artwork), 'lily_(maker)');
});

test('rare character exhaustion continues through other characters and content tags', async () => {
  const f = fixture(url => ({ items: url.searchParams.get('q') === 'latex' ? works('theme') : [],
    errors: {}, hasMoreSources: [] }));
  await f.load(f.tab);
  for (let turn = 0; turn < 10 && f.tab.relatedHasMore; turn++) await f.load(f.tab, true);
  const queries = f.requests.map(url => url.searchParams.get('q'));
  assert.ok(queries.includes('tsuki'));
  assert.ok(queries.includes('latex'));
  assert.ok(!queries.includes('maker'));
  assert.equal(f.tab.related.length, 1);
  assert.equal(f.tab.relatedHasMore, false);
});

test('a failed source stays retryable while healthy related searches continue', async () => {
  const f = fixture(url => ({ items: works(`page-${url.searchParams.get('q')}-${url.searchParams.get('page')}`),
    errors: { rule34: 'HTTP 503' }, hasMoreSources: ['danbooru'] }), ['danbooru', 'rule34']);
  await f.load(f.tab);
  assert.ok(f.tab.related.length);
  assert.equal(f.tab.relatedHasMore, true);
  assert.equal(f.tab.relatedErrors.rule34, 'HTTP 503');
  const before = f.requests.length;
  await f.load(f.tab, true);
  assert.ok(f.requests.slice(before).every(url => !url.searchParams.get('sources').includes('rule34')));
  assert.equal(f.tab.relatedError, false);
});

test('related pages keep all distinct candidates and merge mirrors from later queries', async () => {
  const f = fixture((url, call) => ({ items: call === 1 ? works('first', 110) : [
    { ...works('first')[0], key: 'gelbooru:mirror', source: 'gelbooru', contentHash: 'a'.repeat(32) },
    ...works(`new-${call}`, 2)], errors: {}, hasMoreSources: ['danbooru'] }));
  // A matching file hash identifies the first image across catalogs.
  const response = f.context.request;
  f.context.request = async (...args) => { const result = await response(...args);
    if (f.requests.length === 1) result.items[0].contentHash = 'a'.repeat(32); return result; };
  await f.load(f.tab);
  assert.equal(f.tab.related.length, 110);
  const firstKeys = f.tab.related.map(item => item.key);
  await f.load(f.tab, true);
  assert.deepEqual(f.tab.related.slice(0, 110).map(item => item.key), firstKeys);
  assert.equal(f.tab.related.filter(item => item.memberKeys?.includes('gelbooru:mirror')).length, 1);
});

test('search progress continues beyond page 100 when the source has more', () => {
  const progress = CatalogLogic.advanceSearchSources({ danbooru: 100 }, {}, ['danbooru'],
    { hasMoreSources: ['danbooru'], errors: {} });
  assert.equal(progress.pages.danbooru, 101);
});

test('a source repeating the identical page cannot cause endless duplicate loading', async () => {
  const f = fixture(() => ({ items: works('repeated'), errors: {}, hasMoreSources: ['danbooru'] }));
  await f.load(f.tab);
  for (let turn = 0; turn < 20 && f.tab.relatedHasMore; turn++) await f.load(f.tab, true);
  assert.equal(f.tab.relatedHasMore, false);
  assert.equal(f.tab.related.length, 1);
  assert.ok(f.requests.length <= 10);
});

test('closing the detail cancels further tag fallback requests', async () => {
  const f = fixture(() => { f.context.findTab = () => null;
    return { items: [], errors: {}, hasMoreSources: [] }; });
  await f.load(f.tab);
  assert.equal(f.requests.length, 1);
});

test('retry clicked during loading runs after the current batch without losing the click', async () => {
  const f = fixture((url, call) => ({ items: works(`retry-${call}`, 24),
    errors: call === 1 ? { rule34: 'HTTP 503' } : {}, hasMoreSources: ['danbooru'] }),
  ['danbooru', 'rule34']);
  const pending = f.load(f.tab);
  f.retry(f.tab);
  await pending;
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(f.requests.length >= 2);
  assert.ok(f.requests[1].searchParams.get('sources').includes('rule34'));
  assert.deepEqual(Object.keys(f.tab.relatedErrors), []);
});

test('temporary errors are shown as a pause rather than all works being loaded', () => {
  const start = source.indexOf('function renderRelatedTail(');
  const end = source.indexOf('\nfunction filterFeedWorks(', start);
  const tail = vm.runInNewContext(source.slice(start, end) + '\nrenderRelatedTail',
    { renderErrors: () => '<button>Повторить</button>' });
  const html = tail({ id: 1, relatedStarted: true, relatedQuery: 'latex', related: works('loaded'),
    relatedHasMore: false, relatedErrors: { rule34: 'HTTP 503' } });
  assert.match(html, /Повторить/);
  assert.doesNotMatch(html, /Все доступные похожие работы загружены/);
});

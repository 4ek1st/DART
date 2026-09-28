const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const CatalogLogic = require('../wwwroot/catalog-logic.js');
const source = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');

test('cached thumbnails are attached before the first paint when mounting a tab', () => {
  const img = { dataset: { imageUrl: 'preview' }, isConnected: true, src: '',
    getAttribute: () => img.src, closest: () => ({ classList: { remove() {} } }) };
  const root = { querySelectorAll: () => [img] };
  class IntersectionObserver { observe() {} disconnect() {} }
  const start = source.indexOf('const imageLoader = {');
  const end = source.indexOf('\nconst autoFeed = {', start);
  const loader = vm.runInNewContext(source.slice(start, end) + '\nimageLoader', {
    IntersectionObserver, main: root, URL, AbortController, CatalogLogic
  });
  loader.cache.set('preview', { blobUrl: 'blob:cached', size: 20 });
  loader.mount(root);
  assert.equal(img.src, 'blob:cached', 'Do not wait for IntersectionObserver after a blank paint');
});

test('a visible thumbnail loads ahead of queued offscreen previews', async () => {
  class IntersectionObserver { observe() {} disconnect() {} }
  const root = { querySelectorAll: () => [], getBoundingClientRect: () => ({ top: 100, bottom: 900 }) };
  const started = [];
  const start = source.indexOf('const imageLoader = {');
  const end = source.indexOf('\nconst autoFeed = {', start);
  const loader = vm.runInNewContext(source.slice(start, end) + '\nimageLoader', {
    IntersectionObserver, main: root, URL, AbortController, CatalogLogic,
    fetch: url => { started.push(new URL(url, 'http://local').searchParams.get('url')); return new Promise(() => {}); }
  });
  const image = (url, top) => ({ dataset: { imageUrl: url }, isConnected: true,
    getBoundingClientRect: () => ({ top, bottom: top + 200 }) });
  const offscreen = image('prefetch', 1000), visible = image('visible', 200);
  loader.visible = new Set([offscreen, visible]);
  loader.queue = [offscreen, visible].map(img => ({ url: img.dataset.imageUrl,
    images: new Set([img]), generation: loader.generation }));
  loader.active = 3;
  await loader.drain();
  assert.deepEqual(started, ['visible']);
});

test('renewing a Sankaku signature reuses decoded pixels without a second request', () => {
  const old = 'https://s.sankakucomplex.com/a.jpg?e=1&m=old';
  const fresh = 'https://s.sankakucomplex.com/a.jpg?e=2&m=new';
  const img = { dataset: { imageUrl: old }, isConnected: true, src: '',
    getAttribute(name) { return name === 'src' ? this.src : null; },
    closest: () => ({ classList: { remove() {} } }) };
  const root = { querySelectorAll: () => [img] };
  class IntersectionObserver { observe() {} disconnect() {} }
  const start = source.indexOf('const imageLoader = {');
  const end = source.indexOf('\nconst autoFeed = {', start);
  const loader = vm.runInNewContext(source.slice(start, end) + '\nimageLoader', {
    IntersectionObserver, main: root, URL, AbortController, CatalogLogic,
    fetch: () => { throw new Error('Cached artwork must not be fetched again'); }
  });
  loader.cache.set(CatalogLogic.mediaCacheKey(old), { blobUrl: 'blob:cached', size: 20 });
  loader.mount(root);
  assert.equal(img.src, 'blob:cached');
  img.dataset.imageUrl = fresh;
  loader.refresh(root);
  assert.equal(img.src, 'blob:cached');
  assert.equal(loader.queue.length, 0);
});

test('rerender retains the existing image node for a renewed signature', () => {
  const start = source.indexOf('function canReconcileNode(');
  const end = source.indexOf('\nfunction reconcileChildren(', start);
  const canReconcileNode = vm.runInNewContext(source.slice(start, end) + '\ncanReconcileNode', {
    Node: { ELEMENT_NODE: 1 }, CatalogLogic
  });
  const image = url => ({ nodeType: 1, tagName: 'IMG', dataset: { imageUrl: url } });
  const old = 'https://s.sankakucomplex.com/a.jpg?e=1&m=old';
  const fresh = 'https://s.sankakucomplex.com/a.jpg?e=2&m=new';
  assert.equal(canReconcileNode(image(old), image(fresh)), true);
  assert.equal(canReconcileNode(image(old), image('https://s.sankakucomplex.com/b.jpg?e=2&m=new')), false);
  for (const host of ['cdn.donmai.us', 'gelbooru.com', 'rule34.xxx']) {
    const url = `https://${host}/a.jpg`;
    assert.equal(canReconcileNode(image(url), image(url)), true);
    assert.equal(canReconcileNode(image(url), image(`${url}?different=1`)), false);
  }
  const cardImage = (url, workKey) => ({ ...image(url),
    closest: () => ({ dataset: { workKey } }) });
  for (const host of ['cdn.donmai.us', 'gelbooru.com', 'rule34.xxx', 's.sankakucomplex.com']) {
    assert.equal(canReconcileNode(cardImage(`https://${host}/old.jpg`, 'work:1'),
      cardImage(`https://${host}/new.jpg`, 'work:1')), true);
    assert.equal(canReconcileNode(cardImage(`https://${host}/old.jpg`, 'work:1'),
      cardImage(`https://${host}/new.jpg`, 'work:2')), false);
  }
});

test('viewed identities rejected by a temporary failure can be saved on the next attempt', async () => {
  const start = source.indexOf('async function recordViewedWorks(');
  const end = source.indexOf('\nasync function refreshFollows(', start);
  const persisted = new Set(), attempts = [];
  let fail = true;
  const record = vm.runInNewContext(source.slice(start, end) + '\nrecordViewedWorks', {
    CatalogLogic, viewedTokens: persisted, viewedPending: new Set(), toast() {},
    request: async (url, options) => { const batch = JSON.parse(options.body); attempts.push(batch);
      if (fail) throw new Error('Temporary failure'); }
  });
  const item = { key: 'rule34:12', originalUrl: 'https://x.com/artist/status/123456789' };
  await record([item]);
  fail = false;
  await record([item]);
  assert.equal(attempts.length, 2);
  assert(persisted.has('key:rule34:12'));
  assert(persisted.has('original:x-status:123456789'));
});

test('a burst of subscription responses publishes all works without rebuilding the feed per response', async () => {
  const start = source.indexOf('function decorateFollowItems(');
  const end = source.indexOf('\nasync function loadBookmarks(', start);
  const follows = Array.from({ length: 20 }, (_, i) => ({ key: `gelbooru::${i}`,
    source: 'gelbooru', service: '', artistId: String(i), name: 'Artist ' + i }));
  const tab = { id: 1, kind: 'follows', rating: 'all', items: [] };
  let rebuilds = 0;
  const context = { CatalogLogic: { ...CatalogLogic, buildFollowFeed: (...args) => {
      rebuilds++; return CatalogLogic.buildFollowFeed(...args); } },
    AbortController, URLSearchParams, setTimeout, clearTimeout,
    follows, followedKeys: new Set(), contentPreferences: {}, settings: {}, activeId: 1,
    findTab: () => tab, refreshFollows: async () => true, rememberItems() {}, render() {},
    request: async url => { if (url === '/api/follows/seen') return follows;
      const artist = new URL(url, 'http://local').searchParams.get('artist');
      return { items: [{ key: `gelbooru:${artist}:1`, source: 'gelbooru', rating: 'e',
        images: [`https://example.org/${artist}.jpg`] }], hasMore: false }; }
  };
  const load = vm.runInNewContext(source.slice(start, end) + '\nloadFollowFeed', context);
  await load(tab);
  assert.equal(tab.items.length, 20);
  assert(rebuilds <= 3, `Expected coalesced updates, got ${rebuilds}`);
});

test('large grids render the viewport with surrounding rows and still reach the tail', () => {
  const start = source.indexOf('function renderGrid(');
  const end = source.indexOf('\nfunction measureVirtualGrids(', start);
  const tab = { id: 1, kind: 'bookmarks' };
  const main = { clientHeight: 1300, dataset: { tabId: '1' }, scrollTop: 0 };
  const items = Array.from({ length: 600 }, (_, i) => ({ key: 'work:' + i }));
  const render = vm.runInNewContext(source.slice(start, end) + '\nrenderGrid', {
    currentTab: () => tab, main, escapeHtml: v => String(v), filterFeedWorks: items => items,
    renderCard: item => `<article data-key="${item.key}"></article>`
  });
  const initial = render(items, 'bookmarks');
  const count = (initial.match(/<article/g) || []).length;
  assert(count <= 100, `1440p should not build ${count} cards for five visible rows`);
  main.scrollTop = 80 * 260;
  const tail = render(items, 'bookmarks');
  assert.match(tail, /data-key="work:599"/);
});

test('scrolling back above a virtual grid restores its first rows instead of leaving an empty spacer', () => {
  const start = source.indexOf("main.addEventListener('scroll',");
  const end = source.indexOf("\nwindow.addEventListener('resize',", start);
  let onScroll, renders = 0;
  const tab = { id: 1, gridTops: { bookmarks: 120 }, virtualState: {
    bookmarks: { pitch: 255, startRow: 18, endRow: 42, totalRows: 59, visibleRows: 6 }
  } };
  const main = { dataset: { tabId: '1' }, scrollTop: 0,
    addEventListener: (name, handler) => { onScroll = handler; } };
  vm.runInNewContext(source.slice(start, end), { main, virtualScrollPending: false,
    currentTab: () => tab, requestAnimationFrame: fn => fn(), render: () => renders++,
    autoFeed: { mount() {} }, expireRetainedFeedWorks: () => false });
  onScroll();
  assert.equal(renders, 1);
});

test('recommendation ranking runs outside the UI and preserves grouping and order', async () => {
  const start = source.indexOf('async function mergeRecommendationsAsync(');
  const end = source.indexOf('\nasync function loadRecommendations(', start);
  assert(start >= 0 && end > start, 'Background recommendation ranking exists');
  let mainCalls = 0, workerCalls = 0;
  class Worker {
    constructor() { this.handlers = {}; }
    addEventListener(name, handler) { this.handlers[name] = handler; }
    terminate() {}
    postMessage({ id, args }) {
      workerCalls++;
      queueMicrotask(() => this.handlers.message({ data: {
        id, value: CatalogLogic.mergeRecommendations(...structuredClone(args))
      } }));
    }
  }
  const merge = vm.runInNewContext(source.slice(start, end) + '\nmergeRecommendationsAsync', {
    Worker, setTimeout, clearTimeout,
    CatalogLogic: { mergeRecommendations: (...args) => { mainCalls++; return CatalogLogic.mergeRecommendations(...args); } }
  });
  const liked = [{ key: 'saved', tags: ['latex'] }];
  const candidates = [{ kind: 'other', items: ['danbooru', 'gelbooru'].map(source => ({
    key: source + ':1', source, rating: 'e', tags: ['latex'], contentHash: 'a'.repeat(32)
  })) }];
  const args = [liked, [], candidates, 'all', {}, 1];
  const actual = await merge(...args);
  assert.deepEqual(actual, CatalogLogic.mergeRecommendations(...args));
  assert.equal(workerCalls, 1);
  assert.equal(mainCalls, 0, 'Heavy ranking must not block the main thread');
});

test('recommendation controls share one tag profile and recompute when bookmarks are replaced', () => {
  let reads = 0, tags = ['latex', 'character_name'];
  const item = { key: 'saved', source: 'danbooru', title: 'character_name',
    get tags() { reads++; return tags; } };
  const liked = [item];
  CatalogLogic.recommendationTags(liked);
  assert.equal(CatalogLogic.recommendationTagGroups(liked, 1).names[0].tag, 'character name');
  CatalogLogic.recommendationQueryGroups(liked);
  assert.equal(reads, 1, 'Do not normalize the entire bookmark collection again for every control');
  tags = ['catsuit'];
  assert(CatalogLogic.recommendationTags([item]).some(n => n.tag === 'catsuit'));
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const CatalogLogic = require('../wwwroot/catalog-logic.js');
const source = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
const block = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const keys = items => Array.from(items, item => item.key);
const work = (catalog, id, extra = {}) => ({ source: catalog, id: String(id), key: `${catalog}:${id}`,
  images: [`https://fixture.test/${catalog}-${id}.png`], tags: ['landscape'], rating: 'g',
  published: '2025-01-01T00:00:00Z', ...extra });

function fixture(items = [work('danbooru', 1), work('gelbooru', 2)]) {
  const follow = { key: 'gelbooru::123', source: 'gelbooru', artistId: '123', name: 'Fixture artist',
    followedAt: '2024-01-01T00:00:00Z' };
  const tab = { id: 1, kind: 'follows', rating: 'general', followVersion: 1,
    followUpdateRevision: 1, followGroups: [{ follow, items }], followStreams: [], items: [],
    newKeys: new Set(), loading: false, followErrors: [], followSourceNotices: {} };
  const context = vm.createContext({ CatalogLogic, Map, Set, AbortController, URLSearchParams,
    setTimeout, clearTimeout, contentPreferences: { hideViewedAndSaved: true },
    viewedTokens: new Set(), viewedPending: new Set(), likes: [], bookmarks: [], recent: [],
    follows: [follow], followedKeys: new Set(), activeId: tab.id, settings: { hasApiKey: true },
    currentTab: () => tab, findTab: id => id === tab.id ? tab : null,
    main: { dataset: { tabId: '1' }, scrollTop: 0, clientHeight: 500 },
    names: { gelbooru: 'Gelbooru' }, escapeHtml: String, authorContextData: () => '',
    rememberItems() {}, refreshFollows: async () => true,
    renderCard: item => `<article class="card" data-key="${item.key}"></article>`,
    skeletons: () => '<div class="skeleton"></div>', renderErrors: () => '',
    request: async (url, options = {}) => {
      if (url.startsWith('/api/follows/cache?')) return options.method === 'POST' ? {} : { groups: [] };
      if (url === '/api/follows/seen') return [follow];
      return { items: items.filter(item => item.source === 'gelbooru'), hasMore: false };
    }
  });
  vm.runInContext(block('function knownWorkTokens(', '\nfunction measureVirtualGrids(') + '\n' +
    block('function decorateFollowItems(', '\nasync function loadBookmarks(') + '\n' +
    block('function renderFollowArtist(', '\nfunction selectLoadedProfileImage('), context);
  context.render = () => { context.html = context.renderFollows(tab); };
  return { context, tab, items, publish: () => context.updateFollowFeed(tab),
    draw: () => context.renderGrid(tab.items, 'follows', tab.newKeys, true),
    page: () => context.renderFollows(tab) };
}

test('a new Following generation excludes viewed, pending and saved works before counting New', async () => {
  for (const collection of ['viewedTokens', 'viewedPending', 'likes', 'bookmarks', 'recent']) {
    const f = fixture(), [known, fresh] = f.items;
    if (collection === 'viewedTokens' || collection === 'viewedPending')
      f.context[collection].add(`key:${known.key}`);
    else f.context[collection].push(known);
    await f.publish();
    assert.deepEqual(keys(f.tab.items), [fresh.key], collection);
    assert.deepEqual(Array.from(f.tab.newKeys), [fresh.key], `${collection}: hidden work is not New`);
  }
});

test('Following excludes incoming full-file and MD5 copies of previously liked works', async () => {
  for (const identity of ['media', 'hash']) {
    const known = work('danbooru', 1, identity === 'hash' ? { contentHash: 'a'.repeat(32) } : {});
    const mirror = work('gelbooru', 2, identity === 'hash'
      ? { contentHash: known.contentHash } : { images: known.images });
    const fresh = work('gelbooru', 3), f = fixture([mirror, fresh]);
    f.context.likes.push(known);
    await f.publish();
    assert.deepEqual(keys(f.tab.items), [fresh.key], identity);
  }
});

test('a newer catalog upload by another uploader cannot revive a previously liked work or its New count', async () => {
  for (const identity of ['media', 'hash']) {
    const known = work('danbooru', 1, { published: '2023-01-01T00:00:00Z', uploaderId: '101',
      ...(identity === 'hash' ? { contentHash: 'a'.repeat(32) } : {}) });
    const mirror = work('rule34', 2, { published: '2026-10-24T12:00:00Z', uploaderId: '202',
      ...(identity === 'hash' ? { contentHash: known.contentHash } : { images: known.images }) });
    const fresh = work('gelbooru', 3), f = fixture([mirror, fresh]);
    assert.equal(CatalogLogic.buildFollowFeed(f.tab.followGroups, f.tab.rating).newKeys.has(mirror.key), true,
      'The source record is newer according to its own catalog timestamp');
    f.context.likes.push(known);
    await f.publish();
    assert.deepEqual(keys(f.tab.items), [fresh.key], identity);
    assert.deepEqual(Array.from(f.tab.newKeys), [fresh.key], identity);
  }
});

test('unseen works with older or missing publication dates remain eligible without claiming New', async () => {
  const older = work('gelbooru', 1, { published: '2023-01-01T00:00:00Z' });
  const undated = work('rule34', 2, { published: '' });
  const f = fixture([undated, older]);
  await f.publish();
  assert.deepEqual(keys(f.tab.items), [older.key, undated.key]);
  assert.equal(f.tab.newKeys.size, 0);
});

test('a later upload of the same retained work does not promote its old slot as a fresh work', async () => {
  const first = work('gelbooru', 1, { published: '2023-12-01T00:00:00Z' });
  const known = work('danbooru', 2, { published: '2023-11-01T00:00:00Z', uploaderId: '101' });
  const f = fixture([first, known]);
  await f.publish(); f.draw();
  f.context.likes.push(known);
  const mirror = work('rule34', 3, { images: known.images,
    published: '2026-10-24T12:00:00Z', uploaderId: '202' });
  f.tab.followGroups[0].items.push(mirror);
  f.tab.followUpdateRevision++;
  await f.publish();
  assert.deepEqual(keys(f.tab.items), [first.key, known.key]);
  assert.equal(f.tab.newKeys.size, 0);
});

test('an existing New work keeps its badge while a genuinely fresh incoming group stays New', async () => {
  const old = work('gelbooru', 1, { published: '2023-12-01T00:00:00Z' });
  const currentNew = work('danbooru', 2), f = fixture([old, currentNew]);
  await f.publish(); f.draw();
  assert.deepEqual(Array.from(f.tab.newKeys), [currentNew.key]);
  const mirror = work('rule34', 3, { images: currentNew.images, published: '2026-10-24T12:00:00Z' });
  const fresh = work('gelbooru', 4, { published: '2026-10-24T13:00:00Z' });
  f.tab.followGroups[0].items.push(mirror, fresh);
  f.tab.followUpdateRevision++;
  await f.publish();
  assert.deepEqual(keys(f.tab.items), [currentNew.key, fresh.key, old.key]);
  assert.deepEqual(new Set(f.tab.newKeys), new Set([currentNew.key, fresh.key]));
  f.tab.followGroups[0].follow.seenKeys = { general: [currentNew.key, mirror.key, fresh.key] };
  f.tab.followUpdateRevision++;
  await f.publish();
  assert.equal(f.tab.newKeys.size, 0, 'The ordinary seen-key transition still removes New badges');
});

test('rendered Following cards stay after viewed or saved while newly known slots are excluded', async () => {
  for (const collection of ['viewedPending', 'likes', 'bookmarks']) {
    const f = fixture(), [first, second] = f.items;
    await f.publish(); f.draw();
    assert.equal(f.context.isRetainedFeedWork(f.tab, first), true, collection);
    if (collection === 'viewedPending')
      CatalogLogic.workHistoryTokens(first).forEach(token => f.context.viewedPending.add(token));
    else f.context[collection].push(first);
    const incoming = work('rule34', 3, { images: first.images });
    assert.equal(f.context.filterFeedWorks([incoming], f.tab, false, 'follows').length, 0,
      'A retained key does not grant its newly arrived standalone copy another slot');
    f.tab.followGroups[0].items.push(incoming, work('gelbooru', 4));
    f.tab.followUpdateRevision++;
    await f.publish();
    assert.deepEqual(keys(f.tab.items), [first.key, second.key, 'gelbooru:4'], collection);
    assert.match(f.draw(), /data-key="danbooru:1"/);
    assert.doesNotMatch(f.draw(), /feed-placeholder/);
  }
});

test('refreshing Following starts a new retention generation and hides previously rendered known cards', async () => {
  const f = fixture([work('gelbooru', 1), work('gelbooru', 2)]);
  await f.publish(); f.draw();
  f.context.likes.push(f.items[0]);
  assert.equal(f.context.isRetainedFeedWork(f.tab, f.items[0]), true);
  await f.context.loadFollowFeed(f.tab);
  await f.tab.followCacheSaveTail;
  assert.deepEqual(keys(f.tab.items), [f.items[1].key]);
  assert.equal(f.context.isRetainedFeedWork(f.tab, f.items[0]), false);
  assert.doesNotMatch(f.context.html, /data-key="gelbooru:1"/);
});

test('Following retains only materialized virtual cards from the current generation', async () => {
  const items = Array.from({ length: 300 }, (_, index) => work('gelbooru', index + 1));
  const f = fixture(items); await f.publish();
  const html = f.draw(), rendered = (html.match(/<article/g) || []).length;
  assert(rendered > 0 && rendered < items.length);
  assert.equal(f.tab.retainedFeedWorks?.size, rendered);
  const unseen = f.tab.items.at(-1);
  f.context.viewedTokens.add(`key:${unseen.key}`);
  assert.equal(f.context.isRetainedFeedWork(f.tab, unseen), false);
  f.tab.followUpdateRevision++;
  await f.publish();
  assert.equal(f.tab.items.some(item => item.key === unseen.key), false);
});

test('an all-known Following page explains hiding and continues pagination only after loading completes', async () => {
  const f = fixture(); f.items.forEach(item => f.context.likes.push(item));
  f.tab.followStreams = [{ source: 'gelbooru', buffer: [], nextPage: 1 }];
  await f.publish();
  assert.equal(f.tab.items.length, 0);
  f.tab.loading = true;
  assert.doesNotMatch(f.page(), /data-auto-load="follows"/);
  f.tab.loading = false;
  const html = f.page();
  assert.match(html, /нет новых для вас работ/);
  assert.match(html, /data-auto-load="follows"/);
});

test('Following advances through known-only pages until a fresh work arrives', async () => {
  const first = work('gelbooru', 1), second = work('gelbooru', 2), fresh = work('gelbooru', 3);
  const f = fixture([first]), pages = [], seen = [];
  f.context.likes.push(first, second);
  f.context.request = async (url, options = {}) => {
    if (url.startsWith('/api/follows/cache?')) return options.method === 'POST' ? {} : { groups: [] };
    if (url === '/api/follows/seen') { seen.push(JSON.parse(options.body)); return f.context.follows; }
    const page = Number(new URL(url, 'http://fixture').searchParams.get('page'));
    pages.push(page);
    return { items: [[first], [second], [fresh]][page], hasMore: page < 2 };
  };
  await f.context.loadFollowFeed(f.tab);
  assert.equal(f.tab.items.length, 0);
  assert.match(f.page(), /data-auto-load="follows"/);
  await f.context.loadMoreFollows(f.tab);
  assert.equal(f.tab.items.length, 0);
  assert.match(f.page(), /data-auto-load="follows"/);
  await f.context.loadMoreFollows(f.tab);
  await f.tab.followCacheSaveTail;
  assert.deepEqual(pages, [0, 1, 2]);
  assert.deepEqual(keys(f.tab.items), [fresh.key]);
  assert.equal(f.tab.hasMore, false);
  assert.deepEqual(seen.flatMap(entry => entry.workKeys[f.context.follows[0].key]), [fresh.key]);
});

test('publishing unchanged rendered Following cards avoids rebuilding the known-library index', async () => {
  const f = fixture(); await f.publish(); f.draw();
  f.context.likes.push(...f.items);
  const before = [...f.tab.items];
  f.context.knownWorkTokens = () => { throw new Error('Retained slots must not scan the library again'); };
  f.tab.followUpdateRevision++;
  await f.publish();
  assert.equal(f.tab.items.every((item, index) => item === before[index]), true);
});

test('disabling known-work hiding keeps known Following works and their New counts', async () => {
  const f = fixture(); f.context.contentPreferences.hideViewedAndSaved = false;
  f.items.forEach(item => f.context.likes.push(item));
  await f.publish();
  assert.deepEqual(keys(f.tab.items), keys(f.items));
  assert.equal(f.tab.newKeys.size, f.items.length);
});

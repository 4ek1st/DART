const test = require('node:test'), assert = require('node:assert/strict');
const Navigation = require('../wwwroot/artwork-navigation.js');
const Logic = require('../wwwroot/catalog-logic.js');
const fs = require('node:fs'), vm = require('node:vm');
const app = fs.readFileSync(require('node:path').join(__dirname, '../wwwroot/app.js'), 'utf8');
const work = id => ({ key: `danbooru:${id}`, id, source: 'danbooru', title: `Work ${id}` });
const same = (a, b) => Logic.workHistoryTokens(a).some(token => Logic.workHistoryTokens(b).includes(token));
const merge = Logic.mergeGroupedWorks;

test('both directions retain visited and liked work after the source changes', async () => {
  let items = [work(1), work(2), work(3)];
  const route = Navigation.create({ items, current: items[1], read: () => items, same, merge });
  assert.equal((await route.move(1)).id, 3);
  items = [work(3)];
  assert.equal((await route.move(-1)).id, 2);
  assert.equal((await route.move(-1)).id, 1);
  assert.equal(await route.move(-1), null);
  assert.equal((await route.move(1)).id, 2);
});
test('pagination traverses hidden-only pages and grouped catalog mirrors once', async () => {
  let items = [work(1)], page = 0;
  const pages = [[{ ...work(1), key: 'sankaku:1', source: 'sankaku', memberKeys: ['danbooru:1'] }],
    [{ ...work(2), hidden: true }], [work(3)]];
  const route = Navigation.create({ items, current: items[0], read: () => items,
    more: () => page < pages.length, load: async () => { items.push(...pages[page++]); },
    same, merge, allowed: item => !item.hidden });
  assert.equal((await route.move(1)).id, 3);
  assert.equal(page, 3);
  assert.equal((await route.move(-1)).id, 1);
  assert.equal(route.state.next, true);
  await route.move(1);
  assert.equal(await route.move(1), null);
  assert.equal(route.state.next, false);
});
test('rapid next requests share a page and a reverse request supersedes a slow move', async () => {
  let items = [work(1), work(2)], resolve, calls = 0;
  const route = Navigation.create({ items, current: items[1], read: () => items,
    more: () => items.length < 4, load: () => { calls++; return new Promise(done => { resolve = () => {
      items.push(work(3), work(4)); done(); }; }); } });
  const first = route.move(1), second = route.move(1);
  await Promise.resolve();
  assert.equal(calls, 1);
  resolve();
  assert.equal(await first, null);
  assert.equal((await second).id, 4);
  const pendingRoute = Navigation.create({ items: items.slice(0, 2), current: items[1],
    more: () => true, load: () => new Promise(done => { resolve = done; }) });
  const pending = pendingRoute.move(1); await Promise.resolve();
  assert.equal((await pendingRoute.move(-1)).id, 2);
  resolve(); assert.equal(await pending, null);
});
test('source failure is retryable and previous works remain available', async () => {
  let items = [work(1), work(2)], fails = true;
  const route = Navigation.create({ items, current: items[1], read: () => items, more: () => true,
    load: async () => { if (fails) throw new Error('Temporary'); items.push(work(3)); } });
  assert.equal(await route.move(1), null); assert.equal(route.state.error, true);
  assert.equal(route.state.previous, true);
  fails = false; assert.equal((await route.move(1)).id, 3);
});
test('cancelled navigation cannot open an artwork after leaving the viewer', async () => {
  let items = [work(1)], resolve;
  const route = Navigation.create({ items, current: items[0], read: () => items, more: () => true,
    load: () => new Promise(done => { resolve = () => { items.push(work(2)); done(); }; }) });
  const pending = route.move(1); await Promise.resolve(); route.cancel(); resolve();
  assert.equal(await pending, null); assert.equal(route.state.index, 0);
});
test('prefetch shares pending work with a boundary navigation', async () => {
  let items = [work(1)], resolve, calls = 0;
  const route = Navigation.create({ items, current: items[0], read: () => items,
    more: () => items.length === 1, load: () => { calls++; return new Promise(done => {
      resolve = () => { items.push(work(2)); done(); }; }); } });
  const prefetch = route.prefetch(), next = route.move(1); await Promise.resolve();
  assert.equal(calls, 1); resolve(); await prefetch;
  assert.equal((await next).id, 2); assert.equal(route.neighbors()[0].id, 1);
});
test('navigation loads are bounded without incorrectly declaring a live source exhausted', async () => {
  let calls = 0;
  const route = Navigation.create({ items: [work(1)], current: work(1), more: () => true,
    maxRounds: 3, load: async () => { calls++; } });
  assert.equal(await route.move(1), null); assert.equal(calls, 3);
  assert.equal(route.state.next, true); assert.equal(route.state.error, true);
});
test('late metadata merges a newly identified catalog copy without losing the current position', async () => {
  const items = [work(1), { ...work(2), source: 'rule34', key: 'rule34:2' }, work(3)];
  const route = Navigation.create({ items, current: items[0], same, merge });
  route.update({ ...items[0], contentHash: '1'.repeat(32) });
  route.update({ ...items[1], contentHash: '1'.repeat(32) });
  assert.equal(route.state.count, 2);
  assert.equal((await route.move(1)).id, 3);
  assert.equal((await route.move(-1)).id, 1);
});

test('incremental navigation grouping matches the complete pass for reported copies, variants and scene batches', () => {
  const reported = require('./fixtures/reported-variant-groups.json');
  const fixtures = [...Object.values(reported), require('./fixtures/sankaku-variants.json')];
  const summary = items => items.map(item => ({ key: item.key,
    members: [...item.memberKeys].sort(), images: [...item.images].sort() }));
  for (const original of fixtures) {
    const items = structuredClone(original);
    for (const split of [1, Math.ceil(items.length / 2)]) {
      const previous = Logic.groupWorks(items.slice(0, split)), incoming = items.slice(split);
      const complete = Logic.stableFeedItems(previous, Logic.groupWorks([...previous, ...incoming]));
      assert.deepEqual(summary(merge(previous, incoming)), summary(complete));
    }
  }
});

test('enriching one saved work keeps unrelated records intact instead of regrouping the whole collection', () => {
  const previous = Logic.groupWorks(Array.from({ length: 1000 }, (_, index) => work(index + 1)));
  const updated = { ...previous[0], contentHash: '2'.repeat(32), images: ['https://example.test/full.png'] };
  const next = merge(previous, [updated]);
  assert.equal(next.length, 1000);
  assert.equal(next[0].images[0], updated.images[0]);
  assert.equal(next[500], previous[500]);
  assert.equal(next[999], previous[999]);
});

test('invalidating newly learned grouping evidence also refreshes incremental navigation matches', () => {
  const previous = Logic.groupWorks([work(1), work(2)]);
  merge(previous, [work(3)]); // Populate the bounded-lifetime item evidence cache.
  previous[0].contentHash = 'a'.repeat(32);
  Logic.invalidateGrouping(previous);
  const mirror = { ...work(4), key: 'sankaku:4', source: 'sankaku', contentHash: previous[0].contentHash };
  const next = merge(previous, [mirror]);
  assert.equal(next.length, 2);
  assert.deepEqual(new Set(next[0].memberKeys), new Set(['danbooru:1', 'sankaku:4']));
});
test('shortcuts accept the physical F key and preserve text, video, menus and modifiers', () => {
  const event = { key: 'а', code: 'KeyF' };
  assert.equal(Navigation.shortcut(event), 'like');
  assert.equal(Navigation.shortcut({ key: 'ArrowRight' }), 'next');
  assert.equal(Navigation.shortcut({ key: 'ArrowLeft' }), 'previous');
  for (const field of ['repeat', 'ctrlKey', 'altKey', 'metaKey', 'shiftKey', 'isComposing', 'defaultPrevented'])
    assert.equal(Navigation.shortcut({ ...event, [field]: true }), '');
  assert.equal(Navigation.shortcut(event, { closest: () => true }), '');
  assert.equal(Navigation.shortcut(event, { isContentEditable: true }), '');
  assert.equal(Navigation.shortcut(event, null, true), '');
});

test('a Following snapshot preserves in-flight cursors and their group references after closing the feed', () => {
  const follow = { key: 'gelbooru::fixture_artist', source: 'gelbooru', artistId: 'fixture_artist' };
  const group = { follow, items: [work(1)] };
  const stream = { follow, source: 'gelbooru', group, buffer: [work(2)], nextPage: 1 };
  const source = { id: 2, kind: 'follows', started: true, followLoadingMore: true,
    followGroups: [group], followStreams: [], followPagingStreams: [stream],
    followController: new AbortController(), followCacheSaveTail: Promise.resolve() };
  const context = vm.createContext({ structuredClone, nextArtworkSourceId: -1 });
  vm.runInContext(app.slice(app.indexOf('function copyArtworkSource('),
    app.indexOf('\nfunction artworkRouteSource(')), context);
  const copy = context.copyArtworkSource(source);
  stream.buffer.length = 0;
  assert.equal(copy.artworkDetached, true);
  assert.equal(copy.followLoadingMore, false);
  assert.equal(copy.followStreams[0].buffer[0].id, 2);
  assert.equal(copy.followStreams[0].group, copy.followGroups[0]);
  assert.equal(copy.followController, undefined);
  assert.equal(copy.followCacheSaveTail, undefined);
});

test('a detached Following route can fetch another page with its own cancellation controller', async () => {
  const follow = { key: 'gelbooru::fixture_artist', source: 'gelbooru', artistId: 'fixture_artist' };
  const group = { follow, items: [work(1)] };
  const source = { id: -1, artworkDetached: true, followVersion: 1, rating: 'all',
    followGroups: [group], followStreams: [{ follow, source: 'gelbooru', group, buffer: [], nextPage: 1 }],
    followSourceNotices: {} };
  let requested = false;
  const context = vm.createContext({ CatalogLogic: Logic, AbortController, activeId: 0,
    findTab: () => null, followStreamRetryAt: () => 0,
    settings: { hasApiKey: true, hasRule34ApiKey: true, sankakuAvailable: true },
    requestFollowSource: async (entry, signal) => {
      assert.equal(entry.source, 'gelbooru'); assert.equal(signal.aborted, false); requested = true;
      return { items: [work(2)], hasMore: true, hasMoreSources: ['gelbooru'] };
    }, decorateFollowItems: (_follow, _source, items) => items,
    updateFollowFeed: tab => { tab.items = tab.followGroups.flatMap(group => group.items); },
    render() {}, saveFollowPreview() {}, scheduleFollowRetry() {}, markFollowItemsSeen: async () => {} });
  vm.runInContext(app.slice(app.indexOf('async function loadMoreFollows('),
    app.indexOf('\nasync function loadBookmarks(')), context);
  await context.loadMoreFollows(source);
  assert.equal(requested, true); assert.equal(source.items.length, 2);
  assert.equal(source.followStreams[0].nextPage, 2);
  assert.equal(source.followPagingStreams, undefined);
  assert.equal(source.followLoadingMore, false);
});

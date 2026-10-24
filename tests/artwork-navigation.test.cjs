const test = require('node:test'), assert = require('node:assert/strict');
const Navigation = require('../wwwroot/artwork-navigation.js');
const Logic = require('../wwwroot/catalog-logic.js');
const fs = require('node:fs'), vm = require('node:vm');
const app = fs.readFileSync(require('node:path').join(__dirname, '../wwwroot/app.js'), 'utf8');
const work = id => ({ key: `danbooru:${id}`, id, source: 'danbooru', title: `Work ${id}` });
const same = Logic.sameWork;
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

test('rapid next requests count visible works when a shared page begins with a hidden work', async () => {
  let items = [work(1)], resolve;
  const route = Navigation.create({ items, current: items[0], read: () => items,
    more: () => items.length === 1, allowed: item => !item.hidden,
    load: () => new Promise(done => { resolve = () => {
      items.push({ ...work(2), hidden: true }, work(3), work(4)); done();
    }; }) });
  const first = route.move(1), second = route.move(1);
  await Promise.resolve(); resolve();
  assert.equal(await first, null);
  assert.equal((await second).id, 4);
  assert.equal((await route.move(-1)).id, 3);
});

test('reversing one of several pending next requests retains the remaining visible steps', async () => {
  let items = [work(1)], resolve, calls = 0;
  const route = Navigation.create({ items, current: items[0], read: () => items,
    more: () => items.length === 1, load: () => { calls++; return new Promise(done => {
      resolve = () => { items.push(work(2), work(3), work(4)); done(); };
    }); } });
  const first = route.move(1), second = route.move(1), third = route.move(1);
  const reverse = route.move(-1);
  await Promise.resolve(); assert.equal(calls, 1); resolve();
  assert.deepEqual(await Promise.all([first, second, third]), [null, null, null]);
  assert.equal((await reverse)?.id, 3);
  assert.equal(route.state.busy, false);
});

test('queued next requests stop at the last visible work when the source becomes exhausted', async () => {
  let items = [work(1)], resolve;
  const route = Navigation.create({ items, current: items[0], read: () => items,
    more: () => items.length === 1, allowed: item => !item.hidden,
    load: () => new Promise(done => { resolve = () => {
      items.push(work(2), work(3), { ...work(4), hidden: true }); done();
    }; }) });
  const first = route.move(1), second = route.move(1), third = route.move(1);
  await Promise.resolve(); resolve();
  assert.deepEqual(await Promise.all([first, second]), [null, null]);
  assert.equal((await third)?.id, 3);
  assert.equal(route.state.next, false);
  assert.equal(await route.move(1), null);
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

function artworkSourceFixture(kind = 'follows', preferences = {}, detached = true) {
  const tags = Array.from({ length: 14 }, (_, index) => `tag_${index}`);
  const raw = [1, 2, 3].map(id => ({ ...work(id), source: 'rule34', key: `rule34:${id}`,
    creatorTag: id < 3 ? 'common_artist' : 'other_artist', tags,
    images: [`https://fixture.test/${id}.jpg`] }));
  const source = { id: -1, kind, rating: 'all', artworkDetached: detached, started: true,
    items: kind === 'follows' ? Logic.groupWorks(raw) : raw, hasMore: false, followStreams: [] };
  const context = vm.createContext({ CatalogLogic: Logic, DartArtworkNavigation: Navigation,
    structuredClone, nextArtworkSourceId: -2, artworkRoutes: new Set(),
    contentPreferences: preferences, recent: [], likes: [], bookmarks: [],
    viewedTokens: new Set(), viewedPending: new Set(), findTab: () => source,
    localStorage: { setItem() {} }, recordViewedWorks() {} });
  vm.runInContext(app.slice(app.indexOf('function recordDetailVisit('),
    app.indexOf('\nfunction abortTab(')), context);
  vm.runInContext(app.slice(app.indexOf('function knownWorkTokens('),
    app.indexOf('\nfunction emptyFeedMessage(')), context);
  vm.runInContext(app.slice(app.indexOf('function artworkSourceSignature('),
    app.indexOf('\nfunction pruneArtworkRoutes(')), context);
  const route = context.createArtworkRoute(source, source.items[0]);
  return { context, source, route };
}

function artworkTransitionFixture() {
  const fixture = artworkSourceFixture('search', { hideViewedAndSaved: true });
  const { context, source, route } = fixture;
  let active = { id: 1, kind: 'detail', item: source.items[0], artworkRoute: route };
  const displayed = [], prepared = [], released = [], gates = new Map();
  Object.assign(context, { AbortController, defaultSources: [], quickPreview: { open: false },
    quickPreviewGeneration: 0, currentTab: () => active, ratingFilterFor: () => 'all', toast() {},
    prepareArtworkMedia: async (item, signal) => {
      prepared.push({ key: item.key, signal });
      await gates.get(item.key);
      return () => released.push(item.key);
    },
    activate: (_id, _record, replacement) => {
      active = replacement; displayed.push(replacement.item); context.recordDetailVisit(replacement);
    } });
  vm.runInContext(app.slice(app.indexOf('async function moveArtwork('),
    app.indexOf('\nfunction openDetail(')), context);
  return { ...fixture, displayed, prepared, released,
    hold(key) { let resolve; gates.set(key, new Promise(done => { resolve = done; })); return resolve; } };
}

test('late thumbnail grouping refreshes a live viewer before forward navigation in Following and search', async () => {
  for (const kind of ['follows', 'search']) {
    const { source, route } = artworkSourceFixture(kind);
    const patch = { visualHash: '0123456789abcdef',
      visualPHash: 'abcdabcdabcdabcd', visualAspectRatio: 1 };
    for (const item of source.items.slice(0, 2)) Object.assign(item, patch);
    Logic.refineGrouping(source.items, source.items.slice(0, 2));
    assert.equal(Logic.groupWorks(source.items).length, 2);
    assert.equal((await route.engine.move(1))?.key, 'rule34:3', kind);
    assert.equal(route.engine.state.count, 2, kind);
    assert.equal((await route.engine.move(-1))?.key, 'rule34:1', kind);
  }
});

test('Following thumbnail evidence from its visible publication also refreshes the full viewer source', async () => {
  for (const closeSource of [false, true]) {
    const { context, source } = artworkSourceFixture('follows', {}, false);
    source.followVersion = 1; source.followUpdateRevision = 1;
    source.followGroups = [{ follow: { source: 'rule34', artistId: 'common_artist' }, items: source.items }];
    Object.assign(context, { rememberItems() {}, followStreamRetryAt: () => 0 });
    vm.runInContext(app.slice(app.indexOf('async function updateFollowFeed('),
      app.indexOf('\nasync function flushFollowUpdate(')), context);
    await context.updateFollowFeed(source);
    const full = source.followComputed.feed.items;
    assert.notEqual(source.items, full);
    Logic.groupWorks(full); // A consumer can already have cached the full source.
    const route = context.createArtworkRoute(source, source.items[0]);
    const patch = { visualHash: '0123456789abcdef', visualPHash: 'abcdabcdabcdabcd', visualAspectRatio: 1 };
    for (const item of source.items.slice(0, 2)) Object.assign(item, patch);
    Logic.refineGrouping(source.items, source.items.slice(0, 2));
    if (closeSource) context.findTab = () => null;
    assert.equal((await route.engine.move(1))?.key, 'rule34:3', `closed source: ${closeSource}`);
    assert.equal(route.engine.state.count, 2);
    assert.equal((await route.engine.move(-1))?.key, 'rule34:1');
  }
});

test('known filtering keeps late alias evidence for works already buffered by the viewer', async () => {
  const { context, source, route } = artworkSourceFixture('search', { hideViewedAndSaved: true });
  const learned = { ...source.items[0], contentHash: 'a'.repeat(32) };
  route.engine.update(learned);
  context.likes = [learned];
  source.retainedFeedWorks = new Map([['rule34:1', true]]);
  // The provider repeats an existing listing with a hash learned after the
  // current work's detail request. Its old viewer snapshot lacks that hash.
  source.items = source.items.map(item => item.key === 'rule34:2'
    ? { ...item, contentHash: learned.contentHash } : item);
  assert.equal((await route.engine.move(1))?.key, 'rule34:3');
  assert.equal(route.engine.state.count, 2);
  assert.equal((await route.engine.move(-1))?.key, 'rule34:1');
});

test('Following publication retains late identity evidence for an already buffered mirror', async () => {
  for (const closeSource of [false, true]) {
    const { context, source, route } = artworkSourceFixture('follows', { hideViewedAndSaved: true }, false);
    const learned = { ...source.items[0], contentHash: 'a'.repeat(32) };
    route.engine.update(learned);
    context.likes = [learned];
    source.followVersion = 1; source.followUpdateRevision = 1;
    source.retainedFeedWorks = new Map([['rule34:1', true]]);
    source.followGroups = [{ follow: { key: 'rule34::common_artist', source: 'rule34',
      artistId: 'common_artist' }, items: source.items.map(item => item.key === 'rule34:2'
      ? { ...item, contentHash: learned.contentHash } : item) }];
    Object.assign(context, { rememberItems() {}, followStreamRetryAt: () => 0 });
    vm.runInContext(app.slice(app.indexOf('async function updateFollowFeed('),
      app.indexOf('\nasync function flushFollowUpdate(')), context);
    await context.updateFollowFeed(source);
    assert.equal(source.items.some(item => item.key === 'rule34:2'), false);
    assert.equal(source.followComputed.feed.items.some(item => item.key === 'rule34:2'), true);
    if (closeSource) context.findTab = () => null;
    assert.equal((await route.engine.move(1))?.key, 'rule34:3', `closed source: ${closeSource}`);
    assert.equal(route.engine.state.count, 2);
    assert.equal((await route.engine.move(-1))?.key, 'rule34:1');
  }
});

test('a newly loaded known work never becomes a viewer slot while fresh works remain navigable', async () => {
  const { context, source, route } = artworkSourceFixture('follows', { hideViewedAndSaved: true });
  context.likes = [{ ...work(9), contentHash: 'b'.repeat(32) }];
  route.engine.select(source.items[2]);
  source.items = [...source.items, { ...work(4), contentHash: 'b'.repeat(32) }, work(5)];
  assert.equal((await route.engine.move(1))?.key, 'danbooru:5');
  assert.equal(route.engine.items.some(item => item.key === 'danbooru:4'), false);
  assert.equal((await route.engine.move(-1))?.key, 'rule34:3');
});

test('warming an unvisited listing that reveals a saved work skips it on forward navigation', async () => {
  for (const kind of ['follows', 'search']) {
    const { context, source, route } = artworkSourceFixture(kind, { hideViewedAndSaved: true });
    context.likes = [{ ...work(9), contentHash: 'c'.repeat(32) }];
    route.engine.update({ ...source.items[1], contentHash: 'c'.repeat(32) });
    assert.equal((await route.engine.move(1))?.key, 'rule34:3', kind);
    context.viewedTokens.add('key:rule34:1');
    assert.equal((await route.engine.move(-1))?.key, 'rule34:1', kind);
  }
});

test('late known identity during media preparation skips the target before the viewer displays it', async () => {
  const f = artworkTransitionFixture(), release = f.hold('rule34:2');
  f.context.likes = [{ ...work(9), contentHash: 'c'.repeat(32) }];
  const pending = f.context.moveArtwork(1);
  await new Promise(resolve => setImmediate(resolve));
  const learned = { ...f.source.items[1], contentHash: 'c'.repeat(32) };
  f.route.engine.update(learned); f.route.warmed.set(learned.key, learned);
  release(); await pending;
  assert.deepEqual(f.displayed.map(item => item.key), ['rule34:3']);
  assert.deepEqual(f.prepared.map(item => item.key), ['rule34:2', 'rule34:3']);
  assert.deepEqual(f.released, ['rule34:2', 'rule34:3']);
  assert.equal(f.route.visitedKeys.has('rule34:2'), false);
  assert.equal(f.route.visitedKeys.has('rule34:3'), true);
  await f.context.moveArtwork(-1);
  assert.equal(f.displayed.at(-1).key, 'rule34:1');
});

test('a reverse request cancels preparation after a newly known target was skipped', async () => {
  const f = artworkTransitionFixture(), releaseFirst = f.hold('rule34:2'), releaseNext = f.hold('rule34:3');
  f.context.likes = [{ ...work(9), contentHash: 'd'.repeat(32) }];
  const pending = f.context.moveArtwork(1);
  await new Promise(resolve => setImmediate(resolve));
  f.route.engine.update({ ...f.source.items[1], contentHash: 'd'.repeat(32) });
  releaseFirst(); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(f.prepared.map(item => item.key), ['rule34:2', 'rule34:3']);
  await f.context.moveArtwork(-1);
  releaseNext(); await pending;
  assert.equal(f.prepared[1].signal.aborted, true);
  assert.deepEqual(f.displayed, []);
  assert.equal(f.route.visitedKeys.has('rule34:2'), false);
  assert.equal(f.route.visitedKeys.has('rule34:3'), false);
});

test('media preparation commits the newest canonical metadata for an eligible target', async () => {
  const f = artworkTransitionFixture(), release = f.hold('rule34:2');
  const pending = f.context.moveArtwork(1);
  await new Promise(resolve => setImmediate(resolve));
  f.route.engine.update({ ...f.source.items[1], title: 'Updated during preparation' });
  release(); await pending;
  assert.equal(f.displayed[0].title, 'Updated during preparation');
});

test('skipping a terminal target restores the displayed position before the next Back request', async () => {
  const f = artworkTransitionFixture(), release = f.hold('rule34:3');
  f.route.engine.select(f.source.items[1]);
  f.context.activate(1, true, { id: 1, kind: 'detail', item: f.source.items[1], artworkRoute: f.route });
  f.displayed.length = 0;
  f.context.likes = [{ ...work(9), contentHash: 'f'.repeat(32) }];
  const pending = f.context.moveArtwork(1);
  await new Promise(resolve => setImmediate(resolve));
  f.route.engine.update({ ...f.source.items[2], contentHash: 'f'.repeat(32) });
  release(); await pending;
  assert.deepEqual(f.displayed, []);
  await f.context.moveArtwork(-1);
  assert.deepEqual(f.displayed.map(item => item.key), ['rule34:1']);
});

test('displayed works remain available in both directions after becoming known', async () => {
  const { context, route } = artworkSourceFixture('follows', { hideViewedAndSaved: true });
  const displayed = await route.engine.move(1);
  context.recordDetailVisit({ item: displayed, artworkRoute: route });
  assert.equal((await route.engine.move(1))?.key, 'rule34:3');
  assert.equal((await route.engine.move(-1))?.key, 'rule34:2');
  assert.equal((await route.engine.move(-1))?.key, 'rule34:1');
  assert.equal((await route.engine.move(1))?.key, 'rule34:2');
});

test('a superseded logical move cannot exempt an undisplayed known work', async () => {
  const { context, source, route } = artworkSourceFixture('search', { hideViewedAndSaved: true });
  const prepared = await route.engine.move(1);
  assert.equal(prepared.key, 'rule34:2');
  route.engine.cancel(); // Media preparation was superseded before the viewer showed it.
  route.engine.select(source.items[0]);
  context.likes = [{ ...work(9), contentHash: 'd'.repeat(32) }];
  route.engine.update({ ...prepared, contentHash: 'd'.repeat(32) });
  assert.equal((await route.engine.move(1))?.key, 'rule34:3');
});

test('same-size viewed and pending identity changes update forward eligibility immediately', async () => {
  for (const field of ['viewedTokens', 'viewedPending']) {
    const { context, route } = artworkSourceFixture('search', { hideViewedAndSaved: true });
    context[field].add('key:danbooru:9');
    context[field].delete('key:danbooru:9'); context[field].add('key:rule34:2');
    assert.equal((await route.engine.move(1))?.key, 'rule34:3', field);
    assert.equal((await route.engine.move(-1))?.key, 'rule34:1', field);
    context[field].delete('key:rule34:2'); context[field].add('key:danbooru:9');
    assert.equal((await route.engine.move(1))?.key, 'rule34:2', field);
  }
});

test('replacing or enriching a same-size saved library updates warmed viewer eligibility', async () => {
  const { context, source, route } = artworkSourceFixture('follows', { hideViewedAndSaved: true });
  route.engine.update({ ...source.items[1], contentHash: 'e'.repeat(32) });
  context.likes = [{ ...work(9), contentHash: 'e'.repeat(32) }];
  assert.equal((await route.engine.move(1))?.key, 'rule34:3');
  assert.equal((await route.engine.move(-1))?.key, 'rule34:1');
  context.likes = [{ ...work(9), contentHash: 'f'.repeat(32) }];
  assert.equal((await route.engine.move(1))?.key, 'rule34:2');
  route.engine.select(source.items[0]);
  context.likes[0].contentHash = 'e'.repeat(32); Logic.invalidateGrouping(context.likes);
  assert.equal((await route.engine.move(1))?.key, 'rule34:3');
});

test('known-work navigation follows the hide preference and preserves explicit author browsing', async () => {
  for (const [kind, enabled] of [['search', false], ['profile', true]]) {
    const { context, source, route } = artworkSourceFixture(kind, { hideViewedAndSaved: enabled });
    context.likes = [{ ...work(9), contentHash: 'a'.repeat(32) }];
    route.engine.update({ ...source.items[1], contentHash: 'a'.repeat(32) });
    assert.equal((await route.engine.move(1))?.key, 'rule34:2');
  }
});

test('a changed Following source signature keeps the viewer on its original result generation', async () => {
  const { context, source, route } = artworkSourceFixture('follows', {}, false);
  source.query = 'another_generation';
  source.items = [work(9)];
  source.followComputed = { version: 1, rating: source.rating, feed: { items: source.items } };
  context.findTab = () => null;
  assert.equal((await route.engine.move(1))?.key, 'rule34:2');
  assert.equal(route.engine.items.some(item => item.key === 'danbooru:9'), false);
});

test('a stale Following computed rating or version cannot replace the current viewer source', async () => {
  for (const stale of ['rating', 'version']) for (const closeSource of [false, true]) {
    const { context, source } = artworkSourceFixture('follows', {}, false);
    source.followComputed = { version: 1, rating: 'all', feed: { items: source.items } };
    source.rating = stale === 'rating' ? 'general' : 'all';
    source.followVersion = stale === 'version' ? 2 : 1;
    source.items = [work(9)];
    const route = context.createArtworkRoute(source, source.items[0]);
    source.items = [...source.items, work(10)];
    if (closeSource) context.findTab = () => null;
    assert.equal((await route.engine.move(1))?.key, 'danbooru:10', `${stale}, closed: ${closeSource}`);
    assert.equal(route.engine.items.some(item => item.key === 'rule34:1'), false);
  }
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

test('A/D browse and B bookmarks using physical keys across keyboard layouts', () => {
  for (const [event, expected] of [
    [{ key: 'ф', code: 'KeyA' }, 'previous'],
    [{ key: 'в', code: 'KeyD' }, 'next'],
    [{ key: 'и', code: 'KeyB' }, 'bookmark'],
    [{ key: 'A' }, 'previous'], [{ key: 'd' }, 'next'], [{ key: 'B' }, 'bookmark']
  ]) assert.equal(Navigation.shortcut(event), expected);
  assert.equal(Navigation.shortcut({ code: 'KeyA', repeat: true }), 'previous');
  assert.equal(Navigation.shortcut({ code: 'KeyD', repeat: true }), 'next');
  assert.equal(Navigation.shortcut({ code: 'KeyB', repeat: true }), '');
});

test('new viewer shortcuts do not steal editing, control shortcuts or composition', () => {
  for (const code of ['KeyA', 'KeyD', 'KeyB']) {
    for (const flag of ['ctrlKey', 'altKey', 'metaKey', 'shiftKey', 'isComposing', 'defaultPrevented'])
      assert.equal(Navigation.shortcut({ code, [flag]: true }), '');
    assert.equal(Navigation.shortcut({ code }, { isContentEditable: true }), '');
    assert.equal(Navigation.shortcut({ code }, { closest: () => ({}) }), '');
    assert.equal(Navigation.shortcut({ code }, null, true), '');
  }
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

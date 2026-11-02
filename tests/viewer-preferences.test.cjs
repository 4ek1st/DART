const test = require('node:test');
const assert = require('node:assert/strict');
const prefs = require('../wwwroot/viewer-preferences.js');
const logic = require('../wwwroot/catalog-logic.js');

test('NSFW choices are independent, default to both, and never restrict All images or SFW', () => {
  assert.deepEqual(prefs.normalize(), { nsfwRatings: { q: true, e: true }, videoSound: false });
  for (const [q, e, rating] of [[true, true, 'explicit'], [true, false, 'questionable'],
    [false, true, 'explicit-only'], [false, false, 'none']]) {
    const saved = JSON.parse(JSON.stringify({ nsfwRatings: { q, e }, videoSound: true }));
    assert.equal(prefs.rating('explicit', saved), rating);
    assert.equal(prefs.rating('all', saved), 'all');
    assert.equal(prefs.rating('general', saved), 'general');
    assert.equal(prefs.normalize(saved).videoSound, true);
  }
  assert.deepEqual(prefs.normalize({ nsfwRatings: { q: false, e: 'false' }, videoSound: 'true' }),
    { nsfwRatings: { q: false, e: true }, videoSound: false });
});

test('precise adult ratings filter Q and E consistently for all four catalogs', () => {
  for (const source of logic.supportedSources) {
    for (const [rating, values] of [['questionable', ['q', 'questionable']],
      ['explicit-only', ['e', 'explicit']], ['none', []]]) {
      for (const value of ['g', 's', 'safe', 'q', 'questionable', 'e', 'explicit', ''])
        assert.equal(logic.matchesRating({ source, rating: value }, rating), values.includes(value));
    }
  }
});

test('Following keeps its adult seen state while excluding the unchecked rating before grouping', () => {
  const groups = [{ follow: { followedAt: '2026-01-01', seenKeys: { explicit: ['sankaku:q1'] } },
    items: ['q', 'e', 'q'].map((rating, index) => ({ key: `sankaku:${rating}${index + 1}`,
      source: 'sankaku', rating, published: '2026-02-01' })) }];
  const feed = logic.buildFollowFeed(groups, 'explicit', 120, 'questionable');
  assert.deepEqual(feed.items.map(item => item.key), ['sankaku:q3', 'sankaku:q1']);
  assert.deepEqual([...feed.newKeys], ['sankaku:q3']);
  assert.deepEqual(logic.groupFollowFeed(groups, 'explicit', 'none').items, []);
});

test('opening videos uses saved sound without resetting a manual mute during a render', () => {
  const first = {}, second = {};
  prefs.configureVideo(first, { videoSound: true });
  assert.equal(first.muted, false); assert.equal(first.defaultMuted, false);
  first.muted = true;
  prefs.configureVideo(first, { videoSound: true });
  assert.equal(first.muted, true, 'a background render must preserve native player controls');
  prefs.configureVideo(second, { videoSound: true });
  assert.equal(second.muted, false, 'the next artwork uses the saved default again');
  prefs.configureVideo(second, { videoSound: false }, true);
  assert.equal(second.muted, true); assert.equal(second.defaultMuted, true);
  const silent = {};
  prefs.configureVideo(silent, {});
  assert.equal(silent.muted, true, 'existing users retain silent playback by default');
});

test('viewer choices survive the same client-state cleanup used for session restore', () => {
  const viewerPreferences = { nsfwRatings: { q: false, e: true }, videoSound: true };
  const state = logic.cleanClientState(JSON.parse(JSON.stringify({
    session: { tabs: [{ kind: 'search', rating: 'explicit' }], viewerPreferences }
  })));
  assert.deepEqual(prefs.normalize(state.session.viewerPreferences), viewerPreferences);
});

test('reusing a player for the next artwork reapplies the sound default', () => {
  const video = { dataset: { videoUrl: 'https://example.test/first.webm' } };
  prefs.configureVideo(video, { videoSound: false });
  video.muted = false;
  prefs.configureVideo(video, { videoSound: false });
  assert.equal(video.muted, false, 'the current player keeps its manual setting');
  video.dataset.videoUrl = 'https://example.test/next.webm';
  prefs.configureVideo(video, { videoSound: false });
  assert.equal(video.muted, true, 'a new artwork must use the saved sound default');
});

test('changing adult choices invalidates only NSFW feeds, including detached viewer sources', () => {
  const fs = require('node:fs'), vm = require('./helpers/viewer-vm.cjs');
  const source = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
  const explicit = { id: 1, kind: 'search', rating: 'explicit', started: true, items: [{ key: 'q' }] };
  const all = { id: 2, kind: 'search', rating: 'all', started: true, items: [{ key: 'all' }] };
  const saved = { id: 3, kind: 'likes', rating: 'explicit', started: true, items: [{ key: 'saved' }] };
  const detached = { id: -1, kind: 'follows', rating: 'explicit', started: true, items: [{ key: 'old' }] };
  const aborted = [];
  const context = vm.createContext({ tabs: [explicit, all, saved], artworkRoutes: new Set([
    { source: explicit, backup: detached, engine: { cancel() {} } }]),
    abortTab: tab => aborted.push(tab.id), currentTab: () => all, startTab() {}, render() {} });
  const start = source.indexOf('function refreshNsfwTabs(');
  vm.runInContext(source.slice(start, source.indexOf('\ntry {', start)), context);
  context.refreshNsfwTabs();
  assert.deepEqual(aborted, [1, -1]);
  assert.equal(explicit.started, false); assert.equal(detached.started, false);
  assert.deepEqual(all.items, [{ key: 'all' }]); assert.equal(all.started, true);
  assert.deepEqual(saved.items, [{ key: 'saved' }]); assert.equal(saved.started, true);
});

test('sound and rating choices restore even when no saved tab can be reopened', () => {
  const fs = require('node:fs'), vm = require('./helpers/viewer-vm.cjs');
  const source = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
  const viewerPreferences = { nsfwRatings: { q: false, e: true }, videoSound: true };
  const context = vm.createContext({ CatalogLogic: logic,
    localStorage: { getItem: () => JSON.stringify({ tabs: [], viewerPreferences }) } });
  const start = source.indexOf('function restoreSession(');
  vm.runInContext(source.slice(start, source.indexOf('\nfunction matchingTab(', start)), context);
  assert.equal(context.restoreSession(), false);
  assert.deepEqual(JSON.parse(JSON.stringify(context.viewerPreferences)), viewerPreferences);
});

test('both adult ratings off removes delayed retry streams as well as visible cards', () => {
  const vm = require('./helpers/viewer-vm.cjs');
  const context = vm.createContext({ activeId: 1, render() {},
    viewerPreferences: prefs.normalize({ nsfwRatings: { q: false, e: false } }) });
  const tab = { id: 1, rating: 'explicit', items: [{}], loading: true, hasMore: true,
    followStreams: [{ error: 'temporary', retryAt: 100 }], pausedSources: { rule34: {} } };
  assert.equal(context.stopEmptyRatingFeed(tab), true);
  assert.equal(tab.followStreams.length, 0);
  assert.equal(Object.keys(tab.pausedSources).length, 0);
  assert.equal(tab.hasMore, false); assert.equal(tab.loading, false);
});

test('renewing a signed video URL preserves the manual sound choice for that artwork', () => {
  const video = { dataset: { videoIdentity: 'sankaku:fixture|media.webm', videoUrl: 'media.webm?token=old' } };
  prefs.configureVideo(video, { videoSound: true });
  video.muted = true;
  video.dataset.videoUrl = 'media.webm?token=renewed';
  prefs.configureVideo(video, { videoSound: true });
  assert.equal(video.muted, true);
});

test('rating filters keep warm grouping inputs instead of rebuilding them on every render', () => {
  const items = [{ rating: 'q' }, { rating: 'e' }];
  assert.equal(prefs.filterItems(items, 'explicit', logic.matchesRating), items);
  const first = prefs.filterItems(items, 'questionable', logic.matchesRating);
  assert.equal(prefs.filterItems(items, 'questionable', logic.matchesRating), first);
  items.push({ rating: 'q' });
  assert.equal(prefs.filterItems(items, 'questionable', logic.matchesRating).length, 2);
  items[0] = { rating: 'e' };
  const updated = prefs.filterItems(items, 'questionable', logic.matchesRating, 1);
  assert.equal(updated.length, 1);
  assert.equal(prefs.filterItems(items, 'questionable', logic.matchesRating, 1), updated);
});

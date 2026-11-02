const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const CatalogLogic = require('../wwwroot/catalog-logic.js');
const source = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
const block = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));

function fixture(realRefresh = false) {
  const first = { source: 'danbooru', artistId: 'fixture_artist', name: 'Fixture Artist' };
  const other = { source: 'rule34', artistId: '42', name: 'Other Uploader' };
  const controls = [
    { dataset: { action: 'follow', followSource: first.source, followArtist: first.artistId } },
    { dataset: { action: 'follow', followSource: first.source, followArtist: first.artistId.toUpperCase() } },
    { dataset: { action: 'unfollow', followKey: 'danbooru::fixture_artist' } },
    { dataset: { action: 'follow', followSource: other.source, followArtist: other.artistId } }
  ].map(control => ({ ...control, disabled: false }));
  const writes = [], notices = [];
  const context = vm.createContext({ CatalogLogic, tabs: [], follows: [], followedKeys: new Set(), settings: {}, names: {},
    main: { querySelectorAll: () => [controls[0], controls[2], controls[3]] },
    quickPreview: { querySelectorAll: () => [controls[1]] },
    request: (url, options) => new Promise((resolve, reject) => writes.push({ url, options, resolve, reject })),
    refreshFollows: async () => true, currentTab: () => null, startTab() {}, render() {},
    toast: message => notices.push(message), authorContextData: () => '', escapeHtml: String
  });
  vm.runInContext(block('async function toggleFollow(', '\nfunction normalizeFollowTag(') + '\n' +
    block('function followButton(', '\nfunction renderFollows('), context);
  if (realRefresh) vm.runInContext(block('async function refreshFollows(', '\nfunction createRecommendationPools('), context);
  return { context, first, other, controls, writes, notices };
}

test('overlapping follow clicks for one identity issue one mutation and disable all matching controls', async () => {
  const f = fixture();
  const pending = f.context.toggleFollow(f.first);
  const duplicate = f.context.toggleFollow({ ...f.first, artistId: f.first.artistId.toUpperCase() });
  assert.equal(f.writes.length, 1, 'A second click must not undo the pending follow');
  assert.deepEqual(f.controls.map(control => control.disabled), [true, true, true, false]);
  assert.match(f.context.followButton(f.first), / disabled(?:\s|>)/);
  const management = f.context.renderFollowArtist({ ...f.first, key: 'danbooru::fixture_artist' }, {});
  assert.match(management, /data-action="unfollow"[^>]* disabled>/);
  f.writes[0].resolve({ following: true });
  await Promise.all([pending, duplicate]);
  assert.deepEqual(f.controls.map(control => control.disabled), [false, false, false, false]);
  assert.doesNotMatch(f.context.followButton(f.first), / disabled(?:\s|>)/);
  assert.equal(f.notices.length, 1);
});

test('unrelated follow mutations stay independent and a failed save releases its controls for retry', async () => {
  const f = fixture();
  const pending = f.context.toggleFollow(f.first);
  const independent = f.context.toggleFollow(f.other);
  assert.equal(f.writes.length, 2);
  assert.deepEqual(f.controls.map(control => control.disabled), [true, true, true, true]);
  f.writes[0].reject(new Error('Offline'));
  await pending;
  assert.deepEqual(f.controls.map(control => control.disabled), [false, false, false, true]);
  const retry = f.context.toggleFollow(f.first);
  assert.equal(f.writes.length, 3);
  f.writes[1].resolve({ following: true });
  f.writes[2].resolve({ following: true });
  await Promise.all([independent, retry]);
  assert.deepEqual(f.controls.map(control => control.disabled), [false, false, false, false]);
});

test('a delayed earlier follow read cannot erase a later confirmed subscription to another author', async () => {
  const f = fixture(true), tick = () => new Promise(resolve => setImmediate(resolve));
  const first = f.context.toggleFollow(f.first);
  f.writes[0].resolve({ following: true }); await tick();
  assert.equal(f.writes[1].url, '/api/follows');
  assert.equal(f.writes[1].options, undefined);
  const second = f.context.toggleFollow(f.other);
  f.writes[2].resolve({ following: true }); await tick();
  assert.equal(f.writes[3].url, '/api/follows');
  f.writes[3].resolve([f.first, f.other]); await second;
  f.writes[1].resolve([f.first]); await first;
  assert.deepEqual(Array.from(f.context.follows, follow => follow.artistId), ['fixture_artist', '42']);
  assert.equal(f.context.followedKeys.has('rule34::42'), true);
});

test('an obsolete failed follow read does not report an error after the newer snapshot succeeds', async () => {
  const f = fixture(true);
  const earlier = f.context.refreshFollows(), latest = f.context.refreshFollows();
  f.writes[1].resolve([f.other]); assert.equal(await latest, true);
  f.writes[0].reject(new Error('Earlier request failed')); assert.equal(await earlier, true);
  assert.equal(f.context.followedKeys.has('rule34::42'), true);
  assert.equal(f.notices.length, 0);
});

test('a current failed follow read keeps the last snapshot and exposes the error', async () => {
  const f = fixture(true);
  const initial = f.context.refreshFollows();
  f.writes[0].resolve([f.first]); await initial;
  const latest = f.context.refreshFollows();
  f.writes[1].reject(new Error('Offline'));
  assert.equal(await latest, false);
  assert.equal(f.context.followedKeys.has('danbooru::fixture_artist'), true);
  assert.equal(f.notices.length, 1);
});

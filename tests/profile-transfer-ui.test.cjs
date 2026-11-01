const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Transfer = require('../wwwroot/profile-transfer.js');
const file = (raw = '{}', name = 'profile.json') => ({ name, size: Buffer.byteLength(raw), text: async () => raw });
const response = (value, status = 200) => ({ ok: status === 200, status, json: async () => value, blob: async () => new Blob([JSON.stringify(value)]) });

test('choosing a profile only previews and import requires an explicit action', async () => {
  const calls = [], counts = { likes: 2, follows: 1 };
  const controller = Transfer.create({ fetch: async (url, options) => { calls.push([url, options]); return response(counts); } });
  assert.equal(await controller.choose(file('{"format":"dart-profile"}')), true);
  assert.deepEqual(controller.state.pending.counts, counts);
  assert.equal(calls.length, 1); assert.match(calls[0][0], /preview$/);
  assert.equal(controller.state.applySettings, false);
  controller.cancel(); assert.equal(controller.state.pending, null);
  assert.equal(await controller.import(), false); assert.equal(calls.length, 1);
});

test('import flushes current changes, defaults to merge without settings, and reloads after success', async () => {
  const order = [], result = { added: { likes: 2 }, changed: true };
  const controller = Transfer.create({ fetch: async url => { order.push(url); return response(url.endsWith('preview') ? {} : result); },
    beforeTransfer: async () => { order.push('flush'); return true; }, afterImport: async value => { assert.deepEqual(value, result); order.push('refresh'); } });
  await controller.choose(file()); order.length = 0;
  assert.equal(await controller.import(), true);
  assert.deepEqual(order, ['flush', '/api/profile-transfer/import?applySettings=false', 'refresh']);
  assert.equal(controller.state.pending, null); assert.deepEqual(controller.state.result, result);
});

test('settings apply only after opting in; duplicate clicks cannot start duplicate imports', async () => {
  let release, imports = 0;
  const controller = Transfer.create({ fetch: url => url.endsWith('preview') ? Promise.resolve(response({})) :
    (++imports, assert.match(url, /applySettings=true$/), new Promise(resolve => { release = () => resolve(response({ added: {} })); })) });
  await controller.choose(file()); controller.applySettings(true);
  const pending = controller.import(); await Promise.resolve();
  assert.equal(await controller.import(), false); controller.cancel();
  assert.equal(controller.state.busy, 'import'); release(); await pending; assert.equal(imports, 1);
});

test('invalid, oversized or failed preview never reaches import and can be retried', async () => {
  let calls = 0;
  const controller = Transfer.create({ fetch: async () => { calls++; return response({}, 400); } });
  assert.equal(await controller.choose({ size: Transfer.maxBytes + 1 }), false); assert.equal(calls, 0);
  assert.match(controller.state.error, /20 MB/);
  assert.equal(await controller.choose(file('{bad')), false); assert.equal(calls, 1);
  assert.equal(controller.state.pending, null); assert.equal(await controller.import(), false);
  assert.equal(controller.state.busy, '');
});

test('a cancelled stale preview cannot replace the selected file', async () => {
  let resolve;
  const controller = Transfer.create({ fetch: () => new Promise(done => { resolve = () => done(response({ likes: 9 })); }) });
  const pending = controller.choose(file()); await Promise.resolve();
  controller.cancel(); resolve(); assert.equal(await pending, false);
  assert.equal(controller.state.pending, null); assert.equal(controller.state.busy, '');
});

test('failed flush prevents import and preserves the pending file for retry', async () => {
  const calls = [];
  const controller = Transfer.create({ beforeTransfer: async () => false, fetch: async url => { calls.push(url); return response({}); } });
  await controller.choose(file()); assert.equal(await controller.import(), false);
  assert.equal(calls.length, 1); assert.ok(controller.state.pending); assert.match(controller.state.error, /current changes/);
});

test('export waits for the current profile and returns a downloadable JSON file', async () => {
  const order = [];
  const controller = Transfer.create({ beforeTransfer: async () => { order.push('flush'); return true; },
    fetch: async (url, options) => { order.push(url); assert.equal(options.cache, 'no-store'); return response({ format: 'dart-profile' }); },
    download: async (blob, name) => { order.push('download'); assert.match(name, /^DART-profile-\d{4}-\d{2}-\d{2}\.json$/); assert.equal(JSON.parse(await blob.text()).format, 'dart-profile'); } });
  assert.equal(await controller.export(), true);
  assert.deepEqual(order, ['flush', '/api/profile-transfer/export', 'download']); assert.equal(controller.state.busy, '');
});

test('settings integration has accessible preview, separate collections, explicit merge and translated UI', () => {
  const source = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
  assert.match(source, /profile-transfer-preview-title/); assert.match(source, /profile-transfer-confirm/);
  assert.match(source, /role="alert"/); assert.match(source, /data-action="profile-cancel"/);
  assert.match(source, /profileApplySettings/); assert.match(source, /\['likes', 'Liked'\], \['bookmarks', 'Bookmarks'\]/);
  assert.match(fs.readFileSync(require.resolve('../wwwroot/index.html'), 'utf8'), /profile-transfer\.js/);
  const rows = require('../wwwroot/locales.js'); assert.ok(rows.some(row => row[0] === 'Profile transfer' && row[1] && row[2]));
});

function hydrationFixture(posts) {
  const source = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
  const start = source.indexOf('const transferredMediaHydration = {');
  const end = source.indexOf('\nglobalThis.DartVideoPreview?.attach(', start);
  const requests = [], releases = new Map(); let tab = { id: 1, kind: 'likes' }, renders = 0;
  const context = vm.createContext({ AbortController, Date, recent: [], currentTab: () => tab,
    itemIndex: new Map(posts.map(post => [post.key, post])),
    main: { getBoundingClientRect: () => ({ top: 0, bottom: 1000 }), querySelectorAll: () => posts.map(post => ({
      dataset: { workKey: post.key }, getBoundingClientRect: () => ({ top: post.offscreen ? 3000 : 0, bottom: post.offscreen ? 3100 : 100 }) })) },
    sankakuMediaRecovery: { post(id, signal) { requests.push(id); return new Promise(resolve => releases.set(id, { resolve, signal })); } },
    CatalogLogic: { mergeDetailPages: (before, detail) => ({ ...before, ...detail }) }, rememberItem() {}, refreshSavedDetail() {}, render() { renders++; } });
  vm.runInContext(source.slice(start, end) + '\nthis.hydrator = transferredMediaHydration;', context);
  return { hydrator: context.hydrator, requests, releases, switchTab() { tab = { id: 2, kind: 'home' }; }, get renders() { return renders; } };
}
const turn = () => new Promise(resolve => setImmediate(resolve));

test('missing imported media rehydrates through two lanes and skips offscreen or other-provider cards', async () => {
  const posts = ['a', 'b', 'c'].map(id => ({ key: `sankaku:${id}`, source: 'sankaku', id, thumbnail: '' }));
  posts.push({ key: 'sankaku:far', source: 'sankaku', id: 'far', thumbnail: '', offscreen: true },
    { key: 'danbooru:1', source: 'danbooru', id: '1', thumbnail: '' });
  const f = hydrationFixture(posts); f.hydrator.scan(); assert.deepEqual(f.requests, ['a', 'b']);
  f.releases.get('a').resolve({ thumbnail: 'https://s.sankakucomplex.com/a.jpg' }); await turn();
  assert.deepEqual(f.requests, ['a', 'b', 'c']); assert.equal(posts[0].thumbnail, 'https://s.sankakucomplex.com/a.jpg');
  f.releases.get('b').resolve(null); f.releases.get('c').resolve(null); await turn();
  f.hydrator.scan(); assert.equal(f.requests.length, 3); assert.equal(f.renders, 1);
});

test('leaving the imported library cancels publication of pending thumbnail recovery', async () => {
  const post = { key: 'sankaku:a', source: 'sankaku', id: 'a', thumbnail: '' };
  const f = hydrationFixture([post]); f.hydrator.scan(); f.switchTab(); f.hydrator.scan();
  assert.equal(f.releases.get('a').signal.aborted, true);
  f.releases.get('a').resolve({ thumbnail: 'https://s.sankakucomplex.com/a.jpg' }); await turn();
  assert.equal(post.thumbnail, ''); assert.equal(f.renders, 0);
});

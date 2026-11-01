'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const logic = require('../wwwroot/catalog-logic.js');
const preview = 'https://s.sankakucomplex.com/preview/neutral.jpg?e=4102444800&m=fresh';
const image = 'https://s.sankakucomplex.com/data/neutral.png?e=4102444800&m=fresh';
const post = (id = 'Neutral123') => ({ key: `sankaku:${id}`, id, source: 'sankaku', thumbnail: '', images: [], title: 'Retained title', tags: ['retained_tag'] });
const detail = id => ({ ...post(id), thumbnail: preview, images: [image], tags: ['post_only_tag'], title: 'Abbreviated post title' });
const turn = () => new Promise(resolve => setImmediate(resolve));
function fixture(posts) {
  const source = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
  const start = source.indexOf('const transferredMediaHydration = {'), end = source.indexOf('\nglobalThis.DartVideoPreview?.attach(', start);
  let now = 100000, tab = { id: 1, kind: 'likes' }, renders = 0, nextTimer = 0;
  const calls = [], pending = [], timers = new Map();
  class Clock extends Date { static now() { return now; } }
  const context = vm.createContext({ Date: Clock, AbortController, CatalogLogic: logic,
    currentTab: () => tab, recent: [], itemIndex: new Map(posts.map(p => [p.key, p])),
    main: { getBoundingClientRect: () => ({ top: 0, bottom: 1000 }), querySelectorAll: () => posts.map(p => ({ dataset: { workKey: p.key }, getBoundingClientRect: () => ({ top: p.far ? 3000 : 0, bottom: p.far ? 3100 : 100 }) })) },
    sankakuMediaRecovery: { post(id, signal) { calls.push(id); return new Promise(resolve => pending.push({ id, signal, resolve })); } },
    imageLoader: { cached: () => false }, rememberItem() {}, refreshSavedDetail() {}, render() { renders++; },
    setTimeout(callback, delay) { const id = ++nextTimer;timers.set(id, { callback, at: now + delay });return id; }, clearTimeout(id) { timers.delete(id); } });
  vm.runInContext(source.slice(start, end) + '\nthis.hydration=transferredMediaHydration;', context);
  return { hydration: context.hydration, calls, pending, timers, get renders() { return renders; }, switchTab() { tab = { id: 2, kind: 'home' }; },
    async advance(ms) { now += ms;for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id);timer.callback(); }await turn(); } };
}
test('a transferred mixed-source group recovers its Sankaku member without changing primary identity or metadata', async () => {
  const member = post(), item = { ...post('Other'), key: 'danbooru:7', source: 'danbooru', id: '7', memberKeys: ['danbooru:7', member.key], groupMembers: [member] };
  const f = fixture([item]);f.hydration.scan();assert.deepEqual(f.calls, [member.id]);f.pending[0].resolve(detail(member.id));await turn();
  assert.equal(item.thumbnail, preview);assert.equal(item.key, 'danbooru:7');assert.equal(item.source, 'danbooru');assert.equal(item.id, '7');assert.equal(item.title, 'Retained title');assert.deepEqual(item.tags, ['retained_tag']);assert.ok(item.images.includes(image));
});
test('visible expired imported thumbnails recover by ID, while offscreen and other catalogs stay idle', async () => {
  const stale = { ...post(), thumbnail: preview.replace('4102444800', '1') }, far = { ...post('Far'), far: true }, other = { ...post('Other'), source: 'gelbooru', key: 'gelbooru:2', id: '2' };
  const f = fixture([stale, far, other]);f.hydration.scan();assert.deepEqual(f.calls, [stale.id]);f.pending[0].resolve(detail(stale.id));await turn();assert.equal(stale.thumbnail, preview);assert.equal(f.calls.length, 1);
});
test('visible failed imports retry after cooldown while idle, with bounded attempts and no tight loop', async () => {
  const f = fixture([post()]);f.hydration.scan();f.pending[0].resolve(null);await turn();assert.equal(f.calls.length, 1);assert.equal(f.timers.size, 1);
  await f.advance(59999);assert.equal(f.calls.length, 1);await f.advance(1);assert.equal(f.calls.length, 2);f.pending[1].resolve(detail('Neutral123'));await turn();assert.equal(f.renders, 1);assert.equal(f.timers.size, 0);
});
test('leaving the library cancels the scheduled retry and cannot publish a late response', async () => {
  const item = post(), f = fixture([item]);f.hydration.scan();f.switchTab();f.hydration.scan();assert.equal(f.pending[0].signal.aborted, true);f.pending[0].resolve(detail(item.id));await turn();assert.equal(item.thumbnail, '');assert.equal(f.renders, 0);assert.equal(f.timers.size, 0);
});
test('a persistently unavailable card stops automatic retries after three attempts', async () => {
  const f = fixture([post()]);f.hydration.scan();
  for (let attempt = 0; attempt < 3; attempt++) { f.pending[attempt].resolve(null);await turn();if (attempt < 2) await f.advance(60000); }
  assert.equal(f.calls.length, 3);assert.equal(f.timers.size, 0);f.hydration.scan();assert.equal(f.calls.length, 3);
});
test('a large mixed group tries at most two Sankaku members in each bounded attempt', async () => {
  const item = { ...post(), source: 'danbooru', key: 'danbooru:1', id: '1', memberKeys: Array.from({ length: 50 }, (_, i) => `sankaku:Member${i}`) };
  const f = fixture([item]);f.hydration.scan();f.pending[0].resolve(null);await turn();f.pending[1].resolve(null);await turn();assert.equal(f.calls.length, 2);
  await f.advance(60000);assert.equal(f.calls[2], 'Member2');f.pending[2].resolve(detail('Member2'));await turn();
  assert.equal(item.key, 'danbooru:1');assert.equal(item.thumbnail, preview);assert.equal(f.timers.size, 0);
});
test('shared recovery requests only lightweight media and does not cache a signature beyond its usable expiry', async () => {
  let now = Math.floor(Date.now() / 1000) * 1000, calls = 0;class Clock extends Date { static now() { return now; } }
  const source = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8'), start = source.indexOf('const sankakuMediaRecovery = {'), end = source.indexOf('\n// Portable profiles omit', start);
  const context = vm.createContext({ CatalogLogic: logic, Date: Clock, URL, AbortSignal,
    request: async url => { calls++;assert.equal(new URL(url, 'http://127.0.0.1').searchParams.get('mediaOnly'), 'true');return { ...detail('Neutral123'), thumbnail: preview.replace('4102444800', String((now + 20000) / 1000)), images: [] }; } });
  vm.runInContext(source.slice(start, end) + '\nthis.recovery=sankakuMediaRecovery;', context);
  const signal = new AbortController().signal;await context.recovery.post('Neutral123', signal);await context.recovery.post('Neutral123', signal);assert.equal(calls, 1);
  now += 6000;await context.recovery.post('Neutral123', signal);assert.equal(calls, 2);await context.recovery.post('../invalid', signal);assert.equal(calls, 2);
});

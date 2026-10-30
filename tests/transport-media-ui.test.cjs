'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const CatalogLogic = require('../wwwroot/catalog-logic.js');
const DartResourceCache = require('../wwwroot/resource-cache.js');
const source = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
const start = source.indexOf('async function request('), end = source.indexOf('\nconst visualHashJobs', start);
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function fixture(t) {
  const calls = [], promises = [];
  const context = vm.createContext({ CatalogLogic, DartResourceCache, AbortController, URLSearchParams,
    structuredClone, setTimeout, clearTimeout,
    fetch: async (url, options) => {
      const gate = deferred(), call = { url, signal: options.signal, gate, bodyRead: false }; calls.push(call);
      const read = async value => {
        call.bodyRead = true;
        await Promise.race([gate.promise, new Promise((_, reject) => options.signal?.addEventListener('abort', () =>
          reject(Object.assign(new Error('body cancelled'), { name: 'AbortError' })), { once: true }))]);
        return value;
      };
      return { ok: true, status: 200, headers: { get: () => '' },
        json: () => read({ items: [], saved: true }), blob: () => read({ size: 12 }) };
    } });
  vm.runInContext(source.slice(start, end), context);
  context.addCatalogVisualHashes = () => {};
  const track = promise => { promises.push(promise.catch(() => {})); return promise; };
  t.after(async () => {
    for (let round = 0; round < 10; round++) { calls.forEach(call => call.gate.resolve()); await tick(); }
    await Promise.all(promises);
  });
  return { context, calls, track };
}

test('real catalog and image callbacks hold a shared lane through JSON and blob body reads', async t => {
  const f = fixture(t), c = f.context;
  for (let index = 0; index < 2; index++)
    f.track(c.request(`/api/search?q=neutral_${index}&sources=danbooru`));
  for (let index = 0; index < 3; index++)
    f.track(c.readMediaBlob(`https://example.test/neutral_${index}.jpg`));
  await tick();
  f.track(c.request('/api/detail?source=danbooru&id=7', { priority: 'foreground' }));
  await tick();
  assert.equal(f.calls.length, 5, 'independent JSON/image caches cannot occupy all six browser connections');
  assert(f.calls.every(call => call.bodyRead), 'headers arrived, so the slots are held by unfinished bodies');
  assert(f.calls.some(call => call.url.startsWith('/api/detail?')));
  assert.equal(c.catalogTransport().stats.active, 5);
  assert.equal(c.catalogTransport().stats.queued, 1);
});

test('an image already queued behind four JSON bodies promotes for a foreground viewer without another fetch', async t => {
  const f = fixture(t), c = f.context;
  for (let index = 0; index < 4; index++) f.track(c.requestJson('/api/search?q=hold_' + index));
  const url = 'https://example.test/adopted.jpg';
  const warm = f.track(c.readMediaBlob(url, undefined, { priority: 'background' }));
  await tick();
  assert.equal(f.calls.length, 4, 'warm pixels wait behind ordinary work at the global budget');
  const visible = f.track(c.readMediaBlob(url, undefined, { priority: 'foreground' }));
  await tick();
  const reads = f.calls.filter(call => call.url.startsWith('/api/image?'));
  assert.equal(reads.length, 1, 'foreground adoption must promote the existing queued load');
  assert.equal(c.catalogTransport().stats.active, 5);
  reads[0].gate.resolve();
  assert.equal((await warm).size, 12); assert.equal((await visible).size, 12);
});

test('a saved-work mutation keeps foreground access while ordinary feed bodies are held', async t => {
  const f = fixture(t), c = f.context;
  for (let index = 0; index < 4; index++) f.track(c.requestJson('/api/search?q=hold_' + index));
  await tick();
  const saved = f.track(c.request('/api/likes', { method: 'POST', body: '{}' }));
  await tick();
  const write = f.calls.find(call => call.url === '/api/likes');
  assert(write, 'a like should not wait for unrelated feed bodies');
  write.gate.resolve(); assert.equal((await saved).saved, true);
});

test('aborting a body reader releases its shared transport while leaving other cache readers intact', async t => {
  const f = fixture(t), c = f.context, controller = new AbortController();
  const aborted = f.track(c.requestJson('/api/search?q=abandon', { signal: controller.signal }));
  for (let index = 0; index < 4; index++) f.track(c.requestJson('/api/search?q=held_' + index));
  await tick();
  assert.equal(f.calls.length, 4);
  const rejected = assert.rejects(aborted, { name: 'AbortError' });
  controller.abort(); await rejected;
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(f.calls[0].signal.aborted, true);
  assert.equal(f.calls.length, 5, 'one waiting ordinary request can now consume the freed slot');
  assert.equal(c.catalogTransport().stats.active, 4);
});

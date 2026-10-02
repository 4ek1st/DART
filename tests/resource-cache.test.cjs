const test = require('node:test');
const assert = require('node:assert/strict');
const { create } = require('../wwwroot/resource-cache.js');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

test('concurrent readers share work and cancelling one does not cancel the other', async () => {
  const ready = deferred(); let calls = 0, underlying;
  const cache = create({ load: (_url, signal) => { calls++; underlying = signal; return ready.promise; } });
  const controller = new AbortController();
  const first = cache.get('same', controller.signal).catch(error => error.name);
  const second = cache.get('same');
  controller.abort(); await Promise.resolve();
  assert.equal(await first, 'AbortError'); assert.equal(underlying.aborted, false);
  ready.resolve('pixels'); assert.equal(await second, 'pixels');
  assert.equal(await cache.get('same'), 'pixels'); assert.equal(calls, 1);
});

test('a quick tab return joins the pending request during the cancellation grace period', async () => {
  const ready = deferred(); let calls = 0;
  const cache = create({ grace: 30, load: () => { calls++; return ready.promise; } });
  const leaving = new AbortController();
  const first = cache.get('image', leaving.signal).catch(error => error.name);
  leaving.abort(); assert.equal(await first, 'AbortError');
  const returning = cache.get('image'); ready.resolve('pixels');
  assert.equal(await returning, 'pixels'); assert.equal(calls, 1);
});

test('abandoned queued requests are removed, active work is bounded and cancellation reaches the transport', async () => {
  const calls = [], releases = [];
  const cache = create({ concurrency: 2, grace: 0, load: (key, signal) => new Promise((resolve, reject) => {
    calls.push(key); releases.push(resolve);
    signal.addEventListener('abort', () => reject(Object.assign(new Error('cancelled'), { name: 'AbortError' })));
  }) });
  const a = new AbortController(), c = new AbortController();
  const first = cache.get('a', a.signal).catch(e => e.name), second = cache.get('b');
  const third = cache.get('c', c.signal).catch(e => e.name);
  await Promise.resolve(); assert.deepEqual(calls, ['a', 'b']); assert.equal(cache.stats.queued, 1);
  c.abort(); await third; await wait(5); assert.equal(cache.stats.queued, 0);
  a.abort(); await first; await wait(5); assert.equal(cache.stats.active, 1);
  releases[1]('b'); await second;
  assert.deepEqual(calls, ['a', 'b']);
});

test('failures and partial source responses are retried rather than cached', async () => {
  let calls = 0;
  const cache = create({ keep: value => !value.errors, load: async () => {
    if (++calls === 1) throw new Error('offline');
    return calls === 2 ? { errors: { rule34: 'unavailable' } } : { items: ['ready'] };
  } });
  await assert.rejects(cache.get('page'), /offline/);
  await wait(0); assert.ok((await cache.get('page')).errors);
  await wait(0); assert.deepEqual(await cache.get('page'), { items: ['ready'] });
  assert.equal(calls, 3);
});

test('expiry, memory limits, LRU and explicit refresh bound retained data', async () => {
  let now = 0; const calls = [];
  const cache = create({ now: () => now, ttl: 10, maxEntries: 2, maxBytes: 6, size: value => value.length,
    load: async key => { calls.push(key); return key; } });
  await cache.get('aaa'); await cache.get('bbb'); await cache.get('aaa'); await cache.get('ccc');
  assert.equal(cache.stats.entries, 2); assert.equal(cache.stats.bytes, 6);
  await cache.get('aaa'); assert.equal(calls.filter(key => key === 'aaa').length, 1);
  await cache.get('bbb'); assert.equal(calls.filter(key => key === 'bbb').length, 2);
  now = 11; await cache.get('bbb'); assert.equal(calls.filter(key => key === 'bbb').length, 3);
  cache.clear(); assert.equal(cache.stats.bytes, 0);
  await cache.get('too-large'); assert.equal(cache.stats.entries, 0);
});

test('an older in-flight result cannot refill a cleared cache or replace a fresh request', async () => {
  const old = deferred(); let calls = 0;
  const cache = create({ load: () => ++calls === 1 ? old.promise : Promise.resolve('new') });
  const pending = cache.get('page'); await Promise.resolve(); cache.clear();
  assert.equal(await cache.get('page'), 'new'); old.resolve('old'); assert.equal(await pending, 'old');
  assert.equal(await cache.get('page'), 'new'); assert.equal(calls, 2);
});

test('network timeout releases a slot and leaves the request retryable', async () => {
  let calls = 0;
  const cache = create({ timeout: 10, load: (_key, signal) => {
    if (++calls > 1) return 'ready';
    return new Promise((_, reject) => signal.addEventListener('abort', () =>
      reject(Object.assign(new Error('timeout'), { name: 'AbortError' }))));
  } });
  await assert.rejects(cache.get('page'), { name: 'AbortError' });
  await wait(0); assert.equal(await cache.get('page'), 'ready');
});

test('renewing one artwork invalidates its old response without evicting other pages',async()=>{
  let calls=0;const cache=create({load:async key=>({key,revision:++calls})});
  await cache.get('art');await cache.get('feed');cache.invalidate('art');
  assert.equal((await cache.get('art')).revision,3);
  assert.equal((await cache.get('feed')).revision,2);assert.equal(calls,3);
});

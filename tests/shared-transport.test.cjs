'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { create, createTransport } = require('../wwwroot/resource-cache.js');
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function fixture(t, options = {}) {
  const transport = createTransport({ timeout: 1000, ...options });
  const calls = [], gates = [], promises = [];
  const run = (key, priority, signal) => {
    const promise = transport.run(inner => {
      calls.push(key); const gate = deferred(); gates.push(gate);
      return Promise.race([gate.promise, new Promise((_, reject) => inner.addEventListener('abort', () =>
        reject(Object.assign(new Error('cancelled'), { name: 'AbortError' })), { once: true }))]);
    }, signal, { priority });
    promises.push(promise.catch(() => {})); return promise;
  };
  t.after(async () => {
    for (let round = 0; round < 8; round++) { gates.forEach(gate => gate.resolve('done')); await tick(); }
    await Promise.all(promises);
  });
  return { transport, calls, gates, run };
}

test('catalog and image work share four ordinary lanes plus one foreground lane', async t => {
  const f = fixture(t);
  for (let index = 0; index < 6; index++) void f.run('ordinary-' + index);
  await tick();
  assert.equal(f.calls.length, 4);
  assert.equal(f.transport.stats.active, 4);
  assert.equal(f.transport.stats.queued, 2);
  void f.run('current-artwork', 'foreground'); await tick();
  assert.equal(f.calls.at(-1), 'current-artwork');
  assert.equal(f.transport.stats.active, 5, 'a sixth browser connection remains outside the JavaScript budget');
  assert.equal(f.transport.stats.entries, 0, 'the transport budget retains no response cache');
});

test('background activity is capped while ordinary and foreground work can proceed', async t => {
  const f = fixture(t);
  for (let index = 0; index < 4; index++) void f.run('background-' + index, 'background');
  await tick(); assert.equal(f.calls.length, 2);
  void f.run('ordinary'); void f.run('foreground', 'foreground'); await tick();
  assert(f.calls.includes('ordinary')); assert(f.calls.includes('foreground'));
  assert.equal(f.calls.filter(key => key.startsWith('background-')).length, 2);
});

test('a cached warm request queued at the global budget promotes when a foreground reader adopts it', async t => {
  const f = fixture(t);
  for (let index = 0; index < 4; index++) void f.run('ordinary-' + index);
  let loads = 0; const finish = deferred();
  const cache = create({ load: (_key, signal, scheduling) => {
    loads++;
    return f.transport.run(() => { f.calls.push('adopted'); return finish.promise; }, signal, scheduling);
  } });
  t.after(() => finish.resolve('pixels'));
  const warm = cache.get('same-media', undefined, { priority: 'background' });
  await tick(); assert.equal(f.calls.includes('adopted'), false);
  const visible = cache.get('same-media', undefined, { priority: 'foreground' });
  await tick();
  assert.equal(f.calls.includes('adopted'), true, 'promotion must reach a transport already queued by the cache loader');
  assert.equal(f.transport.stats.active, 5);
  finish.resolve('pixels');
  assert.deepEqual(await Promise.all([warm, visible]), ['pixels', 'pixels']);
  assert.equal(loads, 1, 'adoption cannot duplicate the original cached load');
});

test('cancelling before a transport grant neither runs the task nor consumes a later slot', async t => {
  const f = fixture(t);
  for (let index = 0; index < 4; index++) void f.run('ordinary-' + index);
  const controller = new AbortController();
  const queued = f.run('abandoned', undefined, controller.signal);
  const rejected = assert.rejects(queued, { name: 'AbortError' });
  await tick(); controller.abort(); await rejected;
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(f.transport.stats.queued, 0);
  f.gates[0].resolve('done'); await tick();
  assert.equal(f.calls.includes('abandoned'), false);
});

test('cancelling an active body reader reaches the transport and releases its lane', async () => {
  const transport = createTransport({ timeout: 1000 });
  const controller = new AbortController(); let underlying;
  const promise = transport.run(signal => {
    underlying = signal;
    return new Promise((_, reject) => signal.addEventListener('abort', () =>
      reject(Object.assign(new Error('body cancelled'), { name: 'AbortError' })), { once: true }));
  }, controller.signal);
  const rejected = assert.rejects(promise, { name: 'AbortError' });
  await tick(); controller.abort(); await rejected;
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(underlying.aborted, true);
  assert.equal(transport.stats.active, 0);
  assert.equal(await transport.run(async () => 'new-body'), 'new-body');
});

test('transport queue length is bounded independently of response caching', async t => {
  const f = fixture(t, { maxQueued: 2 });
  for (let index = 0; index < 6; index++) void f.run('ordinary-' + index);
  await tick(); assert.equal(f.transport.stats.queued, 2);
  await assert.rejects(f.run('excess'), { name: 'TransportQueueFullError' });
  assert.equal(f.transport.stats.queued, 2);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { create } = require('../wwwroot/resource-cache.js');
const tick = () => new Promise(resolve => setImmediate(resolve));

function fixture(t) {
  const started = [], releases = new Map(), controllers = [];
  const cache = create({ concurrency: 3, foregroundReserve: 1, backgroundConcurrency: 1,
    grace: 0, load: (key, signal) => new Promise((resolve, reject) => {
      started.push(key); releases.set(key, resolve);
      signal.addEventListener('abort', () => reject(Object.assign(new Error('cancelled'), { name: 'AbortError' })), { once: true });
    }) });
  const get = (key, priority) => {
    const controller = new AbortController(); controllers.push(controller);
    const promise = cache.get(key, controller.signal, { priority }).catch(error => error.name);
    return { controller, promise };
  };
  t.after(async () => {
    controllers.forEach(controller => controller.abort());
    releases.forEach(resolve => resolve('cleanup'));
    await new Promise(resolve => setTimeout(resolve, 5));
  });
  return { cache, get, started, releases };
}

test('a foreground artwork starts while background and normal downloads retain their reserved limits', async t => {
  const f = fixture(t);
  f.get('background-1', 'background'); f.get('background-2', 'background');
  f.get('normal-1', 'normal'); f.get('normal-2', 'normal');
  const foreground = f.get('current-artwork', 'foreground');
  await tick();
  assert.deepEqual(f.started, ['background-1', 'normal-1', 'current-artwork']);
  assert.equal(f.cache.stats.active, 3);
  f.releases.get('current-artwork')('current pixels');
  assert.equal(await foreground.promise, 'current pixels');
  await tick();
  assert.equal(f.started.includes('normal-2'), false, 'Normal work must leave the foreground slot free again');
  f.releases.get('normal-1')('normal pixels'); await tick();
  assert.equal(f.started.includes('normal-2'), true);
  assert.equal(f.started.includes('background-2'), false, 'Speculative work cannot consume every shared slot');
});

test('a foreground reader promotes one queued shared request without cancelling its other reader', async t => {
  const f = fixture(t);
  f.get('background-1', 'background'); f.get('normal-1', 'normal');
  const speculative = f.get('next-artwork', 'background');
  await tick(); assert.equal(f.started.includes('next-artwork'), false);
  const foreground = f.get('next-artwork', 'foreground');
  await tick();
  assert.deepEqual(f.started, ['background-1', 'normal-1', 'next-artwork']);
  speculative.controller.abort();
  assert.equal(await speculative.promise, 'AbortError');
  f.releases.get('next-artwork')('shared pixels');
  assert.equal(await foreground.promise, 'shared pixels');
  assert.equal(f.started.filter(key => key === 'next-artwork').length, 1);
});

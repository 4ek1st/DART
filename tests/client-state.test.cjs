const test = require('node:test');
const assert = require('node:assert/strict');
const { createWriter } = require('../wwwroot/client-state.js');
function storage() {
  const values = new Map();
  return { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}

test('large personal sessions save every field beyond the browser keepalive quota', async () => {
  const written = [], local = storage();
  const writer = createWriter({ storage: local, send: async body => written.push(body) });
  const state = { session: { tabs: [{ kind: 'home' }] }, recent: ['я'.repeat(40000)],
    mediaDuplicatePairs: [['https://example.test/a.jpg', 'https://example.test/b.jpg']] };
  assert.equal(await writer.save(state), true);
  assert(Buffer.byteLength(written[0]) > 65536);
  assert.deepEqual(JSON.parse(written[0]).recent, state.recent);
  assert.deepEqual(JSON.parse(written[0]).mediaDuplicatePairs, state.mediaDuplicatePairs);
  assert.equal(local.getItem('dart-client-state-pending'), undefined);
});

test('rapid tab changes cannot let an old request overwrite the last state', async () => {
  const written = [], finishes = [];
  const writer = createWriter({ storage: storage(), send: body => new Promise(resolve => {
    written.push(JSON.parse(body)); finishes.push(resolve);
  }) });
  const first = writer.save({ session: { tabs: [{ kind: 'follows' }] } });
  writer.save({ session: { tabs: [{ kind: 'likes' }] } });
  writer.save({ session: { tabs: [{ kind: 'home' }] } });
  assert.equal(written.length, 1);
  finishes.shift()(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(written.length, 2);
  assert.equal(written[1].session.tabs[0].kind, 'home');
  assert(written[1].clientRevision > written[0].clientRevision);
  finishes.shift()(); assert.equal(await first, true);
});

test('temporary failure retains the latest state across reload and retries without silent loss', async () => {
  const local = storage(); let fail = true, saved, notices = 0;
  const writer = createWriter({ storage: local, schedule: () => 1, cancel() {},
    onError: () => notices++, send: async body => { if (fail) throw Error('offline'); saved = JSON.parse(body); } });
  assert.equal(await writer.save({ session: { tabs: [{ kind: 'home' }] }, recent: [123] }), false);
  assert.equal(notices, 1); assert.equal(writer.readPending().recent[0], 123);
  const restored = createWriter({ storage: local, send: async body => { saved = JSON.parse(body); } });
  assert.equal(await restored.save(restored.readPending()), true);
  assert.deepEqual(saved.recent, [123]);
  fail = false;
  assert.equal(await writer.flush(), true);
  assert.equal(local.getItem('dart-client-state-pending'), undefined);
});

test('closing waits for a last tab change queued as the preceding request resolves', async () => {
  const written = []; let writer;
  writer = createWriter({ send: async body => {
    written.push(JSON.parse(body));
    if (written.length === 1) queueMicrotask(() => queueMicrotask(() => {
      writer.save({ session: { tabs: [{ kind: 'home' }] } });
    }));
  } });
  assert.equal(await writer.save({ session: { tabs: [{ kind: 'likes' }] } }), true);
  assert.equal(written.length, 2);
  assert.equal(written[1].session.tabs[0].kind, 'home');
});

test('teardown patches use byte size and retain exact tabs rather than truncating them', async () => {
  const writer = createWriter({ send: async () => {} });
  const state = { session: { tabs: [{ kind: 'detail', title: 'ä'.repeat(30000) }] }, recent: ['keep'] };
  await writer.save(state);
  assert.equal(writer.unloadPatch(state), null);
  const small = { ...state, session: { tabs: [{ kind: 'home' }] } };
  await writer.save(small);
  const patch = JSON.parse(writer.unloadPatch(small));
  assert.deepEqual(patch.session, small.session);
  assert.equal(patch.recent, undefined, 'native patch merge retains the stored history');
});

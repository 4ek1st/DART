const test = require('node:test');
const assert = require('node:assert/strict');
const shell = require('../wwwroot/desktop-shell.js');

test('update button appears only for a verified newer release', () => {
  assert.equal(shell.canInstall({ available: false }), false);
  assert.equal(shell.canInstall({ available: true, verified: false, version: '0.2.1' }), false);
  assert.equal(shell.canInstall({ available: true, verified: true, version: '0.2.1' }), true);
  assert.equal(shell.canInstall({ available: true, verified: true, version: '0.2.1', error: 'network failure' }), false);
  assert.equal(shell.canInstall({ available: true, verified: true, version: '0.2.1', installing: true }), false);
});

test('desktop window controls send only native allowlisted commands', () => {
  const messages = [];
  const bridge = { postMessage: value => messages.push(value) };
  assert.equal(shell.windowCommand(bridge, 'minimize'), true);
  assert.equal(shell.windowCommand(bridge, 'maximize'), true);
  assert.equal(shell.windowCommand(bridge, 'close'), true);
  assert.equal(shell.windowCommand(bridge, 'run arbitrary executable'), false);
  assert.equal(shell.windowCommand(null, 'close'), false);
  assert.deepEqual(messages, [
    { type: 'window-command', command: 'minimize' },
    { type: 'window-command', command: 'maximize' },
    { type: 'window-command', command: 'close' }
  ]);
});

function updateFixture(t, responses, extraWindow = {}) {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout', 'setInterval'], now: 1_000_000 });
  const events = new Map(), requests = [];
  const element = () => ({ hidden: true, title: '', attributes: {}, handlers: new Map(),
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(name, handler) { this.handlers.set(name, handler); } });
  const install = element(), controls = element(), main = { querySelector: () => null };
  const document = { hidden: false, documentElement: { classList: { toggle() {} } },
    getElementById: id => ({ 'install-update-button': install, 'window-controls': controls, main })[id],
    addEventListener: (name, action) => events.set(name, action) };
  const window = { document, setTimeout, clearTimeout, setInterval,
    addEventListener: (name, action) => events.set(name, action),
    MutationObserver: class { observe() {} },
    fetch: async (url, options) => {
      requests.push({ url, method: options?.method || 'GET' });
      const value = responses.shift();
      if (value instanceof Error) throw value;
      return { ok: true, json: async () => value || { available: false } };
    }, ...extraWindow };
  shell.mount(window);
  return { install, controls, requests, events, document,
    settle: () => new Promise(resolve => setImmediate(resolve)) };
}
const available = { available: true, verified: true, version: '0.2.6', configured: true };

test('native Close waits for saved session and leaves the window open on a failed write', async t => {
  const messages = []; let finish;
  const fixture = updateFixture(t, [{ available: false }], {
    chrome: { webview: { postMessage: message => messages.push(message), addEventListener() {} } },
    flushClientState: () => new Promise(resolve => { finish = resolve; })
  });
  const click = fixture.controls.handlers.get('click');
  const event = { target: { closest: () => ({ dataset: { windowCommand: 'close' } }) } };
  const failed = click(event); assert.equal(messages.length, 0);
  finish(false); await failed; assert.equal(messages.length, 0);
  const saved = click(event); assert.equal(messages.length, 0);
  finish(true); await saved;
  assert.deepEqual(messages, [{ type: 'window-command', command: 'close' }]);
});

test('a release published while browsing appears within five minutes without opening settings', async t => {
  const fixture = updateFixture(t, [{ available: false, configured: true }, available]);
  await fixture.settle();
  assert.equal(fixture.install.hidden, true);
  t.mock.timers.tick(5 * 60 * 1000);
  await fixture.settle();
  assert.equal(fixture.install.hidden, false);
  assert.equal(fixture.requests.length, 2);
  assert.ok(fixture.requests.every(request => request.url === '/api/updates/check' && request.method === 'POST'));
});

test('a failed startup check retries in the background after one minute', async t => {
  const fixture = updateFixture(t, [new Error('offline'), available]);
  await fixture.settle();
  t.mock.timers.tick(60 * 1000);
  await fixture.settle();
  assert.equal(fixture.install.hidden, false);
  assert.equal(fixture.requests.length, 2);
});

test('returning to the window checks updates without a visibility or settings change', async t => {
  const fixture = updateFixture(t, [{ available: false }, available]);
  await fixture.settle();
  t.mock.timers.tick(60 * 1000);
  fixture.events.get('focus')?.();
  fixture.events.get('focus')?.();
  fixture.events.get('visibilitychange')?.();
  await fixture.settle();
  assert.equal(fixture.install.hidden, false);
  assert.equal(fixture.requests.length, 2, 'simultaneous resume events must share a check');
  fixture.events.get('focus')?.();
  await fixture.settle();
  assert.equal(fixture.requests.length, 2, 'rapid focus changes must not flood update requests');
});

test('reconnecting the network retries a failed check immediately', async t => {
  const fixture = updateFixture(t, [{ error: 'temporary network failure' }, available]);
  await fixture.settle();
  fixture.events.get('online')?.();
  await fixture.settle();
  assert.equal(fixture.install.hidden, false);
  assert.equal(fixture.requests.length, 2);
});

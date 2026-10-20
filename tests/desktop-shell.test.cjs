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
  const element = () => ({ hidden: true, title: '', textContent: '', disabled: false, attributes: {}, handlers: new Map(),
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(name, handler) { this.handlers.set(name, handler); } });
  const panels = [];
  const install = element(), controls = element(), main = { querySelector: () => null };
  const document = { hidden: false, documentElement: { classList: { toggle() {} } },
    getElementById: id => ({ 'install-update-button': install, 'window-controls': controls, main })[id],
    addEventListener: (name, action) => events.set(name, action), body: { append() {}, appendChild() {} },
    createElement: () => {
      const panel = element(), children = new Map();
      panel.querySelector = selector => { if (!children.has(selector)) children.set(selector, element()); return children.get(selector); };
      panel.showModal = () => { panel.open = true; }; panel.close = () => { panel.open = false; };
      panels.push(panel); return panel;
    } };
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
  return { install, controls, requests, events, document, panels,
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

test('server retry time prevents timer, focus, online and manual polling until the deadline', async t => {
  const retryAt = new Date(1_000_000 + 10 * 60 * 1000).toISOString();
  const fixture = updateFixture(t, [{ configured: true, error: 'GitHub API rate limit reached.',
    notice: 'GitHub API rate limit reached.', rateLimited: true, retryAt }, available]);
  await fixture.settle();
  assert.equal(fixture.install.hidden, false, 'waiting must be inspectable from the top bar');
  assert.equal(fixture.install.attributes['data-update-state'], 'waiting');
  fixture.install.onclick(); await fixture.settle();
  const panel = fixture.panels[0];
  assert.equal(panel.querySelector('[data-update-check]').disabled, true);
  assert.equal(panel.querySelector('[data-update-install]').hidden, true);
  assert.doesNotMatch(panel.querySelector('[data-update-status]').textContent, /последняя|latest verified/i);
  assert.equal(panel.querySelector('[data-update-notice]').hidden, true,
    'the same waiting reason must appear only once');
  assert.equal(panel.querySelector('[data-update-retry]').hidden, false);
  assert.match(panel.querySelector('[data-update-retry]').textContent, /\d{2}:\d{2}/);
  t.mock.timers.tick(9 * 60 * 1000);
  fixture.events.get('focus')(); fixture.events.get('online')(); fixture.events.get('visibilitychange')();
  panel.querySelector('[data-update-check]').onclick(); await fixture.settle();
  assert.equal(fixture.requests.length, 1, 'force paths must not bypass the server deadline');
  t.mock.timers.tick(60 * 1000); await fixture.settle();
  assert.equal(fixture.requests.length, 2);
  assert.equal(fixture.install.hidden, false);
  assert.equal(fixture.install.attributes['data-update-state'], 'available');
  assert.equal(panel.querySelector('[data-update-check]').disabled, false);
  assert.equal(panel.querySelector('[data-update-install]').hidden, false);
});

test('a signed fallback offer stays installable during the API cooldown', async t => {
  const fixture = updateFixture(t, [{ ...available, rateLimited: true,
    retryAt: new Date(1_000_000 + 600_000).toISOString(), notice: 'Using the signed public release.' }]);
  await fixture.settle(); fixture.install.onclick(); await fixture.settle();
  const panel = fixture.panels[0];
  assert.equal(fixture.install.hidden, false);
  assert.equal(fixture.install.attributes['data-update-state'], 'available');
  assert.equal(panel.querySelector('[data-update-install]').hidden, false);
  assert.equal(panel.querySelector('[data-update-install]').disabled, false);
  assert.equal(panel.querySelector('[data-update-check]').disabled, true);
  assert.match(panel.querySelector('[data-update-notice]').textContent, /signed public release/);
  assert.equal(panel.querySelector('[data-update-notice]').hidden, false,
    'a fallback explanation must remain visible beside the available version');
  fixture.events.get('online')(); await fixture.settle();
  assert.equal(fixture.requests.length, 1);
});

test('invalid retry metadata keeps a bounded ordinary retry instead of a timer loop', async t => {
  const fixture = updateFixture(t, [{ configured: true, error: 'Temporarily unavailable', retryAt: 'not-a-date' }, available]);
  await fixture.settle(); t.mock.timers.tick(59_999); await fixture.settle();
  assert.equal(fixture.requests.length, 1);
  t.mock.timers.tick(1); await fixture.settle();
  assert.equal(fixture.requests.length, 2);
  assert.equal(fixture.install.hidden, false);
});

test('a transient server pause is visible even without a rate-limit or error flag', async t => {
  const fixture = updateFixture(t, [{ configured: true, available: false, verified: false,
    retryAt: new Date(1_000_000 + 120_000).toISOString(), rateLimited: false, error: '', notice: 'Temporarily unavailable' }]);
  await fixture.settle();
  assert.equal(fixture.install.hidden, false);
  assert.equal(fixture.install.attributes['data-update-state'], 'waiting');
  fixture.install.onclick(); await fixture.settle();
  const panel = fixture.panels[0];
  assert.doesNotMatch(panel.querySelector('[data-update-status]').textContent, /последняя|latest verified/i);
  assert.equal(panel.querySelector('[data-update-check]').disabled, true);
});

test('background checks cannot unlock Install while the local session flush is pending', async t => {
  let finish;
  const fixture = updateFixture(t, [available, available, available], {
    flushClientState: () => new Promise(resolve => { finish = resolve; })
  });
  await fixture.settle(); fixture.install.onclick(); await fixture.settle();
  const panel = fixture.panels[0], install = panel.querySelector('[data-update-install]');
  const pending = install.onclick();
  assert.equal(fixture.install.hidden, true);
  assert.equal(panel.querySelector('[data-update-check]').disabled, true);
  const before = fixture.requests.length;
  fixture.events.get('online')(); await fixture.settle();
  assert.equal(fixture.requests.length, before);
  assert.equal(install.disabled, true);
  finish(false); await pending;
  assert.equal(panel.querySelector('[data-update-check]').disabled, false);
  assert.ok(fixture.requests.every(request => !request.url.endsWith('/install')),
    'failed session persistence must not start installation');
});

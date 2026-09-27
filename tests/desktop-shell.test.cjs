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

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const project = path.resolve(__dirname, '..');
const executable = path.join(project, 'bin', 'Debug', 'net8.0-windows', 'DART.exe');

async function start(dataDirectory) {
  const child = spawn(executable, ['--server-only'], {
    cwd: project, env: { ...process.env, ARTCATALOG_TEST_DATA_DIR: dataDirectory,
      DOTNET_ROLL_FORWARD: 'Major' }, windowsHide: true
  });
  let output = '';
  const origin = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`server startup: ${output}`)), 15000);
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.stdout.on('data', chunk => {
      output += chunk.toString();
      const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) { clearTimeout(timeout); resolve(match[0]); }
    });
    child.stderr.on('data', chunk => { output += chunk.toString(); });
    child.once('exit', code => { clearTimeout(timeout); reject(new Error(`exit ${code}: ${output}`)); });
  });
  return { child, origin };
}

async function stop(server) {
  if (!server || server.child.exitCode !== null) return;
  const exited = new Promise(resolve => server.child.once('exit', resolve));
  server.child.kill();
  await exited;
}

test('tag choices survive restart and unrelated session writes', async () => {
  const build = spawnSync('dotnet', ['build', 'ArtCatalog.csproj', '-c', 'Debug', '-v:q'],
    { cwd: project, encoding: 'utf8', windowsHide: true });
  assert.equal(build.status, 0, build.stdout + build.stderr);
  const dataDirectory = fs.mkdtempSync(path.join(project, 'test-data-preferences-'));
  fs.writeFileSync(path.join(dataDirectory, 'client-state-v4.json'), JSON.stringify({
    recommendationTagPreferences: { holo: 'priority' }
  }));
  let server;
  try {
    server = await start(dataDirectory);
    const get = async () => (await fetch(server.origin +
      '/api/recommendation-tag-preferences')).json();
    const post = async (url, body, origin = server.origin) => fetch(server.origin + url, {
      method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    assert.deepEqual(await get(), { preferences: { holo: 'priority' }, initialized: false });
    assert.equal((await post('/api/recommendation-tag-preferences', {
      tag: 'Group_Sex', mode: 'disabled' })).status, 200);
    assert.equal((await post('/api/client-state', {
      session: { tabs: [] }, recommendationTagPreferences: {}
    })).status, 200);
    assert.deepEqual(await get(), { preferences: {
      holo: 'priority', 'group sex': 'disabled' }, initialized: true });
    assert.equal((await post('/api/recommendation-tag-preferences', {
      tag: 'cum', mode: 'priority'
    }, 'http://elsewhere.invalid')).status, 403);
    await stop(server);
    server = await start(dataDirectory);
    assert.deepEqual(await get(), { preferences: {
      holo: 'priority', 'group sex': 'disabled' }, initialized: true });
    assert.equal((await post('/api/recommendation-tag-preferences', {
      tag: 'holo', mode: 'normal' })).status, 200);
    assert.deepEqual(await get(), { preferences: { 'group sex': 'disabled' }, initialized: true });
  } finally {
    await stop(server);
    const resolved = fs.realpathSync(dataDirectory);
    assert.ok(resolved.startsWith(project + path.sep));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const project = path.resolve(__dirname, '..');
const executable = path.join(project, 'bin', 'Debug', 'net8.0-windows', 'DART.exe');

test('privacy API validates writes and never claims protection without a desktop window', async () => {
  const build = spawnSync('dotnet', ['build', 'ArtCatalog.csproj', '-c', 'Debug', '-v:q'],
    { cwd: project, encoding: 'utf8', windowsHide: true });
  assert.equal(build.status, 0, build.stdout + build.stderr);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'DART-privacy-api-'));
  const child = spawn(executable, ['--server-only', '--data-dir', directory], {
    cwd: project, windowsHide: true, env: { ...process.env, DOTNET_ROLL_FORWARD: 'Major' }
  });
  let output = '';
  try {
    const origin = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('DART did not start: ' + output)), 15000);
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', code => { clearTimeout(timer); reject(new Error(`DART exited ${code}: ${output}`)); });
      child.stdout.on('data', chunk => {
        output += chunk.toString();
        const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
        if (match) { clearTimeout(timer); resolve(match[0]); }
      });
      child.stderr.on('data', chunk => { output += chunk.toString(); });
    });
    const post = (value, sender = origin) => fetch(origin + '/api/privacy', {
      method: 'POST', headers: { Origin: sender, 'Content-Type': 'application/json' },
      body: JSON.stringify(value)
    });
    const current = () => fetch(origin + '/api/privacy').then(response => response.json());
    assert.deepEqual(await current(), { requested: false, active: false, available: false, error: null });
    assert.equal((await post({ hideFromScreenCapture: true }, 'https://another-site.test')).status, 403);
    assert.equal((await post({})).status, 400);
    const unavailable = await post({ hideFromScreenCapture: true });
    assert.equal(unavailable.status, 409);
    assert.deepEqual(await unavailable.json(), { requested: false, active: false,
      available: false, error: 'window-unavailable' });
    assert.equal((await post({ hideFromScreenCapture: false })).status, 200);
    assert.deepEqual(await current(), { requested: false, active: false, available: false, error: null });
  } finally {
    const stopped = new Promise(resolve => child.once('exit', resolve));
    child.kill();
    if (child.exitCode === null) await stopped;
    // The unique temporary fixture contains no personal profile data.
    const resolved = path.resolve(directory);
    if (resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) &&
        path.basename(resolved).startsWith('DART-privacy-api-'))
      fs.rmSync(resolved, { recursive: true });
  }
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const project = path.resolve(__dirname, '..');
const executable = path.join(project, 'bin', 'Debug', 'net8.0-windows', 'DART.exe');

async function startServer(dataDirectory, extraArgs = []) {
  const child = spawn(executable, ['--server-only', ...extraArgs], {
    cwd: project, env: { ...process.env, ARTCATALOG_TEST_DATA_DIR: dataDirectory,
      DOTNET_ROLL_FORWARD: 'Major' },
    windowsHide: true
  });
  let output = '';
  const origin = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('server did not start: ' + output)), 15000);
    child.on('error', error => { clearTimeout(timeout); reject(error); });
    child.on('exit', code => { clearTimeout(timeout); reject(new Error(`server exited ${code}: ${output}`)); });
    child.stdout.on('data', chunk => {
      output += chunk.toString();
      const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) { clearTimeout(timeout); resolve(match[0]); }
    });
    child.stderr.on('data', chunk => { output += chunk.toString(); });
  }).catch(error => { child.kill(); throw error; });
  return { child, origin };
}

async function stopServer(server) {
  if (!server || server.child.exitCode !== null) return;
  const exited = new Promise(resolve => server.child.once('exit', resolve));
  server.child.kill();
  await exited;
}

test('an explicit profile directory wins over an inherited test profile', async () => {
  const first = fs.mkdtempSync(path.join(project, 'test-data-explicit-'));
  const inherited = fs.mkdtempSync(path.join(project, 'test-data-inherited-'));
  fs.writeFileSync(path.join(first, 'client-state-v4.json'), JSON.stringify({ marker: 'personal-profile' }));
  fs.writeFileSync(path.join(inherited, 'client-state-v4.json'), JSON.stringify({ marker: 'empty-test-profile' }));
  const supported = { source: 'danbooru', key: 'danbooru:1', title: 'Saved work', futureField: true };
  fs.writeFileSync(path.join(first, 'bookmarks-v4.json'), JSON.stringify([
    supported, { source: 'retired', key: 'retired:2' }]));
  fs.writeFileSync(path.join(first, 'follows.json'), JSON.stringify([
    { source: 'rule34', key: 'rule34::123', artistId: '123', name: 'Uploader', seenKeys: { all: ['rule34:1'] } },
    { source: 'retired', key: 'retired:creator', artistId: '123' }]));
  let server;
  try {
    const build = spawnSync('dotnet', ['build', 'ArtCatalog.csproj', '-c', 'Debug', '-v:q'],
      { cwd: project, encoding: 'utf8', windowsHide: true });
    assert.equal(build.status, 0, build.stdout + build.stderr);
    server = await startServer(inherited, ['--data-dir', first]);
    const response = await fetch(server.origin + '/api/client-state');
    assert.equal((await response.json()).marker, 'personal-profile');
    const bookmarks = await (await fetch(server.origin + '/api/bookmarks')).json();
    assert.deepEqual(bookmarks.map(item => item.key), ['danbooru:1']);
    const follows = await (await fetch(server.origin + '/api/follows')).json();
    assert.deepEqual(follows.map(follow => follow.key), ['rule34::123']);
    assert.deepEqual(follows[0].seenKeys.all, ['rule34:1']);
    assert.equal((await fetch(server.origin + '/api/search?sources=retired')).status, 400);
    assert.equal((await fetch(server.origin + '/api/detail?source=retired&id=1')).status, 400);
    assert.equal((await fetch(server.origin + '/api/profile?source=retired&artist=123')).status, 400);
    const state = { session: { activeIndex: 1, tabs: [
      { kind: 'detail', item: { source: 'retired', key: 'retired:2' } },
      { kind: 'detail', item: supported, scrollTop: 123 }] }, recent: [supported, { source: 'retired' }] };
    const savedState = await fetch(server.origin + '/api/client-state', { method: 'POST',
      headers: { Origin: server.origin, 'Content-Type': 'application/json' }, body: JSON.stringify(state) });
    assert.equal(savedState.status, 200);
    const cleanedState = await (await fetch(server.origin + '/api/client-state')).json();
    assert.equal(cleanedState.session.tabs.length, 1);
    assert.equal(cleanedState.session.activeIndex, 0);
    assert.deepEqual(cleanedState.recent, [supported]);
    assert.deepEqual(cleanedState.session.tabs[0].item, supported);
    assert.equal(cleanedState.session.tabs[0].scrollTop, 123);
  } finally {
    await stopServer(server);
    for (const directory of [first, inherited]) {
      const resolved = fs.realpathSync(directory);
      assert.ok(resolved.startsWith(project + path.sep));
      fs.rmSync(resolved, { recursive: true, force: true });
    }
  }
});

test('following an artist persists and viewing a rating records only shown works', async () => {
  const build = spawnSync('dotnet', ['build', 'ArtCatalog.csproj', '-c', 'Debug', '-v:q'],
    { cwd: project, encoding: 'utf8', windowsHide: true });
  assert.equal(build.status, 0, build.stdout + build.stderr);
  const dataDirectory = fs.mkdtempSync(path.join(project, 'test-data-'));
  let server;
  try {
    server = await startServer(dataDirectory);
    const getFollows = async () => {
      const response = await fetch(server.origin + '/api/follows');
      assert.equal(response.status, 200);
      return response.json();
    };
    const post = (url, body) => fetch(server.origin + url, {
      method: 'POST', headers: { Origin: server.origin, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    assert.deepEqual(await getFollows(), []);
    assert.equal((await post('/api/follows', {
      source: 'invalid', artistId: 'artist', name: 'Artist'
    })).status, 400);
    assert.equal((await post('/api/follows', {
      source: 'danbooru', artistId: 'artist', name: '   '
    })).status, 400);
    const follow = { source: 'danbooru', artistId: 'some_artist', name: 'Some Artist' };
    assert.equal((await post('/api/follows', follow)).status, 200);
    const saved = await getFollows();
    assert.equal(saved.length, 1);
    assert.equal(saved[0].key, 'danbooru::some_artist');
    assert.equal(saved[0].seenAt.general, saved[0].followedAt);
    assert.equal((await post('/api/follows/gelbooru-tag', {
      key: saved[0].key, tag: 'another_artist_(circle)'
    })).status, 200);
    assert.equal((await getFollows())[0].gelbooruTag, 'another_artist_(circle)');
    assert.equal((await post('/api/follows/gelbooru-tag', {
      key: saved[0].key, tag: 'user:someone_else'
    })).status, 400);
    assert.equal((await post('/api/follows/gelbooru-tag', {
      key: 'danbooru::missing', tag: 'valid_tag'
    })).status, 404);
    assert.equal((await getFollows()).length, 1);
    assert.equal((await post('/api/follows/seen', {
      keys: [saved[0].key], rating: 'general',
      workKeys: { [saved[0].key]: ['danbooru:123'] }
    })).status, 200);
    const viewed = (await getFollows())[0];
    assert.equal(viewed.seenAt.general, saved[0].seenAt.general);
    assert.equal(viewed.seenAt.explicit, saved[0].seenAt.explicit);
    assert.deepEqual(viewed.seenKeys.general, ['danbooru:123']);
    assert.equal(viewed.seenKeys.explicit, undefined);
    await stopServer(server);
    server = await startServer(dataDirectory);
    assert.deepEqual((await getFollows())[0].seenKeys.general, ['danbooru:123']);
    assert.equal((await getFollows())[0].gelbooruTag, 'another_artist_(circle)');
    fs.writeFileSync(path.join(dataDirectory, 'follows.json'), '{ damaged');
    fs.writeFileSync(path.join(dataDirectory, 'follows.json.bak'), '{ damaged');
    assert.deepEqual(await getFollows(), []);
    assert.ok(fs.readdirSync(dataDirectory).some(name => name.startsWith('follows.json.corrupt-')));
    assert.equal((await post('/api/follows', follow)).status, 200);
    assert.equal((await getFollows()).length, 1);
  } finally {
    await stopServer(server);
    const resolved = fs.realpathSync(dataDirectory);
    assert.ok(resolved.startsWith(project + path.sep));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
});

test('content preferences save separately from API credentials and survive a restart', async () => {
  const build = spawnSync('dotnet', ['build', 'ArtCatalog.csproj', '-c', 'Debug', '-v:q'],
    { cwd: project, encoding: 'utf8', windowsHide: true });
  assert.equal(build.status, 0, build.stdout + build.stderr);
  const dataDirectory = fs.mkdtempSync(path.join(project, 'test-data-'));
  let server;
  try {
    server = await startServer(dataDirectory);
    const get = async () => {
      const response = await fetch(server.origin + '/api/content-preferences');
      assert.equal(response.status, 200);
      return response.json();
    };
    const post = (body, origin = server.origin) => fetch(server.origin + '/api/content-preferences', {
      method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    assert.deepEqual(await get(), { language: 'en', aiMode: 'all', excludedTags: [],
      attributionPriority: 'creator', hideViewedAndSaved: false });
    assert.equal((await post({ aiMode: 'generated-and-assisted',
      excludedTags: ['latex', 'ai_art'] }, 'https://other.example')).status, 403);
    assert.equal((await post({ aiMode: 'invalid', excludedTags: [] })).status, 400);
    assert.equal((await post({ aiMode: 'generated', excludedTags: ['a'.repeat(101)] })).status, 400);
    assert.deepEqual(await get(), { language: 'en', aiMode: 'all', excludedTags: [],
      attributionPriority: 'creator', hideViewedAndSaved: false });
    assert.equal((await post({ aiMode: 'generated-and-assisted',
      excludedTags: ['latex', 'ai_art'] })).status, 200);
    assert.deepEqual(await get(), { language: 'en', aiMode: 'generated-and-assisted',
      excludedTags: ['latex', 'ai_art'], attributionPriority: 'creator',
      hideViewedAndSaved: false });
    assert.ok(fs.existsSync(path.join(dataDirectory, 'content-preferences.json')));
    assert.equal(fs.existsSync(path.join(dataDirectory, 'settings.bin')), false);
    await stopServer(server);
    server = await startServer(dataDirectory);
    assert.deepEqual(await get(), { language: 'en', aiMode: 'generated-and-assisted',
      excludedTags: ['latex', 'ai_art'], attributionPriority: 'creator',
      hideViewedAndSaved: false });
    assert.equal((await post({ aiMode: 'generated-and-assisted',
      excludedTags: ['latex', 'ai_art'], attributionPriority: 'creator',
      hideViewedAndSaved: true })).status, 200);
    assert.equal((await get()).hideViewedAndSaved, true);
    for (const language of ['de', 'ru', 'en']) {
      const previous = await get();
      assert.equal((await post({ ...previous, language })).status, 200);
      assert.deepEqual(await get(), { ...previous, language });
      await stopServer(server);
      server = await startServer(dataDirectory);
      assert.deepEqual(await get(), { ...previous, language });
    }
    const viewedUrl = server.origin + '/api/viewed-identities';
    const saveViewed = (origin, tokens) => fetch(viewedUrl, {
      method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify(tokens)
    });
    assert.equal((await saveViewed('https://other.example', ['key:danbooru:12'])).status, 403);
    assert.equal((await saveViewed(server.origin, ['original:unrecognized'])).status, 400);
    const savedViewed = await saveViewed(server.origin, ['key:danbooru:12',
      'hash:' + 'a'.repeat(32), 'original:x-status:123456789']);
    assert.equal(savedViewed.status, 200);
    assert.deepEqual(await savedViewed.json(), { saved: 3 });
    await stopServer(server);
    server = await startServer(dataDirectory);
    assert.equal((await get()).hideViewedAndSaved, true);
    const viewedResponse = await fetch(server.origin + '/api/viewed-identities');
    assert.equal(viewedResponse.status, 200);
    assert.deepEqual(await viewedResponse.json(), ['key:danbooru:12',
      'hash:' + 'a'.repeat(32), 'original:x-status:123456789']);
    const readFavorites = async () => {
      const response = await fetch(server.origin + '/api/favorite-tags');
      assert.equal(response.status, 200);
      return response.json();
    };
    const setFavorite = (tag, favorite, origin = server.origin) =>
      fetch(server.origin + '/api/favorite-tags', { method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag, favorite }) });
    assert.deepEqual(await readFavorites(), []);
    assert.equal((await setFavorite('sexual_coaching', true, 'https://other.example')).status, 403);
    assert.equal((await setFavorite('sexual coaching', true)).status, 400);
    assert.equal((await setFavorite('sexual_coaching', true)).status, 200);
    assert.deepEqual(await readFavorites(), ['sexual_coaching']);
    await stopServer(server);
    server = await startServer(dataDirectory);
    assert.deepEqual(await readFavorites(), ['sexual_coaching']);
    assert.equal((await setFavorite('sexual_coaching', false)).status, 200);
    assert.deepEqual(await readFavorites(), []);
  } finally {
    await stopServer(server);
    const resolved = fs.realpathSync(dataDirectory);
    assert.ok(resolved.startsWith(project + path.sep));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
});

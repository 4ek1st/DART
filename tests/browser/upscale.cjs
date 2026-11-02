/* Opt-in: runs a real signed-by-hash upstream module in an isolated device directory.
   node tests/browser/upscale.cjs <isolated-data-directory> <neutral-png>
   It does not open or restart the user's DART. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require(process.env.DART_PLAYWRIGHT_PATH || 'playwright');
const source = path.resolve(__dirname, '../..');
const data = path.resolve(process.argv[2] || '');
const png = fs.readFileSync(path.resolve(process.argv[3] || ''));
const allowed = path.resolve(process.env.LOCALAPPDATA, 'ArtCatalogBuild') + path.sep;
assert(data.toLowerCase().startsWith(allowed.toLowerCase()), 'QA profile must be in the private build directory');
assert(!fs.existsSync(data), 'Use a fresh isolated directory for the first-use installation test');
const fixture = { key: 'danbooru:upscale-fixture', source: 'danbooru', id: 'upscale-fixture', title: 'Neutral upscale fixture',
  thumbnail: 'https://example.test/fixture.png', images: ['https://example.test/fixture.png'], rating: 'g', tags: ['landscape'] };
const errors = [], calls = []; let address = '', browser, processHandle;
const pngSize = bytes => ({ width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) });
const expected = pngSize(png);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function startServer() {
  const dll = path.join(source, 'bin/Debug/net8.0-windows/DART.dll');
  processHandle = spawn('dotnet', [dll, '--server-only', '--data-dir', data], { cwd: source, windowsHide: true,
    env: { ...process.env, ARTCATALOG_TEST_DATA_DIR: data }, stdio: ['ignore', 'pipe', 'pipe'] });
  let logs = '';
  for (const stream of [processHandle.stdout, processHandle.stderr]) stream.on('data', chunk => {
    logs = (logs + chunk).slice(-10000); address ||= logs.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0] || '';
  });
  const end = Date.now() + 20000;
  while (!address && Date.now() < end && processHandle.exitCode === null) await wait(50);
  assert(address, 'Isolated native server must start: ' + logs.slice(-1000));
}
async function api(route, options = {}) {
  return fetch(address + route, { ...options, headers: { Origin: address, ...options.headers } });
}
(async () => {
  try {
    await startServer();
    assert.equal((await fetch(address + '/api/upscale/install', { method: 'POST' })).status, 403);
    assert.equal((await api('/api/upscale')).status, 200);
    assert.equal((await (await api('/api/upscale')).json()).component.installed, false);
    assert.equal((await api('/api/upscale/jobs?scale=3', { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: png })).status, 400);
    browser = await chromium.launch({ headless: true, executablePath: process.env.DART_BROWSER_EXE });
    const context = await browser.newContext({ viewport: { width: 2560, height: 1440 }, acceptDownloads: true });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/**', async route => {
      const request = route.request(), url = new URL(request.url()); calls.push(url.pathname);
      if (url.pathname.startsWith('/api/upscale')) return route.continue();
      const answer = value => route.fulfill({ json: value });
      if (url.pathname === '/api/image') return route.fulfill({ contentType: 'image/png', body: png });
      if (url.pathname === '/api/client-state') return answer({ session: { activeIndex: 0, tabs: [{ kind: 'likes', title: 'Liked' }] } });
      if (url.pathname === '/api/likes') return answer([fixture]);
      if (url.pathname === '/api/detail') return answer(fixture);
      if (['/api/bookmarks', '/api/follows', '/api/favorite-tags', '/api/favorite-artworks', '/api/viewed-identities'].includes(url.pathname)) return answer([]);
      if (url.pathname === '/api/content-preferences') return answer({ language: 'en', aiMode: 'all' });
      if (url.pathname === '/api/search') return answer({ items: [], errors: {}, hasMore: false });
      return answer({});
    });
    await page.goto(address);
    await page.waitForFunction(() => !!globalThis.DartUpscale && document.querySelectorAll('article.card').length === 1);
    await page.evaluate(() => openSettings('upscale'));
    await page.waitForFunction(() => !document.querySelector('[data-upscale-action="install"]')?.disabled);
    await page.locator('[data-upscale-scale="4"]').click();
    await page.waitForFunction(() => document.querySelector('[data-upscale-scale="4"]').getAttribute('aria-pressed') === 'true');
    assert.equal((await (await api('/api/upscale')).json()).preferences.scale, 4);
    await page.locator('[data-upscale-action="install"]').click();
    await page.waitForFunction(() => !!document.querySelector('[data-upscale-action="remove"]'), { timeout: 120000 });
    const module = (await (await api('/api/upscale')).json()).component;
    assert.equal(module.installed, true); assert.equal(module.version, 'waifu2x-20250915');
    assert.equal(calls.filter(url => url === '/api/upscale/install').length, 1);
    const measurements = [];
    for (const scale of [4, 2]) {
      if (scale === 2) {
        await page.evaluate(() => openSettings('upscale'));
        await page.locator('[data-upscale-scale="2"]').click();
        await page.waitForFunction(() => document.querySelector('[data-upscale-scale="2"]').getAttribute('aria-pressed') === 'true');
      }
      await page.evaluate(item => openDetail(item), fixture);
      await page.waitForFunction(() => !!document.querySelector('.detail-image > img[data-image-url]')?.naturalWidth);
      const original = page.locator('.detail-image > img[data-image-url]').first();
      const before = await original.boundingBox();
      const started = Date.now(); await page.keyboard.press('u');
      await page.waitForFunction(width => document.querySelector('img.upscale-inline-result')?.naturalWidth === width, expected.width * scale, { timeout: 60000 });
      assert.equal(await page.locator('.upscale-dialog').count(), 0, 'default processing never opens a separate interface');
      assert.deepEqual(await original.boundingBox(), before, 'upscaling preserves viewer geometry');
      assert.equal(await original.evaluate(img => img.naturalWidth), expected.width, 'original pixels and metadata remain intact');
      const image = page.locator('img.upscale-inline-result').first();
      const dimensions = await image.evaluate(img => ({ width: img.naturalWidth, height: img.naturalHeight }));
      assert.deepEqual(dimensions, { width: expected.width * scale, height: expected.height * scale });
      const downloadPromise = page.waitForEvent('download');
      await page.evaluate(item => DartUpscale.download(item, item.images[0]), fixture);
      const download = await downloadPromise;
      assert.equal(await download.failure(), null); assert.match(download.suggestedFilename(), /\.png$/i);
      const bytes = fs.readFileSync(await download.path()); assert.deepEqual(pngSize(bytes), dimensions);
      measurements.push({ scale, milliseconds: Date.now() - started, ...dimensions, bytes: bytes.length });
    }
    // The same cached result follows Space preview, pan/zoom and return to the artwork.
    await page.locator('.detail-image > img[data-image-url]').first().focus(); await page.keyboard.press('Space');
    await page.waitForFunction(() => !!document.querySelector('.quick-preview[open] img.upscale-inline-result'));
    await page.locator('[data-preview-action="zoom-in"]').click();
    assert.equal(await page.locator('.quick-preview img.upscale-inline-result').evaluate(img => img.style.transform),
      await page.locator('.quick-preview-image').evaluate(img => img.style.transform));
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.quick-preview[open]') && !!document.querySelector('.detail-image img.upscale-inline-result'));
    await page.setViewportSize({ width: 700, height: 850 });
    await page.evaluate(() => openSettings('upscale'));
    const box = await page.locator('.upscale-settings').boundingBox(); assert(box.width <= 700);
    await page.screenshot({ path: path.join(data, 'upscale-700.png') });
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed: true, measurements, profile: data, apiOrigin: '403 without same-origin', errors }, null, 2));
  } finally {
    await browser?.close();
    if (processHandle && processHandle.exitCode === null) { processHandle.kill(); await new Promise(resolve => processHandle.once('exit', resolve)); }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

// Run with DART_PLAYWRIGHT_PATH pointing to Playwright and DART_BROWSER_EXE to
// a Chromium browser. All APIs, profile state and media belong to this fixture.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.DART_PLAYWRIGHT_PATH || 'playwright');
const logic = require('../../wwwroot/catalog-logic.js');
const root = path.resolve(__dirname, '../../wwwroot');
const sources = logic.supportedSources;
const records = sources.flatMap((source, index) => ['q', 'e', 'g'].map(rating => ({
  key: `${source}:${index + 1}${rating}`, id: `${index + 1}${rating}`, source, rating,
  title: `Fixture ${source} ${rating}`, creatorTag: `fixture_${index}_${rating}`,
  tags: ['landscape', `fixture_${index}_${rating}`], characterTags: [],
  published: '2026-11-01T12:00:00Z',
  thumbnail: `https://example.test/${source}-${rating}.png`,
  images: [source === 'rule34' && rating === 'e' ? 'https://example.test/fixture.webm' :
    `https://example.test/${source}-${rating}.png`]
})));
let saved = { session: { savedWorksVersion: 1, activeIndex: 0,
  tabs: [{ kind: 'search', title: 'NSFW illustrations', rating: 'explicit', selectedSources: sources, sort: 'recent' }] } };
const calls = [], errors = [];
let media = Buffer.alloc(0), browser;
const json = (res, data) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = chunks.length ? JSON.parse(Buffer.concat(chunks)) : {};
      calls.push({ route: url.pathname, query: Object.fromEntries(url.searchParams), method: req.method, body });
      if (url.pathname === '/api/client-state') {
        if (req.method === 'POST') saved = { ...saved, ...body };
        return json(res, req.method === 'GET' ? saved : { saved: true });
      }
      if (url.pathname === '/api/search' || url.pathname === '/api/profile') {
        const selected = (url.searchParams.get('sources') || sources.join(',')).split(',');
        const rating = url.searchParams.get('rating') || 'general';
        const items = records.filter(item => selected.includes(item.source) && logic.matchesRating(item, rating));
        return json(res, { items, errors: {}, notices: {}, sourceStats: {}, hasMoreSources: [], hasMore: false });
      }
      if (url.pathname === '/api/detail') return json(res, records.find(item =>
        item.source === url.searchParams.get('source') && item.id === url.searchParams.get('id')) || records[0]);
      if (url.pathname === '/api/image') {
        res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
        return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="128" height="96"><rect width="128" height="96" fill="#329cff"/></svg>');
      }
      if (url.pathname === '/api/video') {
        res.writeHead(200, { 'Content-Type': 'video/webm', 'Content-Length': media.length }); return res.end(media);
      }
      if (url.pathname === '/api/settings') return json(res, { hasApiKey: true, hasRule34ApiKey: true, sankakuAvailable: true });
      if (url.pathname === '/api/content-preferences') return json(res, { language: 'en', aiMode: 'all' });
      if (url.pathname === '/api/likes') return json(res, records.filter(item => item.rating === 'g'));
      if (['/api/bookmarks', '/api/follows', '/api/favorite-tags', '/api/viewed-identities'].includes(url.pathname)) return json(res, []);
      return json(res, {});
    }
    const file = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
    if (!fs.existsSync(file)) { res.writeHead(404); return res.end(); }
    const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' };
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(fs.readFileSync(file));
  } catch (error) { errors.push(error.message); res.writeHead(500); res.end(); }
});

(async () => {
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    browser = await chromium.launch({ headless: true, executablePath: process.env.DART_BROWSER_EXE });
    const context = await browser.newContext({ viewport: { width: 2560, height: 1440 } });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.mouse.click(20, 20);
    const bytes = await page.evaluate(async () => {
      const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 96;
      canvas.getContext('2d').fillRect(0, 0, 128, 96);
      const audio = new AudioContext(), tone = audio.createOscillator(), output = audio.createMediaStreamDestination();
      tone.connect(output); tone.start(); await audio.resume();
      const stream = new MediaStream([...canvas.captureStream(5).getTracks(), ...output.stream.getTracks()]);
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' }), chunks = [];
      const complete = new Promise(resolve => { recorder.ondataavailable = event => chunks.push(event.data);
        recorder.onstop = () => resolve(new Blob(chunks).arrayBuffer()); });
      recorder.start();
      for (let frame = 0; frame < 10; frame++) {
        canvas.getContext('2d').fillStyle = frame % 2 ? '#329cff' : '#174875';
        canvas.getContext('2d').fillRect(0, 0, 128, 96);
        await new Promise(resolve => setTimeout(resolve, 80));
      }
      recorder.stop();
      const data = Array.from(new Uint8Array(await complete));
      tone.stop(); stream.getTracks().forEach(track => track.stop()); await audio.close(); return data;
    });
    media = Buffer.from(bytes);
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const nsfw = () => page.locator('[data-action="category"][data-category="explicit"]');
    const toggle = async rating => {
      await nsfw().click({ button: 'right' });
      await page.locator(`[data-nsfw-rating="${rating}"]`).click();
    };
    await page.waitForFunction(() => document.querySelectorAll('article.card').length === 8);
    await nsfw().click({ button: 'right' });
    assert.equal(await page.locator('[role="menuitemcheckbox"][aria-checked="true"]').count(), 2);
    await page.keyboard.press('Escape'); assert.equal(await nsfw().getAttribute('aria-expanded'), 'false');
    await toggle('e');
    await page.waitForFunction(() => currentTab().items.length === 4 && currentTab().items.every(item => item.rating === 'q'));
    assert(calls.some(call => call.route === '/api/search' && call.query.rating === 'questionable'));
    await page.locator('[data-category="all"]').click();
    await page.waitForFunction(() => currentTab().items.length === 12);
    await nsfw().click();
    await page.waitForFunction(() => currentTab().items.length === 4);
    await nsfw().focus(); await page.keyboard.press('Shift+F10');
    assert.equal(await page.locator('[data-nsfw-rating="e"]').getAttribute('aria-checked'), 'false');
    await page.keyboard.press('Escape');
    const beforeEmpty = calls.filter(call => call.route === '/api/search').length;
    await toggle('q');
    await page.waitForFunction(() => !currentTab().loading && currentTab().items.length === 0 && !currentTab().hasMore);
    assert.equal(calls.filter(call => call.route === '/api/search').length, beforeEmpty, 'both off must not contact catalogs');
    await toggle('e');
    await page.waitForFunction(() => currentTab().items.length === 4 && currentTab().items.every(item => item.rating === 'e'));
    await page.reload();
    await page.waitForFunction(() => currentTab().items.length === 4 && currentTab().items.every(item => item.rating === 'e'));
    await page.locator('#settings-button').click(); await page.locator('#settings-tab-appearance').click();
    assert.equal(await page.locator('[name="videoSound"]').isChecked(), false);
    await page.locator('[name="videoSound"]').check();
    await page.waitForFunction(() => viewerPreferences.videoSound);
    await page.locator('[data-nav="adult"]').click();
    await page.locator('.card-art[data-key="rule34:3e"]').click();
    await page.waitForFunction(() => { const video = document.querySelector('.detail-video video'); return video && video.readyState >= 2; }, null, { timeout: 10000 }).catch(async error => {
      console.error(JSON.stringify({ errors, mediaBytes: media.length, state: await page.evaluate(() => ({ kind: currentTab()?.kind,
        item: currentTab()?.item?.key, media: [...document.querySelectorAll('video')].map(v =>
          ({ src: v.src, error: v.error?.message, readyState: v.readyState })) })) })); throw error;
    });
    assert.equal(await page.locator('.detail-video video').evaluate(video => video.muted), false);
    assert.equal(await page.locator('.detail-video video').evaluate(video => video.paused), false);
    await page.locator('.detail-video video').evaluate(video => { video.muted = true; });
    await page.evaluate(() => render());
    assert.equal(await page.locator('.detail-video video').evaluate(video => video.muted), true, 'rerender preserves a manual mute');
    await page.evaluate(() => openQuickPreview({ item: currentTab().item, url: currentTab().item.images[0] }, 'fullscreen'));
    await page.waitForFunction(() => { const video = document.querySelector('.quick-preview-video'); return video && video.readyState >= 2; });
    assert.equal(await page.locator('.quick-preview-video').evaluate(video => video.muted), false);
    await page.keyboard.press('Escape');
    await page.reload();
    await page.waitForFunction(() => viewerPreferences.videoSound === true);
    assert.equal(saved.session.viewerPreferences.videoSound, true);
    assert.deepEqual(saved.session.viewerPreferences.nsfwRatings, { q: false, e: true });
    await page.locator('#settings-button').click(); await page.locator('#settings-tab-appearance').click();
    await page.locator('[name="videoSound"]').uncheck();
    await page.reload();
    await page.waitForFunction(() => viewerPreferences.videoSound === false);
    await page.locator('[data-nav="adult"]').click();
    await page.locator('.card-art[data-key="rule34:3e"]').click();
    await page.waitForFunction(() => { const video = document.querySelector('.detail-video video'); return video && video.readyState >= 2; });
    assert.equal(await page.locator('.detail-video video').evaluate(video => video.muted), true);
    await page.evaluate(() => openQuickPreview({ item: currentTab().item, url: currentTab().item.images[0] }, 'fullscreen'));
    assert.equal(await page.locator('.quick-preview-video').evaluate(video => video.muted), true);
    await context.close();
    assert.deepEqual(errors, []);
    console.log('PASS: 1440p right-click, keyboard, Q/E filtering, All images, both-off, profile restore, audible video defaults and manual mute preservation.');
  } finally {
    await browser?.close(); await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

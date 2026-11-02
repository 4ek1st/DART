// Isolated browser integration: neutral synthetic artworks, providers and profile.
// DART_PLAYWRIGHT_PATH selects the existing Playwright package; DART_BROWSER_EXE
// selects headless Edge. No installed application or personal profile is used.
'use strict';
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const assert = require('node:assert/strict'), crypto = require('node:crypto');
const { chromium } = require(process.env.DART_PLAYWRIGHT_PATH || 'playwright');
const root = process.argv[2] || path.resolve(__dirname, '../..');
const screenshots = process.env.DART_QA_OUTPUT || path.join(os.tmpdir(), 'DART-following-order-qa');
const artists = Array.from({ length: 4 }, (_, index) => `fixture_artist_${index}`);
const follows = artists.map(artist => ({ source: 'danbooru', artistId: artist, key: `danbooru::${artist}`,
  name: artist.replaceAll('_', ' '), followedAt: '2025-01-01T00:00:00Z', seenAt: { all: '2026-11-01T00:00:00Z' } }));
function artwork(artist, index, extra = {}) {
  const id = 100000 + artist * 1000 + index;
  return { source: 'danbooru', key: `danbooru:${id}`, id: String(id), title: `Neutral landscape ${id}`,
    rating: 'g', creatorTag: artists[artist], creatorName: follows[artist].name,
    originalUrl: `https://www.pixiv.net/en/artworks/${id}`, tags: ['landscape', `scene_${id}`],
    characterTags: [`fixture_subject_${id}`], width: 1024, height: 1024,
    published: `${index % 2 ? '2026-11-02' : '2024-09-01'}T${String(23 - index).padStart(2, '0')}:00:00Z`,
    thumbnail: `https://example.test/landscape-${id}.png`, images: [`https://example.test/landscape-${id}.png`], ...extra };
}
const initial = artists.map((_, artist) => Array.from({ length: 12 }, (_, index) => artwork(artist, index)));
const background = [artwork(3, 30, { published: '2026-11-03T12:00:00Z' }), artwork(3, 31, { published: '2023-01-01T12:00:00Z' })];
const pagination = Array.from({ length: 6 }, (_, index) => artwork(0, 40 + index, {
  published: `${index % 2 ? '2026-11-04' : '2023-02-01'}T12:00:00Z` }));
const all = [...initial.flat(), ...background, ...pagination], errors = [], writes = [];
let state = { session: { savedWorksVersion: 1, activeIndex: 0,
  tabs: [{ kind: 'follows', title: 'Following', rating: 'all', selectedSources: ['danbooru'] }] } };
let backgroundReleased = false, paginationLoaded = false, releaseBackground, releasePagination, browser;
const backgroundGate = new Promise(resolve => { releaseBackground = () => { backgroundReleased = true; resolve(); }; });
const paginationGate = new Promise(resolve => { releasePagination = resolve; });
const preferences = { language: 'en', aiMode: 'all', hideViewedAndSaved: false, hideFurry: false,
  excludedTags: [], hiddenAuthors: [], curation: { enabled: true, popularity: true, personal: true, freshness: true, resolution: true } };
const ids = items => items.map(item => item.key);
const persistedFollow = () => state.session.tabs.find(tab => tab.kind === 'follows');

async function run() {
  fs.mkdirSync(screenshots, { recursive: true });
  browser = await chromium.launch({ headless: true, executablePath: process.env.DART_BROWSER_EXE });
  const context = await browser.newContext({ viewport: { width: 2560, height: 1440 } });
  await context.addInitScript(() => { Math.random = () => 0.314159265; });
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    const send = value => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(value) });
    if (url.pathname.startsWith('/api/')) {
      const raw = request.postData(), body = raw ? JSON.parse(raw) : {};
      if (url.pathname === '/api/client-state') {
        if (request.method() === 'POST') { state = { ...state, ...body }; writes.push(body); }
        return send(request.method() === 'POST' ? { saved: true } : state);
      }
      if (url.pathname === '/api/follows' || url.pathname === '/api/follows/seen') return send(follows);
      if (url.pathname === '/api/follows/cache') return send(request.method() === 'POST' ? { saved: true } : {
        savedAt: new Date().toISOString(), groups: follows.map((follow, index) => ({ key: follow.key,
          items: [...initial[index], ...(index === 3 && backgroundReleased ? background : []),
            ...(index === 0 && paginationLoaded ? pagination : [])] })) });
      if (url.pathname === '/api/settings') return send({ hasApiKey: true, hasRule34ApiKey: false, sankakuAvailable: false });
      if (url.pathname === '/api/content-preferences') return send(preferences);
      if (['/api/likes', '/api/bookmarks', '/api/favorite-tags', '/api/favorite-artworks',
        '/api/favorite-artwork-groups', '/api/hidden-artworks', '/api/viewed-identities'].includes(url.pathname)) return send([]);
      if (url.pathname === '/api/profile' || url.pathname === '/api/search') {
        const artist = artists.indexOf(url.searchParams.get('artist') || url.searchParams.get('q'));
        const source = url.searchParams.get('source') || url.searchParams.get('sources');
        if (source !== 'danbooru' || artist < 0) return send({ items: [], hasMore: false, hasMoreSources: [], errors: {} });
        const page = Number(url.searchParams.get('page'));
        if (artist === 3 && page === 0) await backgroundGate;
        if (page > 0) { await paginationGate; paginationLoaded = true; }
        const items = page > 0 ? artist === 0 ? pagination : [] :
          [...initial[artist], ...(artist === 3 && backgroundReleased ? background : [])];
        return send({ items, hasMore: artist === 0 && page === 0, hasMoreSources: [], errors: {}, notices: {} });
      }
      if (url.pathname === '/api/detail') return send(all.find(item => item.id === url.searchParams.get('id')));
      if (url.pathname === '/api/image') {
        const bytes = crypto.createHash('sha256').update(url.searchParams.get('url') || '').digest();
        const cells = Array.from({ length: 64 }, (_, index) => `<rect x="${index % 8 * 32}" y="${Math.floor(index / 8) * 32}" width="32" height="32" fill="${bytes[index % 32] >> index % 8 & 1 ? '#329cff' : '#234853'}"/>`).join('');
        return route.fulfill({ status: 200, contentType: 'image/svg+xml',
          body: `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">${cells}</svg>` });
      }
      return send({});
    }
    const filename = path.resolve(root, 'wwwroot', '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
    if (!filename.startsWith(path.join(root, 'wwwroot') + path.sep) || !fs.existsSync(filename))
      return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ status: 200,
      contentType: ({ '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.wasm': 'application/wasm', '.svg': 'image/svg+xml' })[path.extname(filename)] || 'application/octet-stream',
      body: fs.readFileSync(filename) });
  });
  const page = await context.newPage(); page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const order = () => page.evaluate(() => currentTab().items.map(item => item.key));
  const selected = mode => page.locator(`[data-action="follow-order"][data-order="${mode}"]`);
  const shown = () => page.locator('article.card[data-work-key]').evaluateAll(cards => cards.map(card => card.dataset.workKey));
  const savedResponse = mode => page.waitForResponse(response => response.url().endsWith('/api/client-state') &&
    response.request().method() === 'POST' && response.request().postDataJSON()?.session?.tabs?.some(tab => tab.kind === 'follows' && tab.followOrder === mode));

  await page.goto('http://dart.test/');
  assert.equal(await page.title(), 'DART — Discover Art');
  await page.waitForFunction(() => currentTab()?.kind === 'follows' && currentTab().items.length === 48 && document.querySelectorAll('article.card').length > 0);
  assert.equal(await selected('date').getAttribute('aria-pressed'), 'true');
  const date = [...initial.flat()].sort((a, b) => Date.parse(b.published) - Date.parse(a.published)).map(item => item.key);
  assert.deepEqual(await order(), date, 'Date keeps publication chronology across authors');
  const panel = page.locator('.follow-filters'), ratings = panel.locator('[data-action="follow-rating"]').first().locator('..');
  const ordering = page.getByRole('group', { name: 'Following order', exact: true });
  const left = await ratings.boundingBox(), right = await ordering.boundingBox(), container = await panel.boundingBox();
  assert(Math.abs(left.y - right.y) < 3 && right.x >= left.x + left.width, 'Date/Random belongs at the right of the same filter panel');
  assert(right.x + right.width <= container.x + container.width && right.y >= container.y);
  await page.screenshot({ path: path.join(screenshots, 'following-date-1440p.png') });

  await Promise.all([savedResponse('random'), selected('random').click()]);
  assert.equal(await selected('random').getAttribute('aria-pressed'), 'true');
  const random = await order(); assert.notDeepEqual(random, date);
  assert.deepEqual(new Set(random), new Set(date), 'Random retains the same artworks');
  const mixed = await page.evaluate(() => currentTab().items.slice(0, 16).map(item => ({ artist: item.creatorTag, date: item.published })));
  assert.equal(new Set(mixed.map(item => item.artist)).size, 4, 'Random mixes different authors');
  assert.equal(new Set(mixed.map(item => item.date.slice(0, 4))).size, 2, 'Random mixes recent and older works');
  assert.deepEqual(await shown(), random.slice(0, (await shown()).length), 'Rendered cards use the exact Random sequence');
  await page.locator(`.card-art[data-key="${random[0]}"]`).hover(); await page.keyboard.press('Space');
  await page.waitForFunction(key => quickPreview.open && quickPreviewWork?.key === key, random[0]);
  await page.keyboard.press('ArrowRight'); await page.waitForFunction(key => quickPreviewWork?.key === key, random[1]);
  releaseBackground();
  await page.waitForFunction(() => !currentTab().loading && currentTab().items.length === 50);
  assert.deepEqual((await order()).slice(0, random.length), random, 'Background New and older arrivals preserve the exact published prefix');
  await page.keyboard.press('ArrowLeft'); await page.waitForFunction(key => quickPreviewWork?.key === key, random[0]);
  await page.keyboard.press('Escape');
  await page.screenshot({ path: path.join(screenshots, 'following-random-1440p.png') });
  const beforePage = await order();
  await page.locator('#main').hover(); await page.mouse.wheel(0, 10000);
  await page.waitForFunction(() => currentTab().followLoadingMore);
  releasePagination();
  await page.waitForFunction(() => !currentTab().followLoadingMore && currentTab().items.length === 56);
  assert.deepEqual((await order()).slice(0, beforePage.length), beforePage, 'Pagination appends without moving any existing Random card');
  await page.locator('#main').evaluate(element => { element.scrollTop = 0; });
  await Promise.all([savedResponse('date'), selected('date').click()]);
  assert.deepEqual(await order(), [...all].sort((a, b) => Date.parse(b.published) - Date.parse(a.published)).map(item => item.key));
  await Promise.all([savedResponse('random'), selected('random').click()]);
  const seed = await page.evaluate(() => currentTab().followRandomSeed);
  assert.equal(persistedFollow().followOrder, 'random'); assert.equal(persistedFollow().followRandomSeed, seed);
  assert(seed > 0 && seed <= 0xffffffff && Number.isInteger(seed));
  assert(writes.some(write => write.session?.tabs.some(tab => tab.followOrder === 'random' && tab.followRandomSeed === seed)));
  await page.reload();
  await page.waitForFunction(() => currentTab()?.kind === 'follows' && !currentTab().loading && currentTab().items.length === 56);
  assert.equal(await selected('random').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.evaluate(() => currentTab().followRandomSeed), seed, 'Saved Random seed survives startup reload');

  await page.setViewportSize({ width: 760, height: 1000 });
  await selected('date').waitFor({ state: 'visible' });
  const narrow = await page.locator('.follow-filters').boundingBox(), narrowOrder = await ordering.boundingBox();
  assert(narrowOrder.x >= narrow.x && narrowOrder.x + narrowOrder.width <= narrow.x + narrow.width + 1);
  assert(narrowOrder.y >= narrow.y && narrowOrder.y + narrowOrder.height <= narrow.y + narrow.height + 1);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Narrow window has no horizontal page overflow');
  await Promise.all([savedResponse('date'), selected('date').click()]);
  assert.equal(await selected('date').getAttribute('aria-pressed'), 'true');
  await Promise.all([savedResponse('random'), selected('random').click()]);
  assert.equal(await selected('random').getAttribute('aria-pressed'), 'true');
  await page.screenshot({ path: path.join(screenshots, 'following-random-narrow.png') });
  assert.deepEqual(errors, [], 'No browser console or application errors');
  await context.close();
  console.log(JSON.stringify({ result: 'PASS', viewport: '2560x1440 and 760x1000', authors: artists.length,
    initialWorks: 48, backgroundWorks: 2, paginatedWorks: 6, persistedRandomSeed: seed,
    checks: ['Date/Random placement', 'author and age mixing', 'stable background/pagination prefix', 'Space/arrow sequence', 'client-state POST/reload', 'narrow layout', 'console'], screenshots }));
}
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  releaseBackground(); releasePagination(); await browser?.close();
});

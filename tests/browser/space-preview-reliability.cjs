// Real headless Chromium regression; API/profile/media are neutral fixtures.
// Run with DART_PLAYWRIGHT_PATH and DART_BROWSER_EXE for existing tooling.
// --compare-ref <ref> serves that revision's app.js without changing checkout.
'use strict';
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.DART_PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(__dirname, '../..'), web = path.join(root, 'wwwroot');
const refAt = process.argv.indexOf('--compare-ref');
const app = refAt >= 0 ? cp.execFileSync('git', ['show', process.argv[refAt + 1] + ':wwwroot/app.js'], { cwd: root })
  : fs.readFileSync(path.join(web, 'app.js'));
const records = Array.from({ length: 60 }, (_, index) => ({
  key: `danbooru:${index + 1}`, id: String(index + 1), source: 'danbooru', rating: 'g',
  title: `Neutral landscape ${index + 1}`, creatorTag: `neutral_artist_${index + 1}`,
  tags: ['landscape', `neutral_artist_${index + 1}`], characterTags: [],
  published: '2026-11-03T12:00:00Z', thumbnail: `https://example.test/thumb-${index + 1}.svg`,
  images: [`https://example.test/full-${index + 1}.svg`]
}));
let browser;
(async () => {
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.DART_BROWSER_EXE });
    const context = await browser.newContext({ viewport: { width: 2560, height: 1440 } });
    const page = await context.newPage(); page.setDefaultTimeout(8000);
    const errors = [], captures = [];
    let liked = [...records], state = { session: { savedWorksVersion: 1, activeIndex: 0,
      tabs: [{ kind: 'likes', title: 'Liked' }] } };
    page.on('pageerror', error => errors.push(error.message));
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      const json = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      if (url.pathname.startsWith('/api/')) {
        const body = request.postData() ? JSON.parse(request.postData()) : {};
        if (url.pathname === '/api/client-state') {
          if (request.method() === 'POST') state = { ...state, ...body };
          return json(request.method() === 'GET' ? state : { saved: true });
        }
        if (url.pathname === '/api/likes') {
          if (request.method() === 'GET') return json(liked);
          liked = liked.filter(item => item.key !== body.key);
          return json({ saved: false });
        }
        if (url.pathname === '/api/detail') return json(records.find(item => item.id === url.searchParams.get('id')));
        if (url.pathname === '/api/image') return route.fulfill({ status: 200, contentType: 'image/svg+xml',
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="192"><rect width="256" height="192" fill="#329cff"/></svg>' });
        if (url.pathname === '/api/settings') return json({ hasApiKey: true, hasRule34ApiKey: false, sankakuAvailable: false });
        if (url.pathname === '/api/content-preferences') return json({ language: 'en', aiMode: 'all' });
        if (['/api/bookmarks', '/api/follows', '/api/favorite-tags', '/api/favorite-artworks',
          '/api/favorite-artwork-groups', '/api/hidden-artworks', '/api/viewed-identities'].includes(url.pathname)) return json([]);
        return json({});
      }
      if (url.pathname === '/app.js') return route.fulfill({ status: 200, contentType: 'text/javascript', body: app });
      const file = path.resolve(web, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
      if (!file.startsWith(web + path.sep) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
      return route.fulfill({ status: 200, contentType: ({ '.js': 'text/javascript', '.css': 'text/css',
        '.html': 'text/html', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' })[path.extname(file)] || 'application/octet-stream',
        body: fs.readFileSync(file) });
    });
    const frames = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const snapshot = () => page.evaluate(() => ({ open: quickPreview.open, key: quickPreviewWork?.key || null,
      focus: document.activeElement?.dataset.key || document.activeElement?.id || document.activeElement?.tagName,
      pointer: quickPreviewPointer, held: quickPreviewSpaceHeld, kind: currentTab()?.kind }));
    await page.goto('http://neutral-space.test/');
    await page.waitForFunction(() => document.querySelectorAll('article.card').length === 60);
    const card = page.locator('.card-art[data-key="danbooru:1"]');
    await card.hover();
    const position = await card.evaluate(node => { const rect = node.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }; });
    await page.keyboard.press('Space'); await page.locator('#quick-preview[open]').waitFor(); await frames();
    await page.keyboard.press('f');
    await page.waitForFunction(() => !likedKeys.has('danbooru:1') && quickPreviewRenderPending);
    await page.keyboard.press('Escape'); await page.waitForFunction(() => !quickPreview.open); await frames();
    assert.equal(await card.count(), 0, 'Unliking removes the original opener when the deferred collection render is painted');
    assert.equal(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('.card-art')?.dataset.key, position),
      'danbooru:2', 'The stationary mouse is over the next real artwork after the collection repaint');
    captures.push({ step: 'after-unlike-close', ...await snapshot() });
    await page.keyboard.press('Space'); await frames();
    captures.push({ step: 'stationary-reopen', ...await snapshot() });
    assert.equal(await page.evaluate(() => quickPreview.open && quickPreviewWork.key), 'danbooru:2',
      'Space must reopen the artwork under the stationary mouse after the old opener is removed');
    const thirdPosition = await page.locator('.card-art[data-key="danbooru:3"]').evaluate(node => {
      const rect = node.getBoundingClientRect(); return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    });
    await page.mouse.move(thirdPosition.x, thirdPosition.y);
    await page.keyboard.press('Escape'); await page.waitForFunction(() => !quickPreview.open); await frames();
    await page.keyboard.press('Space'); await frames();
    captures.push({ step: 'mouse-moved-within-modal', ...await snapshot() });
    console.log(JSON.stringify(captures));
    assert.equal(await page.evaluate(() => quickPreview.open && quickPreviewWork.key), 'danbooru:3',
      'Mouse movement while the modal is open must select the artwork at that current position after closing');
    // No hover or mouse movement between these quick close/open pairs. This
    // catches modal pointer transitions and held-key state leaking into later presses.
    for (let cycle = 0; cycle < 24; cycle++) {
      await page.keyboard.press('Space');
      assert.equal(await page.evaluate(() => quickPreview.open), false, `Rapid cycle ${cycle}: Space closes once`);
      await page.keyboard.press('Space');
      assert.equal(await page.evaluate(() => quickPreview.open && quickPreviewWork.key), 'danbooru:3',
        `Rapid cycle ${cycle}: the next separate Space press reopens the mouse target`);
    }
    await page.keyboard.press('Escape'); await page.waitForFunction(() => !quickPreview.open);
    const twoRows = await page.locator('article.card').evaluateAll(nodes => {
      const top = nodes[0].getBoundingClientRect().top;
      return 2 * (nodes.map(node => node.getBoundingClientRect().top).find(y => y > top + 10) - top);
    });
    await page.mouse.wheel(0, twoRows);
    await page.waitForFunction(distance => main.scrollTop >= distance - 2, twoRows); await frames();
    const afterScroll = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('.card-art')?.dataset.key,
      thirdPosition);
    assert(afterScroll && afterScroll !== 'danbooru:3', 'Scrolling brings a different neutral artwork under the stationary mouse');
    await page.keyboard.press('Space');
    assert.equal(await page.evaluate(() => quickPreview.open && quickPreviewWork.key), afterScroll,
      'Space hit-tests the current scrolled artwork instead of retaining an old element');
    // A real mouse move outside the viewport must not fall back to a stale
    // artwork focus. Reentering the viewport hands control back to the mouse.
    await page.mouse.move(-20, -20);
    await page.keyboard.press('Escape'); await page.waitForFunction(() => !quickPreview.open);
    await page.keyboard.press('Space');
    assert.equal(await page.evaluate(() => quickPreview.open), false, 'Space outside the viewport must not reopen stale artwork');
    await page.mouse.move(thirdPosition.x, thirdPosition.y); await page.keyboard.press('Space');
    assert.equal(await page.evaluate(() => quickPreview.open && quickPreviewWork.key), afterScroll,
      'Mouse reentry selects the current artwork');
    await page.keyboard.down('Space');
    assert.equal(await page.evaluate(() => quickPreview.open), false);
    assert.equal(await page.evaluate(() => quickPreviewSpaceHeld), true);
    // Headless page activation does not emit an OS window blur. Exercise this
    // lifecycle branch explicitly; pointer/key scenarios above use real input.
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    assert.equal(await page.evaluate(() => quickPreviewSpaceHeld), false);
    await page.keyboard.up('Space');
    await page.mouse.move(thirdPosition.x + 1, thirdPosition.y); await page.mouse.move(thirdPosition.x, thirdPosition.y);
    await page.keyboard.press('Space');
    assert.equal(await page.evaluate(() => quickPreview.open && quickPreviewWork.key), afterScroll,
      'The blur lifecycle reset cannot leave later separate Space presses blocked');
    assert.deepEqual(errors, []);
    console.log('PASS: real pointer/key Space after unliking/deferred collection repaint, modal movement, 24 rapid pairs, scroll and viewport leave/reentry; explicit blur lifecycle reset.');
    await context.close();
  } finally { await browser?.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

// Hidden Edge, the actual app/virtual grid, and neutral local API/media only.
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { chromium } = require(process.env.DART_PLAYWRIGHT_PATH || 'playwright');
const web = path.resolve(__dirname, '../../wwwroot');
const output = process.env.DART_QA_OUTPUT || path.join(os.tmpdir(), 'DART-preview-return');
const records = Array.from({ length: 640 }, (_, index) => ({
  key: `danbooru:${index + 1}`, source: 'danbooru', id: String(index + 1), rating: 'g',
  title: `Neutral geometric field ${index + 1}`, creatorTag: `neutral_artist_${index + 1}`,
  tags: ['landscape', `neutral_artist_${index + 1}`], characterTags: [],
  thumbnail: `https://example.test/thumb-${index + 1}.svg`, images: [`https://example.test/full-${index + 1}.svg`]
}));
const report = { viewport: { width: 2560, height: 1440 }, records: records.length, checks: [], closes: [], errors: [] };
const check = (condition, label) => { assert(condition, label); report.checks.push(label); };
let browser;
(async () => {
  fs.mkdirSync(output, { recursive: true });
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.DART_BROWSER_EXE });
    const context = await browser.newContext({ viewport: report.viewport });
    const page = await context.newPage(); page.setDefaultTimeout(10000);
    page.on('pageerror', error => report.errors.push(error.message));
    let liked = [...records], state = { session: { savedWorksVersion: 1, activeIndex: 0, tabs: [{ kind: 'likes', title: 'Liked' }] } };
    await page.addInitScript(() => {
      globalThis.returnCloseTimes = [];
      document.addEventListener('keydown', event => {
        if (document.querySelector('#quick-preview[open]') && ['Escape', ' '].includes(event.key))
          globalThis.returnCloseStart = performance.now();
      }, true);
      document.addEventListener('click', event => {
        if (event.target.closest?.('[data-preview-action="close"]')) globalThis.returnCloseStart = performance.now();
      }, true);
      new MutationObserver(() => {
        if (globalThis.returnCloseStart && document.querySelector('.artwork-return-highlight')) {
          returnCloseTimes.push(performance.now() - returnCloseStart); returnCloseStart = 0;
        }
      }).observe(document, { subtree: true, attributes: true, childList: true, attributeFilter: ['class', 'open'] });
    });
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
          liked = liked.filter(item => item.key !== body.key); return json({ saved: false });
        }
        if (url.pathname === '/api/detail') return json(records.find(item => item.id === url.searchParams.get('id')) || {});
        if (url.pathname === '/api/image') {
          const id = Number((url.searchParams.get('url') || '').match(/-(\d+)\.svg/)?.[1] || 1);
          return route.fulfill({ status: 200, contentType: 'image/svg+xml', body:
            `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="192"><rect width="256" height="192" fill="rgb(${id & 255},${id >>> 8},137)"/><rect x="128" y="96" width="128" height="96" fill="#d7dfe8"/></svg>` });
        }
        if (url.pathname === '/api/settings') return json({ hasApiKey: true, hasRule34ApiKey: false, sankakuAvailable: false });
        if (url.pathname === '/api/content-preferences') return json({ language: 'en', aiMode: 'all' });
        if (['/api/bookmarks', '/api/follows', '/api/favorite-tags', '/api/favorite-artworks',
          '/api/favorite-artwork-groups', '/api/hidden-artworks', '/api/viewed-identities', '/api/source-status'].includes(url.pathname)) return json([]);
        return json({});
      }
      const file = path.resolve(web, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
      if (!file.startsWith(web + path.sep) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
      return route.fulfill({ status: 200, contentType: ({ '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
        '.html': 'text/html; charset=utf-8', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' })[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
    });
    const frames = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const selected = () => page.evaluate(() => quickPreviewWork?.key);
    const advance = async count => {
      for (let index = 0; index < count; index++) {
        const before = await selected(); await page.keyboard.press('ArrowRight');
        await page.waitForFunction(before => quickPreviewWork?.key !== before, before);
      }
      return selected();
    };
    const open = async key => {
      const card = page.locator(`button.card-art[data-key="${key}"]`);
      await card.hover(); await page.keyboard.press('Space');
      await page.waitForFunction(key => quickPreview.open && quickPreviewWork?.key === key, key);
      check(await page.locator('.artwork-return-highlight').count() === 0, 'opening a new preview cancels the previous return outline');
    };
    const close = async (key, method) => {
      if (method === 'button') await page.locator('[data-preview-action="close"]').click();
      else await page.keyboard.press(method);
      await page.waitForFunction(() => !quickPreview.open); await frames();
      const snapshot = await page.evaluate(key => {
        const card = [...main.querySelectorAll('.card[data-work-key]')].find(node => node.dataset.workKey === key);
        const rect = card?.getBoundingClientRect(), bounds = main.getBoundingClientRect();
        return { key, highlight: card?.classList.contains('artwork-return-highlight'), highlighted: main.querySelectorAll('.artwork-return-highlight').length,
          visible: !!rect && rect.top >= bounds.top && rect.bottom <= bounds.bottom, focus: document.activeElement?.dataset.key,
          color: card && getComputedStyle(card).outlineColor, scroll: main.scrollTop, animations: card?.getAnimations().map(animation => animation.effect.getTiming().duration) };
      }, key);
      report.closes.push({ method, ...snapshot });
      check(snapshot.highlight && snapshot.highlighted === 1, method + ' highlights only the last displayed work');
      check(snapshot.visible, method + ' returns the last work inside the original grid viewport');
      check(snapshot.focus === key, method + ' returns keyboard focus to the last card');
      check(snapshot.color === 'rgb(50, 156, 255)', method + ' uses the requested blue outline');
      check(snapshot.animations.includes(1000), method + ' runs one one-second effect');
      return snapshot;
    };
    await page.goto('http://neutral-preview-return.test/');
    await page.waitForFunction(() => currentTab()?.artworkLists?.get('likes')?.length === 640 && main.querySelector('.virtual-grid'));
    await frames();
    const first = await page.locator('button.card-art').first().getAttribute('data-key');
    await open(first); let key = await advance(5); await close(key, 'Escape');
    await page.waitForFunction(() => !main.querySelector('.artwork-return-highlight'));
    check(await page.locator('.artwork-return-highlight').count() === 0, 'the outline is removed after its one-second lifetime');
    await open(key); key = await advance(3);
    // Gallery controls can own focus; Space is intentionally reserved for a
    // non-button preview surface, just as the user's normal image gesture.
    await page.locator('.quick-preview-image').focus(); await close(key, 'Space');
    await open(key); key = await advance(2); await close(key, 'button');
    await open(key);
    const renderedBefore = await page.locator('.card[data-work-key]').evaluateAll(nodes => nodes.map(node => node.dataset.workKey));
    key = await advance(130);
    check(!renderedBefore.includes(key), 'deep traversal leaves the currently rendered virtual window');
    const deep = await close(key, 'Escape');
    check(deep.scroll > 3000, 'closing a deep virtual traversal teleports the original grid');
    await page.screenshot({ path: path.join(output, 'deep-return-1440p.png') });
    await open(key); await page.keyboard.press('f');
    await page.waitForFunction(key => !likedKeys.has(key) && quickPreviewRenderPending, key);
    await page.keyboard.press('Escape'); await frames();
    check(await page.locator(`.card[data-work-key="${key}"]`).count() === 0, 'an unliked card removed on close is never resurrected');
    check(await page.locator('.artwork-return-highlight').count() === 0, 'a removed target receives no stale outline');
    report.closeCommitMs = await page.evaluate(() => returnCloseTimes);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const reducedKey = await page.locator('button.card-art').first().getAttribute('data-key');
    await open(reducedKey); await page.keyboard.press('Escape'); await frames();
    check(await page.locator('.artwork-return-highlight').count() === 1, 'reduced motion retains the same single return indication');
    check(await page.locator('.artwork-return-highlight').evaluate(node => node.getAnimations().length) === 0,
      'reduced motion uses a static outline without animation');
    await page.waitForFunction(() => !main.querySelector('.artwork-return-highlight'));
    check(await page.locator('.artwork-return-highlight').count() === 0, 'reduced motion cleans its static outline after one second');
    await context.close();
    check(report.errors.length === 0, 'no browser runtime errors');
    console.log(JSON.stringify({ passed: report.checks.length, closes: report.closes.length, errors: report.errors, output }));
  } finally {
    await browser?.close(); fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

// Hidden Edge and neutral response evidence only. No real website probes,
// personal profile, application focus or native UI harness.
'use strict';
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const assert = require('node:assert/strict'), crypto = require('node:crypto');
const { chromium } = require(process.env.DART_PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(__dirname, '../..'), web = path.join(root, 'wwwroot');
const output = process.env.DART_QA_OUTPUT || path.join(os.tmpdir(), 'DART-source-status-' + crypto.randomUUID());
fs.mkdirSync(output, { recursive: true });
const index = fs.readFileSync(path.join(web, 'index.html'), 'utf8');
const aside = index.match(/<aside\b[\s\S]*?<\/aside>/)[0];
const sources = ['danbooru', 'gelbooru', 'rule34', 'sankaku'];
let status = sources.map(source => ({ source, websiteUnavailable: false, statusCode: 200 })), localFailure = false;
const checks = [], errors = [], fail = (condition, label) => { assert(condition, label); checks.push(label); };
let browser;
(async () => {
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.DART_BROWSER_EXE });
    const context = await browser.newContext({ viewport: { width: 2560, height: 1440 }, reducedMotion: 'reduce' });
    const page = await context.newPage(); page.setDefaultTimeout(6000);
    page.on('pageerror', error => errors.push(error.message));
    await page.route('http://dart.source-status.test/**', async route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/source-status') return route.fulfill({ status: localFailure ? 503 : 200,
        json: localFailure ? { error: 'Neutral local failure' } : status });
      if (url.pathname === '/') return route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>DART source status fixture</title><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/themes.css"><script src="/locales.js" defer></script><script src="/i18n.js" defer></script><script src="/source-status.js" defer></script></head><body><div class="app-shell"><div class="workspace">${aside}<main class="main"><h1>Neutral source status check</h1></main></div></div></body></html>` });
      const file = path.join(web, url.pathname.slice(1));
      if (!fs.existsSync(file)) return route.fulfill({ status: 404 });
      return route.fulfill({ contentType: file.endsWith('.css') ? 'text/css; charset=utf-8' : 'application/javascript; charset=utf-8', body: fs.readFileSync(file) });
    });
    await page.goto('http://dart.source-status.test/');
    await page.waitForFunction(() => globalThis.DartSourceStatus?.instance);
    fail(await page.title() === 'DART source status fixture', 'fixture identity');
    fail(await page.locator('[data-source-status]').count() === 4, 'four actual footer source dots');
    const baseColors = await page.locator('[data-source-status]').evaluateAll(nodes => nodes.map(node => getComputedStyle(node).backgroundColor));
    fail(new Set(baseColors).size === 4, 'all four original catalog colors remain distinct');
    for (const source of sources) {
      status = sources.map(name => ({ source: name, websiteUnavailable: name === source, statusCode: name === source ? 503 : 200, retryAt: Date.now() + 30000 }));
      await page.evaluate(() => DartSourceStatus.instance.refresh());
      const node = page.locator(`[data-source-status="${source}"]`);
      await page.waitForFunction(source => getComputedStyle(document.querySelector(`[data-source-status="${source}"]`)).backgroundColor === 'rgb(128, 128, 128)', source);
      fail(await page.locator('.source-unavailable').count() === 1, source + ' alone becomes grey');
      await node.hover(); fail((await node.getAttribute('title')).includes('Problems on the website side.'), source + ' hover has precise website-side label');
      await node.focus();
      fail(await page.locator('#source-status-tooltip').isVisible(), source + ' keyboard focus exposes tooltip');
      fail((await node.getAttribute('aria-label')).includes('Problems on the website side.'), source + ' accessible status');
      const dimensions = await node.boundingBox(); fail(dimensions.width === 8 && dimensions.height === 8, source + ' preserves original dot size');
      status = sources.map(name => ({ source: name, websiteUnavailable: false, statusCode: 200 }));
      await page.evaluate(() => DartSourceStatus.instance.refresh());
      await page.waitForFunction(() => !document.querySelector('.source-unavailable'));
      await page.waitForFunction(({ source, color }) => getComputedStyle(document.querySelector(`[data-source-status="${source}"]`)).backgroundColor === color,
        { source, color: baseColors[sources.indexOf(source)] });
      fail(await node.evaluate(node => getComputedStyle(node).backgroundColor) === baseColors[sources.indexOf(source)], source + ' real success restores brand color');
    }
    status = sources.map(source => ({ source, websiteUnavailable: false, statusCode: source === 'danbooru' ? 401 : 200 }));
    await page.evaluate(() => DartSourceStatus.instance.refresh());
    fail(await page.locator('.source-unavailable').count() === 0, 'bad credentials are not a website outage');
    status[0] = { source: 'danbooru', websiteUnavailable: true, statusCode: 503, retryAt: 1 };
    await page.evaluate(() => DartSourceStatus.instance.refresh()); localFailure = true;
    await page.evaluate(() => DartSourceStatus.instance.refresh());
    fail(await page.locator('[data-source-status="danbooru"]').getAttribute('data-source-state') === 'website-unavailable', 'failed local read and expired deadline do not pretend recovery');
    localFailure = false;
    for (const [language, expected] of [['ru', 'Проблемы на стороне сайта.'], ['de', 'Probleme aufseiten der Website.'], ['en', 'Problems on the website side.']]) {
      await page.evaluate(language => DartI18n.setLanguage(language, false), language);
      await page.evaluate(() => DartSourceStatus.instance.refresh());
      const localized = await page.locator('[data-source-status="danbooru"]').getAttribute('title');
      fail(localized.includes(expected), language + ' localized tooltip: ' + localized);
    }
    for (const theme of ['dark', 'light', 'list']) {
      await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
      const node = page.locator('[data-source-status="danbooru"]'); await node.focus();
      const box = await page.locator('#source-status-tooltip').boundingBox();
      fail(box.x >= 0 && box.y >= 0 && box.x + box.width <= 2560, theme + ' tooltip fits viewport');
      const colors = await page.locator('#source-status-tooltip').evaluate(node => ({ color: getComputedStyle(node).color, background: getComputedStyle(node).backgroundColor }));
      fail(colors.color !== colors.background, theme + ' tooltip keeps contrasting text');
      await page.screenshot({ path: path.join(output, theme + '-1440p.png') });
    }
    await page.setViewportSize({ width: 1100, height: 700 });
    await page.waitForTimeout(80); // Let the resize lifecycle dismiss the previous focus tooltip.
    await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
    await page.locator('[data-source-status="danbooru"]').focus();
    await page.locator('#source-status-tooltip').waitFor({ state: 'visible' });
    const narrow = await page.locator('#source-status-tooltip').boundingBox();
    fail(narrow.x >= 0 && narrow.y >= 0 && narrow.x + narrow.width <= 1100, 'compact tooltip stays on screen');
    await page.screenshot({ path: path.join(output, 'compact.png') });
    await page.setViewportSize({ width: 900, height: 700 }); await page.waitForTimeout(80);
    fail(!await page.locator('.sidebar-footer').isVisible(), 'existing collapsed-sidebar behavior stays intact');
    fail(!await page.locator('#source-status-tooltip').isVisible(), 'hidden footer does not leave an orphaned tooltip');
    await page.screenshot({ path: path.join(output, 'narrow.png') });
    fail(errors.length === 0, 'no JavaScript errors');
    const report = { checks: checks.length, passed: checks, errors, output, sourceHash: crypto.createHash('sha256').update(fs.readFileSync(path.join(web, 'source-status.js'))).digest('hex') };
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ checks: report.checks, errors, output, sourceHash: report.sourceHash }));
  } finally { await browser?.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

// Real headless Edge regression. All works, author preferences and APIs are
// neutral fixtures; no personal profile or native processor is used.
// DART_PLAYWRIGHT_PATH / DART_BROWSER_EXE select existing installed tooling.
// Optional --compare-ref <ref> runs that app.js to reproduce a previous failure.
'use strict';
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const crypto = require('node:crypto'), cp = require('node:child_process'), assert = require('node:assert/strict');
const { chromium } = require(process.env.DART_PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(__dirname, '../..'), web = path.join(root, 'wwwroot');
const refAt = process.argv.indexOf('--compare-ref');
const app = refAt >= 0 ? cp.execFileSync('git', ['show', process.argv[refAt + 1] + ':wwwroot/app.js'], { cwd: root })
  : fs.readFileSync(path.join(web, 'app.js'));
const output = process.env.DART_QA_OUTPUT || path.join(os.tmpdir(), 'DART-recommendation-author-hide-' + crypto.randomUUID());
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const work = (id, source = 'danbooru') => ({ key: `${source}:${id}`, source, id: String(id), rating: 'g',
  title: `Neutral landscape ${id}`, creatorTag: `neutral_artist_${id % 8}`, creatorName: `Neutral Artist ${id % 8}`,
  tags: ['watercolor', 'landscape', 'river', 'forest'], characterTags: [], published: '2026-11-03T12:00:00Z',
  thumbnail: `https://example.test/thumb-${source}-${id}.svg`, images: [`https://example.test/full-${source}-${id}.svg`] });
const liked = Array.from({ length: 40 }, (_, index) => work(700000 + index));
let browser;
const results = [];

async function scenario(pending) {
  const context = await browser.newContext({ viewport: { width: 2560, height: 1440 } });
  const page = await context.newPage(); page.setDefaultTimeout(10000);
  const errors = [], calls = [], known = new Map(liked.map(item => [item.key, item]));
  const preferences = { language: 'en', aiMode: 'all', hideViewedAndSaved: false,
    excludedTags: [], hiddenAuthors: [], curation: { enabled: true } };
  let holdSource = pending, releaseSource;
  const sourceGate = new Promise(resolve => { releaseSource = resolve; });
  let state = { session: { savedWorksVersion: 1, activeIndex: 0, tabs: [{ kind: 'recommendations',
    title: 'Recommendations', rating: 'general', selectedSources: pending ? ['danbooru', 'gelbooru'] : ['danbooru'] }] } };
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), raw = request.postData(), body = raw ? JSON.parse(raw) : {};
    const json = value => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(value) });
    if (url.pathname.startsWith('/api/')) {
      if (url.pathname === '/api/client-state') {
        if (request.method() === 'POST') state = { ...state, ...body };
        return json(request.method() === 'GET' ? state : { saved: true });
      }
      if (url.pathname === '/api/settings') return json({ hasApiKey: true, hasRule34ApiKey: false, sankakuAvailable: false });
      if (url.pathname === '/api/content-preferences') return json(preferences);
      if (url.pathname === '/api/recommendation-tag-preferences') return json({ preferences: {}, initialized: true });
      if (url.pathname === '/api/likes') return json(liked);
      if (url.pathname === '/api/hidden-authors') {
        preferences.hiddenAuthors = preferences.hiddenAuthors.filter(author => author.artistId !== body.author.artistId);
        if (body.hidden) preferences.hiddenAuthors.push(body.author);
        holdSource = false; releaseSource();
        return json(preferences);
      }
      if (['/api/bookmarks', '/api/follows', '/api/favorite-tags', '/api/favorite-artworks',
        '/api/favorite-artwork-groups', '/api/hidden-artworks', '/api/viewed-identities'].includes(url.pathname)) return json([]);
      if (url.pathname === '/api/search' || url.pathname === '/api/profile') {
        const q = url.searchParams.get('q') || '', sources = (url.searchParams.get('sources') || 'danbooru').split(',');
        const pageNumber = Number(url.searchParams.get('page') || 0);
        calls.push({ sources, q, page: pageNumber });
        if (holdSource && sources.length === 1 && sources[0] === 'gelbooru') await sourceGate;
        await wait(80);
        const seed = parseInt(crypto.createHash('sha256').update(q).digest('hex').slice(0, 5), 16);
        const items = sources.flatMap(source => Array.from({ length: 12 }, (_, index) => work(800000 + seed * 16 + index, source)));
        for (const item of items) known.set(item.key, item);
        return json({ items, errors: {}, hasMore: false, hasMoreSources: [], notices: {} });
      }
      if (url.pathname === '/api/detail') return json(known.get(url.searchParams.get('source') + ':' + url.searchParams.get('id')));
      if (url.pathname === '/api/image') {
        const hash = crypto.createHash('sha256').update(url.searchParams.get('url') || '').digest();
        const cells = Array.from({ length: 64 }, (_, index) => `<rect x="${index % 8 * 32}" y="${Math.floor(index / 8) * 32}" width="32" height="32" fill="${hash[index % 32] >> index % 8 & 1 ? '#329cff' : '#234853'}"/>`).join('');
        return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">${cells}</svg>` });
      }
      return json({});
    }
    if (url.pathname === '/app.js') return route.fulfill({ status: 200, contentType: 'text/javascript', body: app });
    const file = path.resolve(web, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
    if (!file.startsWith(web + path.sep) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ status: 200, contentType: ({ '.js': 'text/javascript', '.css': 'text/css',
      '.html': 'text/html', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' })[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
  });
  const snapshot = () => page.evaluate(() => {
    const tab = currentTab(), worker = mergeRecommendationsAsync.state;
    return { kind: tab.kind, started: tab.started, loading: tab.loading, items: tab.items.length,
      tags: tab.recommendationTags?.length, version: tab.recommendationVersion,
      aborted: tab.recommendationController?.signal.aborted, workerGeneration: worker?.nextId,
      pendingWorkerJobs: worker?.jobs?.size, hidden: contentPreferences.hiddenAuthors.length,
      refresh: document.querySelectorAll('[data-action="recommendation-refresh"]').length,
      emptyText: document.querySelector('.feature-empty')?.textContent };
  });
  const captures = [], hiddenArtists = new Set();
  try {
    await page.goto('http://neutral-dart.test/');
    assert.equal(await page.title(), 'DART — Discover Art');
    for (let cycle = 0; cycle < 3; cycle++) {
      await page.locator('article.card .card-artist').first().waitFor();
      if (!pending || cycle) await page.waitForFunction(() => !currentTab().loading);
      const authors = await page.locator('article.card .card-artist').evaluateAll(nodes => nodes.map(node => node.dataset.contextAuthorId));
      const index = authors.findIndex(author => !hiddenArtists.has(author));
      assert(index >= 0, 'The fixture provides another author for the repeated hide');
      const author = authors[index]; hiddenArtists.add(author);
      captures.push({ cycle, stage: 'before-hide', ...await snapshot() });
      const before = calls.length;
      await page.locator('article.card .card-artist').nth(index).click({ button: 'right' });
      await page.locator('[data-context-action="hide"]').click();
      await page.waitForFunction(() => !contentPreferencesSaving && contentPreferences.hiddenAuthors.length > 0);
      captures.push({ cycle, stage: 'after-hide', ...await snapshot() });
      await page.locator('#main').evaluate(element => { element.scrollTop = element.scrollHeight; });
      await page.mouse.wheel(0, 800);
      try {
        await page.waitForFunction(() => currentTab().items.length > 0 && !currentTab().loading &&
          currentTab().items.every(item => !CatalogLogic.isWorkHidden(item, contentPreferences)), null, { timeout: 4000 });
      } catch (error) {
        captures.push({ cycle, stage: 'blocked', newSearchRequests: calls.length - before, ...await snapshot() });
        await page.screenshot({ path: path.join(output, `${pending ? 'pending' : 'settled'}-blocked.png`) });
        throw new Error('Recommendations did not resume after hiding an author: ' + JSON.stringify(captures));
      }
      captures.push({ cycle, stage: 'recovered', newSearchRequests: calls.length - before, ...await snapshot() });
      assert.equal(await page.locator('[data-action="recommendation-refresh"]').count(), 1);
      await page.locator('[data-action="recommendation-refresh"]').click();
      await page.waitForFunction(() => currentTab().items.length > 0 && !currentTab().loading);
      assert.equal(await page.evaluate(() => currentTab().items.every(item => !CatalogLogic.isWorkHidden(item, contentPreferences))), true);
      await page.locator('#settings-button').click(); await page.locator('[data-section="authors"]').click();
      await page.locator('[data-action="unhide-author"]').first().click();
      await page.waitForFunction(() => !contentPreferencesSaving && contentPreferences.hiddenAuthors.length === 0);
      await page.locator('[data-nav="recommendations"]').click();
      await page.waitForFunction(() => currentTab().kind === 'recommendations' && currentTab().items.length > 0 && !currentTab().loading);
    }
    assert.equal(hiddenArtists.size, 3);
    assert.deepEqual(errors, []);
    results.push({ pendingSourceAtFirstHide: pending, distinctAuthors: hiddenArtists.size, captures, searches: calls.length, errors });
  } finally { releaseSource(); await context.close(); }
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.DART_BROWSER_EXE });
    await scenario(false); await scenario(true);
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ viewport: '2560x1440', results }, null, 2));
    console.log(JSON.stringify({ result: 'PASS', viewport: '2560x1440', scenarios: results.length,
      distinctAuthorsPerScenario: 3, checks: ['real author Hide', 'same-page reload of visible recommendations',
        'scroll and Refresh', 'late hidden-author rejection', 'Unhide and repeated authors', 'no page reload'], output }));
  } finally { await browser?.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

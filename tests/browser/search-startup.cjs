// Real application in headless Edge; all API, profile and media data are isolated.
'use strict';
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.DART_PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(__dirname, '../..'), web = path.join(root, 'wwwroot');
const output = process.env.DART_QA_OUTPUT || fs.mkdtempSync(path.join(os.tmpdir(), 'DART-search-startup-'));
fs.mkdirSync(output, { recursive: true });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const works = Array.from({ length: 120 }, (_, index) => ({ key: `danbooru:${5000 + index}`, id: String(5000 + index), source: 'danbooru',
  title: `Neutral landscape ${index}`, rating: 'g', creatorTag: `neutral_artist_${index}`, artistId: `neutral_artist_${index}`,
  tags: ['forest', 'landscape', `scene_${index}`], characterTags: [],
  thumbnail: `https://example.test/thumb-${index}.svg`, images: [`https://example.test/image-${index}.svg`] }));
const report = { viewport: '2560x1440', errors: [], checks: [] };
let browser;

async function fixture(label, kind, gates = {}) {
  const context = await browser.newContext({ viewport: { width: 2560, height: 1440 } });
  const held = new Set(); let pages = 0;
  let state = { session: { savedWorksVersion: 1, activeIndex: 0, tabs: [{ kind,
    title: kind === 'search' ? 'forest' : 'Home', query: kind === 'search' ? 'forest' : '', rating: 'all', selectedSources: ['danbooru'] }] } };
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    const send = value => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(value) }).catch(() => {});
    if (url.pathname.startsWith('/api/')) {
      const gate = gates[url.pathname];
      if (gate && request.method() === 'GET') { held.add(url.pathname); await gate.promise; }
      if (url.pathname === '/api/client-state') {
        if (request.method() === 'POST') state = { ...state, ...JSON.parse(request.postData()) };
        return send(request.method() === 'GET' ? state : { saved: true });
      }
      if (url.pathname === '/api/settings') return send({ hasApiKey: true, hasRule34ApiKey: false, sankakuAvailable: false });
      if (url.pathname === '/api/content-preferences') return send({ language: 'en', aiMode: 'all', hideViewedAndSaved: true,
        excludedTags: [], hiddenAuthors: [], curation: { enabled: false } });
      if (url.pathname === '/api/recommendation-tag-preferences') return send({ preferences: {}, initialized: true });
      if (url.pathname === '/api/hidden-artworks') return send(kind === 'home' ? [works[0]] : []);
      if (url.pathname === '/api/favorite-artworks') return send([works[1]]);
      if (['/api/likes', '/api/bookmarks', '/api/viewed-identities', '/api/favorite-tags', '/api/favorite-artwork-groups', '/api/follows', '/api/tags'].includes(url.pathname)) return send([]);
      if (url.pathname === '/api/search') {
        const page = pages++;
        if (page > 0 && gates.pagination) { held.add('pagination'); await gates.pagination.promise; }
        return send({ items: kind === 'home' ? works.slice(0, 60) : page === 0 ? works.slice(0, 60) : works.slice(60),
          errors: {}, notices: {}, hasMore: kind === 'search' && page === 0, hasMoreSources: kind === 'search' && page === 0 ? ['danbooru'] : [] });
      }
      if (url.pathname === '/api/image') return route.fulfill({ status: 200, contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200"><path fill="#234853" d="M0 0h1600v1200H0z"/><circle cx="900" cy="600" r="280" fill="#329cff"/></svg>' }).catch(() => {});
      return send({});
    }
    const file = path.resolve(web, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
    if (!file.startsWith(web + path.sep) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ status: 200, contentType: ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html',
      '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.ico': 'image/x-icon' })[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
  });
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  page.on('pageerror', error => report.errors.push({ label, error: error.message }));
  return { context, page, held };
}

(async () => {
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.DART_BROWSER_EXE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
    const optional = deferred(), hidden = deferred();
    const boot = await fixture('startup', 'home', { '/api/favorite-artworks': optional, '/api/hidden-artworks': hidden });
    try {
      await boot.page.goto('http://dart-neutral.test/');
      for (let i = 0; i < 100 && !boot.held.has('/api/hidden-artworks'); i++) await boot.page.waitForTimeout(20);
      assert(boot.held.has('/api/hidden-artworks')); assert(boot.held.has('/api/favorite-artworks'));
      assert.equal(await boot.page.evaluate(() => tabs.length), 0, 'First results wait for hidden-work identities');
      const started = performance.now(); hidden.resolve();
      await boot.page.waitForFunction(() => currentTab()?.kind === 'home' && main.querySelector('article.card'));
      report.readyWhileOptionalHeldMs = performance.now() - started;
      assert.equal(await boot.page.locator('article.card[data-work-key="danbooru:5000"]').count(), 0, 'Hidden work cannot flash into Home');
      assert.equal(await boot.page.evaluate(() => favoritesController().artworks().length), 0);
      optional.resolve(); await boot.page.waitForFunction(() => favoritesController().artworks().length === 1);
      assert.equal(await boot.page.evaluate(() => currentTab().kind), 'home');
      report.checks.push('Home starts with optional collection held, respects hidden-work gate, and accepts late collection data');
    } finally { optional.resolve(); hidden.resolve(); await boot.context.close(); }

    const pagination = deferred(), edit = await fixture('search', 'search', { pagination });
    try {
      await edit.page.goto('http://dart-neutral.test/');
      await edit.page.waitForFunction(() => currentTab()?.items.length === 60 && main.querySelector('article.card'));
      await edit.page.locator('main').evaluate(node => { node.scrollTop = node.scrollHeight; });
      for (let i = 0; i < 100 && !edit.held.has('pagination'); i++) await edit.page.waitForTimeout(30);
      assert(edit.held.has('pagination'), 'Infinite scroll has a held next page');
      await edit.page.locator('#search-input').fill('new unsubmitted query');
      await edit.page.locator('#search-input').evaluate(node => node.setSelectionRange(4, 15));
      pagination.resolve(); await edit.page.waitForFunction(() => currentTab().items.length === 120);
      await edit.page.waitForTimeout(100);
      const draft = await edit.page.locator('#search-input').evaluate(node => ({ value: node.value, start: node.selectionStart,
        end: node.selectionEnd, focused: document.activeElement === node }));
      assert.deepEqual(draft, { value: 'new unsubmitted query', start: 4, end: 15, focused: true });
      await edit.page.evaluate(() => { globalThis.__searchId = activeId; createTab('settings', 'Settings'); });
      assert.equal(await edit.page.locator('#search-input').inputValue(), '');
      await edit.page.evaluate(() => activate(globalThis.__searchId));
      assert.equal(await edit.page.locator('#search-input').inputValue(), 'new unsubmitted query');
      await edit.page.evaluate(() => openSearch('background', { background: true }));
      assert.equal(await edit.page.locator('#search-input').inputValue(), 'new unsubmitted query');
      await edit.page.locator('#search-input').fill('  forest  '); await edit.page.locator('#search-input').press('Enter');
      assert.equal(await edit.page.locator('#search-input').inputValue(), 'forest');
      await edit.page.evaluate(() => render());
      assert.equal(await edit.page.locator('#search-input').inputValue(), 'forest');
      report.draftAfterPagination = draft;
      report.checks.push('Pagination preserves text/focus/selection; tab return restores draft; background search leaves it alone; Enter commits normalized query');
      await edit.page.screenshot({ path: path.join(output, 'search-draft-neutral.png') });
    } finally { pagination.resolve(); await edit.context.close(); }
    assert.deepEqual(report.errors, []); report.passed = true;
  } catch (error) { report.exception = error.stack; process.exitCode = 1; }
  finally { await browser?.close(); fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); }
})();

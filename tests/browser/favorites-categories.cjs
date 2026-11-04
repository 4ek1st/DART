// Actual frontend, isolated synthetic profile and neutral SVG previews.
// --compare-ref serves only that revision's Favorites module in memory.
// Run with DART_PLAYWRIGHT_PATH and DART_BROWSER_EXE.
'use strict';
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const cp = require('node:child_process'), crypto = require('node:crypto'), http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.DART_PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(__dirname, '../..'), web = path.join(root, 'wwwroot');
const at = process.argv.indexOf('--compare-ref'), ref = at < 0 ? '' : process.argv[at + 1];
const favorites = ref ? cp.execFileSync('git', ['show', ref + ':wwwroot/favorites.js'], { cwd: root })
  : fs.readFileSync(path.join(web, 'favorites.js'));
const output = process.env.DART_QA_OUTPUT || path.join(os.tmpdir(), 'DART-favorites-categories-' + crypto.randomUUID());
const qualifiedName = 'cum_(sample_series)';
const works = Array.from({ length: 12 }, (_, index) => {
  const characterTags = ['fern'];
  if (index === 0) characterTags.push('cum'); // One stale wrong provider category.
  if ([1, 2, 3, 8, 9, 10].includes(index)) characterTags.push(qualifiedName);
  return { key: 'rule34:' + (1000 + index), id: String(1000 + index), source: 'rule34',
    title: 'Neutral geometric landscape ' + index, rating: index < 8 ? 'e' : 'g',
    creatorTag: 'fixture_artist_' + index, creatorName: 'Fixture Artist ' + index,
    characterTags, tags: ['cum', 'rain', 'fern', ...characterTags],
    thumbnail: 'https://example.test/neutral-' + index + '.svg',
    images: ['https://example.test/original-' + index + '.svg'], published: '2026-11-04T10:00:00Z' };
});
const originalWorks = JSON.stringify(works), manualTags = ['cum', 'fern'];
let state = { session: { savedWorksVersion: 1, activeIndex: 0, tabs: [{ kind: 'favorites',
  title: 'Favorites', rating: 'all', favoriteType: 'character', favoriteOrigin: 'system' }] } };
const summary = { totalWorks: 12, kinds: { cum: 'character', fern: 'character' },
  entries: [{ tag: 'cum', kind: 'character', count: 8, activeDays: 2, lastWorkKey: works[0].key },
    { tag: 'fern', kind: 'character', count: 5, activeDays: 2, lastWorkKey: works[1].key }], works: [works[0], works[1]] };
const report = { revision: ref || 'working-tree', viewport: '2560x1440',
  favoritesSha256: crypto.createHash('sha256').update(favorites).digest('hex'),
  checks: [], failures: [], observations: [], errors: [], requests: [] };
const check = (condition, label, data) => {
  report.checks.push(label); if (!condition) report.failures.push({ label, ...data });
};
const json = (res, value) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); };
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost'), chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks)) : {};
    if (url.pathname.startsWith('/api/')) {
      report.requests.push({ path: url.pathname, method: req.method, rating: url.searchParams.get('rating') });
      if (url.pathname === '/api/client-state') {
        if (req.method === 'POST') state = { ...state, ...body };
        return json(res, req.method === 'GET' ? state : { saved: true });
      }
      if (url.pathname === '/api/settings') return json(res, { hasApiKey: true, hasRule34ApiKey: true, sankakuAvailable: true });
      if (url.pathname === '/api/content-preferences') return json(res, { language: 'en', aiMode: 'all', hideViewedAndSaved: false });
      if (url.pathname === '/api/recommendation-tag-preferences') return json(res, { preferences: { cum: 'priority' }, initialized: true });
      if (url.pathname === '/api/favorites') return json(res, summary);
      if (url.pathname === '/api/favorite-tags') return json(res, manualTags);
      if (url.pathname === '/api/likes') return json(res, works);
      if (['/api/favorite-artworks', '/api/favorite-artwork-groups', '/api/bookmarks', '/api/follows', '/api/viewed-identities', '/api/hidden-artworks'].includes(url.pathname)) return json(res, []);
      if (url.pathname === '/api/search' || url.pathname === '/api/profile') return json(res, { items: works, errors: {}, hasMore: false, hasMoreSources: [] });
      if (url.pathname === '/api/detail') return json(res, works.find(item => item.id === url.searchParams.get('id')) || works[0]);
      if (url.pathname === '/api/image') {
        res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
        return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="256" height="192"><rect width="256" height="192" fill="#234853"/><circle cx="150" cy="85" r="44" fill="#329cff"/></svg>');
      }
      return json(res, {});
    }
    if (url.pathname === '/favorites.js') { res.writeHead(200, { 'Content-Type': 'text/javascript' }); return res.end(favorites); }
    const file = path.resolve(web, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
    if (!file.startsWith(web + path.sep) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' })[path.extname(file)] || 'application/octet-stream' });
    res.end(fs.readFileSync(file));
  } catch (error) { report.errors.push('Server: ' + error.message); res.writeHead(500); res.end(); }
});
let browser;
(async () => {
  fs.mkdirSync(output, { recursive: true });
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    browser = await chromium.launch({ headless: true, executablePath: process.env.DART_BROWSER_EXE });
    const page = await browser.newPage({ viewport: { width: 2560, height: 1440 } });
    page.setDefaultTimeout(10000); page.on('pageerror', error => report.errors.push(error.message));
    const frames = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const action = (name, value) => page.locator('[data-action="favorites-' + name + '"]' + (value ? '[data-value="' + value + '"]' : ''));
    const entity = tag => page.locator('.favorite-entity[data-render-key="favorite:' + tag + '"]');
    const observe = async label => {
      const entries = await page.locator('.favorite-entity').evaluateAll(nodes => nodes.map(node => ({
        tag: node.dataset.renderKey.slice('favorite:'.length), text: node.querySelector('.favorite-entity-stats').textContent.replace(/\s+/g, ' ').trim() })));
      report.observations.push({ label, entries }); return entries;
    };
    const characters = async label => {
      await action('type', 'character').click(); await frames();
      const entries = await observe(label), tags = entries.map(entry => entry.tag);
      check(!tags.includes('cum'), label + ':content-absent', { tags });
      check(tags.includes('fern'), label + ':typed-character-present', { tags });
      check(tags.includes(qualifiedName), label + ':qualified-real-name-present', { tags });
    };
    const content = async (label, count) => {
      await action('type', 'tag').click(); await frames();
      const entries = await observe(label), entry = entries.find(item => item.tag === 'cum');
      check(!!entry, label + ':content-in-tags', { entries });
      check(entry?.text.includes(count + ' liked artworks'), label + ':liked-count', { text: entry?.text, count });
      check(entry?.text.includes('8 viewed artworks'), label + ':view-count', { text: entry?.text });
      check(entry?.text.includes('Priority'), label + ':priority-preserved', { text: entry?.text });
    };
    await page.goto('http://127.0.0.1:' + server.address().port + '/');
    await page.locator('.favorite-entity').first().waitFor();
    await page.waitForFunction(() => !currentTab().favoriteLoading && !!currentTab().favoriteSummary);
    await characters('all-system-characters');
    await content('all-system-tags', 12);
    await page.screenshot({ path: path.join(output, 'neutral-system-tags.png') });
    for (const [rating, count] of [['explicit', 8], ['general', 4], ['all', 12]]) {
      await action('rating', rating).click();
      await page.waitForFunction(() => !currentTab().favoriteLoading);
      await characters(rating + '-system-characters'); await content(rating + '-system-tags', count);
    }
    const oldReads = report.requests.filter(request => request.path === '/api/favorites').length;
    await action('refresh').click(); await page.waitForFunction(() => !currentTab().favoriteLoading);
    check(report.requests.filter(request => request.path === '/api/favorites').length > oldReads, 'refresh-rereads-summary');
    await characters('refreshed-system-characters'); await content('refreshed-system-tags', 12);
    await action('origin', 'mine').click(); await action('type', 'character').click(); await frames();
    check(await entity('cum').count() === 1, 'mine-explicit-character-choice-preserved');
    check(await entity('fern').count() === 1, 'mine-real-character-choice-preserved');
    await action('origin', 'system').click(); await characters('after-manual-round-trip');
    await page.screenshot({ path: path.join(output, 'neutral-system-characters.png') });
    check(JSON.stringify(works) === originalWorks, 'saved-input-metadata-unchanged');
    check(report.requests.every(request => request.path !== '/api/favorite-tags' || request.method === 'GET'), 'no-manual-choice-writes');
    check(report.errors.length === 0, 'no-browser-or-server-errors', { errors: report.errors });
    if (process.argv.includes('--expect-regression'))
      assert(report.failures.some(failure => failure.label.endsWith(':content-absent')), 'Old module must reproduce content inside Characters');
    else assert.equal(report.failures.length, 0, 'Favorites classification failed');
  } catch (error) { report.exception = error.stack; throw error; }
  finally {
    await browser?.close(); await new Promise(resolve => server.close(resolve));
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ revision: report.revision, checks: report.checks.length, failures: report.failures,
      errors: report.errors, exception: report.exception, output }));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

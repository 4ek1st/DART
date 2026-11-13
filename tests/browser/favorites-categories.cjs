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
let windowWorks = [];
const originalWorks = JSON.stringify(works), manualTags = ['cum', 'fern'];
const large = process.argv.includes('--large'), entryOnly = process.argv.includes('--entry-only');
const hero = 'fixture_hero', fog = 'coastal_fog', unavailable = 'unavailable_character';
const member = { ...works[4], key: 'rule34:2001', id: '2001', tags: [hero], characterTags: [hero, 'companion'] };
const other = { ...works[5], key: 'rule34:2002', id: '2002', tags: ['companion'], characterTags: ['companion'] };
const group = { ...other, tags: [hero], characterTags: [hero, 'companion'], groupMembers: [other, member] };
const tagWork = (id, tags) => ({ ...works[8], key: 'rule34:' + id, id: String(id), tags, characterTags: [],
  thumbnail: 'https://example.test/tag-' + id + '.svg', images: ['https://example.test/tag-full-' + id + '.svg'] });
const viewedTag = tagWork(2003, [fog]);
const unseenTag = tagWork(2004, [fog, fog + '_focus']);
const blockedTag = tagWork(2005, [fog, fog + '_focus', 'blocked_example']);
manualTags.push(hero, fog, unavailable);
const liked = large ? [...works, ...Array.from({ length: 2440 }, (_, index) => ({
  ...works[index % works.length], key: 'rule34:' + (10000 + index), id: String(10000 + index),
  characterTags: [index < 24 ? qualifiedName : 'unrelated_character'],
  tags: Array.from({ length: 60 }, (_, tag) => 'neutral_dense_' + tag),
  thumbnail: 'https://example.test/large-' + index + '.svg',
  images: ['https://example.test/large-full-' + index + '.svg']
}))] : works;
const viewedTokens = ['key:' + viewedTag.key, 'key:' + blockedTag.key,
  ...(large ? Array.from({ length: 100000 }, (_, i) => 'key:rule34:' + (50000 + i)) : [])];
if (large) manualTags.push(...Array.from({ length: 16 }, (_, i) => 'missing_neutral_tag_' + i));
let state = { session: { savedWorksVersion: 1, activeIndex: 0, tabs: [{ kind: 'favorites',
  title: 'Favorites', rating: entryOnly ? 'all' : 'explicit', favoriteType: 'character', favoriteOrigin: 'system' }] } };
if (large) state.session.tabs.push(...Array.from({ length: 15 }, (_, i) => ({
  kind: ['search', 'recommendations', 'follows', 'bookmarks', 'profile'][i % 5],
  title: 'Neutral tab ' + i, rating: 'general', query: 'neutral_' + i,
  selectedSources: ['rule34'], profileRef: { source: 'artist', artist: 'neutral_' + i }
})));
const summary = { totalWorks: 32, kinds: { cum: 'character', fern: 'character', [hero]: 'character',
  [fog]: 'tag', [unavailable]: 'character' },
  entries: [{ tag: 'cum', kind: 'character', count: 8, activeDays: 2, lastWorkKey: works[0].key },
    { tag: 'fern', kind: 'character', count: 5, activeDays: 2, lastWorkKey: works[1].key },
    { tag: hero, kind: 'character', count: 17, lastWorkKey: group.key },
    { tag: fog, kind: 'tag', count: 4 }, { tag: unavailable, kind: 'character', count: 2 }],
  works: [works[0], works[1], group, blockedTag] };
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
      if (url.pathname === '/api/content-preferences') return json(res, { language: 'en', aiMode: 'all', hideViewedAndSaved: false, excludedTags: ['blocked_example'] });
      if (url.pathname === '/api/recommendation-tag-preferences') return json(res, { preferences: { cum: 'priority' }, initialized: true });
      if (url.pathname === '/api/favorites') return json(res, summary);
      if (url.pathname === '/api/favorite-tags') return json(res, manualTags);
      if (url.pathname === '/api/likes') return json(res, liked);
      if (url.pathname === '/api/bookmarks') return json(res, [viewedTag]);
      if (url.pathname === '/api/favorite-artworks') return json(res, works);
      if (url.pathname === '/api/viewed-identities') return json(res, viewedTokens);
      if (['/api/favorite-artwork-groups', '/api/follows', '/api/hidden-artworks'].includes(url.pathname)) return json(res, []);
      if (url.pathname === '/api/search' || url.pathname === '/api/profile') return json(res, { items: works, errors: {}, hasMore: false, hasMoreSources: [] });
      if (url.pathname === '/api/detail') return json(res, [...windowWorks, ...works, member, other, viewedTag].find(item =>
        item.id === url.searchParams.get('id')) || works[0]);
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
    await page.addInitScript(() => {
      window.favoriteLongTasks = [];
      new PerformanceObserver(list => window.favoriteLongTasks.push(...list.getEntries().map(task => task.duration)))
        .observe({ type: 'longtask' });
    });
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
      check(await action('rating').count() === 0, label + ':no-rating-buttons');
    };
    const content = async (label, count) => {
      await action('type', 'tag').click(); await frames();
      const entries = await observe(label), entry = entries.find(item => item.tag === 'cum');
      check(!!entry, label + ':content-in-tags', { entries });
      check(entry?.text.includes(count + ' liked artworks'), label + ':liked-count', { text: entry?.text, count });
      check(entry?.text.includes('8 viewed artworks'), label + ':view-count', { text: entry?.text });
      check(entry?.text.includes('Priority'), label + ':priority-preserved', { text: entry?.text });
      check(await action('rating').count() === 0, label + ':no-rating-buttons');
    };
    const cold = performance.now();
    await page.goto('http://127.0.0.1:' + server.address().port + '/');
    await page.locator('.favorite-entity').first().waitFor();
    await page.waitForFunction(() => !currentTab().favoriteLoading && !!currentTab().favoriteSummary);
    report.performance = { coldMs: Math.round(performance.now() - cold) };
    if (entryOnly) {
      const warm = performance.now();
      await action('type', 'tag').click(); await frames();
      await action('type', 'character').click(); await frames();
      report.performance.warmSwitchMs = Math.round(performance.now() - warm);
      report.performance.longTasks = await page.evaluate(() => favoriteLongTasks);
      check(report.errors.length === 0, 'entry-measurement-without-runtime-errors');
      assert.equal(report.failures.length, 0);
      return;
    }
    await characters('all-system-characters');
    await content('all-system-tags', 12);
    await page.screenshot({ path: path.join(output, 'neutral-system-tags.png') });
    await action('type', 'artwork').click();
    check(await action('rating').count() === 3, 'artworks-show-all-rating-buttons');
    const ratingReads = report.requests.filter(request => request.path === '/api/favorites').length;
    for (const [rating, count] of [['explicit', 8], ['general', 4], ['all', 12], ['general', 4]]) {
      await action('rating', rating).press('Enter');
      check(await action('rating', rating).getAttribute('aria-pressed') === 'true', rating + ':keyboard-filter-selected');
      check(await page.evaluate(() => currentTab().items.length) === count, rating + ':artwork-filter-applies');
    }
    check(report.requests.filter(request => request.path === '/api/favorites').length === ratingReads,
      'artwork-rating-does-not-reload-history');
    const warm = performance.now();
    await characters('after-artwork-rating-characters'); await content('after-artwork-rating-tags', 12);
    report.performance.warmSwitchMs = Math.round(performance.now() - warm);
    await action('type', 'artwork').click();
    check(await action('rating', 'general').getAttribute('aria-pressed') === 'true', 'artwork-rating-restored');
    await action('type', 'tag').click();
    const oldReads = report.requests.filter(request => request.path === '/api/favorites').length;
    await action('refresh').click(); await page.waitForFunction(() => !currentTab().favoriteLoading);
    check(report.requests.filter(request => request.path === '/api/favorites').length > oldReads, 'refresh-rereads-summary');
    await characters('refreshed-system-characters'); await content('refreshed-system-tags', 12);
    await action('origin', 'mine').click(); await action('type', 'character').click(); await frames();
    check(await entity('cum').count() === 1, 'mine-explicit-character-choice-preserved');
    check(await entity('fern').count() === 1, 'mine-real-character-choice-preserved');
    const coverStarted = performance.now();
    const cover = entity(hero).locator('article[data-work-key="' + member.key + '"]');
    await cover.waitFor();
    await page.waitForFunction(key => !!document.querySelector('article[data-work-key="' + key + '"] img')?.naturalWidth, member.key);
    report.performance.fallbackReadyMs = Math.round(performance.now() - coverStarted);
    check(await entity(hero).innerText().then(text => text.includes('17 viewed artworks') && text.includes('Previously viewed')),
      'viewed-character-fallback-keeps-count-and-uses-matching-group-member');
    check(await entity(unavailable).innerText().then(text => text.includes('2 viewed artworks') && text.includes('Preview unavailable')),
      'unavailable-thumbnail-does-not-deny-confirmed-views');
    await cover.locator('.card-title').hover();
    await page.locator('#tag-hover-preview').getByText('Previously viewed').waitFor();
    check(true, 'tag-hover-confirms-same-viewed-tier');
    await cover.locator('button.card-art[data-action="open"]').hover();
    await page.keyboard.press('Space');
    await page.waitForFunction(() => quickPreview.open);
    check(await page.evaluate(() => quickPreviewWork?.key) === member.key, 'space-preview-opens-matching-cover-work');
    await page.keyboard.press('Escape');
    await page.evaluate(item => itemIndex.set(item.key, item), unseenTag);
    await action('type', 'tag').click();
    await entity(fog).locator('article[data-work-key="' + viewedTag.key + '"]').waitFor();
    check(await entity(fog).innerText().then(text => text.includes('Previously viewed')), 'tag-fallback-rejects-unseen-and-blocked-works');
    check(await action('rating').count() === 0, 'mine-tags-no-rating-buttons');
    await page.setViewportSize({ width: 900, height: 760 });
    check(await page.locator('.favorites-filters').evaluate(node => node.scrollWidth <= node.clientWidth + 1), 'compact-filters-fit-narrow-window');
    await page.setViewportSize({ width: 2560, height: 1440 });
    await action('origin', 'system').click(); await characters('after-manual-round-trip');
    await page.screenshot({ path: path.join(output, 'neutral-system-characters.png') });
    check(JSON.stringify(works) === originalWorks, 'saved-input-metadata-unchanged');
    check(report.requests.every(request => request.path !== '/api/favorite-tags' || request.method === 'GET'), 'no-manual-choice-writes');
    check(report.requests.every(request => request.path !== '/api/favorites' || request.rating === 'all'), 'only-unfiltered-entity-history-requests');
    report.performance.longTasks = await page.evaluate(() => favoriteLongTasks);
    if (large) {
      report.performance.fixture = await page.evaluate(() => ({ likes: likes.length, viewed: viewedTokens.size, tabs: tabs.length }));
      check(report.performance.fixture.likes >= 2400 && report.performance.fixture.viewed >= 100000 &&
        report.performance.fixture.tabs >= 16, 'large-neutral-library-with-mixed-tabs');
      report.performance.coverBatch = await page.evaluate(async entries => {
        const firstTask = favoriteLongTasks.length, began = performance.now();
        const examples = await favoriteViewedExamples(entries, currentTab(), new AbortController().signal);
        const duration = performance.now() - began;
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        return { duration: Math.round(duration), matched: examples.size, longTasks: favoriteLongTasks.slice(firstTask) };
      }, [{ tag: hero, kind: 'character' }, { tag: fog, kind: 'tag' },
        ...manualTags.filter(tag => tag.startsWith('missing_neutral')).map(tag => ({ tag, kind: 'tag' }))]);
      check(report.performance.coverBatch.matched === 2, 'one-large-batch-resolves-both-viewed-covers');
    }
    if (process.argv.includes('--virtual-window')) {
      windowWorks = Array.from({ length: 180 }, (_, i) => ({ ...works[8], key: 'rule34:' + (90000 + i),
        id: String(90000 + i), title: 'Neutral window cover ' + i, characterTags: ['window_character_' + i],
        tags: ['window_character_' + i], thumbnail: 'https://example.test/window-thumb-' + i + '.svg',
        images: ['https://example.test/window-full-' + i + '.svg'] }));
      const entitySummary = { totalWorks: 180, kinds: {},
        entries: windowWorks.map((work, i) => ({ tag: work.characterTags[0], kind: 'character', count: 180 - i,
          lastWorkKey: work.key })), works: windowWorks.filter((_, i) => i % 3 !== 1) };
      Object.assign(summary, entitySummary);
      manualTags.splice(0, manualTags.length, ...windowWorks.map(work => work.characterTags[0]));
      await page.evaluate(({ works, summary, tags }) => {
        favoriteTags = tags;
        const tab = currentTab();
        tab.favoriteType = 'character'; tab.favoriteOrigin = 'mine'; tab.favoriteSummary = summary;
        tab.virtualState = {}; tab.scrollTop = 0; main.scrollTop = 0;
        works.forEach(rememberItem); favoritesController().invalidate(); render();
      }, { works: entitySummary.works, summary: entitySummary, tags: manualTags });
      await page.locator('[data-grid-key="favorites"].virtual-grid .favorite-entity').first().waitFor(); await frames();
      let mounted = await page.locator('.favorite-entity').count();
      check(mounted < 90, 'window:mounted-entity-count-bounded', { mounted });
      const sourceSize = await page.evaluate(() => currentTab().items.length);
      check(sourceSize === 120, 'window:complete-viewer-source-with-missing-covers', { sourceSize });
      const first = entity('window_character_0');
      await first.locator('button.card-art[data-action="open"]').hover(); await page.keyboard.press('Space');
      await page.waitForFunction(() => quickPreview.open);
      check(await page.evaluate(() => quickPreviewWork.key) === windowWorks[0].key, 'window:first-space-cover-matches');
      await page.keyboard.press('Escape');
      await page.evaluate(() => { main.scrollTop = main.scrollHeight; main.dispatchEvent(new Event('scroll')); });
      await entity('window_character_179').waitFor(); await frames();
      mounted = await page.locator('.favorite-entity').count();
      check(mounted < 90, 'window:tail-entity-count-bounded', { mounted });
      const tail = entity('window_character_179');
      await tail.locator('button.card-art[data-action="open"]').hover(); await page.keyboard.press('Space');
      await page.waitForFunction(() => quickPreview.open);
      check(await page.evaluate(() => quickPreviewWork.key) === windowWorks[179].key, 'window:tail-space-cover-matches');
      await page.keyboard.press('Escape'); await frames();
      check(await tail.isVisible(), 'window:space-return-restores-tail');
      await page.setViewportSize({ width: 900, height: 760 }); await frames();
      await page.evaluate(() => { main.scrollTop = main.scrollHeight; main.dispatchEvent(new Event('scroll')); });
      await entity('window_character_179').waitFor();
      check(await page.locator('.favorite-entity').count() < 60, 'window:narrow-mounted-count-bounded');
      check(await page.locator('.favorites-page').evaluate(node => node.scrollWidth <= node.clientWidth + 1), 'window:narrow-grid-fits');
      await page.evaluate(() => { main.scrollTop = 0; main.dispatchEvent(new Event('scroll')); });
      await first.waitFor(); check(true, 'window:scroll-back-restores-first-cover');
    }
    check(report.errors.length === 0, 'no-browser-or-server-errors', { errors: report.errors });
    if (process.argv.includes('--expect-regression'))
      assert(report.failures.some(failure => failure.label.endsWith(':content-absent')), 'Old module must reproduce content inside Characters');
    else assert.equal(report.failures.length, 0, 'Favorites category, rating or preview check failed');
  } catch (error) { report.exception = error.stack; throw error; }
  finally {
    await browser?.close(); await new Promise(resolve => server.close(resolve));
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ revision: report.revision, checks: report.checks.length, failures: report.failures,
      errors: report.errors, exception: report.exception, output }));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

// Real headless Edge; neutral isolated profile and media. Reports actual input,
// route sync, media preparation, preview painting and main-thread frame stalls.
// DART_PLAYWRIGHT_PATH / DART_BROWSER_EXE use existing installed tooling.
// --compare-ref <ref> freezes app.js, catalog logic and ranking worker.
// --expect-regression verifies that frozen old code exceeds the input budget.
'use strict';
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const crypto = require('node:crypto'), cp = require('node:child_process');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.DART_PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(__dirname, '../..'), web = path.join(root, 'wwwroot');
const refAt = process.argv.indexOf('--compare-ref');
const source = refAt >= 0 ? cp.execFileSync('git', ['show', process.argv[refAt + 1] + ':wwwroot/app.js'], { cwd: root }).toString()
  : fs.readFileSync(path.join(web, 'app.js'), 'utf8');
const worker = refAt >= 0 ? cp.execFileSync('git', ['show', process.argv[refAt + 1] + ':wwwroot/catalog-worker.js'], { cwd: root }).toString()
  : fs.readFileSync(path.join(web, 'catalog-worker.js'), 'utf8');
const logic = refAt >= 0 ? cp.execFileSync('git', ['show', process.argv[refAt + 1] + ':wwwroot/catalog-logic.js'], { cwd: root }).toString()
  : fs.readFileSync(path.join(web, 'catalog-logic.js'), 'utf8');
const output = process.env.DART_QA_OUTPUT || path.join(os.tmpdir(), 'DART-recs-browsing-' + crypto.randomUUID());
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const size = Number(process.env.DART_QA_LIBRARY_SIZE || 4000);
const historySize = Number(process.env.DART_QA_HISTORY_SIZE || 100000);
const preloadRounds = Number(process.env.DART_QA_PRELOAD_ROUNDS ?? 3);
const work = (id, saved = false) => ({ key: `danbooru:${id}`, source: 'danbooru', id: String(id), rating: 'g',
  title: `Neutral landscape ${id}`, creatorTag: `neutral_artist_${id % 120}`, creatorName: `Neutral Artist ${id % 120}`,
  tags: ['landscape', ['river', 'forest', 'mountain', 'watercolor'][id % 4], `scene_${id % 24}`], characterTags: [],
  published: '2026-11-03T12:00:00Z', thumbnail: `https://example.test/thumb-${id}.svg`,
  images: [`https://example.test/full-${id}.svg`], ...(saved ? { savedAt: '2026-11-01T12:00:00Z' } : {}) });
const liked = Array.from({ length: size }, (_, index) => work(700000 + index, true));
const history = Array.from({ length: historySize }, (_, index) => `key:danbooru:${900000000 + index}`);
const instrumentation = `
globalThis.__browseProbe = { calls: [], inputs: [], gaps: [], tasks: [], phase: 'startup' };
const __probe = globalThis.__browseProbe;
const __wrap = (name, read, write, async = false) => {
  const original = read();
  write(function(...args) {
    if (__probe.phase === 'startup') return original.apply(this, args);
    const start = performance.now(), phase = __probe.phase;
    const entry = { name, start, phase, sync: 0, duration: 0 };
    __probe.calls.push(entry);
    const value = original.apply(this, args); entry.sync = performance.now() - start;
    if (async && value?.then) return value.finally(() => { entry.duration = performance.now() - start; });
    entry.duration = entry.sync; return value;
  });
};
__wrap('moveArtwork', () => moveArtwork, fn => moveArtwork = fn, true);
__wrap('prepareArtworkMedia', () => prepareArtworkMedia, fn => prepareArtworkMedia = fn, true);
__wrap('warmArtworkRoute', () => warmArtworkRoute, fn => warmArtworkRoute = fn);
__wrap('artworkSourceItems', () => artworkSourceItems, fn => artworkSourceItems = fn);
__wrap('openQuickPreview', () => openQuickPreview, fn => openQuickPreview = fn);
__wrap('recordDetailVisit', () => recordDetailVisit, fn => recordDetailVisit = fn);
__wrap('filterFeedWorks', () => filterFeedWorks, fn => filterFeedWorks = fn);
__wrap('rememberItems', () => rememberItems, fn => rememberItems = fn);
__wrap('render', () => render, fn => render = fn);
__wrap('mergeGroupedWorks', () => CatalogLogic.mergeGroupedWorks, fn => CatalogLogic.mergeGroupedWorks = fn);
__wrap('decode', () => imageLoader.decode, fn => imageLoader.decode = fn, true);
let __frame = performance.now();
function __pulse(now) { if (__probe.phase !== 'startup' && now - __frame > 35) __probe.gaps.push({start: __frame, duration: now - __frame, phase: __probe.phase}); __frame = now; requestAnimationFrame(__pulse); }
requestAnimationFrame(__pulse);
new PerformanceObserver(list => { for (const entry of list.getEntries()) if (__probe.phase !== 'startup') __probe.tasks.push({start:entry.startTime,duration:entry.duration,phase:__probe.phase}); }).observe({entryTypes:['longtask']});
`;
let browser;
(async () => {
  fs.mkdirSync(output, { recursive: true });
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.DART_BROWSER_EXE });
    const context = await browser.newContext({ viewport: { width: 2560, height: 1440 } });
    const errors = [], requests = [], known = new Map(liked.map(item => [item.key, item]));
    let state = { session: { savedWorksVersion: 1, activeIndex: 0, tabs: [{ kind: 'recommendations',
      title: 'Recommendations', rating: 'general', selectedSources: ['danbooru', 'gelbooru'] }] } };
    let searchCount = 0, releaseSources, gateActive = !preloadRounds;
    const sourceGate = new Promise(resolve => { releaseSources = resolve; });
    await context.addInitScript(() => {
      Math.random = () => .123456789;
      document.addEventListener('keydown', event => {
        const probe = globalThis.__browseProbe;
        if (!probe || probe.phase === 'startup') return;
        const start = performance.now(), before = quickPreviewWork?.key, phase = probe.phase;
        const input = {key: event.key, phase, start, queue: start-event.timeStamp, before, preview:quickPreview.open}; probe.inputs.push(input);
        let frames = 0;
        const changed = () => { frames++; const node=quickPreview.querySelector('.quick-preview-image'); const after=quickPreviewWork?.key;
          if (probe.inputs.at(-1) !== input) { input.superseded = true; return; }
          if (after!==before || (event.code==='Space' && quickPreview.open!==input.preview)) {
            input.change=performance.now()-start; input.after=after; input.pixels=!!node?.naturalWidth;
            requestAnimationFrame(() => { input.paint=performance.now()-start; });
          } else if(frames<160) requestAnimationFrame(changed);
        }; requestAnimationFrame(changed);
      }, true);
    });
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url()), raw = request.postData(), body = raw ? JSON.parse(raw) : {};
      const json = value => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(value) }).catch(() => {});
      if (url.pathname.startsWith('/api/')) {
        if (url.pathname === '/api/client-state') { if (request.method() === 'POST') state = { ...state, ...body }; return json(request.method() === 'GET' ? state : { saved: true }); }
        if (url.pathname === '/api/settings') return json({ hasApiKey: true, hasRule34ApiKey: false, sankakuAvailable: false });
        if (url.pathname === '/api/content-preferences') return json({ language: 'en', aiMode: 'all', hideViewedAndSaved: true, curation: { enabled: true } });
        if (url.pathname === '/api/recommendation-tag-preferences') return json({ preferences: {}, initialized: true });
        if (url.pathname === '/api/likes') return json(liked);
        if (url.pathname === '/api/viewed-identities') return json(request.method() === 'POST' ? {} : history);
        if (['/api/bookmarks', '/api/follows', '/api/favorite-tags', '/api/favorite-artworks', '/api/favorite-artwork-groups', '/api/hidden-artworks'].includes(url.pathname)) return json([]);
        if (url.pathname === '/api/search' || url.pathname === '/api/profile') {
          const sequence = ++searchCount, q = url.searchParams.get('q') || '', pageNumber = Number(url.searchParams.get('page') || 0);
          const seed = parseInt(crypto.createHash('sha256').update(q + url.searchParams.get('sources')).digest('hex').slice(0, 5), 16);
          const items = Array.from({ length: Number(process.env.DART_QA_BATCH_SIZE || 120) }, (_, index) => work(800000 + seed * 1000 + pageNumber * 200 + index));
          for (const item of items) known.set(item.key, item);
          if (sequence > 1 && gateActive) await sourceGate;
          await wait(sequence === 1 ? 60 : 180 + sequence % 8 * 110);
          requests.push({ sequence, page: pageNumber, count: items.length, served: Date.now() });
          return json({ items, errors: {}, hasMore: true, hasMoreSources: [url.searchParams.get('sources') || 'danbooru'], notices: {} });
        }
        if (url.pathname === '/api/detail') { await wait(35); return json(known.get(url.searchParams.get('source') + ':' + url.searchParams.get('id')) || {}); }
        if (url.pathname === '/api/image') {
          await wait(20);
          const hash = crypto.createHash('sha256').update(url.searchParams.get('url') || '').digest();
          const cells = Array.from({ length: 64 }, (_, index) => '<rect x="' + index % 8 * 200 + '" y="' + Math.floor(index / 8) * 150 + '" width="200" height="150" fill="' + (hash[index % 32] >> index % 8 & 1 ? '#329cff' : '#234853') + '"/>').join('');
          return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200">' + cells + '</svg>' }).catch(() => {});
        }
        return json({});
      }
      if (url.pathname === '/app.js') return route.fulfill({ status: 200, contentType: 'text/javascript', body: source + '\n' + instrumentation });
      if (url.pathname === '/catalog-worker.js') return route.fulfill({ status: 200, contentType: 'text/javascript', body: worker });
      if (url.pathname === '/catalog-logic.js') return route.fulfill({ status: 200, contentType: 'text/javascript', body: logic });
      const filename = path.resolve(web, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
      if (!filename.startsWith(web + path.sep) || !fs.existsSync(filename)) return route.fulfill({ status: 404, body: '' });
      return route.fulfill({ status: 200, contentType: ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' })[path.extname(filename)] || 'application/octet-stream', body: fs.readFileSync(filename) });
    });
    const page = await context.newPage(); page.setDefaultTimeout(30000);
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://neutral-browsing.test/');
    await page.locator('article.card .card-art').first().waitFor();
    if (preloadRounds) {
      await page.waitForFunction(() => !currentTab().loading);
      for (let round = 1; round < preloadRounds; round++)
        await page.evaluate(async () => { await loadRecommendations(currentTab(), true); });
      gateActive = true;
    }
    await page.locator('article.card .card-art').first().hover();
    await page.keyboard.press('Space');
    await page.waitForFunction(() => quickPreview.open && quickPreview.querySelector('img')?.naturalWidth > 0);
    await page.evaluate(() => { __browseProbe.phase = 'browsing'; });
    if (preloadRounds) await page.evaluate(() => { void loadRecommendations(currentTab(), true); });
    releaseSources();
    const keys = [];
    for (let index = 0; index < 48; index++) {
      if (index && index % 8 === 0) { keys.push({ at: index * 180, key: 'Space' }, { at: index * 180 + 45, key: 'Space' }); }
      keys.push({ at: index * 180 + 90, key: ['ArrowRight', 'd', 'ArrowRight', 'd', 'ArrowRight', 'ArrowLeft', 'a', 'd'][index % 8] });
    }
    // Independent real inputs keep arriving during a blocked renderer. Awaiting
    // every press before scheduling the next would conceal event queue delay.
    const session = await context.newCDPSession(page);
    await Promise.all(keys.map(async input => {
      await wait(input.at);
      const names = { ArrowRight: ['ArrowRight', 'ArrowRight', 39], ArrowLeft: ['ArrowLeft', 'ArrowLeft', 37],
        a: ['a', 'KeyA', 65], d: ['d', 'KeyD', 68], Space: [' ', 'Space', 32] };
      const [key, code, keyCode] = names[input.key];
      const event = { key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode };
      // Queue the physical down/up pair together, without waiting for the
      // renderer's keydown acknowledgement before sending its keyup. Otherwise
      // a long task creates an artificial overlap between separate Space taps.
      await Promise.all([session.send('Input.dispatchKeyEvent', { ...event, type: 'keyDown' }),
        session.send('Input.dispatchKeyEvent', { ...event, type: 'keyUp' })]);
    }));
    await wait(1000);
    const data = await page.evaluate(() => ({ ...__browseProbe, items: currentTab().items.length, loading: currentTab().loading,
      routeCount: quickPreviewRoute?.engine.items.length, open: quickPreview.open, cache: imageLoader.cache.size }));
    const summarize = values => { const sorted = values.filter(Number.isFinite).sort((a,b) => a-b); return { count: sorted.length, median: sorted[Math.floor(sorted.length / 2)] || 0, p95: sorted[Math.min(sorted.length-1,Math.floor(sorted.length*.95))] || 0, max: sorted.at(-1) || 0 }; };
    const stages = Object.fromEntries([...new Set(data.calls.map(entry => entry.name))].map(name => [name, { sync: summarize(data.calls.filter(entry => entry.name === name).map(entry => entry.sync)), total: summarize(data.calls.filter(entry => entry.name === name).map(entry => entry.duration)) }]));
    const summary = { viewport: '2560x1440', size, historySize, preloadRounds, source: refAt >= 0 ? process.argv[refAt+1] : 'working-tree', items: data.items, requests: requests.length,
      sourceHashes: Object.fromEntries(Object.entries({ app: source, worker, logic }).map(([name, value]) => [name, crypto.createHash('sha256').update(value).digest('hex')])),
      inputs: summarize(data.inputs.map(entry => entry.paint)), totalInput: summarize(data.inputs.filter(entry => Number.isFinite(entry.paint)).map(entry => entry.queue + entry.paint)),
      receivedInputs: data.inputs.length, supersededInputs: data.inputs.filter(entry => entry.superseded).length,
      queued: summarize(data.inputs.map(entry => entry.queue)), gaps: summarize(data.gaps.map(entry => entry.duration)), tasks: summarize(data.tasks.map(entry => entry.duration)), stages, errors, output };
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ summary, data, requests }, null, 2));
    console.log(JSON.stringify(summary));
    assert.deepEqual(errors, [], 'The real app must not raise JavaScript errors');
    assert.equal(data.inputs.length, 58, 'Receive all 48 arrows/A/D presses and ten separate Space taps');
    assert.equal(stages.moveArtwork.sync.count, 48, 'Every browsing key must reach the active artwork route');
    assert.equal(data.open, true, 'Separate Space close/open pairs must leave preview browsing active');
    assert(data.inputs.filter(input => input.key !== ' ' && Number.isFinite(input.change))
      .every(input => input.pixels), 'Every sampled artwork change retains decoded pixels');
    const responsive = summary.totalInput.p95 < 200 && summary.totalInput.max < 300 && summary.queued.max < 150;
    assert.equal(responsive, !process.argv.includes('--expect-regression'),
      'Continuous background publication must keep p95 input-to-painted-frame below 200ms, max below 300ms, and input queue below 150ms');
    await context.close();
  } finally { await browser?.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

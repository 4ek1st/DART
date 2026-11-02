// Real headless Edge, real app rendering and worker, isolated neutral profile.
// Optional --compare-ref <git-ref> serves that app.js in memory to verify RED.
'use strict';
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const assert = require('node:assert/strict'), crypto = require('node:crypto'), cp = require('node:child_process');
const { chromium } = require(process.env.DART_PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(__dirname, '../..'), web = path.join(root, 'wwwroot');
const output = process.env.DART_QA_OUTPUT || path.join(os.tmpdir(), `DART-following-busy-${crypto.randomUUID()}`);
const refIndex = process.argv.indexOf('--compare-ref'), ref = refIndex >= 0 ? process.argv[refIndex + 1] : null;
const follows = Array.from({ length: 128 }, (_, index) => ({ key: `danbooru::artist_${index}`,
  source: 'danbooru', artistId: `artist_${index}`, name: `Neutral Artist ${index}`,
  followedAt: '2026-11-01T00:00:00Z' }));
const groups = follows.map((follow, artist) => ({ key: follow.key, items: artist < 64
  ? Array.from({ length: 16 }, (_, index) => {
    const id = artist * 1000 + index + 1;
    return { key: `danbooru:${id}`, id: String(id), source: 'danbooru', title: `Neutral landscape ${id}`,
      creatorTag: follow.artistId, creatorName: follow.name, rating: 'g', tags: ['landscape', `scene_${id}`],
      originalUrl: `https://www.pixiv.net/en/artworks/${1000000 + id}`,
      published: index < 8 ? '2026-11-02T12:00:00Z' : '2025-01-01T12:00:00Z',
      thumbnail: `https://example.test/${id}.svg`, images: [`https://example.test/${id}.svg`] };
  }) : [] }));
const preferences = { language: 'en', aiMode: 'all', hideViewedAndSaved: false, hideFurry: false,
  excludedTags: [], hiddenAuthors: [], curation: { enabled: true } };
const metrics = [];
let browser;

async function scenario(label, appSource, expectRegression = false) {
  const errors = [];
  let state = { session: { savedWorksVersion: 1, activeIndex: 0, tabs: [{ kind: 'follows',
    title: 'Following', rating: 'all', selectedSources: ['danbooru'], followOrder: 'date' }] } };
  const context = await browser.newContext({ viewport: { width: 2560, height: 1440 } });
  await context.addInitScript(() => { Math.random = () => .123456789; });
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    const send = value => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(value) });
    if (url.pathname.startsWith('/api/')) {
      const raw = request.postData(), body = raw ? JSON.parse(raw) : {};
      if (url.pathname === '/api/client-state') {
        if (request.method() === 'POST') state = { ...state, ...body };
        return send(request.method() === 'POST' ? { saved: true } : state);
      }
      if (url.pathname === '/api/follows' || url.pathname === '/api/follows/seen') return send(follows);
      if (url.pathname === '/api/follows/cache') return send(request.method() === 'POST' ? { saved: true } : {
        savedAt: new Date().toISOString(), groups });
      if (url.pathname === '/api/settings') return send({ hasApiKey: false, hasRule34ApiKey: false, sankakuAvailable: false });
      if (url.pathname === '/api/content-preferences') return send(preferences);
      if (['/api/likes', '/api/bookmarks', '/api/favorite-tags', '/api/favorite-artworks',
        '/api/favorite-artwork-groups', '/api/hidden-artworks', '/api/viewed-identities'].includes(url.pathname)) return send([]);
      if (url.pathname === '/api/search' || url.pathname === '/api/profile') {
        const artist = url.searchParams.get('artist') || url.searchParams.get('q');
        return send({ items: groups[follows.findIndex(follow => follow.artistId === artist)]?.items || [],
          hasMore: false, hasMoreSources: [], errors: {}, notices: {} });
      }
      if (url.pathname === '/api/image') return route.fulfill({ status: 200, contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><path fill="#183b49" d="M0 0h256v256H0z"/><path fill="#347851" d="M0 205 70 92l66 76 48-95 72 132v51H0z"/></svg>' });
      return send({});
    }
    if (url.pathname === '/app.js') return route.fulfill({ status: 200, contentType: 'text/javascript', body: appSource });
    const filename = path.resolve(web, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
    if (!filename.startsWith(web + path.sep) || !fs.existsSync(filename)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ status: 200, contentType: ({ '.js': 'text/javascript', '.css': 'text/css',
      '.html': 'text/html', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' })[path.extname(filename)] || 'application/octet-stream',
      body: fs.readFileSync(filename) });
  });
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  try {
    await page.goto('http://dart.test/');
    assert.equal(await page.title(), 'DART — Discover Art');
    await page.waitForFunction(() => currentTab()?.kind === 'follows' && !currentTab().loading &&
      currentTab().items.length === 1024 && document.querySelectorAll('article.card[data-work-key]').length > 0);
    await page.waitForFunction(() => [...document.querySelectorAll('.card img[data-image-url]')]
      .some(image => image.naturalWidth > 0));
    const chronological = await page.evaluate(() => currentTab().items.map(item => item.key));
    await page.evaluate(() => {
      globalThis.__modeFrames = [];
      document.addEventListener('click', event => {
        const button = event.target.closest?.('[data-action="follow-order"]');
        if (!button) return;
        const started = performance.now(), mode = button.dataset.order;
        requestAnimationFrame(() => {
          const cards = [...document.querySelectorAll('article.card[data-work-key]')];
          const shown = cards.map(card => itemIndex.get(card.dataset.workKey));
          const selected = document.querySelector(`[data-action="follow-order"][data-order="${mode}"]`);
          __modeFrames.push({ requested: mode, inputToRafMs: performance.now() - started,
            selected: selected?.getAttribute('aria-pressed'), activeClass: selected.classList.contains('active'),
            selectedBackground: getComputedStyle(selected).backgroundColor, selectedShadow: getComputedStyle(selected).boxShadow,
            rendered: cards.length, firstKeys: cards.slice(0, 32).map(card => card.dataset.workKey),
            first16Artists: new Set(shown.slice(0, 16).map(item => item?.creatorTag)).size,
            first32Ages: new Set(shown.slice(0, 32).map(item => item?.published.slice(0, 4))).size,
            modelFirstKeys: currentTab().items.slice(0, 32).map(item => item.key), loaded: currentTab().items.length });
        });
      }, true);
      let release;
      globalThis.__evidenceGate = new Promise(resolve => { release = resolve; });
      globalThis.__releaseEvidence = release; globalThis.__holdEvidence = true;
      globalThis.__heldTasks = []; globalThis.__evidenceReady = 0;
      const run = DartCatalogJobs.run;
      DartCatalogJobs.run = (operation, args, fallback) => {
        const task = run(operation, args, fallback);
        if (operation !== 'followFeed' || !__holdEvidence) return task;
        const held = task.then(async result => { __evidenceReady++; await __evidenceGate; return result; });
        __heldTasks.push(held); return held;
      };
      currentTab().followUpdateRevision++;
      globalThis.__pendingPublication = flushFollowUpdate(currentTab());
    });
    await page.waitForFunction(() => __evidenceReady > 0);
    const activeWorkers = page.workers().map(worker => new URL(worker.url()).pathname);
    assert(activeWorkers.includes('/catalog-worker.js'), 'The held result came from the app with its real catalog worker active');
    const click = async mode => {
      const count = await page.evaluate(() => __modeFrames.length);
      await page.locator(`[data-action="follow-order"][data-order="${mode}"]`).click();
      await page.waitForFunction(before => __modeFrames.length > before, count);
      return page.evaluate(() => __modeFrames.at(-1));
    };
    const first = await click('random');
    const firstScreenshot = path.join(output, `${label}-random-worker-held-1440p.png`);
    await page.screenshot({ path: firstScreenshot });
    if (expectRegression) {
      assert.deepEqual(first.firstKeys, chronological.slice(0, 32), 'Baseline reproduces the Date rows before worker release');
      assert.equal(first.selected, 'false', 'Baseline control has not painted its requested selection');
      assert.equal(first.activeClass, false);
    } else {
      assert.equal(first.selected, 'true', 'The first click paints Random while the evidence worker remains held');
      assert.equal(first.activeClass, true);
      assert.notEqual(first.selectedShadow, 'none', 'The shared selected-control style is already computed for this frame');
      assert(first.first16Artists >= 12, 'Rendered cards mix the full artist pool on the first click');
      assert.equal(first.first32Ages, 2);
      assert.deepEqual(first.firstKeys, first.modelFirstKeys, 'Real DOM cards use the selected model order');
      assert.notDeepEqual(first.firstKeys, chronological.slice(0, 32));
    }
    const immediatePrefix = first.modelFirstKeys;
    await page.evaluate(async () => {
      currentTab().followUpdateRevision++;
      __holdEvidence = false; __releaseEvidence();
      await Promise.all(__heldTasks); await __pendingPublication;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    const afterCancellation = await page.evaluate(() => ({ mode: currentTab().followOrder,
      keys: currentTab().items.slice(0, 32).map(item => item.key) }));
    assert.equal(afterCancellation.mode, 'random');
    if (expectRegression) assert.deepEqual(afterCancellation.keys, chronological.slice(0, 32), 'Baseline leaves Date rows beneath selected Random');
    else assert.deepEqual(afterCancellation.keys, immediatePrefix, 'Fingerprint cancellation cannot overwrite the immediate Random prefix');
    const repeats = [];
    if (!expectRegression) for (const mode of ['date', 'random', 'date', 'random']) {
      const frame = await click(mode);
      assert.equal(frame.selected, 'true', `A single ${mode} click paints its selected state`);
      assert.equal(frame.activeClass, true); assert.notEqual(frame.selectedShadow, 'none');
      assert.deepEqual(frame.firstKeys, frame.modelFirstKeys);
      if (mode === 'date') assert.deepEqual(frame.firstKeys, chronological.slice(0, 32));
      else { assert(frame.first16Artists >= 12); assert.equal(frame.first32Ages, 2); }
      repeats.push(frame);
    }
    const finalScreenshot = path.join(output, `${label}-after-cancel-1440p.png`);
    await page.screenshot({ path: finalScreenshot });
    assert.deepEqual(errors, []);
    const result = { label, outcome: expectRegression ? 'EXPECTED RED reproduced' : 'PASS',
      viewport: '2560x1440', follows: 128, loadedWorks: 1024, edgeVersion: browser.version(),
      baselineRef: expectRegression ? ref : null, appSha256: crypto.createHash('sha256').update(appSource).digest('hex'),
      activeWorkers,
      first, afterCancellation, repeats, screenshots: [firstScreenshot, finalScreenshot] };
    metrics.push(result);
  } finally { await context.close(); }
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  browser = await chromium.launch({ headless: true, executablePath: process.env.DART_BROWSER_EXE });
  if (ref) await scenario('baseline', cp.execFileSync('git', ['show', `${ref}:wwwroot/app.js`], { cwd: root, encoding: 'utf8' }), true);
  await scenario('fixed', fs.readFileSync(path.join(web, 'app.js'), 'utf8'));
  const artifact = path.join(output, 'following-order-busy-results.json');
  fs.writeFileSync(artifact, JSON.stringify(metrics, null, 2));
  console.log(JSON.stringify({ result: 'PASS', artifact, scenarios: metrics.map(item => ({ label: item.label,
    outcome: item.outcome, inputToRafMs: Number(item.first.inputToRafMs.toFixed(2)),
    selected: item.first.selected, first16Artists: item.first.first16Artists, first32Ages: item.first.first32Ages,
    renderedCards: item.first.rendered, repeatInputToRafMs: item.repeats.map(frame => Number(frame.inputToRafMs.toFixed(2))),
    screenshots: item.screenshots })) }));
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await browser?.close(); });

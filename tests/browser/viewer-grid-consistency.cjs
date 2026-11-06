// Neutral, isolated real-browser matrix. Every expectation starts at the
// rendered card DOM; synthetic API/media replies never touch a real profile.
// --compare-ref pins app.js AND catalog-worker.js to a single older revision.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const cp = require('node:child_process'), crypto = require('node:crypto');
const { chromium } = require(process.env.DART_PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(__dirname, '../..'), web = path.join(root, 'wwwroot');
const refIndex = process.argv.indexOf('--compare-ref'), ref = refIndex < 0 ? '' : process.argv[refIndex + 1];
const pinned = new Map(['app.js', 'catalog-worker.js'].map(name => [name, ref
  ? cp.execFileSync('git', ['show', `${ref}:wwwroot/${name}`], { cwd: root })
  : fs.readFileSync(path.join(web, name))]));
const output = process.env.DART_QA_OUTPUT || path.join(os.tmpdir(), `DART-grid-matrix-${crypto.randomUUID()}`);
const sources = ['danbooru', 'gelbooru', 'rule34', 'sankaku'];
const work = (id, source, extra = {}) => ({ key: `${source}:${id}`, source, id: String(id), rating: 'g',
  title: `Neutral geometric field ${id}`, creatorTag: 'neutral_artist', creatorName: 'Neutral Artist',
  tags: ['rare_fabric', 'woodland_scene', 'neutral_artist'], characterTags: [],
  published: `2026-11-03T12:${String(id % 60).padStart(2, '0')}:00Z`,
  thumbnail: `https://example.test/thumb-${source}-${id}.svg`,
  images: [`https://example.test/full-${source}-${id}.svg`], ...extra });
const records = Array.from({ length: 64 }, (_, index) => work(1000 + index, sources[index % 4]));
records[5].groupKey = records[6].groupKey = 'gelbooru:parent:1005';
records[7].contentHash = '112233445566778899aabbccddeeff00';
const mirror = work(9007, 'danbooru', { contentHash: records[7].contentHash, fixturePixel: 1007 });
records.splice(8, 0, mirror);
const video = records.find(item => item.id === '1012');
video.images = ['https://example.test/neutral-field.webm']; video.fixtureVideo = true;
const gallery = records.find(item => item.id === '1020');
gallery.images.push('https://example.test/gallery-second-neutral-field.svg');
const seeds = Array.from({ length: 24 }, (_, index) => work(8000 + index, sources[index % 4]));
const all = [...records, ...seeds], known = new Map(all.map(item => [item.key, item]));
const colors = new Map(all.flatMap(item => [item.thumbnail, ...item.images].map(url => [url,
  item.fixtureVideo ? [80, 180, 130, 255] : [(item.fixturePixel || Number(item.id)) & 255,
    (item.fixturePixel || Number(item.id)) >>> 8 & 255, 137, 255]])));
colors.set(gallery.images[1], [20, 110, 210, 255]);
const surfaceIndex = process.argv.indexOf('--surface');
const surfaces = surfaceIndex < 0 ? ['home', 'search', 'recommendations', 'follows', 'likes', 'bookmarks', 'recent', 'favorites', 'profile', 'related']
  : process.argv[surfaceIndex + 1].split(',');
const match = (first, second) => first?.members?.some(key => second?.members?.includes(key));
const report = { revision: ref || 'working-tree', viewport: { width: 2560, height: 1440 }, output,
  sources: Object.fromEntries([...pinned].map(([name, bytes]) => [name, crypto.createHash('sha256').update(bytes).digest('hex')])),
  surfaces: [], checks: [], failures: [], errors: [] };
let browser, videoBytes;
const check = (condition, label, detail = {}) => {
  report.checks.push({ label, passed: !!condition });
  if (!condition) report.failures.push({ label, ...detail });
};
const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

async function makeVideo(page) {
  // Reuse the repository's MediaRecorder fixture approach, with one stable
  // neutral color so decoded native video frames can be checked as pixels.
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 96;
    document.body.append(canvas); const context = canvas.getContext('2d');
    context.fillStyle = 'rgb(80,180,130)'; context.fillRect(0, 0, 128, 96);
    const stream = canvas.captureStream(15), track = stream.getVideoTracks()[0];
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' }), chunks = [];
    let size = 0;
    const complete = new Promise(resolve => { recorder.ondataavailable = event => {
      chunks.push(event.data); size += event.data.size;
    }; recorder.onstop = () => resolve(new Blob(chunks).arrayBuffer()); });
    recorder.start(100);
    for (let frame = 0; frame < 60 && (frame < 12 || size <= 500); frame++) {
      context.fillRect(0, 0, 128, 96); track.requestFrame();
      await new Promise(resolve => setTimeout(resolve, 80));
    }
    recorder.stop(); const bytes = Array.from(new Uint8Array(await complete));
    stream.getTracks().forEach(track => track.stop()); canvas.remove(); return bytes;
  });
  assert.ok(bytes.length > 500, 'Synthetic video must contain actual encoded frames');
  return Buffer.from(bytes);
}

async function fixture(surface) {
  const context = await browser.newContext({ viewport: report.viewport });
  const page = await context.newPage(); page.setDefaultTimeout(10000);
  page.on('pageerror', error => report.errors.push({ surface, message: error.message }));
  let state = { session: { savedWorksVersion: 1, activeIndex: 0, tabs: [{ kind: surface === 'related' ? 'detail' : surface,
    title: `Neutral ${surface}`, rating: 'general', selectedSources: sources,
    ...(surface === 'related' ? { item: seeds[0] } : {}),
    favoriteType: 'artwork', ...(surface === 'profile' ? { profileRef: { source: 'artist', artist: 'neutral_artist' } } : {}) }] },
  recent: surface === 'recent' ? records.slice(0, 40) : [] };
  const follows = [{ key: 'danbooru:neutral_artist', source: 'danbooru', artistId: 'neutral_artist', name: 'Neutral Artist' }];
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    const json = data => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) }).catch(() => {});
    if (url.pathname.startsWith('/api/')) {
      if (url.pathname === '/api/client-state') {
        if (request.method() === 'POST') state = { ...state, ...JSON.parse(request.postData() || '{}') };
        return json(request.method() === 'GET' ? state : { saved: true });
      }
      if (url.pathname === '/api/settings') return json({ hasApiKey: true, hasRule34ApiKey: true, sankakuAvailable: true });
      if (url.pathname === '/api/content-preferences') return json({ language: 'en', aiMode: 'all', hideViewedAndSaved: true, curation: { enabled: true } });
      if (url.pathname === '/api/recommendation-tag-preferences') return json({ preferences: {}, initialized: true });
      if (url.pathname === '/api/likes') return json(surface === 'likes' ? records : seeds);
      if (url.pathname === '/api/bookmarks') return json(surface === 'bookmarks' ? records : []);
      if (url.pathname === '/api/favorite-artworks') return json(surface === 'favorites' ? records : []);
      if (url.pathname === '/api/favorites') return json({ totalWorks: 0, entries: [], works: [], kinds: {} });
      if (url.pathname === '/api/follows' || url.pathname === '/api/follows/seen') return json(follows);
      if (url.pathname === '/api/follows/cache') return json({ groups: [] });
      if (['/api/hidden-artworks', '/api/favorite-tags', '/api/favorite-artwork-groups', '/api/viewed-identities'].includes(url.pathname)) return json([]);
      if (url.pathname === '/api/search' || url.pathname === '/api/profile') {
        const selected = (url.searchParams.get('sources') || url.searchParams.get('source') || sources.join(',')).split(',');
        return json({ name: 'Neutral Artist', items: records.filter(item => selected.includes(item.source)),
          errors: {}, notices: {}, hasMore: false, hasMoreSources: [] });
      }
      if (url.pathname === '/api/detail') return json(known.get(`${url.searchParams.get('source')}:${url.searchParams.get('id')}`) || {});
      if (url.pathname === '/api/image') {
        const color = colors.get(url.searchParams.get('url')) || [1, 2, 3, 255];
        return route.fulfill({ status: 200, contentType: 'image/svg+xml', body:
          `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="192"><rect width="256" height="192" fill="rgb(${color.slice(0, 3)})"/><rect x="128" y="96" width="128" height="96" fill="#d7dfe8"/></svg>` }).catch(() => {});
      }
      if (url.pathname === '/api/video') return route.fulfill({ status: 200, contentType: 'video/webm', body: videoBytes }).catch(() => {});
      return json({});
    }
    const name = url.pathname.slice(1);
    if (pinned.has(name)) return route.fulfill({ status: 200, contentType: 'text/javascript', body: pinned.get(name) });
    const file = path.resolve(web, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
    if (!file.startsWith(web + path.sep) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ status: 200, contentType: ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html',
      '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.ico': 'image/x-icon' })[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
  });
  await page.goto('http://neutral-grid-matrix.test/');
  await page.waitForFunction(surface => currentTab()?.loading === false &&
    (surface !== 'related' || !currentTab().relatedLoading) &&
    document.querySelectorAll(surface === 'related' ? '[data-grid-key="related"] article.card[data-work-key]' : 'article.card[data-work-key]').length > 8, surface);
  await frames(page); return { context, page };
}

async function snapshot(page) {
  return page.evaluate(() => {
    const describe = item => item && ({ key: item.key, members: [...new Set([item.key, ...(item.memberKeys || [])])] });
    const pixel = media => { if (!media || !(media.naturalWidth || media.videoWidth)) return null;
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
      const context = canvas.getContext('2d'); context.drawImage(media, 0, 0, 1, 1, 0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data]; };
    const cardRoot = currentTab()?.kind === 'detail' ? main.querySelector('[data-grid-key="related"]') : main;
    const cards = [...(cardRoot?.querySelectorAll('article.card[data-work-key]') || [])].map(node => ({ key: node.dataset.workKey,
      members: JSON.parse(node.dataset.workMembers), thumbnail: node.querySelector('img[data-image-url]')?.dataset.imageUrl,
      pixel: pixel(node.querySelector('img[data-image-url]')), video: !!node.querySelector('[data-video-preview]') }));
    const modal = quickPreview.open, item = modal ? quickPreviewWork : currentTab()?.kind === 'detail' ? currentTab().item : null;
    const media = modal ? quickPreview.querySelector('.quick-preview-image') : main.querySelector('.detail-stage .detail-image:not([hidden]) img, .detail-stage video[data-video-url], .detail-image:not([hidden]) img, video[data-video-url]');
    return { kind: currentTab()?.kind, tabId: currentTab()?.id, scroll: main.scrollTop, cards,
      viewer: item ? { ...describe(item), mode: modal ? quickPreview.classList.contains('fullscreen') ? 'fullscreen' : 'window' : 'detail',
        media: media?.tagName, url: media?.dataset.imageUrl || media?.dataset.videoUrl, pixel: pixel(media) } : null };
  });
}

async function loaded(page) {
  await page.waitForFunction(() => {
    const media = quickPreview.open ? quickPreview.querySelector('.quick-preview-image') :
      main.querySelector('.detail-image:not([hidden]) img, video[data-video-url]');
    if (!media) return false;
    if (media.tagName === 'VIDEO') return media.readyState >= 2 && media.videoWidth > 0;
    // A decoded thumbnail may already be visible while the full URL loads.
    // Wait for the native element to show the full-media cache blob itself.
    const cached = imageLoader.cached(media.dataset.imageUrl);
    return media.naturalWidth > 0 && cached?.blobUrl === media.currentSrc;
  });
  await frames(page);
}

async function compare(page, surface, label, expected, mode) {
  await loaded(page); const actual = (await snapshot(page)).viewer;
  check(match(expected, actual), `${surface}:${label}:members`, { expected, actual });
  check(actual?.mode === mode, `${surface}:${label}:mode`, { mode, actual });
  if (expected.url) check(actual?.url === expected.url, `${surface}:${label}:selected-media-url`, { expected, actual });
  const color = expected.pixel || colors.get(expected.thumbnail);
  const tolerance = expected.video || actual?.media === 'VIDEO' ? 6 : 0;
  check(color?.every((component, index) => Math.abs(component - (actual?.pixel?.[index] ?? -999)) <= tolerance),
    `${surface}:${label}:native-decoded-pixel`, { expected, color, actual, tolerance });
  return actual;
}

async function arrow(page, surface, label, key, expected, mode) {
  const before = await page.evaluate(() => quickPreview.open ? quickPreviewWork?.key : currentTab()?.item?.key);
  await page.keyboard.press(key);
  await page.waitForFunction(before => (quickPreview.open ? quickPreviewWork?.key : currentTab()?.item?.key) !== before, before,
    { timeout: 5000 }).catch(() => {});
  return compare(page, surface, label, expected, mode);
}

async function exercise(surface) {
  const { context, page } = await fixture(surface);
  const entry = { surface, observations: [] }; report.surfaces.push(entry);
  const note = async label => { const state = await snapshot(page); entry.observations.push({ label, ...state }); return state; };
  const card = key => page.locator(`${surface === 'related' ? '[data-grid-key="related"] ' : ''}article.card[data-work-key="${key}"] button.card-art`);
  const clickCard = async (opener, key) => {
    // Scrolling after pointerdown intentionally cancels an artwork gesture.
    // Settle locator-driven scrolling before issuing the real pointer click.
    await opener.scrollIntoViewIfNeeded(); await frames(page); await opener.click();
    await page.waitForFunction(key => currentTab()?.kind === 'detail' &&
      [currentTab().item.key, ...(currentTab().item.memberKeys || [])].includes(key), key);
  };
  try {
    await page.evaluate(() => { main.scrollTop = 260; main.dispatchEvent(new Event('scroll')); });
    await frames(page);
    let grid = await note('rendered-grid');
    const actualCatalogs = [...new Set(grid.cards.flatMap(item => item.members.map(key => known.get(key)?.source)).filter(Boolean))];
    entry.catalogs = actualCatalogs;
    check(sources.every(source => actualCatalogs.includes(source)), `${surface}:all-four-catalogs`, { actualCatalogs });
    // Progressive recommendation arrivals may put the movie at slot eight.
    // This first path exercises image hover/Enter; the mixed-video path below
    // separately checks actual movie identity, pixels and Space controls.
    const preferred = Math.min(8, grid.cards.length - 3);
    const selectedIndex = grid.cards.findIndex((item,index) => index>=preferred && index<grid.cards.length-1 && !item.video);
    assert(selectedIndex>=0,'The neutral fixture must contain a static opener and its next card');
    const selected = grid.cards[selectedIndex], next = grid.cards[selectedIndex + 1];
    const sourceId = grid.tabId;
    await card(selected.key).scrollIntoViewIfNeeded();
    // Related and the author strip may represent the same work. Wait for the
    // actual card selected by this flow, not its offscreen author-strip alias.
    await page.waitForFunction(({key,surface}) => !!document.querySelector(
      `${surface === 'related' ? '[data-grid-key="related"] ' : ''}article.card[data-work-key="${key}"] img`)?.naturalWidth,
      {key:selected.key,surface});
    grid = await note('selected-rendered-card'); const beforeScroll = grid.scroll;
    const expected = grid.cards[selectedIndex];
    await clickCard(card(selected.key), selected.key);
    await compare(page, surface, 'click-detail', expected, 'detail');
    await arrow(page, surface, 'detail-next', 'ArrowRight', next, 'detail');
    await arrow(page, surface, 'detail-back', 'ArrowLeft', expected, 'detail');
    let image = page.locator('.detail-image:not([hidden]) img').first();
    await image.hover(); await page.keyboard.press('Space');
    await compare(page, surface, 'detail-space-window', expected, 'window');
    await arrow(page, surface, 'window-next', 'ArrowRight', next, 'window');
    await arrow(page, surface, 'window-back', 'ArrowLeft', expected, 'window');
    await page.keyboard.press('Escape'); await frames(page);
    image = page.locator('.detail-image:not([hidden]) img').first();
    await image.focus(); await page.keyboard.press('Enter');
    await compare(page, surface, 'enter-fullscreen', expected, 'fullscreen');
    await arrow(page, surface, 'fullscreen-next', 'ArrowRight', next, 'fullscreen');
    await arrow(page, surface, 'fullscreen-back', 'ArrowLeft', expected, 'fullscreen');
    await page.keyboard.press('Escape'); await frames(page);
    await page.locator(`.tab[data-tab="${sourceId}"]`).click(); await frames(page);
    const returned = await note('returned-grid');
    check(Math.abs(returned.scroll - beforeScroll) <= 2, `${surface}:return-scroll`, { beforeScroll, actual: returned.scroll });
    // Direct card Space follows the actual currently rendered card after return.
    const returnedCard = returned.cards.find(item => match(item, expected));
    if (returnedCard) {
      await card(returnedCard.key).hover(); await page.keyboard.press('Space');
      await compare(page, surface, 'grid-space-reopen', returnedCard, 'window');
      const returnedNext = returned.cards[returned.cards.indexOf(returnedCard) + 1];
      if (returnedNext) {
        await arrow(page, surface, 'grid-space-retained-next', 'ArrowRight', returnedNext, 'window');
        await arrow(page, surface, 'grid-space-retained-back', 'ArrowLeft', returnedCard, 'window');
      }
      await page.keyboard.press('Escape'); await frames(page);
    }
    for (const [label, alias] of [['real-version-group', records[5].key], ['exact-mirror', records[7].key], ['mixed-video', video.key]]) {
      const current = await snapshot(page), candidate = current.cards.find(item => item.members.includes(alias));
      if (!candidate) { check(false, `${surface}:${label}:fixture-card-present`, { alias }); continue; }
      // Favorites preserves individually saved/manual-group rows; its DOM
      // may intentionally expose the two mirror aliases as separate cards.
      if (surface !== 'favorites' && label === 'real-version-group')
        check(candidate.members.includes(records[6].key), `${surface}:real-version-group:second-member`, { candidate });
      if (surface !== 'favorites' && label === 'exact-mirror')
        check(candidate.members.includes(mirror.key), `${surface}:exact-mirror:alias-member`, { candidate });
      await card(candidate.key).scrollIntoViewIfNeeded();
      await page.waitForFunction(key => !!document.querySelector(`article.card[data-work-key="${key}"] img`)?.naturalWidth, candidate.key);
      const actualCard = (await snapshot(page)).cards.find(item => item.key === candidate.key);
      await card(candidate.key).hover(); await page.keyboard.press('Space');
      await compare(page, surface, label, actualCard, 'window');
      if (label === 'mixed-video') {
        const nextMedia = current.cards[current.cards.indexOf(candidate) + 1];
        if (nextMedia) {
          await arrow(page, surface, 'video-to-image-next', 'ArrowRight', nextMedia, 'window');
          await arrow(page, surface, 'image-to-video-back', 'ArrowLeft', actualCard, 'window');
        }
      }
      await page.keyboard.press('Escape'); await frames(page);
    }
    // Select the real second gallery image, rather than silently reopening the
    // card thumbnail/default image. Shared detail rendering is exercised from
    // every source route, including Related's nested detail-grid origin.
    const galleryGrid = await snapshot(page), galleryCard = galleryGrid.cards.find(item => item.members.includes(gallery.key));
    check(!!galleryCard, `${surface}:gallery:fixture-card-present`);
    if (galleryCard) {
      await clickCard(card(galleryCard.key), galleryCard.key);
      const second = page.locator('.artwork-stage .detail-image:not([hidden]) img').nth(1);
      await second.waitFor(); await second.scrollIntoViewIfNeeded();
      const url = await second.getAttribute('data-image-url');
      await page.waitForFunction(url => {
        const image = [...main.querySelectorAll('.detail-image:not([hidden]) img')].find(image => image.dataset.imageUrl === url);
        return image?.naturalWidth > 0 && imageLoader.cached(url)?.blobUrl === image.currentSrc;
      }, url);
      check(url === gallery.images[1], `${surface}:gallery:second-rendered-image-url`, { url, expected: gallery.images[1] });
      const expectedSecond = { ...galleryCard, pixel: colors.get(url), thumbnail: url, url };
      await second.hover(); await page.keyboard.press('Space');
      await compare(page, surface, 'second-gallery-space', expectedSecond, 'window');
      await page.keyboard.press('Escape'); await frames(page);
      await second.focus(); await page.keyboard.press('Enter');
      await compare(page, surface, 'second-gallery-enter-fullscreen', expectedSecond, 'fullscreen');
      await page.keyboard.press('Escape'); await frames(page);
      await second.click();
      await page.waitForFunction(() => quickPreview.open);
      await compare(page, surface, 'second-gallery-click-fullscreen', expectedSecond, 'fullscreen');
      await page.keyboard.press('Escape'); await frames(page);
      await page.locator(`.tab[data-tab="${sourceId}"]`).click(); await frames(page);
    }
    // A grouped work has two genuine versions, not two aliases of one file.
    // Audit both rendered gallery choices through the shared catalog and
    // nested Related origins without multiplying every identical detail path.
    if (surface === 'search' || surface === 'related') {
      const versionGrid = await snapshot(page), versionCard = versionGrid.cards.find(item => item.members.includes(records[5].key));
      await clickCard(card(versionCard.key), versionCard.key);
      const versionImages = page.locator('.artwork-stage .detail-image:not([hidden]) img');
      await versionImages.nth(1).waitFor();
      const versionUrls = await versionImages.evaluateAll(images => images.map(image => image.dataset.imageUrl));
      check(records.slice(5, 7).every(item => versionUrls.includes(item.images[0])), `${surface}:versions:both-rendered`, { versionUrls });
      for (let index = 0; index < 2; index++) {
        const image = versionImages.nth(index), url = await image.getAttribute('data-image-url');
        const expectedVersion = { ...versionCard, pixel: colors.get(url), thumbnail: url, url };
        await image.hover(); await page.keyboard.press('Space');
        await compare(page, surface, `version-${index + 1}-space`, expectedVersion, 'window');
        await page.keyboard.press('Escape'); await frames(page);
        await image.click(); await page.waitForFunction(() => quickPreview.open);
        await compare(page, surface, `version-${index + 1}-click-fullscreen`, expectedVersion, 'fullscreen');
        await page.keyboard.press('Escape'); await frames(page);
      }
      await page.locator(`.tab[data-tab="${sourceId}"]`).click(); await frames(page);
    }
    if (surface === 'home') {
      const home = await snapshot(page), boundary = home.cards[6], continuation = home.cards[7];
      await card(boundary.key).hover(); await page.keyboard.press('Space');
      await compare(page, surface, 'first-section-space', boundary, 'window');
      await arrow(page, surface, 'section-boundary-next', 'ArrowRight', continuation, 'window');
      await arrow(page, surface, 'section-boundary-back', 'ArrowLeft', boundary, 'window');
      await page.keyboard.press('Escape'); await frames(page);
    }
    if (surface === 'related') {
      // The creator strip is another detail-origin route, separate from the
      // Related grid below it. Compare its own actual rendered neighbors.
      const creators = await page.locator('.author-strip article.card[data-work-key]').evaluateAll(cards => cards.map(card => ({
        key: card.dataset.workKey, members: JSON.parse(card.dataset.workMembers),
        thumbnail: card.querySelector('img[data-image-url]')?.dataset.imageUrl,
        video: !!card.querySelector('[data-video-preview]') })));
      check(creators.length > 2, `${surface}:creator-strip:cards-present`, { creators });
      if (creators.length > 2) {
        const creator = creators[1], followingCreator = creators[2];
        const opener = page.locator(`.author-strip article.card[data-work-key="${creator.key}"] button.card-art`);
        await opener.hover(); await page.keyboard.press('Space');
        await compare(page, surface, 'creator-strip-space', creator, 'window');
        await arrow(page, surface, 'creator-strip-space-next', 'ArrowRight', followingCreator, 'window');
        await arrow(page, surface, 'creator-strip-space-back', 'ArrowLeft', creator, 'window');
        await page.keyboard.press('Escape'); await frames(page);
        await clickCard(opener, creator.key);
        await compare(page, surface, 'creator-strip-click-detail', creator, 'detail');
        await arrow(page, surface, 'creator-strip-detail-next', 'ArrowRight', followingCreator, 'detail');
        await arrow(page, surface, 'creator-strip-detail-back', 'ArrowLeft', creator, 'detail');
        await page.locator(`.tab[data-tab="${sourceId}"]`).click(); await frames(page);
      }
    }
    await page.screenshot({ path: path.join(output, `neutral-${surface}.png`) });
    await note('matrix-finished');
  } catch (error) {
    const state = await snapshot(page).catch(() => null);
    report.failures.push({ label: `${surface}:exception`, message: error.message, stack: error.stack, state });
  }
  finally { await context.close(); }
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.DART_BROWSER_EXE });
    const prep = await browser.newPage(); videoBytes = await makeVideo(prep); await prep.close();
    for (const surface of surfaces) {
      console.log(`Matrix ${surface}`);
      try { await exercise(surface); }
      catch (error) { report.failures.push({ label: `${surface}:fixture-start`, message: error.message }); }
    }
    check(report.errors.length === 0, 'browser-page-errors', { errors: report.errors });
  } finally {
    await browser?.close(); fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ revision: report.revision, surfaces: report.surfaces.map(entry => entry.surface),
      checks: report.checks.length, failures: report.failures, errors: report.errors, sources: report.sources, output }));
  }
  assert.equal(report.failures.length, 0, 'Grid/viewer matrix failed; see isolated report');
})().catch(error => { console.error(error); process.exitCode = 1; });

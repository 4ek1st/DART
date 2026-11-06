// Neutral real-browser proof. No local profile, provider access or visible UI.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const { chromium } = require(process.env.DART_PLAYWRIGHT_PATH || 'playwright');
const web = path.resolve(__dirname, '../../wwwroot');
const output = process.env.DART_QA_OUTPUT || path.join(os.tmpdir(), 'DART-preview-gallery-' + crypto.randomUUID());
const sources = ['danbooru', 'gelbooru', 'rule34', 'sankaku'];
const surfaces = ['home', 'search', 'recommendations', 'follows', 'likes', 'bookmarks', 'recent', 'favorites', 'profile', 'related'];
const hash = text => crypto.createHash('md5').update(text).digest('hex');
const make = (id, source) => ({ key: `${source}:${id}`, source, id: String(id), title: `Neutral artwork ${id}`,
  creatorTag: 'neutral_artist', creatorName: 'Neutral Artist', tags: ['neutral_artist', 'neutral_scene'], characterTags: [],
  rating: 'g', published: `2026-11-03T12:${String(id % 60).padStart(2, '0')}:00Z`,
  thumbnail: `https://example.test/thumb-${id}.svg`, images: [`https://example.test/full-${id}.svg`] });
const records = Array.from({ length: 40 }, (_, index) => make(1000 + index, sources[index % 4]));
for (const item of records.slice(0, 4)) {
  item.images = [1, 1, 2, 3].map((page, index) => `https://example.test/gallery-${item.id}-${page}${index === 1 ? '-mirror' : ''}.svg`);
  item.imageRecords = item.images.map((url, index) => ({ url, hash: hash(`${item.id}-${index < 2 ? 1 : index}`) }));
}
const mixed = records[4]; mixed.images = ['https://example.test/mixed-first.svg', 'https://example.test/movie.webm', 'https://example.test/mixed-last.svg'];
const seed = make(9999, 'danbooru'), known = new Map([...records, seed].map(item => [item.key, item]));
let browser, movie;
const report = { viewport: { width: 2560, height: 1440 }, checks: [], errors: [], files: {} };
for (const name of ['app.js', 'preview-gallery.js', 'style.css']) report.files[name] = hash(fs.readFileSync(path.join(web, name)));
const check = (condition, label) => { report.checks.push({ label, passed: !!condition }); assert(condition, label); };
const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const state = page => page.evaluate(() => ({ key: quickPreviewWork?.key, open: quickPreview.open,
  gallery: quickPreviewGallery?.state, url: quickPreview.querySelector('.quick-preview-image')?.dataset.imageUrl || quickPreview.querySelector('video')?.dataset.videoUrl,
  scale: quickPreviewView.scale, y: quickPreviewView.y, movie: !!quickPreview.querySelector('video'),
  ready: !!quickPreview.querySelector('.quick-preview-image')?.naturalWidth }));
async function makeMovie(page) {
  return Buffer.from(await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 96;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#329cff'; ctx.fillRect(0, 0, 128, 96);
    const stream = canvas.captureStream(15), recorder = new MediaRecorder(stream, { mimeType: 'video/webm' }), chunks = [];
    const done = new Promise(resolve => { recorder.ondataavailable = event => chunks.push(event.data);
      recorder.onstop = async () => resolve(Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()))); });
    recorder.start(100);
    for (let frame = 0; frame < 18; frame++) {
      ctx.fillRect(0, 0, 128, 96); stream.getVideoTracks()[0].requestFrame();
      await new Promise(resolve => setTimeout(resolve, 80));
    }
    recorder.stop();
    const bytes = await done; stream.getTracks().forEach(track => track.stop()); return bytes;
  }));
}
async function fixture(surface) {
  const context = await browser.newContext({ viewport: report.viewport });
  const page = await context.newPage(); page.setDefaultTimeout(10000);
  page.on('pageerror', error => report.errors.push({ surface, error: error.message }));
  const calls = []; let fail = '', hold = '', release;
  let liked = surface === 'likes' ? [...records] : [seed], bookmarks = surface === 'bookmarks' ? [...records] : [];
  let saved = { session: { savedWorksVersion: 1, activeIndex: 0, tabs: [{ kind: surface === 'related' ? 'detail' : surface,
    title: 'Neutral gallery fixture', rating: 'general', selectedSources: sources, favoriteType: 'artwork',
    ...(surface === 'related' ? { item: seed } : {}), ...(surface === 'profile' ? { profileRef: { source: 'artist', artist: 'neutral_artist' } } : {}) }] },
    recent: surface === 'recent' ? records : [] };
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    const json = data => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) }).catch(() => {});
    if (url.pathname.startsWith('/api/')) {
      const body = request.postData() ? JSON.parse(request.postData()) : {};
      if (url.pathname === '/api/client-state') { if (request.method() === 'POST') saved = { ...saved, ...body }; return json(request.method() === 'GET' ? saved : { saved: true }); }
      if (url.pathname === '/api/settings') return json({ hasApiKey: true, hasRule34ApiKey: true, sankakuAvailable: true });
      if (url.pathname === '/api/content-preferences') return json({ language: 'en', aiMode: 'all', hideViewedAndSaved: false });
      if (url.pathname === '/api/recommendation-tag-preferences') return json({ preferences: {}, initialized: true });
      if (url.pathname === '/api/likes' || url.pathname === '/api/bookmarks') {
        const values = url.pathname === '/api/likes' ? liked : bookmarks;
        if (request.method() === 'GET') return json(values);
        const exists = values.some(item => item.key === body.key);
        if (exists) values.splice(values.findIndex(item => item.key === body.key), 1); else values.unshift(body);
        return json({ saved: !exists });
      }
      if (url.pathname === '/api/favorite-artworks') return json(surface === 'favorites' ? records : []);
      if (url.pathname === '/api/favorites') return json({ totalWorks: 0, entries: [], works: [], kinds: {} });
      if (url.pathname === '/api/follows' || url.pathname === '/api/follows/seen') return json([{ key: 'danbooru:neutral_artist', source: 'danbooru', artistId: 'neutral_artist', name: 'Neutral Artist' }]);
      if (url.pathname === '/api/follows/cache') return json({ groups: [] });
      if (['/api/hidden-artworks', '/api/favorite-tags', '/api/favorite-artwork-groups', '/api/viewed-identities', '/api/source-status'].includes(url.pathname)) return json([]);
      if (url.pathname === '/api/search' || url.pathname === '/api/profile') {
        const selected = (url.searchParams.get('sources') || url.searchParams.get('source') || sources.join(',')).split(',');
        return json({ name: 'Neutral Artist', items: records.filter(item => selected.includes(item.source)), errors: {}, notices: {}, hasMore: false, hasMoreSources: [] });
      }
      if (url.pathname === '/api/detail') return json(known.get(`${url.searchParams.get('source')}:${url.searchParams.get('id')}`) || seed);
      if (url.pathname === '/api/image') {
        const media = url.searchParams.get('url'); calls.push(media);
        if (media === hold) await new Promise(resolve => { release = resolve; });
        if (media === fail) return route.fulfill({ status: 503, body: 'Neutral fixture unavailable' }).catch(() => {});
        const pageNumber = Number(/gallery-\d+-(\d)/.exec(media)?.[1]) || 1;
        return route.fulfill({ status: 200, contentType: 'image/svg+xml', body:
          `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="rgb(${pageNumber * 55},110,180)"/><text x="45" y="55" font-size="42" fill="white">PAGE ${pageNumber}</text><rect x="420" y="12" width="44" height="55" fill="#329cff"/><circle cx="515" cy="39" r="25" fill="#84d9b4"/><rect x="500" y="330" width="200" height="220" fill="#329cff"/></svg>` }).catch(() => {});
      }
      if (url.pathname === '/api/video') return route.fulfill({ status: 200, contentType: 'video/webm', body: movie }).catch(() => {});
      return json({});
    }
    const file = path.resolve(web, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
    if (!file.startsWith(web + path.sep) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ status: 200, contentType: ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.ico': 'image/x-icon' })[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
  });
  await page.goto('http://neutral-preview-gallery.test/');
  await page.waitForFunction(() => currentTab()?.loading === false && !currentTab()?.relatedLoading && document.querySelectorAll('article.card[data-work-key]').length > 8);
  return { page, context, calls, fail: url => { fail = url; }, hold: url => { hold = url; }, release: () => { hold = ''; release?.(); } };
}
async function open(page, item) {
  const scope = await page.locator(`article.card[data-work-key="${item.key}"] button.card-art`).first();
  await scope.hover(); await page.keyboard.press('Space');
  await page.waitForFunction(key => quickPreview.open && quickPreviewWork?.key === key &&
    !!(quickPreview.querySelector('.quick-preview-image')?.naturalWidth || quickPreview.querySelector('video')?.readyState >= 2), item.key);
}
async function index(page, value) { await page.waitForFunction(value => quickPreviewGallery?.state.index === value && !quickPreviewGallery.state.busy, value); await frames(page); }
async function close(page) { await page.keyboard.press('Escape'); await page.waitForFunction(() => !quickPreview.open); }
async function galleryLayout(page, label) {
  await page.waitForFunction(() => !quickPreview.querySelector('.quick-preview-gallery-peek-image')?.hidden);
  const layout = await page.evaluate(() => {
    const rect = selector => { const r = quickPreview.querySelector(selector).getBoundingClientRect(); return { top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
    const image = quickPreview.querySelector('.quick-preview-gallery-peek-image');
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0, 1, 1, 0, 0, 1, 1);
    return { stage: rect('.quick-preview-stage'), counter: rect('.quick-preview-gallery-position'), peek: rect('.quick-preview-gallery-peek'),
      pixel: [...ctx.getImageData(0, 0, 1, 1).data], opacity: getComputedStyle(image).opacity,
      overlay: rect('.quick-preview-gallery-peek > span'), nextIndex: quickPreviewGallery.state.index + 2,
      shell: { outline: getComputedStyle(quickPreview).outlineStyle, border: getComputedStyle(quickPreview).borderTopWidth } };
  });
  check(layout.counter.top - layout.stage.bottom >= 10, `${label}: counter has a separate gutter below current image`);
  check(layout.peek.top - layout.counter.bottom >= 10, `${label}: next image is separated from page controls`);
  check(layout.counter.width < layout.stage.width * .75, `${label}: controls use a compact pill, not a full-width strip`);
  check(layout.peek.height >= 90, `${label}: next gallery card reveals a meaningful image area`);
  check(layout.pixel[0] === layout.nextIndex * 55 && layout.opacity === '1', `${label}: peek contains actual next-page pixels without a full-image tint`);
  check(layout.overlay.width < layout.peek.width * .75, `${label}: label does not cover the next image`);
  check(layout.shell.outline === 'none' && layout.shell.border === '0px', `${label}: no enclosing frame visually joins the separate cards`);
}
async function galleryProof() {
  const f = await fixture('likes'), { page } = f;
  try {
    for (const item of records.slice(0, 4)) {
      await open(page, item);
      check((await state(page)).gallery.length === 3, `${item.source}: exact source mirrors deduplicated to three pages`);
      check((await state(page)).gallery.index === 0, `${item.source}: starts at page one`);
      await page.waitForFunction(() => !quickPreview.querySelector('.quick-preview-gallery-peek-image')?.hidden);
      if (item === records[0]) {
        await page.waitForTimeout(230);
        await page.screenshot({ path: path.join(output, 'gallery-1440p.png'), animations: 'disabled' });
        await galleryLayout(page, '1440p window');
        check(!f.calls.includes(item.images[3]), 'Only the current and next page preload before a page is selected');
      }
      await page.keyboard.press('s'); await index(page, 1);
      check((await state(page)).url === item.images[2], `${item.source}: S selects the real second unique image`);
      await page.keyboard.press('ArrowDown'); await index(page, 2);
      await page.keyboard.press('ArrowDown'); check((await state(page)).gallery.index === 2, `${item.source}: bottom boundary stays inside artwork`);
      await page.keyboard.press('w'); await index(page, 1); await page.keyboard.press('ArrowUp'); await index(page, 0);
      await page.keyboard.press('ArrowUp'); check((await state(page)).key === item.key, `${item.source}: top boundary never changes artwork`);
      await close(page);
    }
    await open(page, records[0]);
    for (const [language, labels] of [['ru', ['Страницы работы', 'Предыдущее изображение', 'Следующее изображение', 'Загружаем…', 'Не удалось загрузить изображение.']],
      ['de', ['Werkseiten', 'Vorheriges Bild', 'Nächstes Bild', 'Wird geladen…', 'Dieses Bild konnte nicht geladen werden.']]]) {
      await page.evaluate(language => DartI18n.setLanguage(language, false), language);
      const actual = await page.evaluate(() => { const footer = quickPreview.querySelector('.quick-preview-gallery'); return [footer.getAttribute('aria-label'),
        footer.querySelector('[data-preview-action="gallery-previous"]').getAttribute('aria-label'), footer.querySelector('.quick-preview-gallery-peek').getAttribute('aria-label'),
        footer.querySelector('.quick-preview-gallery-loading').textContent, footer.querySelector('.quick-preview-gallery-error > span').textContent]; });
      check(JSON.stringify(actual) === JSON.stringify(labels), `${language}: gallery labels, loading, and errors translated`);
    }
    await page.evaluate(() => DartI18n.setLanguage('en', false));
    await page.evaluate(() => { const input = document.createElement('input'); input.id = 'neutral-gallery-input'; quickPreview.append(input); input.focus(); });
    await page.keyboard.press('s'); await frames(page);
    check((await state(page)).gallery.index === 0, 'Typing into a preview-owned input never changes gallery page');
    await page.evaluate(() => { document.getElementById('neutral-gallery-input').remove(); quickPreview.focus(); });
    await page.mouse.wheel(0, 100); await index(page, 1);
    await page.waitForTimeout(210); await page.mouse.wheel(0, -100); await index(page, 0);
    check((await state(page)).scale === 1, 'Ordinary wheel moves gallery pages without zooming');
    await page.keyboard.down('Control'); await page.mouse.wheel(0, -180); await page.keyboard.up('Control'); await frames(page);
    check((await state(page)).scale > 1, 'Ctrl-wheel preserves image zoom');
    const before = await state(page); await page.mouse.wheel(0, 80); await frames(page);
    const after = await state(page); check(after.gallery.index === before.gallery.index && after.scale === before.scale && after.y !== before.y, 'Zoomed ordinary wheel pans without page jump');
    await page.keyboard.press('0'); await frames(page);
    await page.keyboard.press('f'); await page.waitForFunction(() => !isSavedWorkPending(quickPreviewWork, 'likes'));
    await page.keyboard.press('b'); await page.waitForFunction(() => isSavedWork(quickPreviewWork, 'bookmarks'));
    check((await state(page)).key === records[0].key, 'F and B retain the selected gallery work');
    await page.keyboard.press('f'); await page.waitForFunction(() => isSavedWork(quickPreviewWork, 'likes') && !isSavedWorkPending(quickPreviewWork, 'likes'));
    const next = await page.evaluate(() => quickPreviewRoute.engine.neighbors().map(item => item.key));
    await page.keyboard.press('d'); await page.waitForFunction(key => quickPreviewWork?.key !== key, records[0].key);
    check(next.includes((await state(page)).key), 'D moves to the real neighboring artwork');
    await page.keyboard.press('a'); await page.waitForFunction(key => quickPreviewWork?.key === key, records[0].key);
    await close(page);
    // Opening explicitly at page two must not jump back to the group's cover.
    await page.evaluate(item => { const selected = itemIndex.get(item.key); openQuickPreview({ item: selected, url: item.images[2] }, 'fullscreen'); }, records[0]);
    await index(page, 1); check((await state(page)).url === records[0].images[2] &&
      await page.evaluate(() => !!quickPreviewRoute.presentation), 'Explicit page-two opening retains selection through route presentation in fullscreen');
    await page.keyboard.press('s'); await index(page, 2); await page.keyboard.press('w'); await index(page, 1);
    check((await state(page)).url === records[0].images[2], 'Route presentation preserves second-page selection after both gallery directions');
    await page.screenshot({ path: path.join(output, 'gallery-fullscreen-1440p.png'), animations: 'disabled' });
    await galleryLayout(page, '1440p fullscreen'); await close(page);
    await open(page, mixed); await index(page, 1);
    await page.keyboard.press('w'); await index(page, 0);
    for (const [language, label] of [['ru', 'Следующее видео'], ['de', 'Nächstes Video']]) {
      await page.evaluate(language => DartI18n.setLanguage(language, false), language);
      check(await page.locator('.quick-preview-gallery-peek').getAttribute('aria-label') === label, `${language}: mixed-gallery next video label translated`);
    }
    await page.evaluate(() => DartI18n.setLanguage('en', false));
    await page.keyboard.press('s'); await index(page, 1);
    await page.waitForFunction(() => { const video = quickPreview.querySelector('video'); return video?.readyState >= 2 && !video.paused; });
    check(await page.locator('#quick-preview video').count() === 1, 'Mixed gallery plays exactly one active video');
    await page.evaluate(() => { globalThis.fixtureOldVideo = quickPreview.querySelector('video'); });
    await page.keyboard.press('s'); await index(page, 2);
    check(await page.evaluate(() => fixtureOldVideo.paused && !fixtureOldVideo.getAttribute('src') && !quickPreview.querySelector('video')), 'Leaving video releases playback and its source');
    await page.keyboard.press('w'); await index(page, 1); await page.keyboard.press('w'); await index(page, 0); await close(page);
    // Reset only neutral media cache entries, leaving all actual app state private.
    await page.evaluate(urls => { for (const url of urls) { readMediaBlob.cache?.invalidate(url); const key = imageLoader.key(url), entry = imageLoader.cache.get(key); if (entry) { imageLoader.cache.delete(key); imageLoader.bytes -= entry.size; URL.revokeObjectURL(entry.blobUrl); } } }, records[0].images);
    f.hold(records[0].images[2]); await open(page, records[0]);
    await page.keyboard.press('s'); check((await state(page)).gallery.index === 0, 'Pending page keeps old image visible');
    await page.keyboard.press('s'); await index(page, 2); f.release(); await frames(page);
    check((await state(page)).url === records[0].images[3], 'Rapid keys publish the final page without late stale image'); await close(page);
    await page.evaluate(url => { readMediaBlob.cache?.invalidate(url); const key = imageLoader.key(url), entry = imageLoader.cache.get(key); if (entry) { imageLoader.cache.delete(key); imageLoader.bytes -= entry.size; URL.revokeObjectURL(entry.blobUrl); } }, records[0].images[2]);
    f.hold(records[0].images[2]); await open(page, records[0]); await page.keyboard.press('s');
    await page.keyboard.press('d'); await page.waitForFunction(key => quickPreviewWork?.key !== key, records[0].key);
    const destination = (await state(page)).key; f.release(); await frames(page);
    check((await state(page)).key === destination, 'Changing artwork cancels pending gallery publication; late pages cannot reopen old work');
    await page.keyboard.press('a'); await page.waitForFunction(key => quickPreviewWork?.key === key, records[0].key); await close(page);
    await page.evaluate(url => { readMediaBlob.cache?.invalidate(url); const key = imageLoader.key(url), entry = imageLoader.cache.get(key); if (entry) { imageLoader.cache.delete(key); imageLoader.bytes -= entry.size; URL.revokeObjectURL(entry.blobUrl); } }, records[0].images[2]);
    f.fail(records[0].images[2]); await open(page, records[0]); await page.keyboard.press('s');
    await page.waitForFunction(() => quickPreviewGallery.state.error);
    check((await state(page)).gallery.index === 0 && (await state(page)).ready, 'Page error keeps existing decoded pixels');
    check(await page.locator('[data-preview-action="gallery-retry"]').isVisible(), 'Page error exposes Retry');
    await page.keyboard.press('s'); await index(page, 2); await page.keyboard.press('w'); await page.waitForFunction(() => quickPreviewGallery.state.error);
    f.fail(''); await page.locator('[data-preview-action="gallery-retry"]').click(); await index(page, 1);
    check((await state(page)).url === records[0].images[2], 'Retry recovers failed page and keyboard can skip around it'); await close(page);
    await open(page, records[8]); const single = await state(page); await page.mouse.wheel(0, -180); await frames(page);
    check(!(await state(page)).gallery && (await state(page)).scale > single.scale, 'Single-image ordinary wheel keeps existing zoom behavior'); await close(page);
    await contextResponsive(f);
  } finally { f.release(); await f.context.close(); }
}
async function contextResponsive(f) {
  const { page } = f;
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, records[0]); await page.keyboard.press('s'); await index(page, 1);
  check(await page.evaluate(() => !quickPreview.querySelector('.quick-preview-image').getAnimations().length), 'Reduced motion avoids page animations'); await close(page);
  await page.setViewportSize({ width: 420, height: 800 });
  await open(page, records[0]);
  const bounds = await page.locator('#quick-preview').boundingBox();
  check(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= 420 && bounds.y + bounds.height <= 800, 'Narrow fit includes gallery footer without clipping');
  await galleryLayout(page, 'narrow window');
  await page.screenshot({ path: path.join(output, 'gallery-narrow.png') }); await close(page);
}
(async () => {
  fs.mkdirSync(output, { recursive: true });
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.DART_BROWSER_EXE });
    const prep = await browser.newPage(); movie = await makeMovie(prep); await prep.close();
    await galleryProof();
    for (const surface of surfaces.filter(value => value !== 'likes')) {
      const f = await fixture(surface);
      try { await open(f.page, records[0]); await f.page.keyboard.press('s'); await index(f.page, 1);
        check((await state(f.page)).url === records[0].images[2], `${surface}: same-work gallery uses displayed unique media`); }
      finally { await f.context.close(); }
    }
    check(!report.errors.length, 'No browser runtime errors');
  } catch (error) { report.failure = { message: error.message, stack: error.stack }; throw error; }
  finally { await browser?.close(); fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ checks: report.checks.length, failure: report.failure, errors: report.errors, output })); }
})().catch(error => { console.error(error); process.exitCode = 1; });

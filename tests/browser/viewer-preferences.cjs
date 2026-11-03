// Run with DART_PLAYWRIGHT_PATH pointing to Playwright and DART_BROWSER_EXE to
// a Chromium browser. All APIs, profile state and media belong to this fixture.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.DART_PLAYWRIGHT_PATH || 'playwright');
const logic = require('../../wwwroot/catalog-logic.js');
const root = path.resolve(__dirname, '../../wwwroot');
const sources = logic.supportedSources;
const records = sources.flatMap((source, index) => ['q', 'e', 'g'].map(rating => ({
  key: `${source}:${index + 1}${rating}`, id: `${index + 1}${rating}`, source, rating,
  title: `Fixture ${source} ${rating}`, creatorTag: `fixture_${index}_${rating}`,
  tags: ['landscape', `fixture_${index}_${rating}`], characterTags: [],
  published: '2026-11-01T12:00:00Z',
  thumbnail: `https://example.test/${source}-${rating}.png`,
  images: [source === 'rule34' && rating === 'e' ? 'https://example.test/fixture.webm' :
    `https://example.test/${source}-${rating}.png`]
})));
let saved = { session: { savedWorksVersion: 1, activeIndex: 0,
  tabs: [{ kind: 'search', title: 'NSFW illustrations', rating: 'explicit', selectedSources: sources, sort: 'recent' }] } };
const calls = [], errors = [];
let media = Buffer.alloc(0), browser;
const json = (res, data) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = chunks.length ? JSON.parse(Buffer.concat(chunks)) : {};
      calls.push({ route: url.pathname, query: Object.fromEntries(url.searchParams), method: req.method, body });
      if (url.pathname === '/api/client-state') {
        if (req.method === 'POST') saved = { ...saved, ...body };
        return json(res, req.method === 'GET' ? saved : { saved: true });
      }
      if (url.pathname === '/api/search' || url.pathname === '/api/profile') {
        const selected = (url.searchParams.get('sources') || sources.join(',')).split(',');
        const rating = url.searchParams.get('rating') || 'general';
        const items = records.filter(item => selected.includes(item.source) && logic.matchesRating(item, rating));
        return json(res, { items, errors: {}, notices: {}, sourceStats: {}, hasMoreSources: [], hasMore: false });
      }
      if (url.pathname === '/api/detail') return json(res, records.find(item =>
        item.source === url.searchParams.get('source') && item.id === url.searchParams.get('id')) || records[0]);
      if (url.pathname === '/api/image') {
        res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
        return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="128" height="96"><rect width="128" height="96" fill="#329cff"/></svg>');
      }
      if (url.pathname === '/api/video') {
        res.writeHead(200, { 'Content-Type': 'video/webm', 'Content-Length': media.length }); return res.end(media);
      }
      if (url.pathname === '/api/settings') return json(res, { hasApiKey: true, hasRule34ApiKey: true, sankakuAvailable: true });
      if (url.pathname === '/api/content-preferences') return json(res, { language: 'en', aiMode: 'all' });
      if (url.pathname === '/api/likes') return json(res, records.filter(item => item.rating === 'g'));
      if (['/api/bookmarks', '/api/follows', '/api/favorite-tags', '/api/viewed-identities'].includes(url.pathname)) return json(res, []);
      return json(res, {});
    }
    const file = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
    if (!fs.existsSync(file)) { res.writeHead(404); return res.end(); }
    const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' };
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(fs.readFileSync(file));
  } catch (error) { errors.push(error.message); res.writeHead(500); res.end(); }
});

(async () => {
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    browser = await chromium.launch({ headless: true, executablePath: process.env.DART_BROWSER_EXE });
    const context = await browser.newContext({ viewport: { width: 2560, height: 1440 } });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.mouse.click(20, 20);
    const bytes = await page.evaluate(async () => {
      const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 96;
      document.body.append(canvas);
      canvas.getContext('2d').fillRect(0, 0, 128, 96);
      const audio = new AudioContext(), tone = audio.createOscillator(), output = audio.createMediaStreamDestination();
      tone.connect(output); tone.start(); await audio.resume();
      const videoTrack = canvas.captureStream(15).getVideoTracks()[0];
      const stream = new MediaStream([videoTrack, ...output.stream.getTracks()]);
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' }), chunks = [];
      let encodedBytes = 0;
      const complete = new Promise(resolve => { recorder.ondataavailable = event => {
        chunks.push(event.data); encodedBytes += event.data.size;
      };
        recorder.onstop = () => resolve(new Blob(chunks).arrayBuffer()); });
      recorder.start(100);
      // Wait for actual encoded output rather than assuming the encoder starts
      // within a fixed ten-frame burst on a busy QA machine. Bound it to 4.8s.
      for (let frame = 0; frame < 60 && (frame < 12 || encodedBytes <= 500); frame++) {
        canvas.getContext('2d').fillStyle = frame % 2 ? '#329cff' : '#174875';
        canvas.getContext('2d').fillRect(0, 0, 128, 96);
        videoTrack.requestFrame();
        await new Promise(resolve => setTimeout(resolve, 80));
      }
      recorder.stop();
      const data = Array.from(new Uint8Array(await complete));
      tone.stop(); stream.getTracks().forEach(track => track.stop()); await audio.close(); return data;
    });
    media = Buffer.from(bytes);
    assert.ok(media.length > 500, 'The generated audiovisual fixture must contain encoded frames');
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const nsfw = () => page.locator('[data-action="category"][data-category="explicit"]');
    const toggle = async rating => {
      await nsfw().click({ button: 'right' });
      await page.locator(`[data-nsfw-rating="${rating}"]`).click();
    };
    await page.waitForFunction(() => document.querySelectorAll('article.card').length === 8);
    // Hover previews can start while an unrelated navigation button still has
    // focus. Closing restores artwork focus, while Space continues to follow
    // the real mouse position until Tab explicitly selects keyboard ownership.
    const previewCard = page.locator('.card-art[data-key="danbooru:1e"]');
    await page.locator('#brand-button').focus();
    await previewCard.hover(); await page.keyboard.press('Space');
    await page.locator('#quick-preview[open]').waitFor();
    await page.mouse.click(5, 5);
    await page.waitForFunction(() => !quickPreview.open);
    assert.equal(await previewCard.evaluate(card => document.activeElement === card), true,
      'Closing a hover preview must focus its artwork instead of the previously focused Home button');
    await page.keyboard.press('Space');
    assert.equal(await page.locator('#quick-preview').evaluate(dialog => dialog.open), false,
      'Space at the blank backdrop position must not reopen the previously focused artwork');
    assert.equal(await page.evaluate(() => currentTab().kind), 'search',
      'Space after a backdrop close must not activate the previously focused Home button');
    await previewCard.hover(); await page.keyboard.press('Space');
    await page.locator('#quick-preview[open]').waitFor();
    assert.equal(await page.evaluate(() => currentTab().kind), 'search');
    await page.keyboard.down('Space'); await page.keyboard.down('Space');
    await page.keyboard.up('Space');
    assert.equal(await page.locator('#quick-preview').evaluate(dialog => dialog.open), false,
      'Holding Space closes once without reopening or activating the focused card');
    assert.equal(await page.evaluate(() => currentTab().kind), 'search');
    await page.keyboard.press('Space'); await page.locator('#quick-preview[open]').waitFor();
    await page.locator('[data-preview-action="close"]').focus(); await page.keyboard.press('Space');
    await page.waitForFunction(() => !quickPreview.open);
    assert.equal(await previewCard.evaluate(card => document.activeElement === card), true,
      'Keyboard activation of the modal close button returns focus to the artwork');
    await page.keyboard.press('Enter'); await page.waitForFunction(() => currentTab().kind === 'detail');
    await page.locator('#back-button').click(); await page.waitForFunction(() => currentTab().kind === 'search');
    await previewCard.hover(); await page.keyboard.press('Space');
    await page.locator('#quick-preview[open]').waitFor();
    await page.mouse.click(5, 5); await page.waitForFunction(() => !quickPreview.open);
    assert.equal(await previewCard.evaluate(card => document.activeElement === card), true,
      'A preview opened while Back is focused returns to its artwork');
    await page.keyboard.press('Space');
    assert.equal(await page.locator('#quick-preview').evaluate(dialog => dialog.open), false,
      'Space at the blank backdrop position must not reopen artwork after returning from Back');
    assert.equal(await page.evaluate(() => currentTab().kind), 'search',
      'Space after a backdrop close must not activate the previously focused Back button');
    await previewCard.hover(); await page.keyboard.press('Space'); await page.locator('#quick-preview[open]').waitFor();
    assert.equal(await page.evaluate(() => currentTab().kind), 'search');
    await page.keyboard.press('Escape');
    const blankArea = page.locator('#main h1').first();
    await blankArea.hover();
    assert.equal(await previewCard.evaluate(card => document.activeElement === card), true);
    await page.keyboard.press('Space');
    assert.equal(await page.locator('#quick-preview').evaluate(dialog => dialog.open), false,
      'Space over a non-artwork heading must not reopen the last focused artwork');
    assert.equal(await page.evaluate(() => currentTab().kind), 'search',
      'Space over a non-artwork heading must not activate the stale focused card');
    const sidebarBlank = page.locator('#sidebar .sidebar-footer');
    await sidebarBlank.hover();
    assert.equal(await sidebarBlank.evaluate(element => element.matches(':hover') && !element.closest('button, a, input')), true);
    assert.equal(await previewCard.evaluate(card => document.activeElement === card), true);
    await page.keyboard.press('Space');
    assert.equal(await page.locator('#quick-preview').evaluate(dialog => dialog.open), false,
      'Leaving the artwork area for sidebar text must not reopen the stale focused artwork');
    assert.equal(await page.evaluate(() => currentTab().kind), 'search',
      'Space over sidebar text must not activate Home or the stale focused card');
    await page.locator('.card-art[data-key="gelbooru:2q"]').hover(); await page.keyboard.press('Space');
    await page.locator('#quick-preview[open]').waitFor();
    assert.equal(await page.evaluate(() => quickPreviewWork.key), 'gelbooru:2q',
      'Returning from the sidebar selects the newly hovered artwork');
    await page.keyboard.press('Escape'); await page.waitForFunction(() => !quickPreview.open);
    const pointerTargets = ['danbooru:1e', 'gelbooru:2q', 'sankaku:4e', 'danbooru:1q'];
    const closeModes = ['Space', 'Escape', 'backdrop', 'Space'];
    const pointerResults = [];
    for (const [index, target] of pointerTargets.entries()) {
      const card = page.locator(`.card-art[data-key="${target}"]`);
      await card.hover();
      assert.equal(await card.evaluate(element => element.matches(':hover')), true,
        `The pointer must actually be over ${target} before Space`);
      const focusedBefore = await page.evaluate(() => document.activeElement?.getAttribute('data-key'));
      await page.keyboard.press('Space');
      await page.waitForFunction(() => quickPreview.open && !!quickPreviewWork?.key);
      const opened = await page.evaluate(() => quickPreviewWork.key);
      pointerResults.push({ target, focusedBefore, opened, close: closeModes[index] });
      assert.equal(await page.evaluate(() => currentTab().kind), 'search',
        'Pointer-target Space must not activate the underlying artwork or navigation');
      if (closeModes[index] === 'backdrop') {
        const outside = await page.locator('#quick-preview').evaluate(dialog => {
          const rect = dialog.getBoundingClientRect();
          return [
            { room: rect.left, x: rect.left / 2, y: innerHeight / 2 },
            { room: innerWidth - rect.right, x: (rect.right + innerWidth) / 2, y: innerHeight / 2 },
            { room: rect.top, x: innerWidth / 2, y: rect.top / 2 },
            { room: innerHeight - rect.bottom, x: innerWidth / 2, y: (rect.bottom + innerHeight) / 2 }
          ].sort((a, b) => b.room - a.room)[0];
        });
        assert(outside.room > 0, 'Compact preview must expose a real backdrop area');
        await page.mouse.click(outside.x, outside.y);
      } else await page.keyboard.press(closeModes[index]);
      await page.waitForFunction(() => !quickPreview.open);
    }
    console.log('Pointer-target Space sequence: ' + JSON.stringify(pointerResults));
    assert.deepEqual(pointerResults.map(result => result.opened), pointerTargets,
      'After closing each preview, Space must open the artwork under the pointer instead of the last focused artwork');
    await blankArea.hover();
    await previewCard.focus();
    const focusCardUsingTab = async (key, direction) => {
      for (let attempt = 0; attempt < 64; attempt++) {
        await page.keyboard.press(direction);
        if (await page.evaluate(target => document.activeElement?.matches('button.card-art') &&
            document.activeElement.dataset.key === target, key)) return;
      }
      assert.fail(`${direction} must reach artwork ${key} through the real tab order`);
    };
    await focusCardUsingTab('gelbooru:2q', 'Tab');
    await page.keyboard.press('Space'); await page.locator('#quick-preview[open]').waitFor();
    assert.equal(await page.evaluate(() => quickPreviewWork.key), 'gelbooru:2q',
      'Tab hands artwork selection to the focused card while the pointer remains over a heading');
    await page.keyboard.press('Space'); await page.waitForFunction(() => !quickPreview.open);
    await focusCardUsingTab('danbooru:1e', 'Shift+Tab');
    await page.keyboard.press('Space'); await page.locator('#quick-preview[open]').waitFor();
    assert.equal(await page.evaluate(() => quickPreviewWork.key), 'danbooru:1e',
      'Shift+Tab also hands artwork selection to keyboard focus');
    await page.keyboard.press('Escape'); await page.waitForFunction(() => !quickPreview.open);
    await page.locator('.card-art[data-key="rule34:3e"]').hover(); await page.keyboard.press('Space');
    await page.waitForFunction(() => quickPreview.open && document.querySelector('.quick-preview-video')?.readyState >= 2);
    assert.equal(await page.evaluate(() => quickPreviewWork.key), 'rule34:3e');
    await page.keyboard.press('Escape'); await page.waitForFunction(() => !quickPreview.open);
    await page.locator('.card-art[data-key="gelbooru:2e"]').hover(); await page.keyboard.press('Space');
    await page.locator('#quick-preview[open] .quick-preview-image:not(video)').waitFor();
    assert.equal(await page.evaluate(() => quickPreviewWork.key), 'gelbooru:2e',
      'Moving from a closed video preview to an image selects the hovered image');
    assert.equal(await page.locator('#quick-preview .quick-preview-video').count(), 0);
    await page.keyboard.press('Escape'); await page.waitForFunction(() => !quickPreview.open);
    await page.mouse.move(5, 5);
    await page.locator('#search-input').focus(); await page.keyboard.press('Space');
    assert.equal(await page.locator('#search-input').inputValue(), ' ');
    assert.equal(await page.locator('#quick-preview').evaluate(dialog => dialog.open), false);
    await page.locator('#search-input').fill(''); await page.keyboard.press('Escape');
    await page.locator('#brand-button').focus(); await page.keyboard.press('Space');
    await page.waitForFunction(() => currentTab().kind === 'home');
    await page.locator('[data-nav="adult"]').click();
    await page.waitForFunction(() => currentTab().kind === 'search' && currentTab().items.length === 8);
    await nsfw().click({ button: 'right' });
    assert.equal(await page.locator('[role="menuitemcheckbox"][aria-checked="true"]').count(), 2);
    await page.keyboard.press('Escape'); assert.equal(await nsfw().getAttribute('aria-expanded'), 'false');
    await toggle('e');
    await page.waitForFunction(() => currentTab().items.length === 4 && currentTab().items.every(item => item.rating === 'q'));
    assert(calls.some(call => call.route === '/api/search' && call.query.rating === 'questionable'));
    await page.locator('[data-category="all"]').click();
    await page.waitForFunction(() => currentTab().items.length === 12);
    await nsfw().click();
    await page.waitForFunction(() => currentTab().items.length === 4);
    await nsfw().focus(); await page.keyboard.press('Shift+F10');
    assert.equal(await page.locator('[data-nsfw-rating="e"]').getAttribute('aria-checked'), 'false');
    await page.keyboard.press('Escape');
    const beforeEmpty = calls.filter(call => call.route === '/api/search').length;
    await toggle('q');
    await page.waitForFunction(() => !currentTab().loading && currentTab().items.length === 0 && !currentTab().hasMore);
    assert.equal(calls.filter(call => call.route === '/api/search').length, beforeEmpty, 'both off must not contact catalogs');
    await toggle('e');
    await page.waitForFunction(() => currentTab()?.items?.length === 4 && currentTab().items.every(item => item.rating === 'e'));
    await page.reload();
    await page.waitForFunction(() => currentTab()?.items?.length === 4 && currentTab().items.every(item => item.rating === 'e'));
    await page.locator('#settings-button').click(); await page.locator('#settings-tab-appearance').click();
    assert.equal(await page.locator('[name="videoSound"]').isChecked(), false);
    await page.locator('[name="videoSound"]').check();
    await page.waitForFunction(() => viewerPreferences.videoSound);
    await page.locator('[data-nav="adult"]').click();
    await page.locator('.card-art[data-key="rule34:3e"]').click();
    await page.waitForFunction(() => { const video = document.querySelector('.detail-video video'); return video && video.readyState >= 2; }, null, { timeout: 10000 }).catch(async error => {
      console.error(JSON.stringify({ errors, mediaBytes: media.length, state: await page.evaluate(() => ({ kind: currentTab()?.kind,
        item: currentTab()?.item?.key, media: [...document.querySelectorAll('video')].map(v =>
          ({ src: v.src, error: v.error?.message, readyState: v.readyState })) })) })); throw error;
    });
    assert.equal(await page.locator('.detail-video video').evaluate(video => video.muted), false);
    assert.equal(await page.locator('.detail-video video').evaluate(video => video.paused), false);
    await page.locator('.detail-video video').evaluate(video => { video.muted = true; });
    await page.evaluate(() => render());
    assert.equal(await page.locator('.detail-video video').evaluate(video => video.muted), true, 'rerender preserves a manual mute');
    await page.evaluate(() => openQuickPreview({ item: currentTab().item, url: currentTab().item.images[0] }, 'fullscreen'));
    await page.waitForFunction(() => { const video = document.querySelector('.quick-preview-video'); return video && video.readyState >= 2; });
    assert.equal(await page.locator('.quick-preview-video').evaluate(video => video.muted), false);
    const verifyMovieMouseControls = async mode => {
      const movie = page.locator('.quick-preview-video');
      await page.waitForFunction(() => { const video = document.querySelector('.quick-preview-video');
        return video && video.readyState >= 2 && !video.paused; });
      await page.locator('#quick-preview').evaluate(dialog => Promise.allSettled(
        dialog.getAnimations({ subtree: true }).map(animation => animation.finished)));
      const box = await movie.boundingBox(), play = { x: box.x + 30, y: box.y + box.height - 30 };
      await page.mouse.move(play.x, play.y);
      await page.mouse.click(play.x, play.y);
      await page.waitForFunction(() => document.querySelector('.quick-preview-video').paused);
      await page.mouse.click(play.x, play.y);
      await page.waitForFunction(() => !document.querySelector('.quick-preview-video').paused);
      const before = calls.filter(call => call.route === '/api/likes' && call.method !== 'GET').length;
      await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2, { delay: 80 });
      await page.waitForTimeout(350);
      assert.equal(calls.filter(call => call.route === '/api/likes' && call.method !== 'GET').length, before,
        `${mode}: video double-click must not like the artwork`);
      if (await page.evaluate(() => !!document.fullscreenElement)) await page.evaluate(() => document.exitFullscreen());
      await page.mouse.dblclick(play.x, play.y, { delay: 80 });
      assert.equal(calls.filter(call => call.route === '/api/likes' && call.method !== 'GET').length, before,
        `${mode}: native player controls must not like the artwork`);
      await movie.focus();
      const paused = await movie.evaluate(video => video.paused);
      await page.keyboard.press('Space');
      await page.waitForFunction(previous => document.querySelector('.quick-preview-video').paused !== previous, paused);
      assert.equal(await page.locator('#quick-preview').evaluate(dialog => dialog.open), true,
        `${mode}: native video Space toggles playback without closing the modal`);
    };
    await verifyMovieMouseControls('fullscreen');
    await page.keyboard.press('Escape');
    await page.locator('[data-nav="adult"]').focus();
    await page.locator('.detail-video video').hover();
    await page.keyboard.press('Space');
    await page.locator('#quick-preview[open]:not(.fullscreen)').waitFor();
    await verifyMovieMouseControls('Space');
    await page.keyboard.press('Escape');
    await page.reload();
    await page.waitForFunction(() => viewerPreferences.videoSound === true);
    assert.equal(saved.session.viewerPreferences.videoSound, true);
    assert.deepEqual(saved.session.viewerPreferences.nsfwRatings, { q: false, e: true });
    await page.locator('#settings-button').click(); await page.locator('#settings-tab-appearance').click();
    await page.locator('[name="videoSound"]').uncheck();
    await page.reload();
    await page.waitForFunction(() => viewerPreferences.videoSound === false);
    await page.locator('[data-nav="adult"]').click();
    await page.locator('.card-art[data-key="rule34:3e"]').click();
    await page.waitForFunction(() => { const video = document.querySelector('.detail-video video'); return video && video.readyState >= 2; });
    assert.equal(await page.locator('.detail-video video').evaluate(video => video.muted), true);
    await page.evaluate(() => openQuickPreview({ item: currentTab().item, url: currentTab().item.images[0] }, 'fullscreen'));
    assert.equal(await page.locator('.quick-preview-video').evaluate(video => video.muted), true);
    await context.close();
    assert.deepEqual(errors, []);
    console.log('PASS: 1440p right-click, keyboard, Q/E filtering, All images, both-off, profile restore, Space focus after backdrop/close from Home/Back, repeated pointer-target Space with mixed closes, main/sidebar blank-area suppression and pointer reentry, Tab/Shift+Tab selection, video-to-image selection, held Space, card Enter, native buttons/text fields, audible video defaults, manual mute preservation and native fullscreen/Space video mouse controls without double-click likes.');
  } finally {
    await browser?.close(); await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

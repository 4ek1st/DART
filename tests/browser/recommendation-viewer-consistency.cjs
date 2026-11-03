// Isolated real Chromium fixture: actual grid order, member aliases, native
// decoded thumbnail/full pixels, Space browsing, late publication and scrolling.
// --compare-ref pins BOTH app.js and catalog-worker.js to the same revision.
'use strict';
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const cp = require('node:child_process'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const { chromium } = require(process.env.DART_PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(__dirname, '../..'), web = path.join(root, 'wwwroot');
const refAt = process.argv.indexOf('--compare-ref'), ref = refAt < 0 ? '' : process.argv[refAt + 1];
const source = name => ref ? cp.execFileSync('git', ['show', ref + ':wwwroot/' + name], { cwd: root }) : fs.readFileSync(path.join(web, name));
const pinned = new Map(['app.js', 'catalog-worker.js'].map(name => [name, source(name)]));
const output = process.env.DART_QA_OUTPUT || path.join(os.tmpdir(), 'DART-viewer-consistency-' + crypto.randomUUID());
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const work = (id, source = 'gelbooru', extra = {}) => ({ key: `${source}:${id}`, source, id: String(id), rating: 'g',
  title: `Neutral color field ${id}`, creatorTag: `neutral_artist_${id}`, creatorName: `Neutral Artist ${id}`,
  tags: ['rare_fabric', 'woodland_scene'], characterTags: [], published: '2026-11-03T12:00:00Z',
  thumbnail: `https://example.test/thumb-${source}-${id}.svg`, images: [`https://example.test/full-${source}-${id}.svg`], ...extra });
const seeds = Array.from({ length: 24 }, (_, index) => work(700000 + index));
const initial = Array.from({ length: 240 }, (_, index) => work(1000 + index));
initial[5].groupKey = initial[6].groupKey = 'gelbooru:parent:1005';
initial[5].tags.push('variant_test'); initial[6].tags.push('variant_test');
// Exact mirrored media is a different alias from a genuine second version.
initial[7].contentHash = '1234567890abcdef1234567890abcdef';
const mirrored = work(9007, 'danbooru', { contentHash: initial[7].contentHash, fixturePixel: 1007 });
const laterVersion = work(9005, 'danbooru', { groupKey: 'gelbooru:parent:1005', tags: ['rare_fabric', 'woodland_scene', 'variant_test'] });
const late = [mirrored, laterVersion, ...Array.from({ length: 24 }, (_, index) => work(2000 + index, 'danbooru'))];
const all = [...seeds, ...initial, ...late], known = new Map(all.map(item => [item.key, item]));
const pixels = new Map(all.flatMap(item => [item.thumbnail, ...item.images].map(url => [url, item.fixturePixel || Number(item.id)])));
const same = (first, second) => first && second && first.members.some(key => second.members.includes(key));
let browser;
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const result = { revision: ref || 'working-tree', output, failures: [], observations: [], errors: [], requests: [],
    sources: Object.fromEntries([...pinned].map(([name, bytes]) => [name, crypto.createHash('sha256').update(bytes).digest('hex')])) };
  let releaseSource, sourcesReleased = false, likes = [...seeds], hidden = [];
  const gate = new Promise(resolve => { releaseSource = () => { sourcesReleased = true; resolve(); }; });
  let state = { session: { savedWorksVersion: 1, activeIndex: 0, tabs: [{ kind: 'recommendations',
    title: 'Recommendations', rating: 'general', selectedSources: ['gelbooru', 'danbooru'] }] } };
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.DART_BROWSER_EXE });
    const context = await browser.newContext({ viewport: { width: 2560, height: 1440 } }), page = await context.newPage();
    page.setDefaultTimeout(15000); page.on('pageerror', error => result.errors.push(error.message));
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url()), raw = request.postData(), body = raw ? JSON.parse(raw) : {};
      const json = data => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) }).catch(() => {});
      if (url.pathname.startsWith('/api/')) {
        if (url.pathname === '/api/client-state') { if (request.method() === 'POST') state = { ...state, ...body }; return json(request.method() === 'GET' ? state : { saved: true }); }
        if (url.pathname === '/api/settings') return json({ hasApiKey: true });
        if (url.pathname === '/api/content-preferences') return json({ language: 'en', aiMode: 'all', hideViewedAndSaved: true, curation: { enabled: true } });
        if (url.pathname === '/api/recommendation-tag-preferences') return json({ preferences: { 'variant test': 'priority' }, initialized: true });
        if (url.pathname === '/api/likes') {
          if (request.method() === 'GET') return json(likes);
          const found = likes.some(item => item.key === body.key); likes = likes.filter(item => item.key !== body.key);
          if (!found || request.method() === 'PUT') likes.unshift(body);
          return json({ saved: !found || request.method() === 'PUT' });
        }
        if (url.pathname === '/api/hidden-artworks') {
          if (request.method() !== 'GET') { hidden = hidden.filter(item => item.key !== body.item.key); if (body.hidden) hidden.push(body.item); }
          return json(hidden);
        }
        if (['/api/bookmarks', '/api/follows', '/api/favorite-tags', '/api/favorite-artworks', '/api/favorite-artwork-groups', '/api/viewed-identities'].includes(url.pathname)) return json([]);
        if (url.pathname === '/api/search' || url.pathname === '/api/profile') {
          const selected = (url.searchParams.get('sources') || '').split(',');
          result.requests.push({ sources: selected, q: url.searchParams.get('q'), released: sourcesReleased });
          if (selected.length === 1 && selected[0] === 'danbooru') await gate;
          return json({ items: selected.length === 1 && selected[0] === 'danbooru' ? late : initial,
            errors: {}, notices: {}, hasMore: false, hasMoreSources: [] });
        }
        if (url.pathname === '/api/detail') return json(known.get(url.searchParams.get('source') + ':' + url.searchParams.get('id')) || {});
        if (url.pathname === '/api/image') {
          const identity = pixels.get(url.searchParams.get('url')) || 1, r = identity & 255, g = identity >>> 8 & 255, b = 137;
          return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="192"><rect width="256" height="192" fill="rgb(${r},${g},${b})"/></svg>` }).catch(() => {});
        }
        return json({});
      }
      const name = url.pathname.slice(1);
      if (pinned.has(name)) return route.fulfill({ status: 200, contentType: 'text/javascript', body: pinned.get(name) });
      const file = path.resolve(web, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
      if (!file.startsWith(web + path.sep) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
      return route.fulfill({ status: 200, contentType: ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.ico': 'image/x-icon' })[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
    });
    const frames = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const snapshot = async label => {
      const value = await page.evaluate(() => {
        const describe = item => ({ key: item.key, members: [...new Set([item.key, ...(item.memberKeys || [])])], thumbnail: item.thumbnail, images: item.images });
        const pixel = image => { if (!image?.naturalWidth) return null; const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
          const context = canvas.getContext('2d'); context.drawImage(image, 0, 0, 1, 1); return [...context.getImageData(0, 0, 1, 1).data]; };
        return { items: currentTab().items.length, loading: currentTab().loading, scroll: main.scrollTop, pendingRender: quickPreviewRenderPending,
          list: (currentTab().artworkLists?.get('recommendations') || []).map(describe),
          cards: [...main.querySelectorAll('article.card[data-work-key]')].map(node => ({ key: node.dataset.workKey,
            members: JSON.parse(node.dataset.workMembers), thumbnail: node.querySelector('img[data-image-url]')?.dataset.imageUrl,
            pixel: pixel(node.querySelector('img[data-image-url]')) })),
          preview: quickPreview.open ? { ...describe(quickPreviewWork), selectedUrl: quickPreview.querySelector('img')?.dataset.imageUrl,
            nativeSrc: quickPreview.querySelector('img')?.currentSrc, pixel: pixel(quickPreview.querySelector('img')) } : null,
          route: quickPreviewRoute?.engine.items.map(describe) };
      });
      result.observations.push({ label, ...value }); return value;
    };
    const check = (condition, label, data) => { if (!condition) result.failures.push({ label, ...data }); };
    const open = async key => {
      const card = page.locator(`article.card[data-work-key="${key}"] button.card-art`); await card.hover(); await page.keyboard.press('Space');
      await page.waitForFunction(() => quickPreview.open && document.querySelector('#quick-preview img')?.naturalWidth > 0); await frames();
    };
    const step = async (key, expected, label) => {
      const before = await page.evaluate(() => quickPreviewWork?.key); await page.keyboard.press(key);
      await page.waitForFunction(before => quickPreviewWork?.key !== before, before, { timeout: 5000 }).catch(() => {}); await frames();
      const actual = (await snapshot(label)).preview;
      check(same(expected, actual), label + ':grid-order', { expected, actual });
      check(actual?.selectedUrl === expected.images[0], label + ':original-media-url', { expected, actual });
      const identity = pixels.get(expected.thumbnail), expectedPixel = identity ? [identity & 255, identity >>> 8 & 255, 137, 255] : null;
      check(JSON.stringify(actual?.pixel) === JSON.stringify(expectedPixel), label + ':decoded-media', { expected, expectedPixel, actual });
    };
    await page.goto('http://neutral-consistency.test/'); await page.waitForFunction(() => document.querySelectorAll('article.card').length > 20);
    await page.waitForFunction(() => [...document.querySelectorAll('article.card img[data-image-url]')].slice(0, 12).every(image => image.naturalWidth)); await frames();
    const initialView = await snapshot('initial-grid'); const first = initialView.cards[0];
    await open(first.key); const opened = await snapshot('first-space-open');
    check(same(first, opened.preview), 'clicked-card:work', { first, actual: opened.preview });
    check(opened.preview.selectedUrl === initialView.list[0].images[0], 'clicked-card:original-media-url', { actual: opened.preview });
    check(JSON.stringify(first.pixel) === JSON.stringify(opened.preview.pixel), 'clicked-card:decoded-media', { first, actual: opened.preview });
    for (let index = 1; index <= 5; index++) await step('ArrowRight', initialView.list[index], 'before-publication-next-' + index);
    for (let index = 4; index >= 0; index--) await step('ArrowLeft', initialView.list[index], 'before-publication-back-' + index);
    // The rendered grid retains these ordinary already-visible visit slots even
    // when external history/library changes make them known. The viewer must
    // use that displayed order rather than independently hiding those cards.
    const knownNext = initialView.list[1], savedNext = initialView.list[2];
    await page.evaluate(({ viewed, saved }) => { viewedTokens.add('key:' + viewed); const item = itemIndex.get(saved);
      setSavedWorks('likes', [item, ...likes], [item]); }, { viewed: knownNext.key, saved: savedNext.key });
    await step('ArrowRight', knownNext, 'retained-viewed-next');
    await step('ArrowRight', savedNext, 'retained-saved-next');
    releaseSource(); await page.waitForFunction(() => !currentTab().loading); await frames(); const pending = await snapshot('late-publication-while-preview-open');
    // The grid behind the modal has not repainted. Its group still advertises
    // the old exact version even if a late source adds a preferred member.
    // Traverse with real keys and compare native pixels on Next AND Back.
    const pendingGroupIndex = initialView.list.findIndex(item => item.members.includes('gelbooru:1005'));
    const pendingGroup = pending.cards.find(item => item.members.includes('gelbooru:1005'));
    if (pendingGroup) {
      if (pendingGroupIndex > 2) {
        for (let index = 3; index <= pendingGroupIndex + 1; index++)
          await step('ArrowRight', initialView.list[index], 'pending-grid-next-' + index);
        await step('ArrowLeft', initialView.list[pendingGroupIndex], 'pending-grid-group-back');
      } else {
        for (let index = 1; index >= pendingGroupIndex; index--)
          await step('ArrowLeft', initialView.list[index], 'pending-grid-back-' + index);
        await step('ArrowRight', initialView.list[pendingGroupIndex + 1], 'pending-grid-group-away');
        await step('ArrowLeft', initialView.list[pendingGroupIndex], 'pending-grid-group-back');
      }
      await page.screenshot({ path: path.join(output, 'neutral-pending-group-comparison.png') });
    }
    await page.keyboard.press('Escape'); await frames(); const returned = await snapshot('returned-grid');
    const prefix = initialView.list, returnedPrefix = returned.list.slice(0, prefix.length);
    check(prefix.every((item, index) => same(item, returnedPrefix[index])), 'return-without-refresh:prefix-order', { expected: prefix, actual: returnedPrefix });
    await open(returned.cards[0].key); await snapshot('close-reopen'); await step('ArrowRight', returned.list[1], 'reopen-next');
    await page.keyboard.press('Escape'); await frames();
    // Resolve a deep card from the same full rendered list, then use real
    // scroll events to make its virtual row exist before opening it.
    const targetIndex = Math.min(180, returned.list.length - 8), target = returned.list[targetIndex];
    await page.evaluate(index => { const tab = currentTab(), virtual = tab.virtualState.recommendations;
      main.scrollTop = (tab.gridTops.recommendations || 0) + Math.floor(index / virtual.cols) * virtual.pitch; main.dispatchEvent(new Event('scroll')); }, targetIndex);
    await page.waitForFunction(key => !!document.querySelector(`article.card[data-work-key="${key}"]`), target.key); await frames();
    await open(target.key); await snapshot('deep-virtual-space'); await step('ArrowRight', returned.list[targetIndex + 1], 'deep-virtual-next');
    await step('ArrowLeft', target, 'deep-virtual-back'); await page.keyboard.press('Escape'); await frames();
    // A group contains real versions with distinct pixels, while a mirrored
    // alias has the exact same pixels. Opening must match the card's version.
    const groupIndex = returned.list.findIndex(item => item.members.includes('gelbooru:1005'));
    await page.evaluate(index => { const tab = currentTab(), virtual = tab.virtualState.recommendations;
      main.scrollTop = (tab.gridTops.recommendations || 0) + Math.floor(index / virtual.cols) * virtual.pitch; main.dispatchEvent(new Event('scroll')); }, groupIndex);
    const group = returned.list[groupIndex]; await page.waitForFunction(key => !!document.querySelector(`article.card[data-work-key="${key}"]`), group.key); await frames();
    await page.waitForFunction(key => !!document.querySelector(`article.card[data-work-key="${key}"] img`)?.naturalWidth, group.key);
    const groupBefore = (await snapshot('grouped-card')).cards.find(item => item.key === group.key); await open(group.key);
    const groupOpen = (await snapshot('grouped-space')).preview;
    check(same(groupBefore, groupOpen), 'grouped-card:work-members', { expected: groupBefore, actual: groupOpen });
    check(groupOpen.selectedUrl === group.images[0], 'grouped-card:original-media-url', { expected: group, actual: groupOpen });
    check(JSON.stringify(groupBefore.pixel) === JSON.stringify(groupOpen.pixel), 'grouped-card:decoded-version', { expected: groupBefore, actual: groupOpen });
    await page.keyboard.press('Escape'); await frames(); await page.screenshot({ path: path.join(output, 'neutral-grouped-grid.png') });
    const mirrorIndex = returned.list.findIndex(item => item.members.includes('gelbooru:1007')), mirror = returned.list[mirrorIndex];
    await page.evaluate(index => { const tab = currentTab(), virtual = tab.virtualState.recommendations;
      main.scrollTop = (tab.gridTops.recommendations || 0) + Math.floor(index / virtual.cols) * virtual.pitch; main.dispatchEvent(new Event('scroll')); }, mirrorIndex);
    await page.waitForFunction(key => !!document.querySelector(`article.card[data-work-key="${key}"] img`)?.naturalWidth, mirror.key); await frames();
    const mirrorCard = (await snapshot('mirrored-alias-card')).cards.find(item => item.key === mirror.key); await open(mirror.key);
    const mirrorOpen = (await snapshot('mirrored-alias-space')).preview;
    check(same(mirrorCard, mirrorOpen), 'mirror-card:member-aliases', { expected: mirrorCard, actual: mirrorOpen });
    check(mirrorOpen.selectedUrl === mirror.images[0], 'mirror-card:original-media-url', { expected: mirror, actual: mirrorOpen });
    check(JSON.stringify(mirrorCard.pixel) === JSON.stringify(mirrorOpen.pixel), 'mirror-card:decoded-image', { expected: mirrorCard, actual: mirrorOpen });
    await page.keyboard.press('Escape'); await frames();
    // Explicit manual hides have higher priority than retained visit slots.
    const hiddenTarget = returned.list.find(item => item.members.length === 1 && item.key !== first.key);
    await page.evaluate(() => { main.scrollTop = 0; main.dispatchEvent(new Event('scroll')); });
    await page.waitForFunction(key => !!document.querySelector(`article.card[data-work-key="${key}"]`), returned.list[0].key); await frames();
    const beforeHide = await snapshot('before-explicit-hide');
    await open(beforeHide.cards[0].key);
    await page.evaluate(async key => { await artworkActionsController().setHidden(itemIndex.get(key), true); }, hiddenTarget.key);
    await snapshot('explicit-hide-buffered-route');
    await step('ArrowRight', returned.list.slice(1).find(item => !same(item, hiddenTarget)), 'manual-hide-buffered-next');
    await page.keyboard.press('Escape'); await frames();
    const afterHide = await snapshot('explicit-hide');
    check(!afterHide.list.some(item => same(item, hiddenTarget)), 'manual-hide:removed-from-grid', { hiddenTarget });
    check(result.errors.length === 0, 'browser-errors', { errors: result.errors });
    await context.close();
  } finally {
    releaseSource(); await browser?.close(); fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ revision: result.revision, failures: result.failures, errors: result.errors, output }));
  }
  assert.equal(result.failures.length, 0, 'Grid/viewer consistency failures; see isolated report');
})().catch(error => { console.error(error); process.exitCode = 1; });

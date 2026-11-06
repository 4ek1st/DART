// Neutral real-browser proof. No local profile, provider access or visible UI.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const cp = require('node:child_process');
const { chromium } = require(process.env.DART_PLAYWRIGHT_PATH || 'playwright');
const web = path.resolve(__dirname, '../../wwwroot');
const referenceAt=process.argv.indexOf('--compare-ref'),reference=referenceAt<0?'':process.argv[referenceAt+1];
const pinned=reference?new Map(cp.execFileSync('git',['ls-tree','-r','--name-only',reference,'wwwroot'],{cwd:path.dirname(web),encoding:'utf8'}).trim().split('\n')
  .map(file=>['/'+file.slice(8),cp.execFileSync('git',['show',reference+':'+file],{cwd:path.dirname(web),maxBuffer:16*1024*1024})])):null;
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
const report = { revision:reference||'working-tree',viewport: { width: 2560, height: 1440 }, checks: [], errors: [], files: {} };
for (const name of ['app.js', 'preview-gallery.js', 'style.css']) report.files[name] = hash(pinned?pinned.get('/'+name):fs.readFileSync(path.join(web, name)));
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
async function fixture(surface, { dimensions = { width:800, height:600 }, pageDimensions = {}, large = false } = {}) {
  const context = await browser.newContext({ viewport: report.viewport });
  const page = await context.newPage(); page.setDefaultTimeout(10000);
  page.on('pageerror', error => report.errors.push({ surface, error: error.message }));
  const calls = []; let fail = '', hold = '', release;
  const extra = large ? Array.from({length:2400},(_,i)=>({...make(20000+i,sources[i%4]),tags:['neutral_artist',...Array.from({length:60},(_,tag)=>`neutral_dense_${tag}`)]})) : [];
  let liked = surface === 'likes' ? [...records,...extra] : [seed], bookmarks = surface === 'bookmarks' ? [...records] : [];
  let saved = { session: { savedWorksVersion: 1, activeIndex: 0, tabs: [{ kind: surface === 'related' ? 'detail' : surface,
    title: 'Neutral gallery fixture', rating: 'general', selectedSources: sources, favoriteType: 'artwork',
    ...(surface === 'related' ? { item: seed } : {}), ...(surface === 'profile' ? { profileRef: { source: 'artist', artist: 'neutral_artist' } } : {}) }] },
    recent: surface === 'recent' ? records : [] };
  if(large)saved.session.tabs.push(...Array.from({length:15},(_,i)=>({kind:['search','recommendations','follows','bookmarks','profile'][i%5],title:'Neutral saved tab '+i,rating:'general',selectedSources:sources,
    ...(i%5===4?{profileRef:{source:'artist',artist:'neutral_artist'}}:{})})));
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
      if(url.pathname==='/api/viewed-identities')return json(large?Array.from({length:100000},(_,i)=>'fixture:viewed:'+i):[]);
      if (['/api/hidden-artworks', '/api/favorite-tags', '/api/favorite-artwork-groups', '/api/source-status'].includes(url.pathname)) return json([]);
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
        const size=pageDimensions[pageNumber]||dimensions;
        // Give every work real distinct pixels. Reusing one synthetic image
        // for thousands of records would exercise false duplicate grouping.
        const identity=(/(?:gallery|thumb|full)-(\d+)/.exec(media)?.[1]||media)+':'+pageNumber,signature=hash(identity);
        const tiles=Array.from({length:64},(_,i)=>`<rect x="${size.width*(.1+(i%8)*.1)}" y="${size.height*(.15+Math.floor(i/8)*.08)}" width="${size.width*.1}" height="${size.height*.08}" fill="${parseInt(signature[i%32],16)&(1<<(i%4))?'#d7dfe8':'#173344'}"/>`).join('');
        return route.fulfill({ status: 200, contentType: 'image/svg+xml', body:
          `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}"><rect width="100%" height="100%" fill="rgb(${pageNumber * 55},110,180)"/>${tiles}<text x="45" y="55" font-size="42" fill="white">PAGE ${pageNumber}</text><text x="45" y="${size.height-12}" font-size="36" fill="white">END ${pageNumber}</text><rect x="420" y="12" width="44" height="55" fill="#329cff"/><circle cx="515" cy="39" r="25" fill="#84d9b4"/><rect x="500" y="330" width="200" height="220" fill="#329cff"/></svg>` }).catch(() => {});
      }
      if (url.pathname === '/api/video') return route.fulfill({ status: 200, contentType: 'video/webm', body: movie }).catch(() => {});
      return json({});
    }
    const file = path.resolve(web, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
    const bytes=pinned?pinned.get(url.pathname==='/'?'/index.html':url.pathname):file.startsWith(web+path.sep)&&fs.existsSync(file)?fs.readFileSync(file):null;
    if (!bytes) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ status: 200, contentType: ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.ico': 'image/x-icon' })[path.extname(file)] || 'application/octet-stream', body: bytes });
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
  await page.waitForFunction(() => [...quickPreview.querySelectorAll('.quick-preview-gallery-peek')]
    .filter(node=>!node.hidden&&!node.classList.contains('video')).every(node=>node.querySelector('img')?.naturalWidth>0));
  const layout = await page.evaluate(() => {
    const rect = selector => { const node = quickPreview.querySelector(selector); if (!node) return null;
      const r = node.getBoundingClientRect(); return { left:r.left, right:r.right, top:r.top, bottom:r.bottom, width:r.width, height:r.height }; };
    const next=quickPreviewGallery.state.index<quickPreviewGallery.state.length-1;
    const image = quickPreview.querySelector(next?'.quick-preview-gallery-peek-image':'.quick-preview-gallery-previous-image');
    const current = quickPreview.querySelector('.quick-preview-image');
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0, 1, 1, 0, 0, 1, 1);
    return { stage: rect('.quick-preview-stage'), counter: rect('.quick-preview-gallery-position'), peek: rect(next?'.quick-preview-gallery-peek-next':'.quick-preview-gallery-peek-previous'),
      pixel: [...ctx.getImageData(0, 0, 1, 1).data], opacity: getComputedStyle(image).opacity,
      up:rect('.quick-preview-gallery-position [data-preview-action="gallery-previous"]'),
      down:rect('.quick-preview-gallery-position [data-preview-action="gallery-next"]'),
      count:rect('.quick-preview-gallery-count'), viewport:{width:innerWidth,height:innerHeight},
      natural:{width:current.naturalWidth||current.videoWidth,height:current.naturalHeight||current.videoHeight},
      fullscreen:quickPreview.classList.contains('fullscreen'),peekPage: quickPreviewGallery.state.index+(next?2:0),
      shell: { outline: getComputedStyle(quickPreview).outlineStyle, border: getComputedStyle(quickPreview).borderTopWidth } };
  });
  (report.layouts ||= []).push({label,...layout});
  check(Math.abs((layout.stage.top+layout.stage.bottom)/2-layout.viewport.height/2)<1,
    `${label}: the selected image stays at the original vertical center`);
  check(Math.abs((layout.stage.left+layout.stage.right)/2-layout.viewport.width/2)<1,
    `${label}: the selected image stays at the original horizontal center`);
  const maxWidth=layout.fullscreen?layout.viewport.width:Math.min(1600,layout.viewport.width*.9,layout.viewport.width-32);
  const maxHeight=layout.fullscreen?layout.viewport.height:Math.min(layout.viewport.height*.88,layout.viewport.height-32);
  const scale=Math.min(maxWidth/layout.natural.width,maxHeight/layout.natural.height);
  check(Math.abs(layout.stage.width-(layout.fullscreen?layout.viewport.width:Math.round(layout.natural.width*scale)))<=1 &&
    Math.abs(layout.stage.height-(layout.fullscreen?layout.viewport.height:Math.round(layout.natural.height*scale)))<=1,
    `${label}: neighboring images never reduce the original fit size`);
  check(layout.up.bottom<=layout.count.top && layout.count.bottom<=layout.down.top && layout.counter.width<75,
    `${label}: arrows and counter form a compact vertical control`);
  check(Math.abs((layout.counter.top+layout.counter.bottom)/2-layout.viewport.height/2)<1,
    `${label}: vertical control stays centered beside the image`);
  if(!layout.fullscreen && layout.stage.left>=85)
    check(layout.counter.right<=layout.stage.left-12,`${label}: vertical control sits to the left without moving the image`);
  const spare=(layout.viewport.height-Math.round(layout.natural.height*scale))/2-Math.max(12,Math.min(40,layout.viewport.height*.026))-2;
  check(spare<8?layout.peek.height===0:layout.peek.height>0&&layout.peek.height<=49,
    `${label}: neighbors use a narrow free-space strip and never cover the centered image`);
  check(layout.pixel[0] === layout.peekPage * 55 && layout.opacity === '1', `${label}: peek contains actual adjacent-page pixels without a full-image tint`);
  check(layout.shell.outline === 'none' && layout.shell.border === '0px', `${label}: no enclosing frame visually joins the separate cards`);
}
async function physicalKey(page,code,key) {
  const session=await page.context().newCDPSession(page),vk=code==='KeyW'?87:83;
  try {
    await session.send('Input.dispatchKeyEvent',{type:'keyDown',code,key,text:key,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk});
    await session.send('Input.dispatchKeyEvent',{type:'keyUp',code,key,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk});
  } finally {await session.detach();}
}
async function centeredProof() {
  for(const shape of [{name:'portrait',width:900,height:1300,large:true},{name:'square',width:1000,height:1000}]) {
    const boot=performance.now(),f=await fixture('likes',{dimensions:shape,large:!!shape.large}),{page}=f;
    try {
      await page.emulateMedia({reducedMotion:'reduce'});
      await page.evaluate(()=>{
        globalThis.__galleryTiming={keys:[],longTasks:[]};let started=null;
        window.addEventListener('keydown',event=>{
          if(quickPreview.open&&['KeyW','KeyS','ArrowUp','ArrowDown'].includes(event.code))
            started={at:performance.now(),before:quickPreviewGallery?.state.index,key:event.key,trusted:event.isTrusted};
        },true);
        new MutationObserver(()=>{if(started&&quickPreviewGallery?.state.index!==started.before){
          __galleryTiming.keys.push({...started,ms:Math.round((performance.now()-started.at)*10)/10});started=null;
        }}).observe(quickPreview,{childList:true,subtree:true});
        new PerformanceObserver(list=>{for(const task of list.getEntries())__galleryTiming.longTasks.push({at:task.startTime,ms:task.duration});}).observe({type:'longtask'});
      });
      const bootMs=Math.round(performance.now()-boot);
      const stageBox=()=>page.locator('#quick-preview .quick-preview-stage').boundingBox();
      await open(page,records[8]);await frames(page);const single=await stageBox();await close(page);
      const cold=performance.now();await open(page,records[0]);await galleryLayout(page,shape.name+' first page');
      const coldOpenMs=Math.round(performance.now()-cold),grouped=await stageBox();
      check(Math.abs(single.x-grouped.x)<1&&Math.abs(single.y-grouped.y)<1&&Math.abs(single.width-grouped.width)<1&&Math.abs(single.height-grouped.height)<1,
        `${shape.name}: gallery and the unchanged single-image viewer have identical bounds`);
      await adjacentPages(page,0,2,shape.name+' first page');
      await physicalKey(page,'KeyS','ы');await index(page,1);await adjacentPages(page,1,3,shape.name+' middle page');
      await galleryLayout(page,shape.name+' middle page');
      if(shape.name==='portrait')await page.screenshot({path:path.join(output,'gallery-portrait-middle-1440p.png'),animations:'disabled'});
      await page.locator('.quick-preview-gallery-peek-next').click();await index(page,2);await adjacentPages(page,2,0,shape.name+' last page');
      await galleryLayout(page,shape.name+' last page');
      await page.locator('.quick-preview-gallery-peek-previous').click();await index(page,1);
      check((await state(page)).key===records[0].key,`${shape.name}: clicking either visible neighbor stays in this artwork`);
      await page.locator('.quick-preview-gallery-position [data-preview-action="gallery-previous"]').click();await index(page,0);
      await page.locator('.quick-preview-gallery-position [data-preview-action="gallery-next"]').click();await index(page,1);
      check((await state(page)).key===records[0].key,`${shape.name}: both vertical arrow buttons navigate gallery pages`);
      for(let step=0;step<12;step++) {const wanted=step%2===0?0:1;await physicalKey(page,wanted?'KeyS':'KeyW',wanted?'ы':'ц');await index(page,wanted);}
      await close(page);const warm=performance.now();await open(page,records[0]);await index(page,0);
      const warmOpenMs=Math.round(performance.now()-warm),warmBounds=await stageBox();
      check(Math.abs(warmBounds.y-single.y)<1&&Math.abs(warmBounds.height-single.height)<1,`${shape.name}: warm return preserves the original centered image`);
      if(shape.large) {
        const library=await page.evaluate(()=>({likes:likes.length,viewed:viewedTokens.size,tabs:tabs.length}));
        (report.libraries ||= []).push(library);
        check(library.likes===2440&&library.viewed>=100000&&library.tabs===16,'Large fixture includes 2440 saved works, 100000 viewed identities and 16 mixed tabs');
        await page.keyboard.press('b');await page.waitForFunction(()=>isSavedWork(quickPreviewWork,'bookmarks')&&!isSavedWorkPending(quickPreviewWork,'bookmarks'));
        await page.keyboard.press('f');await page.waitForFunction(()=>!isSavedWork(quickPreviewWork,'likes')&&!isSavedWorkPending(quickPreviewWork,'likes'));
        await page.keyboard.press('f');await page.waitForFunction(()=>isSavedWork(quickPreviewWork,'likes')&&!isSavedWorkPending(quickPreviewWork,'likes'));
        check((await state(page)).key===records[0].key,'Large-library like/bookmark actions preserve gallery identity and position');
      }
      const timing=await page.evaluate(()=>__galleryTiming);check(timing.keys.length>=13&&timing.keys.every(entry=>entry.trusted),`${shape.name}: W/S input uses trusted browser events including Russian layout`);
      (report.performance ||= []).push({shape:shape.name,bootMs,coldOpenMs,warmOpenMs,keys:timing.keys,longTasks:timing.longTasks});
      await close(page);
    } finally {f.release();await f.context.close();}
  }
  const f=await fixture('likes',{dimensions:{width:900,height:1300},pageDimensions:{2:{width:1300,height:900}}});
  try {
    await f.page.emulateMedia({reducedMotion:'reduce'});await open(f.page,records[0]);
    await galleryLayout(f.page,'mixed aspect portrait');await f.page.keyboard.press('s');await index(f.page,1);
    await galleryLayout(f.page,'mixed aspect landscape');await adjacentPages(f.page,1,3,'mixed aspect middle');
    await f.page.keyboard.press('s');await index(f.page,2);await galleryLayout(f.page,'mixed aspect last portrait');
  } finally {await f.context.close();}
}
async function performanceProof() {
  const started=performance.now(),f=await fixture('likes',{dimensions:{width:900,height:1300},large:true}),{page}=f;
  try {
    await page.emulateMedia({reducedMotion:'reduce'});
    const bootMs=Math.round(performance.now()-started);
    await page.evaluate(()=>{
      globalThis.__galleryTiming={keys:[],longTasks:[]};let pending;
      window.addEventListener('keydown',event=>{if(quickPreview.open&&['KeyS','KeyW'].includes(event.code))pending={at:performance.now(),index:quickPreviewGallery.state.index};},true);
      new MutationObserver(()=>{if(pending&&quickPreviewGallery?.state.index!==pending.index){__galleryTiming.keys.push(Math.round((performance.now()-pending.at)*10)/10);pending=null;}})
        .observe(quickPreview,{childList:true,subtree:true});
      new PerformanceObserver(list=>{for(const task of list.getEntries())__galleryTiming.longTasks.push({at:task.startTime,ms:task.duration});}).observe({type:'longtask'});
    });
    const cold=performance.now();await open(page,records[0]);await index(page,0);const coldOpenMs=Math.round(performance.now()-cold);
    for(let step=0;step<12;step++){await page.keyboard.press(step%2?'w':'s');await index(page,step%2?0:1);}
    await close(page);const warm=performance.now();await open(page,records[0]);await index(page,0);const warmOpenMs=Math.round(performance.now()-warm);
    const actions=[];for(const key of ['b','f','f']){
      const before=performance.now();await page.keyboard.press(key);await page.waitForFunction(()=>!isSavedWorkPending(quickPreviewWork,'likes')&&!isSavedWorkPending(quickPreviewWork,'bookmarks'));
      actions.push({key,ms:Math.round(performance.now()-before)});
    }
    check((await state(page)).key===records[0].key,'Performance comparison retains actual work identity through real inputs');
    const timing=await page.evaluate(()=>({...__galleryTiming,likes:likes.length,viewed:viewedTokens.size,tabs:tabs.length}));
    check(timing.likes===2440&&timing.viewed>=100000&&timing.tabs===16,'Performance comparison uses the same complete large fixture');
    report.performance=[{bootMs,coldOpenMs,warmOpenMs,actions,...timing}];
  } finally {await f.context.close();}
}
async function adjacentPages(page,previous,next,label) {
  await page.waitForFunction(({previous,next})=>{
    const a=quickPreview.querySelector('.quick-preview-gallery-previous-image'),b=quickPreview.querySelector('.quick-preview-gallery-peek-image');
    return (!previous||a?.naturalWidth>0)&&(!next||b?.naturalWidth>0);
  },{previous,next});
  for(const [direction,number] of [['previous',previous],['next',next]]) {
    const peek=page.locator('.quick-preview-gallery-peek-'+direction);
    check(await peek.isVisible()===!!number,`${label}: ${direction} exists exactly when that page exists`);
    if(!number)continue;
    const media=await peek.evaluate(node=>{const image=node.querySelector('img'),canvas=document.createElement('canvas');canvas.width=canvas.height=1;
      const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,1,1,0,0,1,1);
      const box=node.getBoundingClientRect(),css=getComputedStyle(node);
      return {pixel:[...ctx.getImageData(0,0,1,1).data],position:getComputedStyle(image).objectPosition,
        top:box.top,bottom:box.bottom,height:innerHeight,topCorners:[css.borderTopLeftRadius,css.borderTopRightRadius],
        bottomCorners:[css.borderBottomLeftRadius,css.borderBottomRightRadius]};});
    check(media.pixel[0]===number*55,`${label}: ${direction} displays the exact adjacent frame`);
    check(media.position===(direction==='previous'?'50% 100%':'50% 0%'),`${label}: ${direction} reveals the touching edge of that image`);
    check(direction==='previous'?Math.abs(media.top)<1:Math.abs(media.bottom-media.height)<1,
      `${label}: ${direction} is flush with its viewport edge`);
    check((direction==='previous'?media.topCorners:media.bottomCorners).every(value=>value==='0px'),
      `${label}: ${direction} has square corners at the window boundary`);
  }
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
        await adjacentPages(page,0,2,'first page');
      }
      await page.keyboard.press('s'); await index(page, 1);
      check((await state(page)).url === item.images[2], `${item.source}: S selects the real second unique image`);
      if(item===records[0]){
        await adjacentPages(page,1,3,'middle page');await galleryLayout(page,'1440p middle page');
        await page.screenshot({path:path.join(output,'gallery-middle-1440p.png'),animations:'disabled'});
        for(const [code,key,wanted] of [['KeyW','ц',0],['KeyS','ы',1],['KeyW','Ц',0],['KeyS','Ы',1]]){
          await physicalKey(page,code,key);await index(page,wanted);check((await state(page)).key===item.key,`Trusted Russian ${key}/${code} selects page ${wanted+1} of the same work`);
        }
      }
      await page.keyboard.press('ArrowDown'); await index(page, 2);
      if(item===records[0]){await adjacentPages(page,2,0,'last page');await galleryLayout(page,'1440p last page');}
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
        footer.querySelector('[data-preview-action="gallery-previous"]').getAttribute('aria-label'), footer.querySelector('.quick-preview-gallery-peek-next').getAttribute('aria-label'),
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
      check(await page.locator('.quick-preview-gallery-peek-next').getAttribute('aria-label') === label, `${language}: mixed-gallery next video label translated`);
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
    const performanceOnly=process.argv.includes('--performance-only');
    if(performanceOnly)await performanceProof();else{await galleryProof();await centeredProof();}
    for (const surface of performanceOnly?[]:surfaces.filter(value => value !== 'likes')) {
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

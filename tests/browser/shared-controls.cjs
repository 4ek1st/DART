// Isolated synthetic profile, provider responses and neutral landscape previews.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../wwwroot');
function neutralPng() {
  const zlib=require('node:zlib'), crc=buffer=>{let n=0xffffffff;for(const byte of buffer){n^=byte;for(let i=0;i<8;i++)n=(n>>>1)^(n&1?0xedb88320:0);}return(n^0xffffffff)>>>0;};
  const chunk=(name,data)=>{const type=Buffer.from(name),size=Buffer.alloc(4),sum=Buffer.alloc(4);size.writeUInt32BE(data.length);sum.writeUInt32BE(crc(Buffer.concat([type,data])));return Buffer.concat([size,type,data,sum]);};
  const header=Buffer.alloc(13);header.writeUInt32BE(64,0);header.writeUInt32BE(64,4);header[8]=8;header[9]=2;
  const pixels=Buffer.alloc(64*193);for(let y=0;y<64;y++)for(let x=0;x<64;x++){const p=y*193+1+x*3;pixels[p]=30+x*2;pixels[p+1]=60+y*2;pixels[p+2]=100;}
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);
}
const pixels=neutralPng();
const works = Array.from({ length: 12 }, (_, i) => ({ key: `danbooru:${i+1}`, id: String(i+1), source: 'danbooru',
  title: `Landscape ${i+1}`, rating: 'g', creatorTag: 'test_artist', creatorName: 'Test Artist',
  tags: ['rain','forest'], allTags: ['rain','forest','fern','sample_series'], characterTags: ['fern'], copyrightTags: ['sample_series'],
  thumbnail: `https://example.test/landscape-${i+1}.svg`, images: [`https://example.test/landscape-${i+1}.svg`], published: '2026-11-02T12:00:00Z' }));
let state = { session: { savedWorksVersion: 1, activeIndex: 0, tabs: [{ kind: 'favorites', title: 'Favorites', rating: 'all', favoriteType: 'character', favoriteOrigin: 'mine' }] } };
const tags = ['fern','rain'], calls = [], serverErrors = [];
let moduleReady = false, upscalePreferences = { scale: 2, auto: false }, jobNumber = 0;
const summary = { totalWorks: 12, kinds: { fern: 'character', rain: 'tag' }, entries: tags.map(tag=>({ tag, kind: tag==='fern'?'character':'tag',count:12,lastWorkKey: works[0].key,activeDays:2 })),works: [works[0]] };
const json = (res, data) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
const server = http.createServer(async (req,res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      const body = chunks.length && req.headers['content-type']!=='image/png' ? JSON.parse(Buffer.concat(chunks)) : {};
      calls.push({path:url.pathname,method:req.method,body});
      if (url.pathname==='/api/client-state') { if(req.method==='POST') state={...state,...body}; return json(res,req.method==='GET'?state:{saved:true}); }
      if (url.pathname==='/api/settings') return json(res,{hasApiKey:true,hasRule34ApiKey:true,sankakuAvailable:true});
      if (url.pathname==='/api/content-preferences') return json(res,{language:'en',aiMode:'all'});
      if (url.pathname==='/api/favorites') return json(res,summary);
      if (url.pathname==='/api/favorite-tags') return json(res,tags);
      if (url.pathname==='/api/favorite-artworks' || url.pathname==='/api/likes') return json(res,works);
      if (url.pathname==='/api/recommendation-tag-preferences') return json(res,{});
      if (['/api/favorite-artwork-groups','/api/hidden-artworks','/api/bookmarks','/api/follows','/api/viewed-identities'].includes(url.pathname)) return json(res,[]);
      if (url.pathname==='/api/search'||url.pathname==='/api/profile') return json(res,{items:works,errors:{},hasMoreSources:[],hasMore:false});
      if (url.pathname==='/api/detail') return json(res,works.find(work=>work.id===url.searchParams.get('id'))||works[0]);
      if (url.pathname==='/api/upscale') return json(res,{component:{state:moduleReady?'ready':'not-installed',installed:moduleReady},preferences:upscalePreferences,cacheBytes:0});
      if (url.pathname==='/api/upscale/preferences') {upscalePreferences={...upscalePreferences,...body};return json(res,upscalePreferences);}
      if (url.pathname==='/api/upscale/jobs') return json(res,{id:String(++jobNumber),state:'completed',scale:Number(url.searchParams.get('scale')),resultUrl:'/api/upscale/jobs/result/image',cached:true});
      if (url.pathname==='/api/upscale/jobs/result/image'||url.pathname==='/api/image') {res.writeHead(200,{'Content-Type':'image/png'});return res.end(pixels);}
      return json(res,{});
    }
    const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end();}
    res.writeHead(200,{'Content-Type':({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream'});res.end(fs.readFileSync(file));
  } catch(error) {serverErrors.push(error.message);res.writeHead(500);res.end();}
});
async function run() {
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  if(process.argv.includes('--serve')){console.log(base);return;}
  const { chromium }=require(process.env.DART_PLAYWRIGHT_PATH||'playwright');
  const browser=await chromium.launch({headless:true,executablePath:process.env.DART_BROWSER_EXE});
  try {
    const page=await browser.newPage({viewport:{width:1700,height:1000}}), errors=[];
    page.setDefaultTimeout(7000);
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base);await page.locator('.favorites-entity-grid img').first().waitFor();
    const origin=page.locator('[aria-label="Collection"]'), category=page.locator('[aria-label="Favorite category"]');
    const a=await origin.boundingBox(),b=await category.boundingBox();
    assert.ok(Math.abs(a.y-b.y)<3 && a.x>b.x+b.width,'Collection belongs at the top right of the filter panel');
    const image=page.locator('.card > .card-art').first(),card=image.locator('..');
    await page.waitForFunction(()=>document.querySelector('.card img')?.naturalWidth>0);
    const before=await image.boundingBox(),cardBefore=await card.boundingBox();await image.hover();
    await page.waitForFunction(()=>getComputedStyle(document.querySelector('.card > .card-art')).transform!=='none');
    await page.waitForTimeout(250);const after=await image.boundingBox(),cardAfter=await card.boundingBox();
    assert.ok(after.width/before.width>1.03&&after.width/before.width<1.04,'Outer frame grows once');
    assert.equal(cardAfter.height,cardBefore.height,'Virtual row geometry remains stable');
    await card.evaluate(node=>node.classList.add('favorite-dragging'));
    await page.waitForTimeout(220);assert.equal(await image.evaluate(node=>getComputedStyle(node).transform),'none','Dragging never scales');
    await card.evaluate(node=>node.classList.remove('favorite-dragging'));
    await image.evaluate(node=>node.classList.add('failed'));
    await page.waitForTimeout(220);assert.equal(await image.evaluate(node=>getComputedStyle(node).transform),'none','Failed previews never scale');
    await image.evaluate(node=>node.classList.remove('failed'));
    await page.emulateMedia({reducedMotion:'reduce'});await page.mouse.move(0,0);await image.hover();
    assert.equal(await image.evaluate(node=>getComputedStyle(node).transform),'none');
    await page.emulateMedia({reducedMotion:'no-preference'});
    for(const theme of ['dark','light','list']) {
      await page.evaluate(value=>document.documentElement.dataset.theme=value,theme);
      assert.equal(await category.locator('.active').evaluate(node=>getComputedStyle(node).borderRadius),'8px');
      assert.notEqual(await category.locator('.active').evaluate(node=>getComputedStyle(node).backgroundColor),await category.locator('button:not(.active)').first().evaluate(node=>getComputedStyle(node).backgroundColor));
    }
    await page.locator('[data-action="favorites-type"][data-value="artwork"]').click();await page.locator('article.card').nth(11).waitFor();
    await page.locator('.card > .card-art').first().click({button:'right'});
    assert.equal(await page.getByRole('menuitem',{name:'Copy image link',exact:true}).count(),0);
    assert.equal(await page.getByRole('menuitem',{name:'Copy all artwork tags',exact:true}).count(),0);
    await page.getByRole('menuitem',{name:'Download image',exact:true}).waitFor();await page.keyboard.press('Escape');
    await page.locator('[data-action="favorites-type"][data-value="tag"]').click();
    await page.setViewportSize({width:700,height:900});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Narrow viewport does not overflow');
    const narrowA=await origin.boundingBox(),narrowB=await category.boundingBox();assert.ok(narrowA.x>=0&&narrowA.x+narrowA.width<=700&&narrowA.y>=narrowB.y);
    await page.getByRole('button',{name:'Settings',exact:true}).click();
    await page.locator('[data-action="settings-section"][data-section="upscale"]').click();
    await page.locator('[data-upscale-auto]').waitFor();assert.equal(await page.locator('[data-upscale-auto]').isChecked(),false);assert.equal(await page.locator('[data-upscale-auto]').isDisabled(),true);
    // The optional processor is a fixture; no module is downloaded or executed.
    moduleReady=true;upscalePreferences={scale:4,auto:true};
    await page.reload();await page.locator('main h1').waitFor();await page.getByRole('button',{name:'Settings',exact:true}).click();
    await page.locator('[data-action="settings-section"][data-section="upscale"]').click();
    await page.locator('[data-upscale-auto]:not(:disabled)').waitFor();assert.equal(await page.locator('[data-upscale-auto]').isChecked(),true);
    await page.locator('[data-upscale-scale="2"]').click();await page.waitForFunction(()=>document.querySelector('[data-upscale-scale="2"]')?.getAttribute('aria-pressed')==='true');
    assert.deepEqual(upscalePreferences,{scale:2,auto:true});
    await page.locator('[data-upscale-auto]').uncheck();await page.waitForFunction(()=>!document.querySelector('[data-upscale-auto]')?.disabled);assert.equal(upscalePreferences.auto,false);
    await page.locator('[data-upscale-auto]').check();await page.waitForFunction(()=>!document.querySelector('[data-upscale-auto]')?.disabled);
    await page.locator('[data-nav="favorites"]').click();await page.locator('[data-action="favorites-type"][data-value="artwork"]').click();
    assert.equal(jobNumber,0,'Feed thumbnails never start auto upscale');
    await page.locator('.card > .card-art').first().hover();await page.keyboard.press('Space');
    await page.locator('#quick-preview[open] .upscale-inline-result').waitFor();assert.equal(jobNumber,1,'Visible Space image auto processes once');
    await page.keyboard.press('u');await page.waitForFunction(()=>!document.querySelector('#quick-preview .upscale-original-suppressed'));
    await page.keyboard.press('u');await page.locator('#quick-preview .upscale-inline-result').waitFor();assert.equal(jobNumber,1,'U comparison reuses the completed result');
    await page.keyboard.press('Escape');
    assert.deepEqual(errors,[]);assert.deepEqual(serverErrors,[]);
    console.log('PASS shared controls: panel layout, outer-frame hover, stable rows, reduced motion, 3 themes, menu, narrow layout');
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
}
run().catch(error=>{console.error(error);server.close();process.exitCode=1;});

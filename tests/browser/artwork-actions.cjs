// Manual browser QA with an isolated native --server-only --data-dir profile.
// Test media and providers are intercepted; persistence uses the real native API.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require(process.env.DART_PLAYWRIGHT_PATH);
const zlib=require('node:zlib');
const root=process.argv[2]||path.resolve(__dirname,'../..'),base=process.env.DART_QA_BACKEND;
assert.match(base||'',/^http:\/\/127\.0\.0\.1:\d+$/,'An explicitly isolated native backend is required');
const works=Array.from({length:6},(_,n)=>{const id=String(n+1);return{key:'danbooru:'+id,source:'danbooru',id,title:'Landscape study '+id,rating:'g',
 thumbnail:'https://cdn.donmai.us/preview/qa-'+id+'.png',images:['https://cdn.donmai.us/qa-'+id+'.png',...(n===0?['https://cdn.donmai.us/qa-'+id+'-2.png']:[])],
 tags:['rain','forest','solo'],allTags:['rain','forest','solo','fern','sample_series','test_artist'],characterTags:[n<4?'fern':'frieren'],
 copyrightTags:['sample_series'],creatorTag:'test_artist',creatorName:'Test Artist',published:'2026-11-02T12:00:00Z'};});
async function api(route,body,method){const response=await fetch(base+route,{method:method||(body?'POST':'GET'),headers:{Origin:base,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 assert.equal(response.ok,true,route+' '+response.status);const text=await response.text();return text?JSON.parse(text):null;}
function png(seed){
 const crc=buffer=>{let value=0xffffffff;for(const byte of buffer){value^=byte;for(let j=0;j<8;j++)value=(value>>>1)^(value&1?0xedb88320:0);}return(value^0xffffffff)>>>0;};
 const chunk=(name,data)=>{const type=Buffer.from(name),length=Buffer.alloc(4),check=Buffer.alloc(4);length.writeUInt32BE(data.length);check.writeUInt32BE(crc(Buffer.concat([type,data])));return Buffer.concat([length,type,data,check]);};
 const header=Buffer.alloc(13);header.writeUInt32BE(64,0);header.writeUInt32BE(64,4);header[8]=8;header[9]=2;
 const bytes=crypto.createHash('sha256').update(seed).digest(),pixels=Buffer.alloc(64*(1+64*3));
 for(let y=0;y<64;y++)for(let x=0;x<64;x++)for(let c=0;c<3;c++)pixels[y*193+1+x*3+c]=bytes[(Math.floor(x/8)+Math.floor(y/8)*8+c*5)%32];
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);
}
let browser,page;const errors=[],calls=[];
(async()=>{try{
 for(const group of await api('/api/favorite-artwork-groups'))await api('/api/favorite-artwork-groups',{ungroupId:group.id});
 for(const item of await api('/api/favorite-artworks'))await api('/api/favorite-artworks',{item,favorite:false});
 for(const item of await api('/api/hidden-artworks'))await api('/api/hidden-artworks',{item,hidden:false});
 for(const item of await api('/api/bookmarks'))await api('/api/bookmarks',item);
 for(const item of works)await api('/api/likes',item,'PUT');
 for(const item of works.slice(0,3))await api('/api/favorite-artworks',{item,favorite:true});
 await api('/api/favorites/activity',works.map(item=>({item})));
 await api('/api/favorite-tags',{tag:'fern',kind:'character',favorite:true});
 await api('/api/favorite-tags',{tag:'rain',kind:'tag',favorite:true});
 await api('/api/recommendation-tag-preferences',{tag:'rain',mode:'priority'});
 await api('/api/client-state',{session:{savedWorksVersion:1,activeIndex:0,tabs:[{kind:'favorites',title:'Favorites',rating:'all',favoriteType:'artwork',favoriteOrigin:'mine'}]}});
 browser=await chromium.launch({headless:true,executablePath:process.env.DART_BROWSER_EXE});
 const context=await browser.newContext({viewport:{width:1920,height:1080},acceptDownloads:true});
 await context.addInitScript(({downloadBytes})=>{window.testCopies=[];window.testDownloads=[];Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>window.testCopies.push({text}),
   write:async items=>{const blob=await items[0].getType('image/png');window.testCopies.push({type:blob.type,size:blob.size});}}});
   // Browser-managed downloads bypass page request interception in Edge. Supply
   // fixture bytes at that boundary; retain/assert the production selected URL.
   const click=HTMLAnchorElement.prototype.click;
   HTMLAnchorElement.prototype.click=function(){if(this.hasAttribute('download')&&this.href.includes('/api/image?')){
     window.testDownloads.push({url:this.href,name:this.download});const blob=new Blob([Uint8Array.from(atob(downloadBytes),c=>c.charCodeAt(0))],{type:'image/png'});
     const url=URL.createObjectURL(blob);this.href=url;setTimeout(()=>URL.revokeObjectURL(url),2000);}
     return click.call(this);};
 },{downloadBytes:png('download-fixture').toString('base64')});
 await context.route('**/*',async route=>{const url=new URL(route.request().url());calls.push(url.pathname);
   const json=value=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(value)});
   if(url.pathname==='/api/image'){
     return route.fulfill({status:200,contentType:'image/png',body:png(url.search)});
   }
   if(url.pathname==='/api/detail')return json(works.find(item=>item.id===url.searchParams.get('id')));
   if(['/api/search','/api/profile'].includes(url.pathname))return json({items:works,errors:{},hasMoreSources:[],hasMore:false,page:0});
   if(url.pathname.startsWith('/api/')){
     const response=await fetch(base+url.pathname+url.search,{method:route.request().method(),headers:{Origin:base,'Content-Type':'application/json'},body:route.request().postData()||undefined});
     return route.fulfill({status:response.status,contentType:response.headers.get('content-type')||'application/json',body:Buffer.from(await response.arrayBuffer())});
   }
   const filename=path.join(root,'wwwroot',url.pathname==='/'?'index.html':url.pathname.slice(1));
   if(!fs.existsSync(filename))return route.fulfill({status:404,body:''});
   return route.fulfill({status:200,contentType:({'.js':'text/javascript','.html':'text/html','.css':'text/css','.svg':'image/svg+xml','.wasm':'application/wasm'})[path.extname(filename)]||'application/octet-stream',body:fs.readFileSync(filename)});
 });
 page=await context.newPage();page.setDefaultTimeout(7000);page.on('pageerror',error=>errors.push(error.message));
 const favoriteCards=()=>page.locator('[data-grid-key="favorites-artworks"] article.card');
 const card=id=>page.locator('[data-grid-key="favorites-artworks"] article[data-work-key="danbooru:'+id+'"]');
 const menu=(name)=>page.getByRole('menuitem',{name,exact:true});
 await page.goto(base+'/');await favoriteCards().nth(2).waitFor();
 assert.equal(await page.locator('[data-action="favorite-artwork"], .favorite-artwork-star, [data-action="favorites-star"]').count(),0);
 const style=await card(2).locator('.card-art[data-action="open"]').evaluate(node=>{const s=getComputedStyle(node);return [s.padding,s.borderWidth,s.borderRadius,s.backgroundColor,s.display];});
 await card(2).locator('button.card-art').click({button:'right'});await menu('Copy image').click();
 await page.waitForFunction(()=>testCopies.some(item=>item.type==='image/png'&&item.size>0));
 await card(2).locator('[data-action="like"]').click();await page.waitForFunction(()=>document.querySelector('article[data-work-key="danbooru:2"] [data-action="like"]')?.getAttribute('aria-pressed')==='false');
 assert.equal((await api('/api/likes')).some(item=>item.key==='danbooru:2'),false);
 await card(2).locator('[data-action="like"]').click();await page.waitForFunction(()=>document.querySelector('article[data-work-key="danbooru:2"] [data-action="like"]')?.getAttribute('aria-pressed')==='true');
 await card(1).dragTo(card(2));await page.waitForFunction(()=>document.querySelectorAll('[data-grid-key="favorites-artworks"] article.card').length===2);
 let groups=await api('/api/favorite-artwork-groups');assert.deepEqual(groups[0].keys,['danbooru:2','danbooru:1']);
 assert.equal(await card(2).locator('.favorite-group-badge').textContent(),'▤ 2');
 await page.reload();await card(2).waitFor();assert.equal(await favoriteCards().count(),2);
 const tabCount=await page.locator('[role="tab"]').count();await card(2).locator('button.card-art').click({button:'middle'});
 await page.waitForFunction(count=>document.querySelectorAll('[role="tab"]').length>count,tabCount);assert.equal(await page.evaluate(()=>currentTab()?.kind),'favorites');
 await card(2).locator('button.card-art').hover();await page.keyboard.press('Space');
 await page.locator('#quick-preview[open]').waitFor();await page.waitForFunction(()=>quickPreviewWork?.key==='danbooru:2');
 await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>quickPreviewWork?.key==='danbooru:1');
 await page.keyboard.press('b');await page.waitForFunction(()=>bookmarks.some(item=>item.key==='danbooru:1'));
 assert.equal((await api('/api/bookmarks')).some(item=>item.key==='danbooru:1'),true);
 assert.equal(await page.locator('#quick-preview [data-action="artwork-more"]').count(),1);
 await page.locator('#quick-preview [data-action="artwork-more"]').click();await page.keyboard.press('Escape');
 assert.equal(await page.locator('#quick-preview').evaluate(node=>node.open),true,'Escape closes the menu before the viewer');
 await page.locator('#quick-preview [data-action="artwork-more"]').click();await menu('Copy image').click();
 await page.waitForFunction(()=>testCopies.some(item=>item.type==='image/png'&&item.size>0));
 await page.locator('#quick-preview [data-action="artwork-more"]').click();await menu('Copy artwork link').click();
 await page.waitForFunction(()=>testCopies.some(item=>item.text==='https://danbooru.donmai.us/posts/1'));
 await page.keyboard.press('Escape');await page.locator('#quick-preview').waitFor({state:'hidden'});
 await card(2).locator('.card-artist').click({button:'right'});await menu('Copy author tag').waitFor();await page.keyboard.press('Escape');
 await card(2).click({button:'right'});await menu('Group with another Favorite').click();
 await page.getByRole('dialog').getByPlaceholder('Find a favorite artwork').fill('missing-title');await page.getByText('No matching favorite artworks.',{exact:true}).waitFor();
 await page.getByRole('dialog').getByPlaceholder('Find a favorite artwork').fill('3');
 await page.getByRole('dialog').getByRole('button',{name:'Landscape study 3',exact:true}).click();
 await page.waitForFunction(()=>document.querySelectorAll('[data-grid-key="favorites-artworks"] article.card').length===1);
 groups=await api('/api/favorite-artwork-groups');assert.deepEqual(groups[0].keys,['danbooru:3','danbooru:2','danbooru:1']);
 await card(3).locator('button.card-art').click();await page.locator('.detail-meta h1').waitFor();
 await page.waitForFunction(()=>!currentTab().detailLoading&&!currentTab().relatedLoading&&!currentTab().creatorLoading&&document.querySelector('.detail-image img')?.naturalWidth>0);
 assert.equal(await page.locator('.favorite-group-strip article.card').count(),3);
 assert.equal(await page.locator('.detail-actions .artwork-more-button').count(),1);
 assert.equal(await page.locator('.detail-actions [data-action="favorite-artwork"]').count(),0);
 await page.locator('.detail-image img').first().click();await page.locator('#quick-preview.fullscreen[open]').waitFor();await page.keyboard.press('Escape');
 await page.locator('.tag-link[data-query="fern"]').click({button:'right'});await menu('Copy tag').click();
 await page.waitForFunction(()=>testCopies.some(item=>item.text==='fern'));
 await page.locator('.detail-actions .artwork-more-button').click();
 assert.equal(await menu('Copy image link').count(),0);assert.equal(await menu('Copy all artwork tags').count(),0);
 await page.keyboard.press('Escape');
 await page.locator('.tag-link[data-query="fern"]').click({button:'right'});await menu('Copy').click();
 await page.waitForFunction(()=>testCopies.some(item=>item.text?.includes('test_artist,')&&item.text.includes('fern')));
 await page.locator('.detail-actions .artwork-more-button').click();const downloadPromise=page.waitForEvent('download');await menu('Download image').click();
 const download=await downloadPromise;assert.equal(download.suggestedFilename(),'DART-danbooru-3.png');assert.ok(fs.statSync(await download.path()).size>0);
 assert.equal(await page.evaluate(()=>new URL(testDownloads[0].url).searchParams.get('url')),'https://cdn.donmai.us/qa-3.png');
 await page.getByRole('button',{name:'Ungroup artworks',exact:true}).click();
 await page.waitForFunction(()=>!document.querySelector('.favorite-group-strip'));
 assert.equal((await api('/api/favorite-artwork-groups')).length,0);
 await page.locator('.detail-actions .artwork-more-button').click();assert.equal(await menu('Ungroup artworks').count(),0);
 await menu('Group with another Favorite').click();await page.getByRole('dialog').getByRole('button',{name:'Landscape study 1',exact:true}).click();
 await page.waitForFunction(()=>document.querySelectorAll('.favorite-group-strip article.card').length===2);
 assert.equal(await page.locator('.detail-meta h1').textContent(),'Landscape study 3');
 assert.deepEqual(await page.evaluate(()=>currentTab().artworkRoute.engine.items.map(item=>item.key)),['danbooru:1','danbooru:3']);
 await page.getByRole('button',{name:'Ungroup artworks',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.favorite-group-strip'));
 await page.locator('[data-nav="favorites"]').click();await page.locator('[data-action="favorites-type"][data-value="artwork"]').click();await card(3).waitFor();
 await favoriteCards().nth(2).waitFor();
 assert.equal((await api('/api/favorite-artwork-groups')).length,0);assert.equal((await api('/api/favorite-artworks')).length,3);
 await card(1).locator('button.card-art').click({button:'right'});await menu('Don’t show this artwork again').click();
 await page.waitForFunction(()=>document.querySelectorAll('[data-grid-key="favorites-artworks"] article.card').length===2);
 assert.equal((await api('/api/hidden-artworks')).length,1);assert.equal((await api('/api/favorite-artworks')).length,3);
 await page.locator('#settings-button').click();await page.locator('#settings-tab-content').click();
 await page.locator('[data-hidden-artworks] summary').click();await page.getByRole('button',{name:'Show again',exact:true}).click();
 assert.equal((await api('/api/hidden-artworks')).length,0);
 await page.locator('[data-nav="favorites"]').click();await page.locator('[data-action="favorites-type"][data-value="character"]').click();
 await page.locator('[data-action="favorites-origin"][data-value="system"]').click();await page.locator('.favorites-entity-grid article.card').first().waitFor();
 assert.ok((await page.locator('.favorite-entity-stats').first().textContent()).includes('liked artworks'));
 await page.locator('[data-nav="likes"]').click();await page.locator('article.card').nth(5).waitFor();
 const normalStyle=await page.locator('article.card button.card-art').first().evaluate(node=>{const s=getComputedStyle(node);return[s.padding,s.borderWidth,s.borderRadius,s.backgroundColor,s.display];});
 assert.deepEqual(style,normalStyle,'Favorites and normal catalog use the same card styles');
 await page.locator('[data-nav="favorites"]').click();await page.locator('[data-action="favorites-type"][data-value="artwork"]').click();
 for(const theme of ['light','list']){
   await page.locator('#settings-button').click();await page.locator('#settings-tab-appearance').click();await page.locator('[data-theme-choice="'+theme+'"]').click();
   await page.locator('[data-nav="favorites"]').click();await page.locator('[data-action="favorites-type"][data-value="artwork"]').click();
   assert.equal(await page.locator('html').getAttribute('data-theme'),theme);assert.equal(await favoriteCards().count(),3);
 }
 if(process.env.DART_QA_SCREENSHOT)await page.screenshot({path:process.env.DART_QA_SCREENSHOT});
 await page.setViewportSize({width:700,height:900});await favoriteCards().first().waitFor();
 assert.equal(await page.locator('main').evaluate(node=>node.scrollWidth>node.clientWidth+1),false,'Favorites must fit narrow screens');
 assert.deepEqual(errors,[]);await context.close();
 console.log('PASS Favorites/catalog parity: native drag/drop persistence, group merge/ungroup, finite Space reader/arrows, modal menu, PNG copying, stable links/tags, selected download, author precedence, persistent hide/restore, recommendation signals, standard styles and narrow layout.');
}catch(error){if(page)console.error(JSON.stringify({errors,ui:await page.evaluate(()=>({kind:currentTab()?.kind,menuHidden:document.querySelector('.recommendation-tag-menu')?.hidden,menu:document.querySelector('.recommendation-tag-menu')?.textContent,summary:[...document.querySelectorAll('summary')].map(node=>node.textContent)}))}));throw error;
}finally{await browser?.close();}})().catch(error=>{console.error(error);process.exitCode=1;});

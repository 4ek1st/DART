// Real rendered frontend, neutral SVG media and an isolated synthetic profile.
// --compare-ref pins coherent frontend bytes; --expect-regression proves no
// tooltip, --expect-current-art-regression reproduces the old self-preview.
'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),crypto=require('node:crypto'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.DART_PLAYWRIGHT_PATH||'playwright');
const root=path.resolve(__dirname,'../..'),web=path.join(root,'wwwroot');
const refAt=process.argv.indexOf('--compare-ref'),ref=refAt<0?'':process.argv[refAt+1];
const pinned=new Map();
for(const name of ['index.html','app.js','tag-preview.js','tag-preview.css']){
 try{pinned.set(name,ref?cp.execFileSync('git',['show',ref+':wwwroot/'+name],{cwd:root,stdio:['ignore','pipe','ignore']}):fs.readFileSync(path.join(web,name)));}
 catch(error){if(!ref||name==='index.html'||name==='app.js')throw error;}
}
const output=process.env.DART_QA_OUTPUT||path.join(os.tmpdir(),'DART-tag-hover-'+crypto.randomUUID());
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const make=(id,tags,extra={})=>({key:'danbooru:'+id,source:'danbooru',id:String(id),title:'Neutral geometric landscape '+id,
 rating:'g',creatorTag:'fixture_artist_'+id,tags,characterTags:[],thumbnail:'https://example.test/neutral-'+id+'.svg',
 images:['https://example.test/original-'+id+'.svg'],published:'2026-11-05T10:00:00Z',...extra});
const seen=make(20,['seen_tag']),dated=make(21,['history_tag']);
const seeds=Array.from({length:3},(_,i)=>make(701+i,['recommendation_topic','fixture_character'],{characterTags:['fixture_character']}));
const loaded=make(11,['unseen_tag']);
const home=[loaded,...Array.from({length:47},(_,i)=>make(1000+i,['woodland_scene']))];
const favoriteTags=['seen_tag','unseen_tag','leave_fast','fallback_a','fallback_b','cache_tag','filtered_tag','history_tag','empty_tag','excluded_tag'];
const hidden=make(52,['filtered_tag']);
const samples={unseen_tag:[make(400,['unseen_tag_gloves']),make(401,['unseen_tag']),make(402,['unseen_tag'])],
 fallback_a:[make(101,['fallback_a'])],fallback_b:[make(102,['fallback_b'])],cache_tag:[make(103,['cache_tag']),make(105,['cache_tag'])],
 filtered_tag:[make(49,['filtered_tag'],{rating:'e'}),make(50,['filtered_tag'],{creatorTag:'blocked_artist'}),hidden,make(53,['filtered_tag'])],
 empty_tag:[]};
const currentLeaf={...samples.cache_tag[0],contentHash:'a'.repeat(32),tags:['cache_tag','detail_choice','fern','blue_eyes','search_character'],characterTags:['fern','search_character']};
const currentVersion=make(1201,['detail_choice'],{creatorTag:currentLeaf.creatorTag,groupKey:'danbooru:parent:103',contentHash:'b'.repeat(32)});
const currentMirror=make(1301,['detail_choice'],{key:'rule34:1301',source:'rule34',creatorTag:currentLeaf.creatorTag,contentHash:'a'.repeat(32),thumbnail:currentLeaf.thumbnail,images:currentLeaf.images});
const lateViewedExclusions=[currentVersion,currentMirror];
const viewedAlternatives=[make(1320,['detail_choice']),
 make(1401,['fern'],{characterTags:['fern','other_character']}),make(1402,['fern'],{characterTags:['fern']}),
 make(1451,['blue_eyes','portrait']),make(1452,['blue_eyes','eye_focus'])];
const currentDetail={...currentLeaf,groupKey:'danbooru:parent:103',groupCount:2,
 images:[...currentLeaf.images,...currentVersion.images],memberKeys:[currentLeaf.key,currentVersion.key],
 groupMembers:[currentLeaf,currentVersion],imageRecords:[{url:currentLeaf.images[0],hash:currentLeaf.contentHash,owner:currentLeaf.key},
  {url:currentVersion.images[0],hash:currentVersion.contentHash,owner:currentVersion.key}]};
// The real listing is already complete, so opening it legitimately skips a
// redundant detail fetch. Supply its grouped/typed metadata at that boundary.
samples.cache_tag[0]=currentDetail;
samples.detail_choice=[currentDetail,currentVersion,currentMirror,make(1321,['detail_choice'])];
samples.fern=[currentDetail,make(1403,['fern'],{characterTags:['fern','other_character']}),make(1404,['fern'],{characterTags:['fern']})];
samples.blue_eyes=[currentDetail,make(1453,['blue_eyes','portrait']),make(1454,['blue_eyes','eye_focus'])];
samples.search_character=[currentDetail,make(1501,['search_character'],{characterTags:['search_character','other_character']}),make(1502,['search_character'],{characterTags:['search_character']})];
let client={recent:[...viewedAlternatives,seen],session:{savedWorksVersion:1,activeIndex:0,tabs:[{kind:'home',title:'Home',rating:'general',selectedSources:['danbooru']}]}};
const known=new Map([...home,seen,dated,...seeds,...Object.values(samples).flat(),...viewedAlternatives,...lateViewedExclusions,currentDetail].map(item=>[item.key,item]));
const report={revision:ref||'working-tree',viewport:'2560x1440',checks:[],failures:[],errors:[],requests:[],observations:[],sources:Object.fromEntries([...pinned].map(([name,bytes])=>[name,crypto.createHash('sha256').update(bytes).digest('hex')]))};
const check=(condition,label,data={})=>{report.checks.push(label);if(!condition)report.failures.push({label,...data});};
const json=(res,value)=>{if(!res.destroyed){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(value));}};
const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost'),chunks=[];for await(const chunk of req)chunks.push(chunk);
 const body=chunks.length?JSON.parse(Buffer.concat(chunks)):{};
 if(url.pathname.startsWith('/api/')){
  report.requests.push({path:url.pathname,method:req.method,q:url.searchParams.get('q'),rating:url.searchParams.get('rating'),url:url.searchParams.get('url'),id:url.searchParams.get('id'),source:url.searchParams.get('source')});
  if(url.pathname==='/api/client-state'){if(req.method==='POST')client={...client,...body};return json(res,req.method==='GET'?client:{saved:true});}
  if(url.pathname==='/api/settings')return json(res,{hasApiKey:true,hasRule34ApiKey:true,sankakuAvailable:true});
  if(url.pathname==='/api/content-preferences')return json(res,{language:'en',aiMode:'all',hideViewedAndSaved:true,excludedTags:['excluded_tag'],hiddenAuthors:[{source:'artist',artistId:'blocked_artist',name:'Blocked Artist'}]});
  if(url.pathname==='/api/recommendation-tag-preferences')return json(res,{preferences:{},initialized:true});
  if(url.pathname==='/api/favorite-tags')return json(res,favoriteTags);
  if(url.pathname==='/api/hidden-artworks')return json(res,[hidden]);
  if(url.pathname==='/api/viewed-identities')return json(res,req.method==='GET'?[...viewedAlternatives,seen].map(item=>'key:'+item.key):{});
  if(url.pathname==='/api/likes')return json(res,seeds);
  if(['/api/bookmarks','/api/favorite-artworks','/api/favorite-artwork-groups','/api/follows'].includes(url.pathname))return json(res,[]);
  if(url.pathname==='/api/favorites')return json(res,{totalWorks:1,kinds:{},entries:[{tag:'history_tag',kind:'tag',count:1,lastWorkKey:dated.key}],works:[dated]});
  if(url.pathname==='/api/tags')return json(res,[{name:'cache_tag',count:12,sources:['danbooru']}]);
  if(url.pathname==='/api/detail')return json(res,known.get(url.searchParams.get('source')+':'+url.searchParams.get('id'))||home[0]);
  if(url.pathname==='/api/search'||url.pathname==='/api/profile'){
   const tag=url.searchParams.get('q')||'';
   if(tag==='fallback_a')await wait(900);else if(tag)await wait(65);
   return json(res,{items:tag?(samples[tag]||[make(104,[tag])]):home,errors:{},hasMore:false,hasMoreSources:[]});
  }
  if(url.pathname==='/api/image'){
   const id=Number((url.searchParams.get('url')||'').match(/(?:neutral|original)-(\d+)/)?.[1]||1);
   if(id===101)await wait(200);else await wait(12);
   if(!res.destroyed){res.writeHead(200,{'Content-Type':'image/svg+xml'});res.end(`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="192"><rect width="256" height="192" fill="rgb(${id&255},${id>>>8&255},137)"/></svg>`);}return;
  }
  return json(res,{});
 }
 const name=url.pathname.slice(1)||'index.html';
 if(pinned.has(name)){res.writeHead(200,{'Content-Type':name.endsWith('.html')?'text/html':name.endsWith('.css')?'text/css':'text/javascript'});return res.end(pinned.get(name));}
 const file=path.resolve(web,name);if(!file.startsWith(web+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end();}
 res.writeHead(200,{'Content-Type':({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.wasm':'application/wasm'})[path.extname(file)]||'application/octet-stream'});res.end(fs.readFileSync(file));
}catch(error){report.errors.push('Server: '+error.message);if(!res.destroyed){res.writeHead(500);res.end();}}});
let browser,page;
(async()=>{fs.mkdirSync(output,{recursive:true});try{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({headless:true,executablePath:process.env.DART_BROWSER_EXE});
 page=await browser.newPage({viewport:{width:2560,height:1440},colorScheme:'dark'});page.setDefaultTimeout(9000);page.on('pageerror',error=>report.errors.push(error.message));
 const frames=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const chip=tag=>page.locator('.favorite-tags .tag-chip[data-query="'+tag+'"]');
 const searches=tag=>report.requests.filter(entry=>entry.path==='/api/search'&&entry.q===tag).length;
 const tip=page.locator('.tag-hover-preview');
 const blank=async()=>{await page.mouse.move(15,200);await frames();};
 const click=async locator=>{await locator.scrollIntoViewIfNeeded();await frames();await locator.click();};
 const hiddenTip=async label=>{await frames();check(!await tip.isVisible(),label);};
 const inspect=async(label,tag,id,origin)=>{
  await page.waitForFunction(({tag,id,origin})=>{const box=document.querySelector('.tag-hover-preview'),image=box?.querySelector('[data-tag-preview-image]');if(!box||box.hidden||!box.classList.contains('ready')||box.dataset.tag!==tag||box.dataset.origin!==origin||!image?.naturalWidth)return false;try{const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,1,1);const pixel=ctx.getImageData(0,0,1,1).data;return pixel[0]===(id&255)&&pixel[1]===(id>>>8&255)&&pixel[2]===137;}catch{return false;}},{tag,id,origin});
  const value=await tip.evaluate(box=>{const image=box.querySelector('[data-tag-preview-image]'),canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,1,1);const r=box.getBoundingClientRect();return{tag:box.dataset.tag,origin:box.dataset.origin,label:box.querySelector('[data-tag-preview-label]')?.textContent,state:box.querySelector('[data-tag-preview-state]')?.textContent,pixel:[...ctx.getImageData(0,0,1,1).data],pointer:getComputedStyle(box).pointerEvents,rect:{left:r.left,top:r.top,right:r.right,bottom:r.bottom},viewport:{width:innerWidth,height:innerHeight}};});
  report.observations.push({stage:label,...value});check(value.tag===tag,label+':tag');check(value.origin===origin,label+':origin');check(value.label.includes(tag.replaceAll('_',' '))||value.label.includes(tag),label+':label');
  check(JSON.stringify(value.pixel)===JSON.stringify([id&255,id>>>8&255,137,255]),label+':native-pixels',{pixel:value.pixel,id});check(value.pointer==='none',label+':no-pointer-stealing');
  check(value.rect.left>=0&&value.rect.top>=0&&value.rect.right<=value.viewport.width&&value.rect.bottom<=value.viewport.height,label+':fits-viewport',value.rect);
 };
 await page.goto('http://127.0.0.1:'+server.address().port+'/');await chip('seen_tag').waitFor();await page.waitForFunction(()=>!currentTab().loading);
 await blank();await wait(200);const writesBefore=report.requests.filter(entry=>entry.method!=='GET'&&entry.path!=='/api/client-state').length;
 await chip('seen_tag').hover();await wait(900);
 if(process.argv.includes('--expect-regression')){const missing=!await tip.isVisible();check(missing,'baseline-no-hover-preview');assert(missing,'Old frontend must reproduce the missing hover preview');console.log('Baseline absent-preview behavior reproduced');return;}
 await inspect('viewed-priority','seen_tag',20,'viewed');check(searches('seen_tag')===0,'viewed-priority:no-search');
 check(await page.locator('html').getAttribute('data-theme')==='dark','dark-theme:system-setting');
 await wait(180);await page.screenshot({path:path.join(output,'neutral-tag-preview-dark-1440p.png')});
 await page.evaluate(()=>render());await inspect('ready-survives-same-page-render','seen_tag',20,'viewed');check(searches('seen_tag')===0,'same-page-render:no-source-read');
 await blank();await chip('seen_tag').hover();await wait(120);await page.evaluate(()=>render());await inspect('pending-survives-same-page-render','seen_tag',20,'viewed');
 await blank();await hiddenTip('pointer-leave:hides');
 await chip('leave_fast').hover();await wait(75);await blank();await wait(400);check(searches('leave_fast')===0,'leave-before-delay:no-search');
 await chip('unseen_tag').hover();await inspect('unseen-index-does-not-win','unseen_tag',401,'search');check(searches('unseen_tag')===1,'fallback:single-search');
 const request=report.requests.find(entry=>entry.path==='/api/search'&&entry.q==='unseen_tag');check(request.rating==='general','fallback:current-rating');
 await blank();await chip('filtered_tag').hover();await inspect('filters-first-eligible','filtered_tag',53,'search');
 await blank();await chip('history_tag').hover();await inspect('dated-history-priority','history_tag',21,'viewed');check(searches('history_tag')===0,'dated-history:no-search');
 await blank();await chip('fallback_a').hover();await wait(390);check(searches('fallback_a')===1,'race:A-started');
 check((await tip.locator('[data-tag-preview-state]').textContent()).includes('Loading'),'loading:caption-shown');
 await chip('fallback_b').hover();await inspect('race-B','fallback_b',102,'search');await wait(1000);await inspect('race-B-stays','fallback_b',102,'search');
 await blank();await chip('cache_tag').hover();await inspect('cached-first','cache_tag',103,'search');const cacheCalls=searches('cache_tag');
 await blank();await chip('cache_tag').hover();await inspect('cached-repeat','cache_tag',103,'search');check(searches('cache_tag')===cacheCalls,'cache:no-second-search');
 await blank();await chip('empty_tag').hover();await page.waitForFunction(()=>document.querySelector('.tag-hover-preview')?.querySelector('[data-tag-preview-state]')?.textContent==='No preview available');
 check(await tip.locator('[data-tag-preview-image]').getAttribute('src')===null,'empty:no-stale-image');const emptyCalls=searches('empty_tag');
 await blank();await chip('empty_tag').hover();await wait(500);check(searches('empty_tag')===emptyCalls,'empty:short-negative-cache');
 await blank();await chip('excluded_tag').hover();await wait(500);await hiddenTip('excluded-tag:no-preview');check(searches('excluded_tag')===0,'excluded-tag:no-search');
 const keyBefore=await page.evaluate(()=>currentTab().id);const writesAfter=report.requests.filter(entry=>entry.method!=='GET'&&entry.path!=='/api/client-state').length;
 check(writesBefore===writesAfter,'hover:no-history-library-or-favorite-writes',{writesBefore,writesAfter});check(await page.evaluate(()=>currentTab().kind)==='home','hover:no-navigation');
 await blank();await chip('cache_tag').evaluate(node=>{node.title='Fixture native title';node.setAttribute('aria-describedby','existing-description');});
 await chip('cache_tag').hover();await inspect('title-aria-active','cache_tag',103,'search');
 check(await chip('cache_tag').getAttribute('title')===null,'active:native-title-suppressed');await blank();
 check(await chip('cache_tag').getAttribute('title')==='Fixture native title','native-title-restored');check(await chip('cache_tag').getAttribute('aria-describedby')==='existing-description','aria-description-restored');
 await chip('fallback_b').focus();await page.keyboard.press('Tab');await inspect('keyboard-tab','cache_tag',103,'search');
 await page.keyboard.press('Escape');await hiddenTip('Escape:hides');check(await page.evaluate(()=>document.activeElement?.dataset.query)==='cache_tag','Escape:focus-retained');
 await blank();await chip('cache_tag').hover();await inspect('before-contextmenu','cache_tag',103,'search');await chip('cache_tag').click({button:'right'});
 check(await page.locator('.recommendation-tag-menu').isVisible(),'right-click:menu-opens');await hiddenTip('right-click:preview-hides');await page.keyboard.press('Escape');await blank();
 await chip('cache_tag').hover();await inspect('before-scroll','cache_tag',103,'search');await page.locator('main').evaluate(node=>{node.scrollTop=200;});await hiddenTip('scroll:hides');
  await blank();await chip('cache_tag').scrollIntoViewIfNeeded();await frames();await chip('cache_tag').hover();await inspect('before-resize','cache_tag',103,'search');await page.setViewportSize({width:700,height:900});await hiddenTip('resize:hides');
 await click(page.locator('#settings-button'));await click(page.locator('#settings-tab-appearance'));await click(page.locator('[data-theme-choice="light"]'));
 check(await page.locator('html').getAttribute('data-theme')==='light','light-theme:actual-setting');await click(page.locator('#brand-button'));await chip('cache_tag').waitFor();await page.waitForFunction(()=>!currentTab().loading);
 await blank();await page.emulateMedia({reducedMotion:'reduce'});await chip('cache_tag').scrollIntoViewIfNeeded();await frames();await chip('cache_tag').hover();await inspect('narrow-reduced-motion','cache_tag',103,'search');
 await page.screenshot({path:path.join(output,'neutral-tag-preview-light-700.png')});
 const motion=await tip.evaluate(box=>({animation:getComputedStyle(box).animationName,animationDuration:getComputedStyle(box).animationDuration,transition:getComputedStyle(box.querySelector('img')).transitionDuration}));
 check((motion.animation==='none'||parseFloat(motion.animationDuration)<=0.01)&&parseFloat(motion.transition)<=0.01,'reduced-motion:no-animation',motion);
 check(await page.evaluate(()=>main.scrollWidth<=main.clientWidth+1),'narrow:no-main-overflow');await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await hiddenTip('blur:hides');
  await blank();await chip('cache_tag').hover();await inspect('before-click','cache_tag',103,'search');await chip('cache_tag').click();await page.waitForFunction(()=>currentTab().kind==='search'&&currentTab().query==='cache_tag');
 check(await page.evaluate(()=>currentTab().id)!==keyBefore,'tag-click:navigates');await hiddenTip('tag-click:preview-hides');
 await page.setViewportSize({width:2560,height:1440});await frames();
 report.observations.push({stage:'search-before-opening-detail',...await page.evaluate(()=>({cards:[...main.querySelectorAll('article.card[data-work-key]')].map(node=>node.dataset.workKey),
  items:currentTab().items.map(item=>({key:item.key,known:CatalogLogic.workHistoryTokens(item).some(token=>viewedTokens.has(token)||viewedPending.has(token))}))}))});
 await click(page.locator('article.card[data-work-key="danbooru:103"] button.card-art'));await page.waitForFunction(()=>currentTab()?.kind==='detail'&&!currentTab().detailLoading);
 report.observations.push({stage:'opened-detail-metadata',...await page.evaluate(()=>({item:{key:currentTab().item.key,id:currentTab().item.id,tags:currentTab().item.tags,characters:currentTab().item.characterTags,members:currentTab().item.memberKeys},error:currentTab().detailError}))});
 await page.locator('.tag-link[data-query="fern"]').waitFor();
 // A previously seen mirror would correctly hide this discovery card before
 // opening. Add neutral historical mirror/version evidence only after entry.
 await page.evaluate(items=>{for(const item of items){rememberItem(item);for(const token of CatalogLogic.workHistoryTokens(item))viewedTokens.add(token);}
  recent=[recent[0],...items,...recent.slice(1)];},lateViewedExclusions);
 const detailTag=page.locator('.tag-link[data-query="cache_tag"]');await detailTag.scrollIntoViewIfNeeded();await frames();await blank();const detailHint=await detailTag.getAttribute('title');
 await detailTag.hover();
 if(process.argv.includes('--expect-current-art-regression')){
  await inspect('baseline-current-art-repeated','cache_tag',103,'viewed');check(true,'baseline:opened-artwork-repeated');assert.equal(report.failures.length,0,'Baseline must isolate the self-preview behavior');return;
 }
 await inspect('detail-tag-uses-other-search-example','cache_tag',105,'search');await page.evaluate(()=>render());await frames();await inspect('detail-render-origin','cache_tag',105,'search');
 check(await detailTag.getAttribute('title')===null,'detail-render:native-title-suppressed');
 check((await detailTag.getAttribute('aria-describedby')||'').split(/\s+/).includes('tag-hover-preview'),'detail-render:tooltip-description-retained');
 await blank();check(await detailTag.getAttribute('title')===detailHint,'detail-render:native-hint-restored');
 await detailTag.hover();await wait(120);await page.evaluate(()=>render());await inspect('detail-pending-render-origin','cache_tag',105,'search');
 check(await detailTag.getAttribute('title')===null,'detail-pending-render:native-title-suppressed');await blank();
 for(const [tag,id,origin,label] of [['detail_choice',1320,'viewed','detail-excludes-group-versions-and-hash-mirrors'],
   ['fern',1402,'viewed','representative-character-prefers-solo'],['blue_eyes',1452,'viewed','representative-content-prefers-focus'],
   ['search_character',1502,'search','representative-search-prefers-solo']]){
  const control=page.locator('.tag-link[data-query="'+tag+'"]');await control.scrollIntoViewIfNeeded();await frames();await blank();
  // Detail's normal related-work queries may share the tag. Count hover's
  // additional requests only, after those ordinary detail tasks have settled.
  const callsBefore=searches(tag),writesBefore=report.requests.filter(entry=>entry.method!=='GET'&&entry.path!=='/api/client-state').length,detailId=await page.evaluate(()=>currentTab().id);
  await control.hover();await inspect(label,tag,id,origin);
  if(origin==='viewed')check(searches(tag)===callsBefore,label+':no-hover-search');
  check(writesBefore===report.requests.filter(entry=>entry.method!=='GET'&&entry.path!=='/api/client-state').length,label+':no-hover-writes');
  check(await page.evaluate(()=>currentTab().id)===detailId,label+':no-navigation');
 }
 await page.screenshot({path:path.join(output,'neutral-tag-preview-representative.png')});
 await click(page.locator('[data-nav="favorites"]'));await click(page.locator('[data-action="favorites-type"][data-value="tag"]'));await page.waitForFunction(()=>!currentTab().favoriteLoading);
 const favoriteTag=page.locator('.favorite-entity [data-context-tag="seen_tag"], .favorite-entity .favorite-tag-button[data-tag="seen_tag"]').first();
 await favoriteTag.scrollIntoViewIfNeeded();await frames();await blank();await favoriteTag.hover();await inspect('Favorites-tag-origin','seen_tag',20,'viewed');
 await click(page.locator('[data-nav="recommendations"]'));const recommended=page.locator('[data-recommendation-tag][data-query="fixture_character"]').first();await recommended.waitFor();await page.waitForFunction(()=>!currentTab().loading);
 await recommended.scrollIntoViewIfNeeded();await frames();await blank();await recommended.hover();await inspect('recommendation-tag-origin','fixture_character',701,'viewed');
 await page.locator('#search-input').fill('cache');const suggestion=page.locator('.tag-suggestion[data-tag="cache_tag"]');await suggestion.waitFor();await blank();await suggestion.hover();await inspect('autocomplete-tag-origin','cache_tag',103,'viewed');
 await page.screenshot({path:path.join(output,'neutral-tag-preview-autocomplete.png')});
 await click(page.locator('#brand-button'));await chip('seen_tag').waitFor();await page.waitForFunction(()=>!currentTab().loading);
 for(const [language,viewedCaption,emptyCaption] of [['ru','Уже просмотренное','Нет доступного превью'],['de','Bereits angesehen','Keine Vorschau verfügbar']]){
  await blank();await page.evaluate(language=>DartI18n.setLanguage(language,false),language);
  await chip('seen_tag').hover();await inspect('localized-'+language,'seen_tag',20,'viewed');
  check(await tip.locator('[data-tag-preview-state]').textContent()===viewedCaption,'locale-'+language+':viewed-caption');
  check(await tip.locator('[data-tag-preview-label]').textContent()==='#seen tag','locale-'+language+':tag-label-unchanged');
  await blank();await chip('empty_tag').hover();await page.waitForFunction(expected=>document.querySelector('.tag-hover-preview')?.querySelector('[data-tag-preview-state]')?.textContent===expected,emptyCaption);
  check(await tip.locator('[data-tag-preview-state]').textContent()===emptyCaption,'locale-'+language+':empty-caption');
 }
 await blank();await page.evaluate(()=>DartI18n.setLanguage('en',false));
 // A non-abortable decoder must not leave a tooltip loading forever. The
 // standalone injected controller uses no production state or API writes.
 await page.evaluate(()=>{
  tagPreviewController.instance.dispose();
  const trigger=document.createElement('button');trigger.dataset.fixtureHover='';trigger.textContent='Timeout fixture';trigger.title='Original timeout title';trigger.setAttribute('aria-describedby','original-timeout-description');
  trigger.style.cssText='position:fixed;right:20px;bottom:20px;z-index:10000';document.body.append(trigger);
  window.__timeoutReleases=0;
  window.__timeoutController=DartTagPreview.create({document,selector:'[data-fixture-hover]',getTag:()=>'<b>neutral</b>',getScope:()=>({key:'timeout-fixture',rating:'all'}),
   resolver:{resolve:async()=>({item:{},origin:'search'}),clear(){}},delay:0,timeout:40,
   loadImage:()=>new Promise(resolve=>{window.__resolveTimeoutImage=resolve;})});
 });
 await page.locator('[data-fixture-hover]').hover();await page.waitForFunction(()=>typeof window.__resolveTimeoutImage==='function');await wait(130);
 check(await tip.locator('[data-tag-preview-state]').textContent()==='No preview available','timeout:bounded-empty-state');
 check(!await tip.evaluate(box=>box.classList.contains('ready')),'timeout:no-ready-image');
 check(await tip.locator('[data-tag-preview-label]').evaluate(node=>node.childElementCount===0&&node.textContent.includes('<b>neutral</b>')),'label:literal-text-no-html');
 await page.evaluate(()=>window.__resolveTimeoutImage({url:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"/>',release:()=>{window.__timeoutReleases++;}}));await wait(100);
 check(await tip.locator('[data-tag-preview-state]').textContent()==='No preview available'&&!await tip.evaluate(box=>box.classList.contains('ready')),'timeout:late-image-cannot-reopen');
 check(await page.evaluate(()=>window.__timeoutReleases)===1,'timeout:late-pin-released');
 await page.evaluate(()=>window.__timeoutController.dispose());
 check(await page.locator('[data-fixture-hover]').getAttribute('title')==='Original timeout title','dispose:native-title-restored');
 check(await page.locator('[data-fixture-hover]').getAttribute('aria-describedby')==='original-timeout-description','dispose:aria-description-restored');
 check(await tip.count()===0,'dispose:tooltip-removed');check(report.errors.length===0,'no-browser-server-errors',{errors:report.errors});
}catch(error){report.exception=error.stack;
 try{report.lastState=await page.evaluate(()=>{const box=document.querySelector('.tag-hover-preview'),image=box?.querySelector('img');return{kind:currentTab()?.kind,rating:currentTab()?.rating,loading:currentTab()?.loading,tag:box?.dataset.tag,origin:box?.dataset.origin,hidden:box?.hidden,ready:box?.classList.contains('ready'),state:box?.querySelector('[data-tag-preview-state]')?.textContent,src:image?.src,naturalWidth:image?.naturalWidth,focused:document.activeElement?.dataset.tag};});}catch{}
 throw error;}finally{
 await browser?.close();await new Promise(resolve=>server.close(resolve));fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({checks:report.checks.length,failures:report.failures,errors:report.errors,exception:report.exception,output}));
}assert.equal(report.failures.length,0,'Tag hover preview regression');})().catch(error=>{console.error(error);process.exitCode=1});

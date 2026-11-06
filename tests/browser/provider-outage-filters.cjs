// Hidden Edge, neutral local fixture only. No installed app/profile or providers.
// DART_PLAYWRIGHT_PATH / DART_BROWSER_EXE select existing installed tooling.
// --compare-ref freezes the complete frontend from one committed revision.
'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const crypto=require('node:crypto'),assert=require('node:assert/strict');
const {chromium}=require(process.env.DART_PLAYWRIGHT_PATH||'playwright');
const root=path.resolve(__dirname,'../..'),web=path.join(root,'wwwroot');
const argument=name=>{const index=process.argv.indexOf(name);return index<0?'':process.argv[index+1];};
const ref=argument('--compare-ref'),only=argument('--case');
const output=process.env.DART_QA_OUTPUT||path.join(os.tmpdir(),'DART-provider-outage-'+crypto.randomUUID());
const sources=['danbooru','gelbooru','rule34','sankaku'],surfaces=['search','recommendations','related','follows'];
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const files=ref?cp.execFileSync('git',['ls-tree','-r','--name-only',ref,'wwwroot'],{cwd:root,encoding:'utf8'}).trim().split('\n'):
  fs.readdirSync(web,{recursive:true}).filter(name=>fs.statSync(path.join(web,name)).isFile()).map(name=>'wwwroot/'+name.replaceAll('\\','/'));
const assets=new Map(files.map(file=>['/'+file.slice('wwwroot/'.length),ref?cp.execFileSync('git',['show',ref+':'+file],{cwd:root,maxBuffer:16*1024*1024}):fs.readFileSync(path.join(root,file))]));
const report={revision:ref||'working-tree',viewport:{width:2560,height:1440},hashes:Object.fromEntries([...assets].filter(([name])=>/\.(js|html|css)$/.test(name)).map(([name,bytes])=>[name,hash(bytes)])),checks:[],failures:[],errors:[],scenarios:[]};
function check(value,label,detail={}){report.checks.push({label,passed:!!value});if(!value)report.failures.push({label,...detail});}
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function work(source,index,extra={}){
  const number=(sources.indexOf(source)+1)*10000+index;
  const id=source==='sankaku'?'Fxt'+number+'AbC':String(number);
  return {source,id,key:source+':'+id,title:'Neutral scene '+number,rating:'g',
    creatorTag:'fixture_artist_'+number,creatorName:'Fixture Artist '+number,
    tags:['rare_fabric','woodland_scene','fixture_topic'],characterTags:[],copyrightTags:[],
    contentHash:crypto.createHash('md5').update(source+':'+index).digest('hex'),
    visualHash:'',visualPHash:'',visualAspectRatio:0,visualSamples:[],participants:[],
    published:'2026-11-05T12:00:00Z',width:1600,height:2400,popularityCount:200,
    thumbnail:'https://example.test/thumb-'+number+'.svg',images:['https://example.test/full-'+number+'.svg'],...extra};
}
function records(source,follow=false,page=0){
  const rows=Array.from({length:12},(_,index)=>work(source,page*100+index+1));
  if(follow)for(const item of rows){item.creatorTag='followed_artist';item.creatorName='Followed Artist';item.tags.push('followed_artist');}
  rows[3].tags.push('ai_generated');rows[4].tags.push('ai_assisted');rows[5].tags.push('anthro');
  rows[6].tags.push('fixture_blocked');rows[7].creatorTag='blocked_artist';
  if(follow)rows[7].participants=[{tag:'blocked_artist',name:'Blocked Artist',role:'artist'},{tag:'followed_artist',name:'Followed Artist',role:'artist'}];
  rows[8].contentHash='a'.repeat(32);rows[9].contentHash='b'.repeat(32);rows[10].contentHash='c'.repeat(32);
  rows[11].creatorTag='followed_artist';rows[11].tags.push('followed_artist');
  return rows;
}
const liked=Array.from({length:20},(_,index)=>work('danbooru',700000+index,{tags:['rare_fabric','woodland_scene'],creatorTag:'seed_artist_'+index}));
const knownLike=work('danbooru',800001,{contentHash:'a'.repeat(32)}),knownBookmark=work('gelbooru',800002,{contentHash:'b'.repeat(32)});
let browser;
async function fixture(surface,failed,{hold=false,allOffline=false,paged=false}={}){
  const context=await browser.newContext({viewport:report.viewport});
  const page=await context.newPage();page.setDefaultTimeout(12000);
  let outage=true,released=false,release;
  const gate=new Promise(resolve=>{release=()=>{released=true;resolve();};});
  const calls=[],failures=new Map(),known=new Map([...liked,knownLike,knownBookmark,...sources.flatMap(source=>[...records(source),...records(source,true)])].map(item=>[item.key,item]));
  const preferences={language:'en',aiMode:'generated-and-assisted',hideFurry:true,hideViewedAndSaved:true,hideFollowedArtists:true,
    excludedTags:['fixture_blocked'],hiddenAuthors:[{source:'artist',artistId:'blocked_artist',name:'Blocked Artist'}],
    curation:{enabled:true,popularity:true,personal:true,freshness:true,resolution:true}};
  const follow={key:'danbooru::followed_artist',source:'danbooru',artistId:'followed_artist',name:'Followed Artist',followedAt:'2026-01-01T00:00:00Z',seenAt:{general:'2026-11-01T00:00:00Z'}};
  const initial={kind:surface==='related'?'detail':surface,title:'Neutral '+surface,rating:'general',selectedSources:sources,
    ...(surface==='search'?{feed:'illustrations',query:'fixture_topic'}:{}),...(surface==='related'?{item:liked[0]}:{})};
  let state={session:{savedWorksVersion:1,activeIndex:0,tabs:[initial]}};
  page.on('pageerror',error=>report.errors.push({surface,failed,message:error.message}));
  await context.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    const json=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)}).catch(()=>{});
    if(url.pathname.startsWith('/api/')){
      if(url.pathname==='/api/client-state'){if(req.method()==='POST')state={...state,...JSON.parse(req.postData()||'{}')};return json(req.method()==='GET'?state:{saved:true});}
      if(url.pathname==='/api/settings')return json({hasApiKey:true,hasRule34ApiKey:true,sankakuAvailable:true});
      if(url.pathname==='/api/content-preferences')return json(preferences);
      if(url.pathname==='/api/recommendation-tag-preferences')return json({preferences:{'rare fabric':'priority'},initialized:true});
      if(url.pathname==='/api/likes')return json([...liked,knownLike]);
      if(url.pathname==='/api/bookmarks')return json([knownBookmark]);
      if(url.pathname==='/api/viewed-identities')return json(['hash:'+'c'.repeat(32)]);
      if(url.pathname==='/api/follows'||url.pathname==='/api/follows/seen')return json([follow]);
      if(url.pathname==='/api/follows/cache')return json(req.method()==='GET'?{groups:[]}:{saved:true});
      if(url.pathname==='/api/favorites')return json({totalWorks:0,entries:[],works:[],kinds:{}});
      if(url.pathname==='/api/source-status')return json(sources.map(source=>({source,websiteUnavailable:failures.has(source),statusCode:failures.has(source)?503:200,retryAt:failures.get(source)||null,checkedAt:Date.now()})));
      if(['/api/hidden-artworks','/api/favorite-tags','/api/favorite-artworks','/api/favorite-artwork-groups'].includes(url.pathname))return json([]);
      if(url.pathname==='/api/search'||url.pathname==='/api/profile'){
        const selected=(url.searchParams.get('sources')||url.searchParams.get('source')||sources.join(',')).split(',');
        const entry={path:url.pathname,sources:selected,page:Number(url.searchParams.get('page')||0),rating:url.searchParams.get('rating'),query:url.searchParams.get('q')||url.searchParams.get('artist')||'',outage};calls.push(entry);
        const blocked=outage&&selected.some(source=>allOffline||source===failed)&&(!paged||entry.page>0);
        entry.blocked=blocked;
        if(hold&&blocked&&!released)await gate;
        const items=[],errors={},retryAt={};
        for(const source of selected){
          if(outage&&(allOffline||source===failed)&&(!paged||entry.page>0)){errors[source]='Website maintenance (HTTP 503)';retryAt[source]=Date.now()+800;failures.set(source,retryAt[source]);continue;}
          failures.delete(source);
          const rows=records(source,surface==='follows',entry.page);for(const item of rows){known.set(item.key,item);items.push(item);}
        }
        const more=paged&&entry.page<3?selected.filter(source=>!errors[source]):[];
        return json({name:'Followed Artist',items,errors,retryAt,notices:{},hasMore:more.length>0,hasMoreSources:more});
      }
      if(url.pathname==='/api/detail'){
        const source=url.searchParams.get('source'),id=url.searchParams.get('id');
        if(!paged&&outage&&(allOffline||source===failed)){const retry=Date.now()+800;failures.set(source,retry);return json({error:'Website maintenance (HTTP 503)',retryAt:retry},503);}
        const item=known.get(source+':'+id);return item?json(item):json({error:'Unknown fixture post'},404);
      }
      if(url.pathname==='/api/image'){
        const identity=(url.searchParams.get('url')||'').replace(/(?:thumb|full)-/,'media-');
        const pixels=crypto.createHash('sha256').update(identity).digest();
        const tiles=Array.from({length:64},(_,index)=>`<rect x="${index%8*20}" y="${Math.floor(index/8)*30}" width="20" height="30" fill="${pixels[index%32]&(1<<(index%8))?'#d8e8f2':'#183628'}"/>`).join('');
        return route.fulfill({status:200,contentType:'image/svg+xml',body:`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="240">${tiles}</svg>`}).catch(()=>{});
      }
      return json({});
    }
    const name=url.pathname==='/'?'/index.html':url.pathname,bytes=assets.get(name);
    if(!bytes)return route.fulfill({status:404,body:''}).catch(()=>{});
    return route.fulfill({status:200,contentType:({'.js':'text/javascript','.css':'text/css','.html':'text/html','.wasm':'application/wasm','.svg':'image/svg+xml','.ico':'image/x-icon'})[path.extname(name)]||'application/octet-stream',body:bytes}).catch(()=>{});
  });
  const snapshot=()=>page.evaluate(()=>{
    const tab=currentTab(),grid=tab.kind==='detail'?main.querySelector('[data-grid-key="related"]'):main;
    const keys=[...(grid?.querySelectorAll('article.card[data-work-key]')||[])].map(node=>node.dataset.workKey);
    const lists=tab.artworkLists?[...tab.artworkLists.values()].flat():[];
    const items=keys.map(key=>lists.find(item=>item.key===key)||itemIndex.get(key)).filter(Boolean);
    return{kind:tab.kind,loading:!!tab.loading,relatedLoading:!!tab.relatedLoading,keys,
      items:items.map(item=>({key:item.key,source:item.source,sources:CatalogLogic.workSources(item).map(entry=>entry.source),hidden:CatalogLogic.isWorkHidden(item,contentPreferences),
        known:CatalogLogic.workHistoryTokens(item).some(token=>knownWorkTokens().has(token)),followed:isFollowedArtistHidden(item,tab,tab.kind==='detail'?'related':''),rating:item.rating})),
      preferences:JSON.stringify(contentPreferences),transport:catalogTransport().stats};
  });
  const started=performance.now();
  await page.goto('http://neutral-provider-outage.test/');
  return{context,page,calls,snapshot,release,started,recover(){outage=false;release();},async close(){release();await context.close();}};
}
function validate(snapshot,label,{offline=false}={}){
  if(!offline)check(snapshot.keys.length>0,label+':usable healthy cards');
  check(new Set(snapshot.keys).size===snapshot.keys.length,label+':unique card keys');
  check(snapshot.items.every(item=>!item.hidden),label+':AI/furry/tag/author filters');
  check(snapshot.items.every(item=>!item.known),label+':viewed and saved filters');
  check(snapshot.items.every(item=>!item.followed),label+':followed author filter scope');
  check(snapshot.items.every(item=>['g','s','general','sensitive','safe','sfw'].includes(item.rating)),label+':rating');
}
async function healthyBeforeHeldSource(){
  const f=await fixture('search','danbooru',{hold:true});
  try{
    let ready=true;await f.page.waitForFunction(()=>currentTab()?.kind==='search'&&main.querySelectorAll('article.card[data-work-key]').length>0,null,{timeout:3000}).catch(()=>{ready=false;});
    const firstCardsMs=Math.round(performance.now()-f.started);
    check(ready,'held Danbooru does not delay ready Search providers');
    if(ready){const s=await f.snapshot();validate(s,'held Search');check(s.items.every(item=>item.source!=='danbooru'),'held Search:only completed sources published');}
    f.recover();await f.page.waitForFunction(()=>!currentTab().loading,null,{timeout:10000});
    report.scenarios.push({type:'held-search',readyBeforeRelease:ready,firstCardsMs,requests:f.calls.length});
  }finally{await f.close();}
}
async function filtering(surface,failed,allOffline=false){
  const label=(allOffline?'offline':failed)+':'+surface,f=await fixture(surface,failed,{allOffline});
  try{
    if(!allOffline)await f.page.waitForFunction(surface=>currentTab()&&(surface==='related'?main.querySelectorAll('[data-grid-key="related"] article.card[data-work-key]').length:main.querySelectorAll('article.card[data-work-key]').length)>0,surface,{timeout:12000});
    else await wait(1800);
    const before=await f.snapshot();validate(before,label,{offline:allOffline});
    check(!before.items.some(item=>allOffline||item.sources.includes(failed)),label+':no fabricated unavailable-source result');
    const prefs=before.preferences;
    await f.page.evaluate(()=>{const tab=currentTab();if(tab.kind==='detail')void loadRelated(tab,true);else if(tab.kind==='follows')void loadMoreFollows(tab);else if(tab.kind==='recommendations')void loadRecommendations(tab,true);else void loadSearch(tab,true);});
    await wait(300);const continued=await f.snapshot();validate(continued,label+':continued',{offline:allOffline});
    check(continued.preferences===prefs,label+':preferences unchanged during failure');
    f.recover();await wait(1200);
    await f.page.evaluate(()=>{const tab=currentTab();if(tab.kind==='detail')void loadRelated(tab,false);else if(tab.kind==='follows')void loadFollowFeed(tab);else if(tab.kind==='recommendations')void loadRecommendations(tab,false);else void loadSearch(tab,false);});
    await f.page.waitForFunction(surface=>surface==='related'?!currentTab().relatedLoading:!currentTab().loading,surface,{timeout:12000});
    const recovered=await f.snapshot();validate(recovered,label+':recovered');
    check(recovered.preferences===prefs,label+':preferences unchanged after recovery');
    check(recovered.items.some(item=>item.sources.includes(failed)),label+':recovered provider participates');
    check(f.calls.every(call=>call.rating==='general'),label+':rating remains on requests');
    report.scenarios.push({type:label,before:before.keys.length,after:recovered.keys.length,requests:f.calls.length});
  }catch(error){report.failures.push({label,error:error.message});}finally{await f.close();}
}
async function viewerBoundaries(){
  const f=await fixture('search','danbooru',{hold:true,paged:true});
  try{
    await f.page.locator('article.card[data-work-key]').first().waitFor();
    await f.page.locator('#main').evaluate(node=>{node.scrollTop=node.scrollHeight;});
    for(let count=0;count<40&&!f.calls.some(call=>call.blocked);count++)await wait(50);
    check(f.calls.some(call=>call.sources.includes('danbooru')&&call.page>0&&call.blocked),'viewer boundary:Danbooru page held');
    await wait(200);
    const card=f.page.locator('article.card[data-work-key]').last();await card.scrollIntoViewIfNeeded();await card.locator('button.card-art').hover();
    await f.page.keyboard.press('Space');await f.page.waitForFunction(()=>quickPreview.open&&!!quickPreviewWork);
    await f.page.evaluate(()=>{
      globalThis.__boundaryTiming={steps:[],longTasks:[]};let key=null;
      window.addEventListener('keydown',event=>{if(event.key==='ArrowRight')key={at:performance.now(),previous:quickPreviewWork?.key};},{capture:true});
      new MutationObserver(()=>{if(key&&quickPreviewWork?.key!==key.previous){__boundaryTiming.steps.push(Math.round((performance.now()-key.at)*10)/10);key=null;}})
        .observe(quickPreview,{childList:true,subtree:true});
      new PerformanceObserver(list=>{for(const task of list.getEntries())__boundaryTiming.longTasks.push({at:Math.round(task.startTime),durationMs:Math.round(task.duration)});})
        .observe({type:'longtask'});
    });
    let steps=0;const stepTimesMs=[];
    for(;steps<12;steps++){
      const previous=await f.page.evaluate(()=>quickPreviewWork.key);
      const started=performance.now();await f.page.keyboard.press('ArrowRight');
      let moved=true;await f.page.waitForFunction(previous=>quickPreview.open&&quickPreviewWork?.key!==previous,previous,{timeout:2000}).catch(()=>{moved=false;});
      stepTimesMs.push(Math.round(performance.now()-started));
      check(moved,'viewer boundary:advance without closing '+steps);
      if(!moved)break;
    }
    check(steps===12,'viewer boundary:multiple healthy pages while Danbooru remains held');
    check(f.calls.some(call=>!call.sources.includes('danbooru')&&call.page>=3),'viewer boundary:third healthy page requested from viewer');
    check(await f.page.evaluate(()=>quickPreview.open),'viewer boundary:preview remains open');
    const before=await f.page.evaluate(()=>quickPreviewWork.key);await f.page.keyboard.press('ArrowLeft');
    await f.page.waitForFunction(previous=>quickPreviewWork?.key!==previous,before,{timeout:3000}).catch(()=>{});
    check(await f.page.evaluate(previous=>quickPreviewWork?.key!==previous,before),'viewer boundary:back remains usable');
    const browserTiming=await f.page.evaluate(()=>__boundaryTiming);
    check(browserTiming.steps.length===steps,'viewer boundary:every advance has a browser DOM timing');
    report.scenarios.push({type:'viewer-boundaries',steps,stepTimesMs,browserTiming,requests:f.calls.length,highestHealthyPage:Math.max(...f.calls.filter(call=>!call.sources.includes('danbooru')).map(call=>call.page))});
  }catch(error){report.failures.push({label:'viewer-boundaries',error:error.message});}finally{await f.close();}
}
(async()=>{fs.mkdirSync(output,{recursive:true});try{
  browser=await chromium.launch({headless:true,executablePath:process.env.DART_BROWSER_EXE});
  if(!only||only==='held')await healthyBeforeHeldSource();
  if(!only||only==='boundary')await viewerBoundaries();
  if(!only||only==='filters')for(const source of argument('--source')?[argument('--source')]:sources)
    for(const surface of argument('--surface')?[argument('--surface')]:surfaces)await filtering(surface,source);
  if(!only||only==='offline')for(const surface of argument('--surface')?[argument('--surface')]:surfaces)await filtering(surface,'danbooru',true);
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({revision:report.revision,checks:report.checks.length,failed:report.failures.length,errors:report.errors,failures:report.failures,scenarios:report.scenarios,output}));
  assert.equal(report.errors.length,0,'Browser errors');assert.equal(report.failures.length,0,'Outage/filter matrix failed');
}finally{await browser?.close();}})().catch(error=>{console.error(error.message);process.exitCode=1;});

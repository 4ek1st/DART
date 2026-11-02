const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require(process.env.DART_PLAYWRIGHT_PATH);
const root=process.argv[2]||path.resolve(__dirname,'../..'),logic=require(path.join(root,'wwwroot/catalog-logic.js'));
const sources=logic.supportedSources;
const works=sources.flatMap((source,index)=>[false,true].map(old=>({source,key:source+':'+((old?2001:1001)+index),id:String((old?2001:1001)+index),
 title:(old?'Old popular ':'Recent ')+source,rating:'e',creatorTag:'fixture_'+source+'_'+(old?'old':'new'),tags:['fixture_artist','landscape'],characterTags:['fixture_'+source+'_'+old],
 published:(old?'2026-08-31':'2026-11-02')+'T'+String(12-index).padStart(2,'0')+':00:00Z',popularityCount:old?100000:1,width:old?4096:1024,height:old?4096:1024,
 thumbnail:'https://example.test/'+source+'-'+old+'.png',images:['https://example.test/'+source+'-'+old+'.png']})));
let follow={source:'danbooru',artistId:'fixture_artist',key:'danbooru::fixture_artist',name:'Fixture artist',followedAt:'2025-01-01',seenAt:{all:'2026-11-03',explicit:'2026-11-03'}};
let state={session:{savedWorksVersion:1,activeIndex:0,tabs:[{kind:'follows',title:'Following',rating:'all',selectedSources:sources}]}};
let browser; const errors=[];
const preferences={language:'en',aiMode:'all',hideViewedAndSaved:false,hideFurry:false,excludedTags:[],hiddenAuthors:[],curation:{enabled:true,popularity:true,personal:true,freshness:true,resolution:true}};
(async()=>{try{
 browser=await chromium.launch({headless:true,executablePath:process.env.DART_BROWSER_EXE});
 const context=await browser.newContext({viewport:{width:2560,height:1440}});
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url()),send=value=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(value)});
  if(url.pathname.startsWith('/api/')){
   const data=route.request().postData();const body=data?JSON.parse(data):{};
   if(url.pathname==='/api/client-state'){if(route.request().method()==='POST')state={...state,...body};return send(state);}
   if(url.pathname==='/api/follows')return send([follow]);
   if(url.pathname==='/api/follows/seen')return send([follow]);
   if(url.pathname==='/api/follows/cache')return send({savedAt:new Date().toISOString(),groups:[{key:follow.key,items:works}]});
   if(url.pathname==='/api/settings')return send({hasApiKey:true,hasRule34ApiKey:true,sankakuAvailable:true});
   if(url.pathname==='/api/content-preferences')return send(preferences);
   if(['/api/likes','/api/bookmarks','/api/favorite-tags','/api/favorite-artworks','/api/viewed-identities'].includes(url.pathname))return send([]);
   if(url.pathname==='/api/search'||url.pathname==='/api/profile'){
    const source=url.searchParams.get('source')||url.searchParams.get('sources');
    return send({items:works.filter(w=>w.source===source),hasMore:false,hasMoreSources:[],errors:{},notices:{},sourceStats:{}});
   }
   if(url.pathname==='/api/detail')return send(works.find(w=>w.source===url.searchParams.get('source')&&w.id===url.searchParams.get('id')));
   if(url.pathname==='/api/image'){
    const bytes=crypto.createHash('sha256').update(url.searchParams.get('url')||'').digest();
    const cells=Array.from({length:64},(_,i)=>'<rect x="'+(i%8)*32+'" y="'+Math.floor(i/8)*32+'" width="32" height="32" fill="'+((bytes[i%32]>>(i%8))&1?'#329cff':'#232323')+'"/>').join('');
    return route.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">'+cells+'</svg>'});
   }
   return send({});
  }
  const filename=path.join(root,'wwwroot',url.pathname==='/'?'index.html':url.pathname.slice(1));
  if(!fs.existsSync(filename))return route.fulfill({status:404,body:''});
  return route.fulfill({status:200,contentType:({'.js':'text/javascript','.html':'text/html','.css':'text/css','.wasm':'application/wasm','.svg':'image/svg+xml'})[path.extname(filename)]||'application/octet-stream',body:fs.readFileSync(filename)});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://dart.test/');
 await page.waitForFunction(()=>currentTab()?.kind==='follows'&&!currentTab().loading&&document.querySelectorAll('article.card').length===8);
 assert.equal(await page.evaluate(()=>contentPreferences.curation.enabled),true);
 const expected=[...works].sort((a,b)=>Date.parse(b.published)-Date.parse(a.published)).map(w=>w.key);
 const shown=()=>page.locator('article.card').evaluateAll(cards=>cards.map(card=>card.dataset.workKey));
 assert.deepEqual(await shown(),expected,'Following must retain its publication chronology with quality enabled');
 await page.locator('.card-art[data-key="'+expected[0]+'"]').hover();await page.keyboard.press('Space');
 await page.waitForFunction(key=>quickPreviewWork?.key===key,expected[0]);
 await page.keyboard.press('ArrowRight');await page.waitForFunction(key=>quickPreviewWork?.key===key,expected[1],{timeout:7000}).catch(async error=>{
  console.error(JSON.stringify({expected:expected[1],errors,state:await page.evaluate(()=>({current:quickPreviewWork?.key,keys:quickPreviewRoute?.engine.items.map(i=>i.key),state:quickPreviewRoute?.engine.state,kind:quickPreviewRoute?.source.kind,focused:document.activeElement?.outerHTML.slice(0,150)}))}));throw error;
 });
 await page.keyboard.press('ArrowLeft');await page.waitForFunction(key=>quickPreviewWork?.key===key,expected[0]);
 await page.keyboard.press('Escape');assert.deepEqual(await shown(),expected);
 follow={...follow,seenAt:{all:'2026-11-01',explicit:'2026-11-01'}};
 await page.reload();
 await page.waitForFunction(()=>currentTab()?.kind==='follows'&&!currentTab().loading&&document.querySelectorAll('article.card .new-badge').length===4);
 assert.deepEqual(await shown(),expected,'New works must retain publication order too');
 await page.locator('[data-action="follow-refresh"]').click();
 await page.waitForFunction(()=>currentTab()?.kind==='follows'&&!currentTab().loading);
 assert.deepEqual(await shown(),expected,'Explicit refresh must preserve the feed order');
 assert.deepEqual(errors,[]);await context.close();
 console.log('PASS Following1440p: four sources, enabled quality, old/high-score works, New order, refresh and Space/arrow navigation.');
}finally{await browser?.close();}})().catch(error=>{console.error(error);process.exitCode=1;});

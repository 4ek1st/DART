'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),F=require('../wwwroot/favorites.js');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const work=id=>({key:'danbooru:'+id,id:String(id),source:'danbooru',title:'Neutral '+id,tags:[],thumbnail:'https://example.test/'+id+'.jpg',rating:'g'});
function setup(overrides={}){
 const counts={tags:0,artworks:0,summary:0},tab={kind:'favorites',favoriteType:'artwork',rating:'all'};
 let tags=[],serverTags=['fern'],artworks=[work(1)],summary=1;
 const c=F.create({getTags:()=>tags,setTags:value=>tags=value,getActiveTab:()=>tab,schedule:()=>1,unschedule(){},
  request:async(url,init)=>{
   if(overrides.request){const result=overrides.request(url,init);if(result!==undefined)return result;}
   if(init?.method==='POST')return {};
   if(url==='/api/favorite-tags'){counts.tags++;return [...serverTags];}
   if(url==='/api/favorite-artworks'){counts.artworks++;return [...artworks];}
   if(url.startsWith('/api/favorites?')){counts.summary++;return {totalWorks:summary++,entries:[],works:[],kinds:{}};}
   throw Error(url);
  }});
 return {c,tab,counts,tags:()=>tags,setTags:values=>serverTags=values,setArtworks:values=>artworks=values};
}

test('view activity refreshes summary without rereading unchanged manual Favorites or tags',async()=>{
 const f=setup();try{
  await Promise.all([f.c.loadTags(),f.c.loadArtworks()]);await f.c.load(f.tab);
  assert.deepEqual(f.counts,{tags:1,artworks:1,summary:1});
  const saved=f.c.artworks();
  for(let i=0;i<8;i++){f.c.record(work(i+100));await f.c.flush();await tick();}
  assert.equal(f.counts.summary,9);assert.equal(f.counts.tags,1);assert.equal(f.counts.artworks,1);
  assert.equal(f.c.artworks(),saved);assert.equal(f.tab.favoriteSummary.totalWorks,9);
 }finally{f.c.dispose();}
});

test('explicit Refresh rereads collections while normal category and activity loads reuse them',async()=>{
 const f=setup();try{
  await f.c.load(f.tab);f.setTags(['fern','spruce']);f.setArtworks([work(2)]);
  f.c.invalidate();await f.c.load(f.tab);
  assert.deepEqual(f.counts,{tags:1,artworks:1,summary:2});
  f.c.handle({dataset:{action:'favorites-refresh'}},f.tab);await tick();
  assert.deepEqual(f.counts,{tags:2,artworks:2,summary:3});
  assert.deepEqual(f.tags(),['fern','spruce']);assert.equal(f.c.artworks()[0].key,'danbooru:2');
 }finally{f.c.dispose();}
});

test('external import invalidation discards old in-flight collection snapshots and loads current ones',async()=>{
 let releaseTags,releaseArtworks;const f=setup({request(url){
  if(url==='/api/favorite-tags'&&!releaseTags)return new Promise(resolve=>releaseTags=resolve);
  if(url==='/api/favorite-artworks'&&!releaseArtworks)return new Promise(resolve=>releaseArtworks=resolve);
 }});
 try{
  const oldTags=f.c.loadTags(),oldArtworks=f.c.loadArtworks();
  f.c.invalidateCollections();f.setTags(['new_character']);f.setArtworks([work(9)]);
  const tags=f.c.loadTags(true),artworks=f.c.loadArtworks(true);
  releaseTags(['stale_character']);releaseArtworks([work(1)]);
  await Promise.all([oldTags,oldArtworks,tags,artworks]);
  assert.deepEqual(f.tags(),['new_character']);assert.equal(f.c.artworks()[0].key,'danbooru:9');
 }finally{f.c.dispose();}
});

test('failed initial collection loads retry and an offline forced refresh retains already usable data',async()=>{
 let offline=true;const f=setup({request(url){if(offline&&url.startsWith('/api/favorite-'))throw Error('offline');}});
 try{
  await f.c.load(f.tab);assert(f.tab.favoriteError);offline=false;
  await f.c.load(f.tab,true);assert.equal(f.tab.favoriteError,'');
  const saved=f.c.artworks();offline=true;
  await f.c.load(f.tab,true);assert(f.tab.favoriteError);assert.equal(f.c.artworks(),saved);assert.deepEqual(f.tags(),['fern']);
  assert.equal(await f.c.loadArtworks(),true,'loaded local collection remains usable offline');
 }finally{f.c.dispose();}
});

test('old manual tag and artwork replies cannot overwrite an externally imported collection',async()=>{
 let releaseTag,releaseArtwork;
 const f=setup({request(url,init){
  if(init?.method==='POST'&&url==='/api/favorite-tags')return new Promise(resolve=>releaseTag=resolve);
  if(init?.method==='POST'&&url==='/api/favorite-artworks')return new Promise(resolve=>releaseArtwork=resolve);
 }});
 try{
  await f.c.load(f.tab);
  const tagging=f.c.toggle('old_pending_tag','character',true),saving=f.c.toggleArtwork(work(3));await tick();
  f.c.invalidateCollections();f.setTags(['imported_tag']);f.setArtworks([work(9)]);
  await Promise.all([f.c.loadTags(true),f.c.loadArtworks(true)]);
  assert.deepEqual(f.tags(),['imported_tag']);assert.deepEqual(f.c.artworks().map(item=>item.key),['danbooru:9']);
  releaseTag(['fern','old_pending_tag']);releaseArtwork([work(3)]);
  await Promise.all([tagging,saving]);await tick();
  assert.deepEqual(f.tags(),['imported_tag']);assert.deepEqual(f.c.artworks().map(item=>item.key),['danbooru:9']);
 }finally{f.c.dispose();}
});

test('disposed pending collection loads never publish late arrays or labels',async()=>{
 let release;let tags=[],changes=0;
 const c=F.create({getTags:()=>tags,setTags:value=>tags=value,changed:()=>changes++,
  request:()=>new Promise(resolve=>release=resolve)});
 const loading=c.loadTags();c.dispose();release(['late_tag']);
 assert.equal(await loading,false);assert.deepEqual(tags,[]);assert.equal(changes,0);
});

const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const CatalogLogic = require('../wwwroot/catalog-logic.js');
const DartResourceCache = require('../wwwroot/resource-cache.js');
const source = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
const between = (a,b) => source.slice(source.indexOf(a), source.indexOf(b, source.indexOf(a)));

test('matching catalog requests share one response without sharing mutable artwork objects', async () => {
  const calls = [];
  const context = vm.createContext({ CatalogLogic, DartResourceCache, URLSearchParams, structuredClone,
    fetch: async path => { calls.push(path); return { ok: true, json: async () => ({ items: [{key:'danbooru:1',source:'danbooru',tags:[]}] }) }; }
  });
  vm.runInContext(between('async function request(', '\nconst visualHashJobs'), context);
  context.addCatalogVisualHashes = async () => {};
  const first = '/api/search?q=test&page=0&pages=danbooru:0,rule34:0&sources=danbooru,rule34&rating=all';
  const second = '/api/search?rating=all&sources=rule34,danbooru&q=test&page=0';
  const [a,b] = await Promise.all([context.request(first), context.request(second)]);
  a.items[0].tags.push('changed'); assert.deepEqual(b.items[0].tags, []); assert.equal(calls.length, 1);
  context.clearCatalogResponses(); await context.request(second); assert.equal(calls.length, 2);
  await context.request(first.replace('rating=all','rating=general')); assert.equal(calls.length, 3);
  await context.request(first.replace('danbooru:0','danbooru:1')); assert.equal(calls.length, 4);
  await context.request('/api/detail?source=sankaku&id=one');
  await context.request('/api/detail?source=sankaku&id=one',{cache:'reload'}); assert.equal(calls.length,6);
});

function savedFixture() {
  let finish, reads=0;
  const context=vm.createContext({CatalogLogic,likes:[],bookmarks:[],tabs:[],rememberItems(){},toast(){},
    request:()=>{reads++;return new Promise(resolve=>{finish=resolve;});}});
  vm.runInContext(between('function setSavedWorks(', '\nasync function loadFavoriteTags('),context);
  return {context,reads:()=>reads,finish:value=>finish(value)};
}

test('saved collections load once and simultaneous consumers share the same pending read',async()=>{
  const f=savedFixture(),c=f.context;
  const a=c.refreshLikes(),b=c.refreshLikes();assert.equal(f.reads(),1);
  f.finish([{key:'danbooru:1',source:'danbooru'}]);await Promise.all([a,b]);
  await c.refreshLikes();assert.equal(f.reads(),1);assert.equal(c.likes.length,1);
});

test('a stale collection response cannot undo a like changed during the request',async()=>{
  const f=savedFixture(),c=f.context;
  const pending=c.refreshLikes();c.setSavedWorks('likes',[{key:'rule34:2',source:'rule34'}]);
  f.finish([]);await pending;assert.equal(c.likes[0].key,'rule34:2');
});

test('synchronizing a write retries a read that started before that write',async()=>{
  const f=savedFixture(),c=f.context;
  const old=c.refreshLikes();c.setSavedWorks('likes',[{key:'rule34:2',source:'rule34'}]);
  const fresh=c.refreshSavedWorks('likes',true);f.finish([]);await old;
  await new Promise(resolve=>setImmediate(resolve));assert.equal(f.reads(),2);
  f.finish([{key:'rule34:2',source:'rule34',title:'Stored metadata'}]);await fresh;
  assert.equal(c.likes[0].title,'Stored metadata');await c.refreshLikes();assert.equal(f.reads(),2);
});

test('detail metadata enriches existing grouped saved works without adding removed works or changing order',()=>{
  const f=savedFixture(),c=f.context;
  const other={key:'danbooru:9',source:'danbooru',title:'Other'};
  c.setSavedWorks('likes',[other,{key:'danbooru:1',source:'danbooru',memberKeys:['danbooru:1','rule34:2'],tags:[]}]);
  c.refreshSavedDetail({key:'rule34:2',source:'rule34',creatorTag:'artist',tags:['new_tag']});
  assert.equal(c.likes.length,2);assert.equal(c.likes[0],other);
  assert.ok([...c.likes[1].tags, ...(c.likes[1].allTags || [])].includes('new_tag'));
  c.setSavedWorks('likes',[other]);c.refreshSavedDetail({key:'rule34:2',source:'rule34',title:'Late'});
  assert.equal(c.likes.length,1);assert.equal(c.bookmarks.length,0);assert.equal(f.reads(),0);
});

test('refreshing the taste profile retains consumed query pages and the current visit seed',()=>{
  const context=vm.createContext({CatalogLogic,likes:[{key:'danbooru:1',source:'danbooru',tags:['catsuit','red_hair']}],
    contentPreferences:{},recommendationTagPreferences:{catsuit:'priority'},recommendationVisitCount:0,localStorage:{setItem(){}}});
  vm.runInContext(between('function createRecommendationPools(', '\nasync function mergeRecommendationsAsync('),context);
  const tab={rating:'all',selectedSources:['danbooru']};context.prepareRecommendationProfile(tab);
  const group=Object.values(tab.recommendationPools).flat()[0];group.streams[0].nextPage=3;
  const seed=tab.recommendationSeed,visit=context.recommendationVisitCount;
  context.prepareRecommendationProfile(tab,context.likes,false);
  assert.equal(Object.values(tab.recommendationPools).flat().find(g=>g.query===group.query).streams[0].nextPage,3);
  assert.equal(tab.recommendationSeed,seed);assert.equal(context.recommendationVisitCount,visit);
});

'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('./helpers/viewer-vm.cjs');
const Logic=require('../wwwroot/catalog-logic.js'),app=fs.readFileSync(require.resolve('../wwwroot/app.js'),'utf8');
const source=app.slice(app.indexOf('function createRecommendationPools('),app.indexOf('\nfunction decorateFollowItems('));
const work=id=>({key:'danbooru:'+id,source:'danbooru',id:String(id),rating:'g',tags:['forest'],images:[],title:'Neutral landscape'});
const tick=async()=>{for(let index=0;index<4;index++)await new Promise(setImmediate);};
function prepared(tag='forest') {return {tags:[{tag,count:8}],tagGroups:{names:[],copyright:[],other:[{tag,count:8}]},
 queryGroups:{priority:[{tag,count:8}],names:[],copyright:[],other:[],combinations:[]}};}
function fixture(){
 const pending=[],requests=[],paint=[];
 const tab={id:1,kind:'recommendations',rating:'general',selectedSources:['danbooru'],items:[work(900)],errors:{}};
 const context=vm.createContext({CatalogLogic:{...Logic,
  recommendationTags(){throw Error('Unexpected synchronous evidence');},recommendationTagGroups(){throw Error('Unexpected synchronous evidence');},
  recommendationQueryGroups(){throw Error('Unexpected synchronous evidence');}},
  DartWorkAnalysis:{create:()=>({analyze(liked,preferences){return new Promise((resolve,reject)=>pending.push({liked,preferences,resolve,reject}));}})},
  likes:Array.from({length:8},(_,index)=>work(index+1)),contentPreferences:{},recommendationTagPreferences:{forest:'priority'},
  recommendationVisitCount:0,localStorage:{setItem(){}},AbortController,URLSearchParams,setTimeout,clearTimeout,
  findTab:id=>id===tab.id?tab:null,activeId:tab.id,rememberItems(){},render(){paint.push({loading:tab.loading,keys:tab.items.map(item=>item.key)});},
  request:async url=>{requests.push(new URL(url,'http://fixture').searchParams.get('q'));return{items:[work(1000)],errors:{},hasMoreSources:[]};}});
 vm.runInContext(source,context);
 return{context,tab,pending,requests,paint,load:()=>context.loadRecommendations(tab)};
}
test('cold analysis leaves current cards usable and starts provider queries only after the worker result',async()=>{
 const f=fixture(),loading=f.load();await tick();
 assert.equal(f.tab.loading,true);assert.equal(f.pending.length,1);assert.equal(f.requests.length,0);
 assert.deepEqual(Array.from(f.tab.items,item=>item.key),['danbooru:900']);
 f.pending[0].resolve(prepared());await loading;
 assert.equal(f.tab.loading,false);assert(f.requests.includes('forest'));assert.equal(f.tab.recommendationTags[0].tag,'forest');
});
test('a superseded analysis cannot replace a newer request or start old provider work',async()=>{
 const f=fixture(),first=f.load();await tick();const second=f.load();await tick();
 assert.equal(f.pending.length,2);f.pending[0].resolve(prepared('old_interest'));await first;
 assert.equal(f.requests.length,0);assert.equal(f.tab.loading,true);
 f.pending[1].resolve(prepared('new_interest'));await second;
 assert(f.requests.includes('new_interest'));assert(!f.requests.includes('old_interest'));
});
test('preference changes during analysis restart against the latest preferences before publishing',async()=>{
 const f=fixture(),loading=f.load();await tick();f.context.recommendationTagPreferences={rain:'priority'};
 f.pending[0].resolve(prepared('forest'));await tick();
 assert.equal(f.pending.length,2);assert.equal(f.requests.length,0);assert.equal(f.pending[1].preferences.rain,'priority');
 f.pending[1].resolve(prepared('rain'));await loading;
 assert(f.requests.includes('rain'));assert(!f.requests.includes('forest'));
});
test('a same-sized saved-library replacement cannot publish stale analysis',async()=>{
 const f=fixture(),loading=f.load();await tick();f.context.likes=Array.from({length:8},(_,index)=>work(index+100));
 f.pending[0].resolve(prepared('old_interest'));await tick();assert.equal(f.pending.length,2);assert.equal(f.requests.length,0);
 f.pending[1].resolve(prepared('new_interest'));await loading;
 assert(!f.requests.includes('old_interest'));assert(f.requests.includes('new_interest'));
});
test('cancelled analysis releases the loading state and does not start provider requests',async()=>{
 const f=fixture(),loading=f.load();await tick();f.tab.recommendationController.abort();
 f.pending[0].resolve(prepared());await loading;assert.equal(f.tab.loading,false);assert.equal(f.requests.length,0);
 assert.deepEqual(Array.from(f.tab.items,item=>item.key),['danbooru:900']);
});
test('analysis failure retains cards and permits an explicit retry',async()=>{
 const f=fixture(),loading=f.load();await tick();f.pending[0].reject(Error('Unavailable'));await loading;
 assert.equal(f.tab.loading,false);assert.equal(f.tab.loadError,true);assert.equal(f.requests.length,0);
 assert.deepEqual(Array.from(f.tab.items,item=>item.key),['danbooru:900']);
 const retry=f.context.retryRecommendationSources(f.tab);await tick();f.pending[1].resolve(prepared());await retry;
 assert.equal(f.tab.loading,false);assert.equal(f.tab.loadError,false);assert(f.requests.length>0);
});

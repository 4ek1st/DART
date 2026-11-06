'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Logic=require('../wwwroot/catalog-logic.js');
const app=fs.readFileSync(require.resolve('../wwwroot/app.js'),'utf8');
const source=app.slice(app.indexOf('function knownWorkTokens('),app.indexOf('\nfunction scheduleRelatedKnownRefresh('));
function fixture(state={}){
 const context=vm.createContext({CatalogLogic:Logic,viewedTokens:new Set(),viewedPending:new Set(),recent:[],likes:[],bookmarks:[],...state});
 vm.runInContext(source,context);return {context,read:()=>context.knownWorkTokens(),learn:items=>context.learnKnownWorkAliases(items)};
}
const work=(source,id,hash)=>({source,id:String(id),key:`${source}:${id}`,contentHash:hash,
 images:[`https://fixture.test/${source}-${id}.jpg`],tags:['neutral_scene'],rating:'g'});
function pair(id=1){
 const hash=id.toString(16).padStart(32,'0'),first=work('danbooru',id,hash),second=work('gelbooru',id,hash);
 return {first,second,group:Logic.groupWorks([first,second])[0]};
}
test('only a confirmed group containing an exact known anchor teaches its additional identities',()=>{
 const {first,second,group}=pair(),f=fixture({viewedTokens:new Set([`key:${first.key}`])});
 assert.equal(f.read().has(`key:${second.key}`),false);
 f.learn([group]);assert.equal(f.read().has(`key:${second.key}`),true);
 const unknown=pair(2);f.learn([unknown.group]);assert.equal(f.read().has(`key:${unknown.second.key}`),false);
});
test('pending viewed writes can anchor aliases, but removing or replacing the anchor stays live',()=>{
 const {first,second,group}=pair(3),tokens=new Set([`key:${first.key}`]),f=fixture({viewedPending:tokens});
 f.learn([group]);const known=f.read();assert.equal(known.has(`key:${second.key}`),true);
 tokens.delete(`key:${first.key}`);tokens.add('key:danbooru:unrelated');
 assert.equal(known.has(`key:${second.key}`),false,'same-size replacement cannot keep a stale alias');
 tokens.add(`key:${first.key}`);assert.equal(known.has(`key:${second.key}`),true);
 f.context.viewedPending=new Set(['key:danbooru:replacement']);
 assert.equal(f.read().has(`key:${second.key}`),false,'replaced pending set is respected');
});
test('legacy and incomplete unions cannot introduce new known identities',()=>{
 const {first,second,group}=pair(4),f=fixture({viewedTokens:new Set([`key:${first.key}`])});
 f.learn([{...group,groupingVersion:0},{...group,groupMembers:[]}]);
 assert.equal(f.read().has(`key:${second.key}`),false);
});
test('a weak related-parent identity cannot anchor additional known versions',()=>{
 const {first,second,group}=pair(9),f=fixture({viewedTokens:new Set([`group:danbooru:parent:${first.id}`])});
 f.learn([group]);assert.equal(f.read().has(`key:${second.key}`),false);
});
test('learned grouping evidence is invalidated when the owning grouping revision changes',()=>{
 const {first,second,group}=pair(5),f=fixture({viewedTokens:new Set([`key:${first.key}`])});
 f.learn([group]);assert.equal(f.read().has(`key:${second.key}`),true);
 Logic.invalidateGrouping([group]);assert.equal(f.read().has(`key:${second.key}`),false);
});
test('library replacement or a same-size library revision invalidates its learned aliases',()=>{
 const {first,second,group}=pair(6),likes=[first],f=fixture({likes});
 f.learn([group]);assert.equal(f.read().has(`key:${second.key}`),true);
 f.context.likes=[work('danbooru',600,'f'.repeat(32))];
 assert.equal(f.read().has(`key:${second.key}`),false);
 f.context.likes=[first];f.learn([group]);assert.equal(f.read().has(`key:${second.key}`),true);
 f.context.likes[0]=work('danbooru',601,'e'.repeat(32));Logic.invalidateGrouping(f.context.likes);
 assert.equal(f.read().has(`key:${second.key}`),false);
});
test('alias membership never scans the complete viewing history',()=>{
 class CountedSet extends Set{*[Symbol.iterator](){throw new Error('History iteration during membership');}}
 const {first,second,group}=pair(7),history=new CountedSet(Array.from({length:130000},(_,i)=>'fixture:'+i));
 history.add(`key:${first.key}`);const f=fixture({viewedTokens:history});f.learn([group]);
 for(let i=0;i<50;i++)assert.equal(f.read().has(`key:${second.key}`),true);
});
test('bounded alias learning evicts old components without weakening unrelated exact membership',()=>{
 const pairs=Array.from({length:200},(_,i)=>pair(1000+i));
 const f=fixture({viewedTokens:new Set(pairs.map(p=>`key:${p.first.key}`))});
 for(const p of pairs)f.learn([p.group]);
 assert.equal(f.read().has(`key:${pairs[0].second.key}`),false,'old learned components have a finite lifetime');
 assert.equal(f.read().has(`key:${pairs.at(-1).second.key}`),true);
 assert.equal(f.read().has(`key:${pairs[0].first.key}`),true,'exact source membership is unaffected by eviction');
});
test('feed publication learns confirmed aliases without removing retained visit cards',()=>{
 const {first,second,group}=pair(8),f=fixture({viewedTokens:new Set([`key:${first.key}`]),
  contentPreferences:{hideViewedAndSaved:true},filterHiddenFeedWorks:items=>items,
  isHideableFeed:()=>true,isRetainedFeedWork:()=>false,curateFeedWorks:items=>items});
 vm.runInContext(app.slice(app.indexOf('function filterFeedWorks('),app.indexOf('\nfunction filterHiddenFeedWorks(')),f.context);
 const tab={kind:'search',rating:'all'};
 assert.equal(f.context.filterFeedWorks([group],tab,true).length,0);
 assert.equal(f.context.filterFeedWorks([second],tab,true).length,0,'later singleton retains the confirmed relation');
 f.context.isRetainedFeedWork=()=>true;
 assert.equal(f.context.filterFeedWorks([group],tab,true).length,1,'materialized current visit slot remains');
});

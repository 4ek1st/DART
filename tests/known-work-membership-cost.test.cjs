'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Logic=require('../wwwroot/catalog-logic.js');
const app=fs.readFileSync(process.env.DART_MEMBERSHIP_APP_FILE||require.resolve('../wwwroot/app.js'),'utf8');
const block=(start,end)=>app.slice(app.indexOf(start),app.indexOf(end,app.indexOf(start)));
function fixture(state={},libraryOnly=false){
 const context=vm.createContext({CatalogLogic:Logic,viewedTokens:new Set(),viewedPending:new Set(),recent:[],likes:[],bookmarks:[],...state});
 vm.runInContext(block('function knownWorkTokens(',libraryOnly?'\nfunction knownLibraryWorkTokens(':'\nfunction scheduleRelatedKnownRefresh('),context);
 return {context,read:()=>context.knownWorkTokens()};
}
class CountedSet extends Set{
 constructor(values){super(values);this.iterations=0;this.reads=0;}
 *[Symbol.iterator](){this.iterations++;for(const value of super.values()){this.reads++;yield value;}}
}
test('large-history feed membership never iterates or copies the history, pending queue or cached library',()=>{
 const history=new CountedSet(Array.from({length:124050},(_,index)=>'key:danbooru:'+index));
 const pending=new CountedSet(['key:rule34:999999']),library=new CountedSet(Array.from({length:32830},(_,index)=>'hash:fixture_'+index));
 const f=fixture({viewedTokens:history,viewedPending:pending,knownLibraryWorkTokens:()=>library},true);
 for(let call=0;call<12;call++){
  const known=f.read();
  assert.equal(known.has('key:danbooru:123456'),true);assert.equal(known.has('key:rule34:999999'),true);
  assert.equal(known.has('hash:fixture_32829'),true);assert.equal(known.has('missing_fixture'),false);
 }
 for(const [name,source]of[['history',history],['pending',pending],['library',library]]){
  assert.equal(source.iterations,0,`${name} was iterated for a membership-only filter`);
  assert.equal(source.reads,0,`${name} copied ${source.reads} identities`);
 }
});
test('membership follows additions, deletions and same-size replacements in the current Sets',()=>{
 const history=new Set(['old_history']),pending=new Set(['old_pending']),library=new Set(['old_library']);
 const f=fixture({viewedTokens:history,viewedPending:pending,knownLibraryWorkTokens:()=>library},true),known=f.read();
 for(const [source,oldValue,newValue]of[[history,'old_history','new_history'],[pending,'old_pending','new_pending'],[library,'old_library','new_library']]){
  source.delete(oldValue);source.add(newValue);assert.equal(source.size,1);
  assert.equal(known.has(oldValue),false);assert.equal(known.has(newValue),true);
 }
});
test('a fresh feed filter captures replaced history and pending Set references',()=>{
 const f=fixture({viewedTokens:new Set(['previous_history']),viewedPending:new Set(['previous_pending']),knownLibraryWorkTokens:()=>new Set()},true);
 const first=f.read();assert.equal(first.has('previous_history'),true);
 f.context.viewedTokens=new Set(['replacement_history']);f.context.viewedPending=new Set(['replacement_pending']);
 const next=f.read();assert.equal(next.has('previous_history'),false);assert.equal(next.has('previous_pending'),false);
 assert.equal(next.has('replacement_history'),true);assert.equal(next.has('replacement_pending'),true);
});
test('library-array replacements and explicit grouping revisions refresh saved membership',()=>{
 const work=(id,hash)=>({key:'danbooru:'+id,source:'danbooru',id:String(id),contentHash:hash.repeat(32)});
 const likes=[work(1,'a')],f=fixture({likes});
 assert.equal(f.read().has('hash:'+'a'.repeat(32)),true);
 f.context.likes=[work(2,'b')];
 assert.equal(f.read().has('hash:'+'a'.repeat(32)),false);assert.equal(f.read().has('key:danbooru:2'),true);
 f.context.likes[0]=work(3,'c');Logic.invalidateGrouping(f.context.likes);
 const refreshed=f.read();assert.equal(refreshed.has('key:danbooru:2'),false);assert.equal(refreshed.has('hash:'+'c'.repeat(32)),true);
});
test('explicit size and iteration provide the exact deduplicated insertion order while membership remains live',()=>{
 const history=new Set(['viewed','shared']),pending=new Set(['shared','pending']),library=new Set(['pending','library']);
 const known=fixture({viewedTokens:history,viewedPending:pending,knownLibraryWorkTokens:()=>library},true).read();
 const expected=['viewed','shared','pending','library'];
 assert.equal(known.size,4);assert.deepEqual(Array.from(known),expected);assert.deepEqual(Array.from(known.values()),expected);assert.deepEqual(Array.from(known.keys()),expected);
 history.delete('viewed');library.add('new_library');assert.equal(known.size,4);
 assert.deepEqual(Array.from(known),['shared','pending','library','new_library']);
});
test('CatalogLogic hideViewedWorks accepts the membership view and preserves truly different files',()=>{
 const seen={key:'danbooru:1',source:'danbooru',id:'1',contentHash:'a'.repeat(32)};
 const mirror={key:'gelbooru:2',source:'gelbooru',id:'2',contentHash:'a'.repeat(32)};
 const different={key:'rule34:3',source:'rule34',id:'3',contentHash:'b'.repeat(32)};
 const f=fixture({viewedTokens:new Set(Logic.workHistoryTokens(seen))}),known=f.read();
 assert.deepEqual(Logic.hideViewedWorks([mirror,different],known),[different]);
 f.context.viewedTokens.clear();assert.deepEqual(Logic.hideViewedWorks([mirror,different],known),[mirror,different]);
});

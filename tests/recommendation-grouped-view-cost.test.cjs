'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(process.env.DART_GROUPED_PROFILE_MODULE||require.resolve('../wwwroot/catalog-logic.js'),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
function fixture(){
 const context=vm.createContext({URL,TextEncoder,groupWorkSizes:[]});
 vm.runInContext(source.replace('function groupWorks(items) {','function groupWorks(items) { globalThis.groupWorkSizes.push(items?.length || 0);'),context);
 return {logic:context.CatalogLogic,calls:context.groupWorkSizes,reset:()=>{context.groupWorkSizes.length=0;}};
}
const work=(id,tags=['neutral_topic'],more={})=>({key:'danbooru:'+id,source:'danbooru',id:String(id),title:'Fixture '+id,rating:id%2?'g':'e',creatorTag:'fixture_artist_'+id,tags,characterTags:[],copyrightTags:[],contentHash:id.toString(16).padStart(32,'0'),images:['https://example.test/neutral-'+id+'.jpg'],...more});
function evidence(){
 return [...Array.from({length:8},(_,i)=>work(100+i,['fixture_hero_a','rare_fabric','Café','cafe\u0301','Series:Name'],{characterTags:['fixture_hero_a'],copyrightTags:['Series:Name']})),
  ...Array.from({length:8},(_,i)=>work(200+i,['fixture_hero_b','ornate_armor'],{characterTags:['fixture_hero_b']})),
  ...Array.from({length:8},(_,i)=>work(300+i,['woodland_scene']))];
}
function outputs(logic,liked){
 const preferences={'fixture hero a':'priority','wide view':'disabled'},background=Array.from({length:30},(_,i)=>work(10000+i,[i%2?'rare_fabric':'woodland_scene']));
 const candidates=Array.from({length:16},(_,i)=>work(20000+i,[i%2?'fixture_hero_a':'fixture_hero_b',i%3?'rare_fabric':'ornate_armor',...(i%5===0?['wide_view']:[])],{key:'rule34:'+(20000+i),source:'rule34',rating:'e'}));
 return plain({groups:logic.recommendationQueryGroups(liked,preferences,background),combinations:logic.recommendationCombinations(liked,preferences,background),ranked:logic.rankRecommendations(liked,candidates,'all',12,preferences,17,{background,curation:{enabled:true},recentKeys:['rule34:20001']})});
}
for(const mode of ['whole','filtered','rated'])test(`an already grouped ${mode} view does not repeat full recommendation-profile grouping`,()=>{
 const f=fixture(),grouped=f.logic.groupWorks(evidence());
 const liked=mode==='whole'?grouped:grouped.filter((item,index)=>mode==='rated'?item.rating==='g':index%3!==0);
 f.reset();f.logic.recommendationQueryGroups(liked,{},[],{includeCombinations:false});
 assert.equal(f.calls.filter(size=>size>0).length,0,`Trusted ${mode} view regrouped ${Array.from(f.calls)}`);
});
for(const mode of ['whole','filtered','rated'])test(`trusted ${mode} view preserves exact queries, combination counts/weights and ranked output versus an untrusted clone`,()=>{
 const f=fixture(),grouped=f.logic.groupWorks(evidence());
 const liked=mode==='whole'?grouped:grouped.filter((item,index)=>mode==='rated'?item.rating==='g':index%3!==0);
 const before=JSON.stringify(liked),expected=outputs(f.logic,structuredClone(liked)),actual=outputs(f.logic,liked);
 assert.deepEqual(actual,expected);assert.equal(JSON.stringify(liked),before);
 assert(actual.groups.priority.length>0);assert(actual.combinations.length>0);assert(actual.ranked.length>0);
});
test('mirrors from mixed canonical batches still regroup into one liked work',()=>{
 const f=fixture(),first=f.logic.groupWorks([work(1)])[0],second=f.logic.groupWorks([work(2,['neutral_topic'],{key:'gelbooru:2',source:'gelbooru',contentHash:first.contentHash})])[0];
 const mixed=[first,second];f.reset();
 const profile=plain(f.logic.recommendationTags(mixed,20));
 assert(f.calls.some(size=>size===2),'Mixed origins bypassed grouping');
 assert.equal(profile.find(entry=>entry.tag==='neutral topic')?.count,1);
 assert.deepEqual(outputs(f.logic,mixed),outputs(f.logic,structuredClone(mixed)));
});
test('a repeated reference from a trusted batch still deduplicates instead of counting two likes',()=>{
 const f=fixture(),grouped=f.logic.groupWorks([work(1)]),duplicate=[grouped[0],grouped[0]];f.reset();
 const profile=plain(f.logic.recommendationTags(duplicate,20));
 assert(f.calls.some(size=>size===2),'Repeated objects bypassed grouping');
 assert.equal(profile.find(entry=>entry.tag==='neutral topic')?.count,1);
});
test('raw recommendation fields are read once before fallback grouping',()=>{
 const f=fixture(),reads={tags:0,allTags:0,characterTags:0,copyrightTags:0},raw=work(1);
 for(const field of Object.keys(reads))Object.defineProperty(raw,field,{enumerable:true,get(){reads[field]++;return field==='tags'?['neutral_topic']:[];}});
 f.logic.recommendationQueryGroups([raw],{},[],{includeCombinations:false});
 assert.deepEqual(reads,{tags:1,allTags:1,characterTags:1,copyrightTags:1});
});
test('canonical recommendation snapshots read getter-backed metadata once without regrouping',()=>{
 const f=fixture(),grouped=f.logic.groupWorks([work(1)]),item=grouped[0],savedTags=item.tags;let reads=0;
 Object.defineProperty(item,'tags',{enumerable:true,get(){reads++;return savedTags;}});f.reset();
 f.logic.recommendationQueryGroups(grouped,{},[],{includeCombinations:false});
 assert.equal(reads,1);assert.equal(f.calls.filter(size=>size>0).length,0);
});
test('invalidating a parent batch invalidates a cached same-length filtered recommendation view',()=>{
 const f=fixture(),raw=evidence(),grouped=f.logic.groupWorks(raw),liked=grouped.filter((_,index)=>index<8);
 const before=plain(f.logic.recommendationTags(liked,100));
 grouped[3].tags=['learned_topic'];grouped[3].allTags=['learned_topic'];f.logic.invalidateGrouping(raw);f.reset();
 const after=plain(f.logic.recommendationTags(liked,100));
 assert.notDeepEqual(after,before);assert(after.some(entry=>entry.tag==='learned topic'));
 assert(f.calls.some(size=>size===liked.length),'Invalid parent origin retained the trusted shortcut');
 assert.deepEqual(after,plain(f.logic.recommendationTags(structuredClone(liked),100)));
});
test('same-length refinement refreshes canonical recommendation evidence and an invalidated subset',()=>{
 const f=fixture(),grouped=f.logic.groupWorks(evidence()),liked=grouped.filter((_,index)=>index<8);
 f.logic.recommendationTags(grouped,100);f.logic.recommendationTags(liked,100);
 grouped[2].tags=['refined_topic'];grouped[2].allTags=['refined_topic'];f.logic.refineGrouping(grouped,[grouped[2]]);
 for(const view of [grouped,liked]){
  const actual=plain(f.logic.recommendationTags(view,100));
  assert(actual.some(entry=>entry.tag==='refined topic'));
  assert.deepEqual(actual,plain(f.logic.recommendationTags(structuredClone(view),100)));
 }
});

test('invalidating a non-first mixed origin refreshes the cached fallback profile',()=>{
 const f=fixture(),first=f.logic.groupWorks([work(1,['fixed_topic'])]),second=f.logic.groupWorks([work(2,['before_topic'])]),view=[first[0],second[0]];
 f.logic.recommendationTags(view,100);
 second[0].tags=['after_topic'];second[0].allTags=['after_topic'];f.logic.invalidateGrouping(second);
 const after=plain(f.logic.recommendationTags(view,100));
 assert(after.some(entry=>entry.tag==='after topic'));assert(!after.some(entry=>entry.tag==='before topic'));
 assert.deepEqual(after,plain(f.logic.recommendationTags(structuredClone(view),100)));
});
test('each repeated parent invalidation refreshes a cached view even after its original batch is already invalid',()=>{
 const f=fixture(),parent=f.logic.groupWorks([work(1,['first_topic'])]),view=parent.slice();
 assert.equal(f.logic.recommendationTags(view,100)[0].tag,'first topic');
 for(const tag of ['second_topic','third_topic','fourth_topic']){
  parent[0].tags=[tag];parent[0].allTags=[tag];f.logic.invalidateGrouping(parent);
  const after=plain(f.logic.recommendationTags(view,100));
  assert.deepEqual(after,[{tag:tag.replaceAll('_',' '),count:1}]);
  assert.deepEqual(after,plain(f.logic.recommendationTags(structuredClone(view),100)));
 }
});

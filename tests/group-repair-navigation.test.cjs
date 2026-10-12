const test=require('node:test'),assert=require('node:assert/strict');
const navigation=require('../wwwroot/artwork-navigation.js'),logic=require('../wwwroot/catalog-logic.js');
test('a repaired union becomes two adjacent works and preserves the selected artwork in both directions',async()=>{
 const first={key:'danbooru:1',memberKeys:['danbooru:1']},second={key:'rule34:2',memberKeys:['rule34:2']};
 const old={key:first.key,memberKeys:[first.key,second.key]},tail={key:'gelbooru:3'};
 let source=[old,tail];const route=navigation.create({items:source,current:old,read:()=>source,
  same:(a,b)=>[a.key,...a.memberKeys||[]].some(k=>[b.key,...b.memberKeys||[]].includes(k)),merge:logic.mergeGroupedWorks});
 source=[first,second,tail];route.replaceGroup(old,[first,second]);
 assert.equal(route.state.index,0);assert.equal(route.items.length,3);
 assert.equal((await route.move(1)).key,second.key);assert.equal((await route.move(-1)).key,first.key);
});

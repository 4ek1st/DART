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

test('linked different publications stay individually selectable after detail enrichment and source sync',async()=>{
 const first={key:'danbooru:5783052',source:'danbooru',id:'5783052',groupKey:'danbooru:parent:5397965',pixivGroupKey:'pixiv:102339528'},
  second={key:'danbooru:5397965',source:'danbooru',id:'5397965',groupKey:'danbooru:parent:5397965',pixivGroupKey:'pixiv:98765090'};
 let source=logic.groupWorks([first,second]);
 assert.equal(typeof logic.sameWork,'function');
 assert.equal(logic.sameWork(source[0],source[1]),false);
 const route=navigation.create({items:source,current:source[0],read:()=>source,same:logic.sameWork,merge:logic.mergeGroupedWorks});
 route.update({...source[1],title:'Updated second publication'});
 assert.equal(route.state.index,0);
 assert.equal((await route.move(1)).key,second.key);
 route.select(source[1]);assert.equal(route.state.index,1);
 assert.equal((await route.move(-1)).key,first.key);
});

test('viewing one confirmed publication does not hide a different linked publication',()=>{
 const first={key:'danbooru:5783052',groupKey:'danbooru:parent:5397965',pixivGroupKey:'pixiv:102339528'},
  second={key:'danbooru:5397965',groupKey:'danbooru:parent:5397965',pixivGroupKey:'pixiv:98765090'};
 const known=new Set(logic.workHistoryTokens(first));
 assert.deepEqual(logic.hideViewedWorks([second],known),[second]);
 const unknown={key:'rule34:10',groupKey:'rule34:parent:9'},parent={key:'rule34:9'};
 assert.equal(logic.hideViewedWorks([unknown],new Set(logic.workHistoryTokens(parent))).length,0);
});

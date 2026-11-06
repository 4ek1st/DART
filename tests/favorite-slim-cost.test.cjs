'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const F=require('../wwwroot/favorites.js');
const bytes=value=>Buffer.byteLength(JSON.stringify(value),'utf8');
const tags=(count,unicode=false)=>Array.from({length:count},(_,index)=>(unicode?'neutral_虹色_\u{1f308}_':'neutral_fixture_detail_')+index);
// These fixtures already have the wire schema produced before the byte-budget
// stage. The frozen pop reference specifies the existing removal priority.
function fixture(members=4,unicode=false){
 const value=F.slim({key:'danbooru:1',source:'danbooru',id:'1',title:'Neutral fixture',thumbnail:'https://example.test/thumb.jpg',images:['https://example.test/full.jpg'],tags:[],allTags:[],characterTags:[],copyrightTags:[]});
 value.tags=tags(160,unicode);value.allTags=tags(220,unicode);value.characterTags=['fixture_character'];value.copyrightTags=['fixture_series'];
 value.groupMembers=Array.from({length:members},(_,index)=>({key:'danbooru:'+(index+2),source:'danbooru',id:String(index+2),tags:[...value.allTags,...value.characterTags,...value.copyrightTags],participants:[]}));
 return value;
}
function legacyBudget(value){
 const result=structuredClone(value);
 for(const field of ['allTags','tags','copyrightTags','characterTags'])
  while(result[field].length&&bytes(result)>30000){result[field].pop();result.filteringComplete=false;}
 while(result.groupMembers.length&&bytes(result)>30000){result.groupMembers.pop();result.filteringComplete=false;}
 while(result.imageRecords.length&&bytes(result)>30000)result.imageRecords.pop();
 while(result.images.length>1&&bytes(result)>30000)result.images.pop();
 return result;
}
for(const unicode of [false,true])for(const count of [0,2,4,8,32])test(`bounded activity metadata preserves the legacy byte budget and prefix order (${count} members, Unicode ${unicode})`,()=>{
 const input=fixture(count,unicode),before=structuredClone(input),expected=legacyBudget(input),actual=F.slim(input);
 assert.deepEqual(actual,expected);assert(bytes(actual)<=30000);assert.deepEqual(input,before,'Preparing activity must not trim saved metadata');
});
test('byte trimming does not serialize the complete large grouped work hundreds of times',()=>{
 const input=fixture(32),stringify=JSON.stringify;let complete=0,total=0;
 JSON.stringify=function(value,...args){total++;if(value?.key===input.key&&Array.isArray(value.groupMembers))complete++;return stringify.call(this,value,...args);};
 let result;try{result=F.slim(input);}finally{JSON.stringify=stringify;}
 assert.equal(result.filteringComplete,false);assert(bytes(result)<=30000);
 assert(complete<=2,`Whole grouped envelope was serialized ${complete} times`);
 assert(total<=80,`Byte budget required ${total} serialization passes`);
});
test('image records trim before images without changing the one-image minimum or completeness policy',()=>{
 const input=fixture(0);input.tags=[];input.allTags=[];input.characterTags=[];input.copyrightTags=[];
 input.images=Array.from({length:100},(_,index)=>'https://example.test/'+String(index)+'/'+('x'.repeat(500))+'.jpg');
 input.imageRecords=input.images.map(url=>({url,hash:'a'.repeat(32),owner:input.key}));
 assert.deepEqual(F.slim(input),legacyBudget(input));
 assert.equal(F.slim(input).filteringComplete,true);assert(F.slim(input).images.length>=1);
});
test('an oversized scalar envelope retains its fields and stops at the original minimum',()=>{
 const input=fixture(0);input.creatorName='虹'.repeat(2000);input.creatorTag='虹'.repeat(2000);input.artist='虹'.repeat(2000);input.artistId='虹'.repeat(2000);input.uploaderName='虹'.repeat(2000);input.uploaderId='虹'.repeat(2000);
 assert.deepEqual(F.slim(input),legacyBudget(input));
});

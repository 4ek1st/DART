const test=require('node:test'),assert=require('node:assert/strict');
const logic=require('../wwwroot/catalog-logic.js');
const make=(source,id,pub,parent,hash)=>({source,id:String(id),key:`${source}:${id}`,
  groupKey:parent?`${source}:parent:${parent}`:`pixiv:${pub}`,pixivGroupKey:pub?`pixiv:${pub}`:'',
  originalUrl:pub?`https://www.pixiv.net/artworks/${pub}`:'',contentHash:hash||'',
  images:[`https://fixture.test/${source}-${id}.jpg`],creatorTag:'confirmed_artist',tags:['one_character'],characterTags:['one_character']});
function reported(){return [
 make('danbooru',5783052,102339528,5397965,'3'.repeat(32)),
 make('rule34',6169396,98765090),make('rule34',6169395,98765090),
 make('danbooru',5397965,98765090,5397965,'4'.repeat(32)),
 make('gelbooru',7317292,98765090,null,'4'.repeat(32))];}

test('a Danbooru parent linking two distinct Pixiv publications cannot combine their galleries',()=>{
 const groups=logic.groupWorks(reported());assert.equal(groups.length,2);
 const animation=groups.find(g=>g.memberKeys.includes('danbooru:5783052'));
 assert.deepEqual(animation.memberKeys,['danbooru:5783052']);assert.equal(animation.images.length,1);
 const other=groups.find(g=>g.memberKeys.includes('danbooru:5397965'));
 assert.equal(other.memberKeys.length,4);
});
test('an unknown publication cannot bridge conflicting parents before its exact file match is resolved',()=>{
 const a=make('danbooru',1,100001,1,'a'.repeat(32)),b=make('danbooru',2,100002,1,'b'.repeat(32));
 const unknown=make('danbooru',3,null,1,'b'.repeat(32));
 for(const items of [[a,unknown,b],[unknown,a,b],[b,a,unknown]]){
  const groups=logic.groupWorks(structuredClone(items));assert.equal(groups.length,2);
  assert.equal(groups.find(g=>g.memberKeys.includes(b.key)).memberKeys.length,2);
 }
});
test('a verified exact copy still joins when a catalog misattributes its publication URL',()=>{
 const groups=logic.groupWorks([make('danbooru',1,100001,1,'a'.repeat(32)),make('gelbooru',2,100002,null,'a'.repeat(32))]);
 assert.equal(groups.length,1);assert.equal(groups[0].images.length,1);
});
test('published group evidence survives saved JSON and detail hydration without parent contamination',()=>{
 const initial=logic.groupWorks(reported());
 assert(initial.every(g=>g.groupingVersion===2&&(g.memberKeys.length===1||g.groupMembers.length)));
 const saved=JSON.parse(JSON.stringify(initial));
 const refreshed=logic.mergeDetailPages(saved.find(g=>g.key==='danbooru:5783052'),reported()[0]);
 assert.equal(refreshed.groupingVersion,2);
 const next=logic.groupWorks([refreshed,...saved.filter(g=>g.key!=='danbooru:5783052'),...reported()]);
 assert.equal(next.length,2);assert.equal(next.find(g=>g.key==='danbooru:5783052').images.length,1);
});
test('legacy repair requires every member and retains all saved identities in the split groups',()=>{
 const members=reported(),old={...members[0],memberKeys:members.map(m=>m.key),images:members.flatMap(m=>m.images)};
 assert.equal(logic.repairLegacyGroup(old,members.slice(0,4)),null);
 const groups=logic.repairLegacyGroup(old,members);assert.equal(groups.length,2);
 assert.deepEqual(new Set(groups.flatMap(g=>g.memberKeys)),new Set(old.memberKeys));
 assert.equal(logic.needsGroupRepair(old),true);assert(groups.every(g=>!logic.needsGroupRepair(g)));
});

test('a partial listing cannot erase known publication boundaries or let an old union return',()=>{
 const members=reported(),fixed=logic.groupWorks(members);
 const partial={...members[0],originalUrl:'',pixivGroupKey:''};
 assert.equal(logic.groupWorks([...fixed,partial]).length,2);
 const old={...members[0],memberKeys:members.map(m=>m.key),images:members.flatMap(m=>m.images)};
 const animation=fixed.find(g=>g.key===members[0].key);
 assert.equal(logic.mergeWorkMetadata(animation,old),animation);
 const untouched=[members[0]];assert.equal(logic.replaceRepairedGroups(untouched,old,fixed),untouched);
});

test('an incomplete legacy repair never silently drops a saved extra image',()=>{
 const members=reported(),old={...members[0],memberKeys:members.map(m=>m.key),images:[...members.flatMap(m=>m.images),'https://fixture.test/unmapped-version.jpg']};
 assert.equal(logic.repairLegacyGroup(old,members),null);
});

test('partial post metadata keeps the per-member evidence of a verified saved group',()=>{
 const members=reported(),group=logic.groupWorks(members).find(g=>g.memberKeys.length>1);
 const raw=members.find(m=>m.key===group.key);
 const merged=logic.mergeWorkMetadata(group,{...raw,groupingVersion:0,groupMembers:[]});
 assert.equal(merged.groupingVersion,2);assert.equal(merged.groupMembers.length,4);
 assert.equal(logic.groupWorks([merged])[0].memberKeys.length,4);
});

const {test}=require('node:test'),assert=require('node:assert/strict');
const G=require('../wwwroot/favorite-groups.js');
const work=id=>({key:`danbooru:${id}`,source:'danbooru',id:String(id),memberKeys:[`danbooru:${id}`],title:`Work ${id}`});
test('manual groups collapse into a target-first card without changing artwork identities',()=>{
 const items=[work(1),work(2),work(3)],before=JSON.stringify(items);
 const rows=G.layout(items,[{id:'pack',keys:['danbooru:2','danbooru:1']}]);
 assert.equal(rows.length,2);assert.equal(rows[0].item,items[1]);assert.deepEqual(rows[0].items,[items[1],items[0]]);
 assert.equal(JSON.stringify(items),before);assert.equal(rows[1].item,items[2]);
});
test('filtered members never leak into a visible group, aliases and stale keys are deduplicated',()=>{
 const one=work(1);one.memberKeys.push('gelbooru:9');
 const rows=G.layout([one,work(3)],[{id:'pack',keys:['gelbooru:9','danbooru:2','danbooru:1']}]);
 assert.equal(rows.length,2);assert.deepEqual(rows[0].items,[one]);assert.equal(rows[0].groupId,'pack');
});
test('failed grouping preserves the collection and a stale load cannot undo a saved drop',async()=>{
 let finish,fail=false,calls=0;const messages=[];
 const c=G.create({request:(url,init)=>{calls++;if(!init)return new Promise(resolve=>finish=resolve);if(fail)throw Error('Disk');return Promise.resolve([{id:'pack',keys:['danbooru:2','danbooru:1']}]);},toast:x=>messages.push(x)});
 const loading=c.load();assert.equal(await c.merge('danbooru:1','danbooru:2'),true);finish([]);await loading;
 assert.equal(c.groups()[0].id,'pack');fail=true;assert.equal(await c.ungroup('pack'),false);
 assert.equal(c.groups()[0].id,'pack');assert.equal(messages.length,1);assert.equal(c.pending,false);
 assert.equal(await c.merge('danbooru:1','danbooru:1'),false);assert.equal(calls,3);
});

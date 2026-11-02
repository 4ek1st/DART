const {test}=require('node:test'), assert=require('node:assert/strict');
const A=require('../wwwroot/artwork-actions.js');
const Logic=require('../wwwroot/catalog-logic.js');
const work=(id,extra={})=>({key:`danbooru:${id}`,source:'danbooru',id:String(id),title:'Forest',rating:'g',
 thumbnail:'https://cdn.donmai.us/preview.jpg',images:[`https://cdn.donmai.us/${id}.jpg`],...extra});
test('hidden identity uses strong mirrors without weak parent collisions',()=>{
 const h=A.create({tokens:Logic.workHistoryTokens});h.restore([work(1,{contentHash:'a'.repeat(32),groupKey:'danbooru:parent:1'})]);
 assert.equal(h.isHidden(work(2,{contentHash:'a'.repeat(32)})),true);
 assert.equal(h.isHidden(work(3,{groupKey:'danbooru:parent:1'})),false);
});
test('failed hide rolls back its work and retains independent hides',async()=>{
 let reject;const h=A.create({request:()=>new Promise((yes,no)=>{reject=no;}),tokens:Logic.workHistoryTokens});
 h.restore([work(9)]);const p=h.setHidden(work(1),true);assert.equal(h.isHidden(work(1)),true);
 await Promise.resolve();reject(Error('disk'));await p;assert.equal(h.isHidden(work(1)),false);assert.equal(h.isHidden(work(9)),true);
});
test('stale refresh cannot erase a confirmed hide',async()=>{
 let finish;const h=A.create({tokens:Logic.workHistoryTokens,request:async(url,options)=>options?[work(1)]:new Promise(resolve=>{finish=resolve;})});
 const loading=h.load();await h.setHidden(work(1),true);finish([]);await loading;assert.equal(h.isHidden(work(1)),true);
});
test('media target prefers clicked gallery image and validates supported hosts',()=>{
 assert.equal(A.media(work(1),'https://cdn.donmai.us/second.png'),'https://cdn.donmai.us/second.png');
 assert.equal(A.media(work(1),'javascript:alert(1)'),'https://cdn.donmai.us/1.jpg');
 assert.equal(A.media(work(1,{images:['https://evil.test/a.jpg'],thumbnail:'https://evil.test/a.jpg'})),null);
});
test('download uses the full selected media and a stable safe filename',async()=>{
 const calls=[]; const h=A.create({download:(url,name)=>calls.push([url,name])});
 await h.run('download',{item:work(1),mediaUrl:'https://cdn.donmai.us/second.png'});
 assert.equal(calls[0][0],'/api/image?url=https%3A%2F%2Fcdn.donmai.us%2Fsecond.png');assert.match(calls[0][1],/danbooru-1\.png$/);
});
test('copy image starts clipboard write before delayed image conversion completes',async()=>{
 let finish, value; const calls=[];
 const h=A.create({png:()=>new Promise(resolve=>{finish=resolve;}),copyImage:promise=>{calls.push('write');value=promise;return Promise.resolve();}});
 const p=h.run('copy-image',{item:work(1)});assert.deepEqual(calls,['write']);
 finish(new Blob(['png'],{type:'image/png'}));await p;assert.equal((await value).type,'image/png');
});
test('copy link/tag/author use their exact intended value',async()=>{
 const texts=[];const h=A.create({copyText:text=>texts.push(text)});
 await h.run('copy-link',{item:work(1)});await h.run('copy-value',{kind:'tag',tag:'blue_archive'});
 await h.run('copy-value',{kind:'author',author:{name:'Test Artist',artistId:'test_artist'}});
 assert.deepEqual(texts,['https://danbooru.donmai.us/posts/1','blue_archive','test_artist']);
});

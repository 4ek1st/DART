'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Preview=require('../wwwroot/tag-preview.js'),app=fs.readFileSync(require.resolve('../wwwroot/app.js'),'utf8');
const item=(id,tags=['forest'],more={})=>({key:'danbooru:'+id,tags,...more});
const scope={sources:['danbooru','rule34','sankaku'],rating:'all'};
function fixture(load){
 const calls=[],context=vm.createContext({AbortSignal:{any:AbortSignal.any,timeout:()=>AbortSignal.timeout(5)},URLSearchParams,
  DartTagPreview:Preview,tagPreviewAllowed:work=>!work.hidden,request:async(url,options)=>{
   const params=new URL(url,'https://example.test').searchParams;calls.push({source:params.get('sources'),q:params.get('q'),priority:options.priority});
   return load(params.get('sources'),options.signal);
  }});
 const start=app.indexOf('async function searchTagPreview(');
 vm.runInContext(app.slice(start,app.indexOf('\nfunction tagPreviewController(',start)),context);
 return{calls,search:signal=>context.searchTagPreview('forest',scope,signal||new AbortController().signal)};
}
test('a preview stops at the first catalog with an eligible exact example and keeps provider result order',async()=>{
 const eligible=[item(3),item(2)];
 const f=fixture(async source=>({items:source==='danbooru'?[item(1,['forest_path']),item(4,['forest'],{hidden:true})]:eligible}));
 assert.deepEqual(Array.from(await f.search()),[eligible[0]]);assert.deepEqual(f.calls.map(x=>x.source),['danbooru','rule34']);
 assert(f.calls.every(x=>x.priority==='background'&&x.q==='forest'));
});
test('filtered first rows retain the same round-robin order as the actual search interface',async()=>{
 const a=fixture(async source=>({items:source==='danbooru'?[item(1,['forest'],{hidden:true}),item(2)]:[item(3)]}));
 assert.equal((await a.search())[0].key,'danbooru:3','B1 precedes the eligible A2');
 const b=fixture(async source=>({items:[item(1,['forest_path']),item(source==='danbooru'?2:3)]}));
 assert.equal((await b.search())[0].key,'danbooru:2','A2 precedes B2 after all first rows were checked');
});
test('one stalled catalog cannot hold the next preview catalog',async()=>{
 const f=fixture((source,signal)=>source==='danbooru'?new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>resolve({items:[]}),100);
  signal.addEventListener('abort',()=>{clearTimeout(timer);reject(signal.reason)},{once:true});
 }):Promise.resolve({items:[item(5)]}));
 assert.equal((await f.search())[0].key,'danbooru:5');assert.equal(f.calls.length,2);
});
test('provider errors stay retryable and caller cancellation does not visit the next provider',async()=>{
 const f=fixture(async()=>{throw Error('Unavailable')});await assert.rejects(f.search(),/Unavailable/);assert.equal(f.calls.length,3);
 const controller=new AbortController(),cancel=fixture(async()=>{controller.abort();throw controller.signal.reason;});
 await assert.rejects(cancel.search(controller.signal),{name:'AbortError'});assert.equal(cancel.calls.length,1);
});

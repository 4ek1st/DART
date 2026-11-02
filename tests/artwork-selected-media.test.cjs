const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const CatalogLogic=require('../wwwroot/catalog-logic.js'),DartArtworkActions=require('../wwwroot/artwork-actions.js');
const app=fs.readFileSync(require.resolve('../wwwroot/app.js'),'utf8');
const block=app.slice(app.indexOf('async function resolveArtworkActionMedia('),app.indexOf('\nasync function artworkPng('));
const url=(hash,expiry)=>`https://s.sankakucomplex.com/data/aa/bb/${hash.repeat(32)}.jpg?e=${expiry}&m=signature`;
function fixture(missing=false){
 const first=url('a',4102444800),old=url('b',1),fresh=url('b',4102444800),calls=[];
 const item={key:'sankaku:one',source:'sankaku',id:'one',images:[first,old],memberKeys:['sankaku:one','sankaku:two'],imageRecords:[{url:old,owner:'sankaku:two'}]};
 const context=vm.createContext({CatalogLogic,DartArtworkActions,URLSearchParams,itemIndex:new Map([[item.key,item]]),rememberItem:value=>value,
   request:async path=>{calls.push(path);return{key:'sankaku:two',source:'sankaku',id:'two',images:missing?[first]:[first,fresh]};}});
 vm.runInContext(block,context);return{context,item,first,old,fresh,calls};
}
test('renewal retains the selected second gallery image and requests its owner',async()=>{
 const f=fixture();assert.equal(await f.context.resolveArtworkActionMedia(f.item,f.old),f.fresh);
 assert.equal(new URL(f.calls[0],'https://test').searchParams.get('id'),'two');
});
test('an unavailable selected gallery image fails instead of copying the first image',async()=>{
 const f=fixture(true);await assert.rejects(f.context.resolveArtworkActionMedia(f.item,f.old));
});

const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(){const source=fs.readFileSync(require.resolve('../wwwroot/app.js'),'utf8'),item={key:'rule34:123',images:['https://example.test/clip.mp4']},writes=[];let decodes=0;
 const context={Map,CatalogLogic:require('../wwwroot/catalog-logic.js'),itemIndex:new Map([[item.key,item]]),runVisualHashJob:async job=>job(),
  createImageBitmap:async blob=>{decodes++;return{blob,close(){}}},catalogBitmapFingerprint:()=>({hash:'0123456789abcdef',perceptualHash:'fedcba9876543210'}),
  publishCardEvidence:(item,update)=>{Object.assign(item,update);writes.push(update)}};
 vm.createContext(context);const start=source.indexOf('async function rememberVideoFrames('),end=source.indexOf('\nglobalThis.DartVideoPreview?.attach',start);
 vm.runInContext('const videoFingerprintValues=new Map();'+source.slice(start,end),context);
 return{item,writes,decodes:()=>decodes,remember:context.rememberVideoFrames};}
test('real video-preview blob contract learns all five frames once and reuses evidence',async()=>{
 const f=fixture(),entry={blobs:[1,2,3,4,5],times:[1,2,3,4,5],duration:26.8667,width:320,height:180},context={key:f.item.images[0],url:f.item.images[0],card:{dataset:{key:f.item.key},isConnected:true},signal:new AbortController().signal};
 await f.remember(entry,context);assert.equal(f.writes.length,1);assert.equal(f.decodes(),5);assert.equal(f.item.videoSamples[0].frames.length,5);
 await f.remember(entry,context);assert.equal(f.decodes(),5);assert.equal(f.writes.length,1);
});
test('cancelled or unowned video preview cannot publish grouping evidence',async()=>{
 const f=fixture(),c=new AbortController();c.abort();const entry={blobs:[1,2,3,4,5],duration:26,width:320,height:180};
 await f.remember(entry,{key:f.item.key,url:f.item.images[0],signal:c.signal});
 await f.remember(entry,{key:f.item.key,url:'https://example.test/other.mp4',signal:new AbortController().signal});
 assert.equal(f.decodes(),0);assert.equal(f.writes.length,0);
});

const {test}=require('node:test'),assert=require('node:assert/strict');
const Copy=require('../wwwroot/artwork-image-copy.js');
const png=(width,height)=>{const data=new Uint8Array(33),view=new DataView(data.buffer);data.set([137,80,78,71,13,10,26,10]);view.setUint32(8,13);data.set([73,72,68,82],12);view.setUint32(16,width);view.setUint32(20,height);return new Blob([data],{type:'image/png'});};
test('oversized originals are rejected before allocating a decoded bitmap',async()=>{
 let decoded=0;const converter=Copy.create({decode:()=>{decoded++;throw Error('Must not decode');}});
 await assert.rejects(converter.convert({blob:png(30000,30000)}),error=>error.code==='copy-image-too-large');assert.equal(decoded,0);
});
test('unknown dimensions fail closed before decoding',async()=>{
 let decoded=0;const converter=Copy.create({decode:()=>{decoded++;}});
 await assert.rejects(converter.convert({blob:new Blob(['unknown'],{type:'image/png'})}),error=>error.code==='copy-image-format');assert.equal(decoded,0);
});
test('a bounded conversion serializes memory use and releases its decoded bitmap',async()=>{
 let finish,closed=0;const converter=Copy.create({decode:async()=>({width:64,height:32,close:()=>closed++}),
   encode:()=>new Promise(resolve=>finish=resolve)});
 const first=converter.convert({blob:png(64,32)});await new Promise(resolve=>setImmediate(resolve));
 await assert.rejects(converter.convert({blob:png(64,32)}),error=>error.code==='copy-image-busy');
 finish(new Blob(['png'],{type:'image/png'}));assert.equal((await first).type,'image/png');assert.equal(closed,1);
});
test('dimensions come from encoded PNG/JPEG/GIF/WebP headers, including large WebP payloads',async()=>{
 assert.deepEqual(Copy.dimensions(await png(100,50).arrayBuffer()),{width:100,height:50});
 const jpeg=Uint8Array.from([255,216,255,192,0,8,8,0,50,0,100,1]);
 assert.deepEqual(Copy.dimensions(jpeg.buffer),{width:100,height:50});
 const gif=new Uint8Array(24);gif.set(Buffer.from('GIF89a'));new DataView(gif.buffer).setUint16(6,100,true);new DataView(gif.buffer).setUint16(8,50,true);
 gif[13]=0x2c;new DataView(gif.buffer).setUint16(18,100,true);new DataView(gif.buffer).setUint16(20,50,true);
 assert.deepEqual(Copy.dimensions(gif.buffer),{width:100,height:50});
 const webp=new Uint8Array(30),view=new DataView(webp.buffer);webp.set(Buffer.from('RIFF'));webp.set(Buffer.from('WEBPVP8 '),8);view.setUint32(16,4*1024*1024,true);
 webp.set([0x9d,1,0x2a],23);view.setUint16(26,100,true);view.setUint16(28,50,true);
 assert.deepEqual(Copy.dimensions(webp.buffer,5*1024*1024),{width:100,height:50});
});
test('untrusted inner GIF frames cannot allocate beyond a smaller declared canvas',async()=>{
 let decoded=0;const data=new Uint8Array(24),view=new DataView(data.buffer);data.set(Buffer.from('GIF89a'));view.setUint16(6,100,true);view.setUint16(8,50,true);
 data[13]=0x2c;view.setUint16(18,30000,true);view.setUint16(20,30000,true);
 const converter=Copy.create({decode:()=>decoded++});await assert.rejects(converter.convert({blob:new Blob([data])}),error=>error.code==='copy-image-too-large');assert.equal(decoded,0);
});
test('already loaded pixels avoid another decode and keep the output within the pixel budget',async()=>{
 let output;const element={naturalWidth:30000,naturalHeight:20000};
 const converter=Copy.create({decode:()=>{throw Error('Loaded pixels must be reused');},encode:async(image,size)=>{assert.equal(image,element);output=size;return new Blob(['png']);}});
 await converter.convert({element});assert.ok(output.width*output.height<=16*1024*1024);assert.ok(output.width<=8192&&output.height<=8192);
 assert.equal(element.naturalWidth,30000);
});

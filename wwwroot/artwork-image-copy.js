(function(root){
  'use strict';
  const MAX_PIXELS=16*1024*1024,MAX_EDGE=8192,MAX_HEADER=2*1024*1024;
  const failure=code=>Object.assign(Error(code),{code});
  const within=({width,height})=>Number.isSafeInteger(width)&&Number.isSafeInteger(height)&&width>0&&height>0&&width<=MAX_EDGE&&height<=MAX_EDGE&&width*height<=MAX_PIXELS;
  function dimensions(buffer,totalSize=buffer.byteLength){
    const b=new Uint8Array(buffer),v=new DataView(b.buffer,b.byteOffset,b.byteLength),text=(offset,count)=>String.fromCharCode(...b.subarray(offset,offset+count));
    const size=(width,height)=>width>0&&height>0?{width,height}:null;
    if(b.length>=33&&b[0]===137&&text(1,3)==='PNG'&&v.getUint32(4)===0x0d0a1a0a&&v.getUint32(8)===13&&text(12,4)==='IHDR')return size(v.getUint32(16),v.getUint32(20));
    if(b.length>=10&&['GIF87a','GIF89a'].includes(text(0,6))){
      const canvas=size(v.getUint16(6,true),v.getUint16(8,true));if(!canvas||!within(canvas))return canvas;
      let offset=13+(b[10]&128?3*(1<<((b[10]&7)+1)):0);
      while(offset<b.length){
        if(b[offset]===0x2c&&offset+10<=b.length){const frame=size(v.getUint16(offset+5,true),v.getUint16(offset+7,true));return frame&&within(frame)?canvas:frame;}
        if(b[offset++]!==0x21)return null;offset++;
        for(;;){if(offset>=b.length)return null;const length=b[offset++];if(!length)break;offset+=length;}
      }return null;
    }
    if(b.length>=4&&b[0]===255&&b[1]===216){
      let offset=2;
      while(offset+4<=b.length){
        if(b[offset++]!==255)return null;while(b[offset]===255)offset++;
        const marker=b[offset++];if(marker===0xd9||marker===0xda)return null;
        if(marker===1||marker>=0xd0&&marker<=0xd8)continue;
        if(offset+2>b.length)return null;const length=v.getUint16(offset);if(length<2||offset+length>b.length)return null;
        if(marker>=0xc0&&marker<=0xcf&&![0xc4,0xc8,0xcc].includes(marker))return length>=8?size(v.getUint16(offset+5),v.getUint16(offset+3)):null;
        offset+=length;
      }return null;
    }
    if(b.length>=25&&text(0,4)==='RIFF'&&text(8,4)==='WEBP'){
      let canvas=null,offset=12;
      const u24=p=>b[p]+b[p+1]*256+b[p+2]*65536;
      while(offset+8<=b.length){const kind=text(offset,4),length=v.getUint32(offset+4,true),payload=offset+8;
        if(payload+length>totalSize)return null;
        if(kind==='VP8X'&&length>=10&&payload+10<=b.length){canvas=size(u24(payload+4)+1,u24(payload+7)+1);if(!canvas||!within(canvas))return canvas;}
        if(kind==='VP8 '&&length>=10&&payload+10<=b.length&&b[payload+3]===0x9d&&b[payload+4]===1&&b[payload+5]===0x2a){const frame=size(v.getUint16(payload+6,true)&0x3fff,v.getUint16(payload+8,true)&0x3fff);return frame&&within(frame)?canvas||frame:frame;}
        if(kind==='VP8L'&&length>=5&&payload+5<=b.length&&b[payload]===0x2f){const bits=v.getUint32(payload+1,true),frame=size((bits&0x3fff)+1,((bits>>>14)&0x3fff)+1);return within(frame)?canvas||frame:frame;}
        // Animation frames have additional nested image headers. Reuse existing
        // displayed pixels instead of allocating an unvalidated original here.
        if(kind==='ANIM'||kind==='ANMF')return null;
        offset=payload+length+(length&1);
      }
    }return null;
  }
  function create({decode=blob=>createImageBitmap(blob),encode}={}){
    let busy=false;
    return{async convert({blob,load,element}={}){
      if(busy)throw failure('copy-image-busy');busy=true;let bitmap;
      try{
        let image=element;
        if(!image){
          blob ||= await load?.();
          if(!blob||blob.size>30*1024*1024)throw failure('copy-image-too-large');
          const header=dimensions(await blob.slice(0,MAX_HEADER).arrayBuffer(),blob.size);
          if(!header)throw failure('copy-image-format');if(!within(header))throw failure('copy-image-too-large');
          image=bitmap=await decode(blob);
          if(!within({width:image.width,height:image.height}))throw failure('copy-image-too-large');
        }
        const width=image.videoWidth||image.naturalWidth||image.width,height=image.videoHeight||image.naturalHeight||image.height;
        if(!width||!height)throw failure('copy-image-format');
        const scale=Math.min(1,MAX_EDGE/width,MAX_EDGE/height,Math.sqrt(MAX_PIXELS/(width*height)));
        const output={width:Math.max(1,Math.floor(width*scale)),height:Math.max(1,Math.floor(height*scale))};
        if(encode)return await encode(image,output);
        const canvas=document.createElement('canvas');canvas.width=output.width;canvas.height=output.height;
        try{canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
          return await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(failure('copy-image-format')),'image/png'));
        }finally{canvas.width=canvas.height=1;}
      }finally{bitmap?.close();busy=false;}
    }};
  }
  const api={create,dimensions,within};root.DartArtworkImageCopy=api;
  if(typeof module!=='undefined')module.exports=api;
})(globalThis);

(function (root) {
  'use strict';
  const fail = code => { throw new Error(code); };
  const text = (bytes, offset, length) => String.fromCharCode(...bytes.subarray(offset, offset + length));
  function inspect(value) {
    const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
    if (bytes.length > 64 * 1024 * 1024) fail('too-large');
    if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
    if (text(bytes, 0, 3) === 'GIF') fail('animated');
    if (bytes[0] === 137 && text(bytes, 1, 3) === 'PNG') {
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      for (let offset = 8; offset <= bytes.length - 12;) {
        const size = view.getUint32(offset), type = text(bytes, offset + 4, 4);
        if (size > bytes.length - offset - 12) fail('image');
        if (type === 'acTL') fail('animated');
        offset += size + 12;
      }
      return 'image/png';
    }
    if (text(bytes, 0, 4) === 'RIFF' && text(bytes, 8, 4) === 'WEBP') {
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      for (let offset = 12; offset <= bytes.length - 8;) {
        const size = view.getUint32(offset + 4, true), type = text(bytes, offset, 4);
        if (type === 'ANIM' || type === 'ANMF' || type === 'VP8X' && bytes[offset + 8] & 2) fail('animated');
        if (size > bytes.length - offset - 8) fail('image');
        offset += size + 8 + (size & 1);
      }
      return 'image/webp';
    }
    if (text(bytes, 4, 4) === 'ftyp') {
      let avif = false;
      const size = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0);
      if (size > bytes.length || size < 16) fail('image');
      for (let offset = 8; offset <= size - 4; offset += offset === 8 ? 8 : 4) {
        const brand = text(bytes, offset, 4);
        if (brand === 'avis') fail('animated');
        if (brand === 'avif') avif = true;
      }
      if (avif) return 'image/avif';
    }
    fail('image');
  }
  function dimensions(width, height, scale) {
    if (![2, 4].includes(scale)) fail('scale');
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) fail('image');
    if (width * height > 40_000_000 || width * height * scale * scale > 160_000_000 ||
        Math.max(width, height) * scale > 32768) fail('too-large');
    return { width, height };
  }
  function preflight(value, scale) {
    const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
    const type = inspect(bytes), view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const check = (width, height) => dimensions(width, height, scale);
    if (type === 'image/png' && bytes.length >= 24) check(view.getUint32(16), view.getUint32(20));
    if (type === 'image/jpeg') for (let offset = 2; offset < bytes.length - 8;) {
      if (bytes[offset++] !== 255) break;
      while (bytes[offset] === 255) offset++;
      const marker = bytes[offset++];
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker >= 0xd0 && marker <= 0xd8 || marker === 1) continue;
      if (offset + 2 > bytes.length) break;
      const size = view.getUint16(offset);
      if (size < 2 || size > bytes.length - offset) fail('image');
      if (size >= 7 && [0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {
        check(view.getUint16(offset + 5), view.getUint16(offset + 3)); break;
      }
      offset += size;
    }
    if (type === 'image/webp' && bytes.length >= 25) {
      const chunk = text(bytes,12,4), uint24 = offset => bytes[offset] | bytes[offset+1] << 8 | bytes[offset+2] << 16;
      if (chunk === 'VP8X' && bytes.length >= 30) check(uint24(24) + 1, uint24(27) + 1);
      else if (chunk === 'VP8 ' && bytes.length >= 30 && text(bytes,23,3) === '\x9d\x01\x2a') check(view.getUint16(26,true) & 16383, view.getUint16(28,true) & 16383);
      else if (chunk === 'VP8L' && bytes[20] === 47) {
        const bits = view.getUint32(21,true); check((bits & 16383) + 1, (bits >>> 14 & 16383) + 1);
      }
    }
    if (type === 'image/avif') {
      const boxes = (start, end, depth) => {
        if (depth > 5) return;
        for (let offset = start; offset <= end - 8;) {
          let size = view.getUint32(offset), header = 8;
          const kind = text(bytes,offset+4,4);
          if (size === 1) {
            if (offset + 16 > end || view.getUint32(offset+8) !== 0) fail('image');
            size = view.getUint32(offset+12); header = 16;
          } else if (size === 0) size = end - offset;
          if (size < header || size > end - offset) fail('image');
          if (kind === 'ispe' && size >= header + 12) check(view.getUint32(offset+header+4), view.getUint32(offset+header+8));
          if (['meta','iprp','ipco'].includes(kind)) boxes(offset+header+(kind==='meta'?4:0),offset+size,depth+1);
          offset += size;
        }
      };
      boxes(0,bytes.length,0);
    }
    return type;
  }
  async function normalize(blob, scale) {
    if (!blob || blob.size > 64 * 1024 * 1024) fail('too-large');
    const type = preflight(await blob.arrayBuffer(), scale);
    let bitmap;
    try {
      bitmap = await root.createImageBitmap(new Blob([blob], { type }), { imageOrientation: 'from-image' });
      const size = dimensions(bitmap.width, bitmap.height, scale);
      const canvas = new root.OffscreenCanvas(size.width, size.height);
      canvas.getContext('2d', { alpha: true }).drawImage(bitmap, 0, 0);
      const png = await canvas.convertToBlob({ type: 'image/png' });
      if (png.size > 64 * 1024 * 1024) fail('too-large');
      return { ...size, blob: png };
    } catch (error) { fail(['too-large', 'scale', 'image'].includes(error.message) ? error.message : 'image'); }
    finally { bitmap?.close(); }
  }
  const api = { inspect, preflight, dimensions, normalize };
  if (typeof module !== 'undefined') module.exports = api;
  else root.onmessage = async event => {
    try { root.postMessage({ result: await normalize(event.data.blob, event.data.scale) }); }
    catch (error) { root.postMessage({ error: error.message }); }
  };
})(globalThis);

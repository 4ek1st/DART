(function(root) {
  function isStaticRaster(bytes) {
    if (bytes[0] === 0xff && bytes[1] === 0xd8) return true;
    const text = (offset, length) => String.fromCharCode(...bytes.slice(offset, offset + length));
    const uint32 = offset => (bytes[offset] * 0x1000000 + (bytes[offset + 1] << 16) +
      (bytes[offset + 2] << 8) + bytes[offset + 3]) >>> 0;
    if (bytes[0] === 137 && text(1, 3) === 'PNG') {
      for (let offset = 8; offset + 8 <= bytes.length;) {
        const kind = text(offset + 4, 4);
        if (kind === 'acTL') return false;
        if (kind === 'IDAT') return true;
        offset += uint32(offset) + 12;
      }
      return false;
    }
    if (text(0, 4) === 'RIFF' && text(8, 4) === 'WEBP') {
      const kind = text(12, 4);
      return kind === 'VP8 ' || kind === 'VP8L' ||
        kind === 'VP8X' && bytes.length > 20 && (bytes[20] & 2) === 0;
    }
    // GIF, animated PNG/WebP, videos and unknown containers are never collapsed by a frame.
    return false;
  }

  function sameImagePixels(left, right) {
    if (!left || !right || !left.width || !right.width || !left.height || !right.height ||
        Math.abs(left.width / left.height - right.width / right.height) > 0.001) return false;
    const a = left.pixels, b = right.pixels, size = 128;
    if (a?.length !== size * size * 4 || b?.length !== a.length) return false;
    const blocks = new Float32Array(256);
    let total = 0;
    for (let pixel = 0; pixel < size * size; pixel++) {
      const offset = pixel * 4;
      if (Math.abs(a[offset + 3] - b[offset + 3]) > 2) return false;
      const delta = (Math.abs(a[offset] - b[offset]) + Math.abs(a[offset + 1] - b[offset + 1]) +
        Math.abs(a[offset + 2] - b[offset + 2])) / 3;
      if (delta > 12) return false;
      total += delta;
      const block = (Math.floor(pixel / size / 8) * 16) + Math.floor(pixel % size / 8);
      blocks[block] += delta / 64;
      if (blocks[block] > 2) return false;
    }
    // Tight local and global tolerances admit compression noise, not variant grouping.
    return total / (size * size) <= 1.1;
  }

  async function fingerprint(blob) {
    if (!isStaticRaster(new Uint8Array(await blob.slice(0, 65536).arrayBuffer()))) return null;
    const bitmap = await createImageBitmap(blob);
    try {
      const canvas = new OffscreenCanvas(128, 128);
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.imageSmoothingQuality = 'high';
      context.drawImage(bitmap, 0, 0, 128, 128);
      return { width: bitmap.width, height: bitmap.height,
        pixels: context.getImageData(0, 0, 128, 128).data };
    } finally { bitmap.close(); }
  }
  function createDuplicateIndex(saved = []) {
    const parents = new Map();
    let revision = 0;
    const valid = key => typeof key === 'string' && key.length <= 1000 && /^https?:\/\//i.test(key);
    const resolve = key => {
      for (let steps = 0; parents.has(key) && steps < 512; steps++) key = parents.get(key);
      return key;
    };
    const add = (left, right) => {
      if (!valid(left) || !valid(right)) return false;
      left = resolve(left); right = resolve(right);
      if (left === right) return false;
      // A stable ordering keeps restored relationships acyclic even if mirrors arrive in another order.
      parents.set(left > right ? left : right, left > right ? right : left);
      while (parents.size > 512) parents.delete(parents.keys().next().value);
      revision++;
      return true;
    };
    const restore = entries => {
      if (Array.isArray(entries)) for (const pair of entries.slice(-512))
        if (Array.isArray(pair) && pair.length === 2) add(pair[0], pair[1]);
    };
    restore(saved);
    return { resolve, add, restore, entries: () => [...parents], get revision() { return revision; } };
  }

  function uniqueImages(urls, index, keyForUrl, signatureForUrl) {
    const seen = [];
    return urls.filter(url => {
      const key = keyForUrl(url), signature = signatureForUrl(key);
      const duplicate = seen.find(previous => index.resolve(previous.key) === index.resolve(key) ||
        signature && sameImagePixels(previous.signature, signature));
      if (duplicate) { index.add(key, duplicate.key); return false; }
      seen.push({ key, signature });
      return true;
    });
  }

  const api = { isStaticRaster, sameImagePixels, fingerprint, createDuplicateIndex, uniqueImages };
  root.DartMediaDuplicates = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

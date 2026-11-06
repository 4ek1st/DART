(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DartFingerprintCache = api;
})(globalThis, function() {
  'use strict';
  const MAX_IMAGES = 512, MAX_VIDEOS = 64, MAX_BYTES = 480000;
  const hash = value => typeof value === 'string' && /^[a-f0-9]{16}$/i.test(value) ? value.toLowerCase() : '';
  const aspect = value => typeof value === 'number' && Number.isFinite(value) && value > 0;
  const object = value => value && typeof value === 'object' && !Array.isArray(value);

  function create({ cacheKey = value => value } = {}) {
    let bytes = 0;
    const recency = new Map();
    function keyOf(value) {
      if (typeof value !== 'string' || value.length > 1000) return '';
      try {
        const canonical = cacheKey(value);
        if (typeof canonical !== 'string' || canonical.length > 1000) return '';
        const url = new URL(canonical);
        // Canonicalization belongs to the shared media owner. Fail closed on
        // residual queries: do not persist credentials or conflate resized files.
        if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.href.length > 1000) return '';
        return url.href;
      } catch { return ''; }
    }
    function imageEvidence(value) {
      if (!object(value) || !hash(value.hash) || !hash(value.perceptualHash) || !aspect(value.aspectRatio)) return null;
      const layout = value.layout ?? '';
      if (typeof layout !== 'string' || layout.length > 1024 || layout &&
          (!layout.startsWith('vl1:') || /[^\x20-\x7e]/.test(layout))) return null;
      return Object.freeze({ hash: hash(value.hash), perceptualHash: hash(value.perceptualHash),
        aspectRatio: value.aspectRatio, layout });
    }
    function videoEvidence(value, key) {
      if (!object(value) || keyOf(value.url) !== key || !aspect(value.aspectRatio) ||
          typeof value.duration !== 'number' || !Number.isFinite(value.duration) ||
          value.duration < .2 || value.duration > 43200 || !Array.isArray(value.frames) || value.frames.length !== 5) return null;
      const frames = [];
      for (const frame of value.frames) {
        if (!object(frame) || !hash(frame.hash) || !hash(frame.perceptualHash)) return null;
        frames.push(Object.freeze({ hash: hash(frame.hash), perceptualHash: hash(frame.perceptualHash) }));
      }
      return Object.freeze({ url: key, duration: value.duration, aspectRatio: value.aspectRatio,
        frames: Object.freeze(frames) });
    }
    function boundedMap(kind, limit, validate) {
      return new class extends Map {
        set(rawKey, rawValue) {
          const key = keyOf(rawKey); if (!key) return this;
          let value;
          try { value = validate(rawValue, key); } catch { return this; }
          if (!value) return this;
          const size = JSON.stringify([key, value]).length + 1;
          if (size > MAX_BYTES) return this;
          this.delete(key);
          super.set(key, value);
          recency.set(kind + '\0' + key, { map: this, key, size }); bytes += size;
          while (this.size > limit) this.delete(this.keys().next().value);
          while (bytes > MAX_BYTES) { const oldest = recency.values().next().value; oldest.map.delete(oldest.key); }
          return this;
        }
        get(rawKey) {
          const key = super.has(rawKey) ? rawKey : keyOf(rawKey);
          if (!key || !super.has(key)) return undefined;
          const value = super.get(key), identity = kind + '\0' + key, entry = recency.get(identity);
          super.delete(key); super.set(key, value);
          recency.delete(identity); recency.set(identity, entry);
          return value;
        }
        has(rawKey) { if (super.has(rawKey)) return true; const key = keyOf(rawKey); return !!key && super.has(key); }
        delete(rawKey) {
          const key = super.has(rawKey) ? rawKey : keyOf(rawKey);
          if (!key || !super.delete(key)) return false;
          const identity = kind + '\0' + key, entry = recency.get(identity);
          if (entry) { bytes -= entry.size; recency.delete(identity); }
          return true;
        }
        clear() { for (const key of this.keys()) this.delete(key); }
      }();
    }
    const images = boundedMap('image', MAX_IMAGES, imageEvidence), videos = boundedMap('video', MAX_VIDEOS, videoEvidence);
    return {
      images, videos,
      snapshot() { return { images: [...images], videos: [...videos] }; },
      restore(data) {
        images.clear(); videos.clear();
        // Even malformed or oversized saved arrays cannot trigger an unbounded
        // decode/validation scan. The tail holds the most recently used entries.
        for (const [name, target, limit] of [['images', images, MAX_IMAGES], ['videos', videos, MAX_VIDEOS]])
          if (Array.isArray(data?.[name])) for (const pair of data[name].slice(-limit))
            if (Array.isArray(pair) && pair.length === 2) target.set(pair[0], pair[1]);
      }
    };
  }
  return { create };
});

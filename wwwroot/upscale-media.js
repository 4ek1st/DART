(function (root) {
  'use strict';
  function create({ logic, cached, read, renew, apply = () => {} }) {
    return async function readOriginal(item, selected, signal) {
      if (!selected || logic.videoMimeType(selected)) throw new Error('image');
      const pixels = cached(selected);
      if (pixels?.blob) return pixels.blob;
      const key = logic.mediaCacheKey(selected);
      const recover = async () => {
        for (const ref of logic.workSources(item).filter(ref => ref.source === 'sankaku')) {
          if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
          const detail = await renew(ref.id, signal);
          if (!detail || signal?.aborted) continue;
          // Only match the original file's identity. The thumbnail is deliberately
          // excluded: a signed preview must never become a small upscale input.
          const replacement = (detail.images || []).find(url => logic.mediaCacheKey(url) === key);
          apply(detail);
          if (replacement && !logic.signedMediaExpired(replacement)) return replacement;
        }
        return '';
      };
      let url = selected;
      if (logic.signedMediaExpired(url)) url = await recover() || url;
      try { return await read(url, signal, { priority: 'foreground' }); }
      catch (error) {
        if (signal?.aborted) throw error;
        const replacement = await recover();
        if (!replacement || replacement === url) throw error;
        return read(replacement, signal, { priority: 'foreground' });
      }
    };
  }
  const api = { create };
  if (typeof module !== 'undefined') module.exports = api;
  else root.DartUpscaleMedia = api;
})(typeof window !== 'undefined' ? window : globalThis);

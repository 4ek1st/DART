(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DartVideoPreview = api;
})(globalThis, function () {
  'use strict';

  const abortError = () => new DOMException('Preview cancelled', 'AbortError');
  function sampleTimes(duration) {
    return Number.isFinite(duration) && duration > 0
      ? [0.1, 0.3, 0.5, 0.7, 0.9].map(part => duration * part) : [];
  }

  function createFrameCache({ maxEntries = 24, maxBytes = 8 * 1024 * 1024,
    createUrl = blob => URL.createObjectURL(blob), revokeUrl = url => URL.revokeObjectURL(url) } = {}) {
    const entries = new Map();
    let bytes = 0;
    function remove(key) {
      const entry = entries.get(key);
      if (!entry) return;
      entries.delete(key);
      bytes -= entry.size;
      entry.urls.forEach(revokeUrl);
    }
    return {
      get(key) {
        const entry = entries.get(key);
        if (!entry) return null;
        if (entry.until <= Date.now()) { remove(key); return null; }
        entries.delete(key); entries.set(key, entry);
        return entry;
      },
      put(key, result) {
        const size = result.blobs.reduce((sum, blob) => sum + blob.size, 0);
        if (result.blobs.length !== 5 || size > maxBytes) return null;
        remove(key);
        const entry = { ...result, urls: result.blobs.map(createUrl), size,
          until: Date.now() + 30 * 60 * 1000 };
        entries.set(key, entry); bytes += size;
        while (entries.size > maxEntries || bytes > maxBytes) remove(entries.keys().next().value);
        return entry;
      },
      clear() { for (const key of [...entries.keys()]) remove(key); }
    };
  }

  function mediaEvent(video, event, signal, action, timeout = 6000) {
    return new Promise((resolve, reject) => {
      if (signal.aborted) { reject(abortError()); return; }
      const cleanup = () => {
        clearTimeout(timer);
        video.removeEventListener(event, ready);
        video.removeEventListener('error', failed);
        signal.removeEventListener('abort', cancelled);
      };
      const ready = () => { cleanup(); resolve(); };
      const failed = () => { cleanup(); reject(new Error('Preview media unavailable')); };
      const cancelled = () => { cleanup(); reject(abortError()); };
      const timer = setTimeout(failed, timeout);
      video.addEventListener(event, ready, { once: true });
      video.addEventListener('error', failed, { once: true });
      signal.addEventListener('abort', cancelled, { once: true });
      try { action(); } catch (error) { cleanup(); reject(error); }
    });
  }

  function encodeFrame(canvas, signal) {
    return new Promise((resolve, reject) => {
      if (signal.aborted) { reject(abortError()); return; }
      const cancelled = () => reject(abortError());
      signal.addEventListener('abort', cancelled, { once: true });
      canvas.toBlob(blob => {
        signal.removeEventListener('abort', cancelled);
        if (signal.aborted) reject(abortError());
        else if (blob) resolve(blob);
        else reject(new Error('Preview frame unavailable'));
      }, 'image/webp', 0.72);
    });
  }

  async function extractFrames(url, signal) {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.disableRemotePlayback = true;
    const session = crypto.randomUUID().replaceAll('-', '');
    try {
      await mediaEvent(video, 'loadedmetadata', signal, () => {
        video.src = `/api/video-preview?url=${encodeURIComponent(url)}&session=${session}`;
        video.load();
      });
      // Some WebM containers omit duration in their header. A bounded tail seek
      // lets Chromium discover the end; live streams remain ordinary thumbnails.
      if (video.duration === Infinity)
        await mediaEvent(video, 'seeked', signal, () => { video.currentTime = 1e10; });
      const times = sampleTimes(video.duration);
      if (!times.length || !video.videoWidth || !video.videoHeight ||
          video.videoWidth * video.videoHeight > 3840 * 2160)
        throw new Error('Preview metadata unavailable');
      const scale = Math.min(1, 320 / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('Preview canvas unavailable');
      const blobs = [];
      for (const time of times) {
        await mediaEvent(video, 'seeked', signal, () => { video.currentTime = time; });
        if (video.readyState < 2) throw new Error('Preview frame not decoded');
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        blobs.push(await encodeFrame(canvas, signal));
      }
      return { blobs, times, width: canvas.width, height: canvas.height };
    } finally {
      video.pause();
      video.removeAttribute('src');
      video.load();
      canvas.width = canvas.height = 0;
    }
  }

  function createController(root, options = {}) {
    const doc = root.ownerDocument;
    const win = doc.defaultView;
    const motion = win.matchMedia('(prefers-reduced-motion: reduce)');
    const cache = options.cache || createFrameCache();
    const keyOf = options.cacheKey || (value => value);
    const extract = options.extract || extractFrames;
    const decode = options.decode || (async url => { const image = new win.Image(); image.src = url; await image.decode(); });
    const dwell = options.dwell ?? 300;
    const interval = options.interval ?? 800;
    const failures = new Map();
    const listeners = [];
    let target = null, targetKey = '', hover = null, focus = null;
    let generation = 0, dwellTimer, frameTimer, job = null, pending = null, disposed = false;

    function listen(node, name, handler, settings) {
      node.addEventListener(name, handler, settings);
      listeners.push(() => node.removeEventListener(name, handler, settings));
    }
    function eligible(card) {
      if (!card || !card.isConnected || !root.contains(card) || doc.hidden || motion.matches) return false;
      const box = card.getBoundingClientRect(), bounds = root.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && box.bottom > bounds.top && box.top < bounds.bottom &&
        box.right > bounds.left && box.left < bounds.right;
    }
    function current(card, revision) {
      return !disposed && revision === generation && card === target && eligible(card) &&
        keyOf(card.dataset.videoPreview) === targetKey;
    }
    function restore(card) {
      const overlay = card?.querySelector('.video-preview-frame');
      if (overlay) { overlay.hidden = true; overlay.removeAttribute('src'); }
      card?.classList.remove('video-preview-active');
    }
    function stop() {
      generation++;
      clearTimeout(dwellTimer); clearTimeout(frameTimer);
      pending = null;
      if (job) job.controller.abort();
      restore(target); target = null; targetKey = '';
    }
    async function show(card, entry, revision, index = 0) {
      if (!current(card, revision)) return;
      try { await decode(entry.urls[index]); } catch { stop(); return; }
      if (!current(card, revision)) return;
      const overlay = card.querySelector('.video-preview-frame');
      if (!overlay) return;
      overlay.src = entry.urls[index]; overlay.hidden = false;
      card.classList.add('video-preview-active');
      frameTimer = setTimeout(() => { void show(card, entry, revision, (index + 1) % entry.urls.length); }, interval);
    }
    async function pump() {
      if (job || !pending || disposed) return;
      const request = pending;
      pending = null;
      if (!current(request.card, request.revision)) return;
      const controller = new AbortController();
      const active = job = { controller };
      let timedOut = false;
      const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, options.timeout ?? 18000);
      let url = request.url;
      try {
        if (options.isExpired?.(url)) url = await options.recoverUrl?.(request.card, url, controller.signal) || url;
        let result;
        try { result = await extract(url, controller.signal); }
        catch (error) {
          if (controller.signal.aborted) throw error;
          const renewed = url === request.url
            ? await options.recoverUrl?.(request.card, url, controller.signal) : '';
          if (!renewed || renewed === url) throw error;
          url = renewed;
          result = await extract(url, controller.signal);
        }
        if (controller.signal.aborted || disposed) return;
        const entry = cache.put(request.key, result);
        if (entry && current(request.card, request.revision))
          void show(request.card, entry, request.revision);
      } catch (error) {
        if (!controller.signal.aborted || timedOut) {
          failures.set(request.key, { url: request.url, until: Date.now() + 120000 });
          if (failures.size > 64) failures.delete(failures.keys().next().value);
        }
        if (current(request.card, request.revision)) restore(request.card);
      } finally {
        clearTimeout(timeout);
        if (job === active) job = null;
        void pump();
      }
    }
    function enter(card) {
      if (disposed || !eligible(card) || card === target) return;
      stop(); target = card; targetKey = keyOf(card.dataset.videoPreview);
      const revision = generation, key = targetKey, url = card.dataset.videoPreview;
      const entry = cache.get(key);
      if (entry) { void show(card, entry, revision); return; }
      const failure = failures.get(key);
      if (failure?.url === url && failure.until > Date.now()) return;
      dwellTimer = setTimeout(() => {
        if (!current(card, revision)) return;
        pending = { card, revision, key, url };
        void pump();
      }, dwell);
    }
    const cardAt = node => node?.closest?.('button.card-art[data-video-preview]');
    listen(root, 'pointerover', event => {
      if (event.pointerType === 'touch') return;
      const card = cardAt(event.target);
      if (card && !card.contains(event.relatedTarget)) { hover = card; enter(card); }
    }, { passive: true });
    listen(root, 'pointermove', event => {
      if (event.pointerType !== 'touch') { hover = cardAt(event.target); if (hover) enter(hover); }
    }, { passive: true });
    listen(root, 'pointerout', event => {
      const card = cardAt(event.target);
      if (card && !card.contains(event.relatedTarget)) {
        if (hover === card) hover = null;
        if (target === card && focus !== card) stop();
      }
    }, { passive: true });
    listen(root, 'focusin', event => {
      const card = cardAt(event.target);
      if (card?.matches(':focus-visible')) { focus = card; enter(card); }
    });
    listen(root, 'focusout', event => {
      const card = cardAt(event.target);
      if (focus === card) focus = null;
      if (target === card && hover !== card) stop();
    });
    listen(root, 'scroll', () => { hover = focus = null; stop(); }, { passive: true, capture: true });
    listen(root, 'click', () => { hover = focus = null; stop(); }, true);
    listen(root, 'contextmenu', () => { hover = focus = null; stop(); }, true);
    listen(doc, 'keydown', event => {
      if (['Escape', 'Enter', 'Space'].includes(event.code)) stop();
    }, true);
    listen(doc, 'visibilitychange', () => { if (doc.hidden) { hover = focus = null; stop(); } });
    listen(win, 'blur', () => { hover = focus = null; stop(); });
    listen(win, 'resize', () => { hover = focus = null; stop(); });
    listen(motion, 'change', () => { if (motion.matches) { hover = focus = null; stop(); } });
    return {
      stop,
      refresh() {
        if (target && (!eligible(target) || keyOf(target.dataset.videoPreview) !== targetKey)) stop();
        else if (target && !target.querySelector('.video-preview-frame')?.hidden)
          target.classList.add('video-preview-active');
      },
      dispose() { disposed = true; stop(); listeners.forEach(remove => remove()); cache.clear(); failures.clear(); }
    };
  }

  let controller;
  return {
    sampleTimes, createFrameCache, extractFrames, createController,
    attach(root, options) { controller?.dispose(); controller = createController(root, options); return controller; },
    refresh() { controller?.refresh(); },
    stop() { controller?.stop(); },
    dispose() { controller?.dispose(); controller = null; }
  };
});

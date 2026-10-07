(function(root) {
  'use strict';
  // Ordinary saves have no keepalive quota. Serialize them so a slower old
  // request cannot overwrite a newer session, and keep failed writes for retry.
  function createWriter({ send, storage, onError = () => {}, schedule = setTimeout,
      cancel = clearTimeout, retryDelay = 3000 } = {}) {
    const key = 'dart-client-state-pending';
    const writerId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    let pending = '', running, timer, lastSaved = '', notified = false, revision = 0, latest;
    let lastValue = '';
    const read = () => { try { return JSON.parse(storage?.getItem(key) || 'null'); } catch { return null; } };
    const remember = body => { try { storage?.setItem(key, body); } catch { /* Native storage still works. */ } };
    const drain = async () => {
      while (pending && pending !== lastSaved) {
        const body = pending;
        try {
          await send(body);
          lastSaved = body; notified = false;
          if (pending === body) {
            pending = '';
            try { storage?.removeItem(key); } catch { /* Storage may be unavailable. */ }
          }
        } catch (error) {
          if (!notified) { notified = true; onError(error); }
          timer = schedule(() => { timer = undefined; void flush(); }, retryDelay);
          return false;
        }
      }
      return true;
    };
    const flush = () => {
      if (timer !== undefined) { cancel(timer); timer = undefined; }
      if (!running) running = drain().then(saved => {
        running = undefined;
        // A new value can arrive after drain resolves, before this microtask.
        // Adopt that write so closing/installing still waits for the latest one.
        return saved && pending && pending !== lastSaved ? flush() : saved;
      }, error => { running = undefined; throw error; });
      return running;
    };
    return {
      readPending: read,
      save(value) {
        const valueBody = JSON.stringify(value);
        if (valueBody !== lastValue) {
          lastValue = valueBody;
          latest = { ...value, clientWriter: writerId, clientRevision: ++revision };
        }
        const body = JSON.stringify(latest);
        if (body !== lastSaved || pending) { pending = body; remember(body); }
        return flush();
      },
      flush,
      // During browser teardown only send a compact patch that actually fits
      // the shared 64 KiB keepalive quota. The server retains the other fields.
      unloadPatch(value) {
        if (!latest) return null;
        const body = JSON.stringify({ session: value.session,
          themePreference: value.themePreference, mediaDuplicatePairs: value.mediaDuplicatePairs,
          mediaVerifiedImages: value.mediaVerifiedImages,
          clientWriter: latest.clientWriter, clientRevision: latest.clientRevision });
        return new TextEncoder().encode(body).length <= 48 * 1024 ? body : null;
      }
    };
  }
  const api = { createWriter };
  root.DartClientState = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);

(function(root) {
  'use strict';
  // Reuse the exact local session backup captured by the UI. This is only an
  // in-memory serialization hint; the durable/native JSON format stays plain.
  const snapshots = new WeakMap();
  function snapshot(value, sessionBody) {
    snapshots.set(value, { session: value.session, body: sessionBody });
    return value;
  }
  // Ordinary saves have no keepalive quota. Serialize them so a slower old
  // request cannot overwrite a newer session, and keep failed writes for retry.
  function createWriter({ send, storage, onError = () => {}, schedule = setTimeout,
      cancel = clearTimeout, retryDelay = 3000, saveDelay = 32 } = {}) {
    const key = 'dart-client-state-pending';
    const writerId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    let pending = '', running, timer, lastSaved = '', notified = false, revision = 0, latest;
    let lastValue = '', latestBody = '', deferredSave;
    const writerBody = JSON.stringify(writerId);
    const read = () => { try { return JSON.parse(storage?.getItem(key) || 'null'); } catch { return null; } };
    const remember = body => { try { storage?.setItem(key, body); } catch { /* Native storage still works. */ } };
    const stage = value => {
      const data = { ...value };
      delete data.clientWriter; delete data.clientRevision;
      const hint = snapshots.get(value);
      let valueBody;
      if (hint && hint.session === data.session) {
        delete data.session;
        const remainder = JSON.stringify(data);
        valueBody = `{"session":${hint.body}${remainder.length > 2 ? ',' : ''}${remainder.slice(1)}`;
      } else valueBody = JSON.stringify(data);
      if (valueBody !== lastValue) {
        lastValue = valueBody;
        latest = { clientWriter: writerId, clientRevision: ++revision };
        latestBody = `${valueBody.slice(0, -1)}${valueBody.length > 2 ? ',' : ''}"clientWriter":${writerBody},"clientRevision":${revision}}`;
      }
      if (latestBody !== lastSaved || pending) {
        if (pending !== latestBody) remember(latestBody);
        pending = latestBody;
      }
    };
    const takeDeferred = () => {
      const deferred = deferredSave;
      if (deferred) { cancel(deferred.timer); deferredSave = undefined; }
      return deferred;
    };
    const settle = (deferred, result) => {
      if (deferred) result.then(deferred.resolve, deferred.reject);
      return result;
    };
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
      const deferred = takeDeferred();
      if (deferred) {
        try { stage(deferred.capture()); }
        catch (error) { deferred.reject(error); return Promise.reject(error); }
      }
      if (timer !== undefined) { cancel(timer); timer = undefined; }
      if (!running) running = drain().then(saved => {
        running = undefined;
        // A new value can arrive after drain resolves, before this microtask.
        // Adopt that write so closing/installing still waits for the latest one.
        return saved && (deferredSave || pending && pending !== lastSaved) ? flush() : saved;
      }, error => { running = undefined; throw error; });
      return settle(deferred, running);
    };
    return {
      readPending: read,
      save(value) {
        // Explicit close/update saves supersede a queued ordinary capture.
        const deferred = takeDeferred();
        try { stage(value); }
        catch (error) { deferred?.reject(error); throw error; }
        return settle(deferred, flush());
      },
      saveLater(capture) {
        if (deferredSave) { deferredSave.capture = capture; return deferredSave.promise; }
        const deferred = { capture };
        deferred.promise = new Promise((resolve, reject) => { deferred.resolve = resolve; deferred.reject = reject; });
        deferredSave = deferred;
        // Coalesce activity, tab and metadata notifications after the visible
        // interaction has had a chance to paint. Flush/unload bypass this wait.
        deferred.timer = schedule(() => { void flush().catch(() => {}); }, saveDelay);
        return deferred.promise;
      },
      flush,
      // During browser teardown only send a compact patch that actually fits
      // the shared 64 KiB keepalive quota. The server retains the other fields.
      unloadPatch(value) {
        // Teardown can happen before the delayed capture. Persist the complete
        // latest state/outbox locally even when its keepalive patch cannot fit.
        const deferred = takeDeferred();
        try { stage(value); }
        catch (error) { deferred?.reject(error); throw error; }
        deferred?.resolve(false);
        const body = JSON.stringify({ session: value.session,
          themePreference: value.themePreference, mediaDuplicatePairs: value.mediaDuplicatePairs,
          mediaVerifiedImages: value.mediaVerifiedImages,
          clientWriter: latest.clientWriter, clientRevision: latest.clientRevision });
        return new TextEncoder().encode(body).length <= 48 * 1024 ? body : null;
      }
    };
  }
  const api = { createWriter, snapshot };
  root.DartClientState = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);

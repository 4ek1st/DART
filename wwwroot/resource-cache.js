(function(root) {
  'use strict';
  const cancelled = () => Object.assign(new Error('Cancelled'), { name: 'AbortError' });

  // Each reader owns its cancellation. A tab leaving must not cancel a request
  // still used by another tab, or restart the same download on a quick return.
  function create({ load, key = value => value, size = () => 1, keep = () => true,
    ttl = 60000, maxEntries = 80, maxBytes = 8 * 1024 * 1024,
    concurrency = 6, timeout = 20000, grace = 250, now = Date.now }) {
    const cache = new Map(), pending = new Map(), queue = [];
    let bytes = 0, active = 0, revision = 0;
    function evict() {
      for (const [id, entry] of cache) {
        if (entry.expires > now() && bytes <= maxBytes && cache.size <= maxEntries) continue;
        cache.delete(id); bytes -= entry.size;
      }
    }
    function drain() {
      while (active < concurrency && queue.length) {
        const job = queue.shift();
        if (job.controller.signal.aborted) continue;
        active++;
        const timer = setTimeout(() => job.controller.abort(), timeout);
        const finish = (handler, value) => {
          clearTimeout(timer); clearTimeout(job.cancelTimer);
          if (pending.get(job.id) === job) pending.delete(job.id);
          job.done = true; active--;
          handler(value); drain();
        };
        Promise.resolve().then(() => load(job.input, job.controller.signal)).then(value => {
          if (job.controller.signal.aborted) throw cancelled();
          if (job.revision === revision && !job.discarded && keep(value)) {
            const weight = size(value);
            if (weight <= maxBytes) {
              const old = cache.get(job.id);
              if (old) bytes -= old.size;
              cache.delete(job.id);
              cache.set(job.id, { value, size: weight, expires: now() + ttl });
              bytes += weight; evict();
            }
          }
          finish(job.resolve, value);
        }).catch(error => finish(job.reject, error));
      }
    }
    function get(input, signal) {
      if (signal?.aborted) return Promise.reject(cancelled());
      const id = key(input), entry = cache.get(id);
      if (entry) {
        if (entry.expires > now()) {
          cache.delete(id); cache.set(id, entry);
          return Promise.resolve(entry.value);
        }
        cache.delete(id); bytes -= entry.size;
      }
      let job = pending.get(id);
      if (!job || job.controller.signal.aborted) {
        job = { id, input, revision, readers: 0, controller: new AbortController() };
        job.promise = new Promise((resolve, reject) => { job.resolve = resolve; job.reject = reject; });
        pending.set(id, job); queue.push(job);
      }
      clearTimeout(job.cancelTimer);
      job.readers++;
      const result = new Promise((resolve, reject) => {
        let finished = false;
        const finish = (handler, value) => {
          if (finished) return;
          finished = true; signal?.removeEventListener('abort', abort);
          job.readers--; handler(value);
          if (!job.readers && !job.done) job.cancelTimer = setTimeout(() => {
            if (job.readers || job.done) return;
            job.controller.abort();
            const position = queue.indexOf(job);
            if (position >= 0) { queue.splice(position, 1); job.reject(cancelled()); }
            if (pending.get(id) === job) pending.delete(id);
          }, grace);
        };
        const abort = () => finish(reject, cancelled());
        signal?.addEventListener('abort', abort, { once: true });
        job.promise.then(value => finish(resolve, value), error => finish(reject, error));
      });
      drain();
      return result;
    }
    return { get, invalidate(input) {
      const id = key(input), entry = cache.get(id), job = pending.get(id);
      if (entry) { cache.delete(id); bytes -= entry.size; }
      if (job) { job.discarded = true; pending.delete(id); }
    }, clear() { revision++; cache.clear(); bytes = 0; pending.clear(); },
      get stats() { return { entries: cache.size, bytes, active, queued: queue.length }; } };
  }
  const api = { create };
  root.DartResourceCache = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

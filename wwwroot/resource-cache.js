(function(root) {
  'use strict';
  const cancelled = () => Object.assign(new Error('Cancelled'), { name: 'AbortError' });

  // Each reader owns its cancellation. A tab leaving must not cancel a request
  // still used by another tab, or restart the same download on a quick return.
  function create({ load, key = value => value, size = () => 1, keep = () => true,
    ttl = 60000, maxEntries = 80, maxBytes = 8 * 1024 * 1024,
    concurrency = 6, foregroundReserve = 0, backgroundConcurrency = concurrency,
    timeout = 20000, grace = 250, now = Date.now }) {
    const cache = new Map(), pending = new Map(), queue = [], running = new Set();
    const reserve = Math.min(Math.max(0, foregroundReserve), Math.max(0, concurrency - 1));
    const priorityOf = value => value === 'foreground' ? 2 : value === 'background' ? 0 : 1;
    const priorityName = value => value === 2 ? 'foreground' : value === 0 ? 'background' : 'normal';
    let bytes = 0, active = 0, revision = 0;
    function promoteJob(job, priority) {
      const previous = job.priority;
      job.priority = Math.max(previous, priorityOf(priority));
      if (job.priority !== previous)
        for (const listener of job.priorityListeners) listener(priorityName(job.priority));
    }
    function evict() {
      for (const [id, entry] of cache) {
        if (entry.expires > now() && bytes <= maxBytes && cache.size <= maxEntries) continue;
        cache.delete(id); bytes -= entry.size;
      }
    }
    function drain() {
      while (active < concurrency && queue.length) {
        const background = [...running].filter(job => job.priority === 0).length;
        let position = -1;
        for (let index = 0; index < queue.length; index++) {
          const candidate = queue[index];
          if (!candidate.controller.signal.aborted &&
              (candidate.priority < 2 && active >= concurrency - reserve ||
               candidate.priority === 0 && background >= backgroundConcurrency)) continue;
          if (position < 0 || candidate.priority > queue[position].priority) position = index;
        }
        if (position < 0) return;
        const [job] = queue.splice(position, 1);
        if (job.controller.signal.aborted) continue;
        active++; running.add(job);
        const timer = setTimeout(() => job.controller.abort(), timeout);
        const finish = (handler, value) => {
          clearTimeout(timer); clearTimeout(job.cancelTimer);
          if (pending.get(job.id) === job) pending.delete(job.id);
          job.done = true; active--; running.delete(job);
          job.priorityListeners.clear();
          handler(value); drain();
        };
        const scheduling = {
          get priority() { return priorityName(job.priority); },
          onPriorityChange(listener) {
            job.priorityListeners.add(listener);
            return () => job.priorityListeners.delete(listener);
          }
        };
        Promise.resolve().then(() => load(job.input, job.controller.signal, scheduling)).then(value => {
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
    function get(input, signal, options = {}) {
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
        job = { id, input, revision, readers: 0, priority: priorityOf(options.priority),
          priorityListeners: new Set(), controller: new AbortController() };
        job.promise = new Promise((resolve, reject) => { job.resolve = resolve; job.reject = reject; });
        pending.set(id, job); queue.push(job);
      }
      // A visible reader can adopt speculative work without duplicating its
      // transport or inheriting the speculative queue position/slot limit.
      promoteJob(job, options.priority);
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
    return { get, promote(input, priority) {
      const job = pending.get(key(input));
      if (job && !job.done && !job.controller.signal.aborted) { promoteJob(job, priority); drain(); }
    }, invalidate(input) {
      const id = key(input), entry = cache.get(id), job = pending.get(id);
      if (entry) { cache.delete(id); bytes -= entry.size; }
      if (job) { job.discarded = true; pending.delete(id); }
    }, clear() { revision++; cache.clear(); bytes = 0; pending.clear(); },
      get stats() { return { entries: cache.size, bytes, active, queued: queue.length }; } };
  }

  // Catalog JSON and image bodies share the browser's HTTP/1 connection pool.
  // Keep one lane outside this budget for a native video element, and preserve
  // priority adoption when a cache loader has already queued its transport.
  function createTransport({ concurrency = 5, foregroundReserve = 1,
    backgroundConcurrency = 2, maxQueued = 64, timeout = 90000 } = {}) {
    const queue = create({ load: (task, signal, scheduling) => task.load(signal, scheduling),
      key: task => task, keep: () => false, maxEntries: 0, maxBytes: 0,
      concurrency, foregroundReserve, backgroundConcurrency, timeout, grace: 0 });
    return {
      run(load, signal, options = {}) {
        if (signal?.aborted) return Promise.reject(cancelled());
        const stats = queue.stats;
        const canStart = options.priority === 'foreground' ? stats.active < concurrency :
          options.priority !== 'background' && stats.active < concurrency - foregroundReserve;
        if (stats.queued >= maxQueued && !canStart)
          return Promise.reject(Object.assign(new Error('Transport queue is full'), { name: 'TransportQueueFullError' }));
        const task = { load };
        const unsubscribe = options.onPriorityChange?.(priority => queue.promote(task, priority));
        return queue.get(task, signal, options).finally(() => unsubscribe?.());
      },
      get stats() { return queue.stats; }
    };
  }
  const api = { create, createTransport };
  root.DartResourceCache = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

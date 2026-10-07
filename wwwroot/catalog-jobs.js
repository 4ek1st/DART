(function(root) {
  'use strict';
  let worker, sequence = 0;
  const jobs = new Map();
  async function run(operation, args, fallback) {
    if (typeof Worker !== 'function' || worker === false) return fallback();
    try {
      if (!worker) {
        worker = new Worker('/catalog-worker.js');
        const fail = () => {
          worker?.terminate(); worker = false;
          for (const job of jobs.values()) job.reject(new Error('Catalog worker unavailable'));
          jobs.clear();
        };
        worker.addEventListener('message', ({ data }) => {
          const job = jobs.get(data.id);
          if (!job) return;
          jobs.delete(data.id);
          data.error ? job.reject(new Error(data.error)) : job.resolve(data.value);
        });
        worker.addEventListener('error', event => { event.preventDefault(); fail(); });
        worker.addEventListener('messageerror', fail);
      }
      const id = ++sequence;
      let timer;
      try {
        return await new Promise((resolve, reject) => {
          jobs.set(id, { resolve, reject });
          timer = setTimeout(() => { jobs.delete(id); reject(new Error('Catalog worker timeout')); }, 15000);
          worker.postMessage({ id, operation, args });
        });
      } finally { clearTimeout(timer); jobs.delete(id); }
    } catch { return fallback(); }
  }
  root.DartCatalogJobs = { run };
  if (typeof module !== 'undefined') module.exports = root.DartCatalogJobs;
})(globalThis);

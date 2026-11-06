(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DartProviderPages = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  // Page promises never belong to a persisted tab or detached navigation copy.
  // A generation owns both its in-flight cursors and its publication order.
  const owners = new WeakMap();
  function scope(owner, name, generation, signal) {
    let scopes = owners.get(owner);
    if (!scopes) owners.set(owner, scopes = new Map());
    let value = scopes.get(name);
    if (value?.generation === generation && value.signal === signal) return value;
    const pending = new Map();
    let publication = Promise.resolve();
    value = { generation, signal, pending, completed: 0, state: {},
      current: () => scopes.get(name) === value && !signal?.aborted,
      has: key => pending.has(key),
      run(key, load, metadata = null) {
        if (pending.has(key)) return pending.get(key).promise;
        let resolve, reject;
        const result = new Promise((done, fail) => { resolve = done; reject = fail; });
        const job = { metadata, promise: result.finally(() => {
          if (pending.get(key) === job) pending.delete(key);
          if (value.current()) value.completed++;
        }) };
        pending.set(key, job);
        try { Promise.resolve(value.current() ? load() : undefined).then(resolve, reject); }
        catch (error) { reject(error); }
        return job.promise;
      },
      publish(commit) {
        const next = publication.catch(() => {}).then(() => value.current() ? commit() : undefined);
        publication = next;
        return next;
      }
    };
    scopes.set(name, value);
    return value;
  }
  function progress(owner) {
    return [...(owners.get(owner)?.values() || [])].reduce((total, value) => total + value.completed, 0);
  }
  return { scope, progress };
});

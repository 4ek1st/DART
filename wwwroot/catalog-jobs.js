(function(root) {
  'use strict';
  let worker, sequence = 0, profileSequence = 0, profile = null;
  const jobs = new Map(), groupedReplies = new Map();
  const groupingRevision = items => root.CatalogLogic?.groupingRevision?.(items) || 0;
  const profileRevision = items => root.CatalogLogic?.recommendationInputVersion?.(items) ?? groupingRevision(items);
  const cacheKey = value => typeof value === 'string' && value.length > 0 && value.length <= 80 ? value : '';
  function fields(item) {
    const result = [];
    for (const key of Object.keys(item || {})) {
      const value = item[key];
      result.push(key, value, Array.isArray(value) ? value.length : -1);
    }
    return result;
  }
  function unchanged(entry) {
    if (entry.inputRevision !== groupingRevision(entry.input) || entry.value.length !== entry.rows.length) return false;
    return entry.value.every((item, index) => {
      if (item !== entry.rows[index]) return false;
      const keys = Object.keys(item || {}), previous = entry.fields[index];
      if (keys.length * 3 !== previous.length) return false;
      for (let position = 0; position < keys.length; position++) {
        const key = keys[position], value = item[key], offset = position * 3;
        if (key !== previous[offset] || !Object.is(value, previous[offset + 1]) ||
            (Array.isArray(value) ? value.length : -1) !== previous[offset + 2]) return false;
      }
      return true;
    });
  }
  function remember(key, id, input, inputRevision, value, base, reusedPrefix) {
    if (groupedReplies.get(key)?.id > id) return;
    const rowFields = new Array(value.length);
    for (const [position, index] of reusedPrefix || []) rowFields[position] = base.fields[index];
    for (let index = 0; index < value.length; index++) rowFields[index] ||= fields(value[index]);
    groupedReplies.delete(key);
    groupedReplies.set(key, { id, input, inputRevision, value, rows: [...value], fields: rowFields });
    while (groupedReplies.size > 4) groupedReplies.delete(groupedReplies.keys().next().value);
  }
  function forget(job) {
    const current = job.key && groupedReplies.get(job.key);
    if (current && current.id <= job.id && (!job.base || current.id === job.base.id)) groupedReplies.delete(job.key);
    if (job.profileId !== undefined && profile?.id === job.profileId) profile = null;
  }
  function hydrate(data, job) {
    const value = data.value;
    if (data.reusedPrefix !== undefined) {
      if (!job.key || !job.base || data.groupingCacheKey !== job.key || data.baseReplyId !== job.base.id ||
          !Array.isArray(value) || !Array.isArray(data.reusedPrefix) || !unchanged(job.base))
        throw new Error('Catalog worker grouping base changed');
      const positions = new Set();
      for (const pair of data.reusedPrefix) {
        if (!Array.isArray(pair) || pair.length !== 2) throw new Error('Invalid catalog worker grouping reference');
        const [position, index] = pair;
        if (!Number.isInteger(position) || !Number.isInteger(index) || position < 0 || position >= value.length ||
            index < 0 || index >= job.base.value.length || positions.has(position) || value[position] !== null)
          throw new Error('Invalid catalog worker grouping reference');
        positions.add(position); value[position] = job.base.value[index];
      }
    }
    if (job.key) {
      if (!Array.isArray(value)) throw new Error('Invalid catalog worker grouping result');
      const keys = new Set();
      for (const item of value) {
        if (!item || typeof item !== 'object' || typeof item.key !== 'string' || keys.has(item.key))
          throw new Error('Invalid catalog worker grouping result');
        keys.add(item.key);
      }
    }
    return value;
  }
  async function run(operation, args, fallback, options = {}) {
    if (typeof Worker !== 'function' || worker === false) return fallback();
    try {
      if (!worker) {
        worker = new Worker('/catalog-worker.js');
        const fail = () => {
          worker?.terminate(); worker = false; profile = null; groupedReplies.clear();
          for (const job of jobs.values()) job.reject(new Error('Catalog worker unavailable'));
          jobs.clear();
        };
        worker.addEventListener('message', ({ data }) => {
          const job = jobs.get(data.id);
          if (!job) return;
          jobs.delete(data.id);
          try {
            if (data.error) throw new Error(data.error);
            const value = hydrate(data, job);
            if (job.key) remember(job.key, data.id, job.input, job.inputRevision, value, job.base, data.reusedPrefix);
            job.resolve(value);
          } catch (error) { forget(job); job.reject(error); }
        });
        worker.addEventListener('error', event => { event.preventDefault(); fail(); });
        worker.addEventListener('messageerror', fail);
      }
      for (let attempt = 0; attempt < 2; attempt++) {
        const id = ++sequence, key = operation === 'groupWorks' ? cacheKey(options.cacheKey) : '';
        const candidate = key && groupedReplies.get(key);
        const base = !attempt && candidate && candidate.input === options.previousInput && unchanged(candidate) ? candidate : null;
        if (base) { groupedReplies.delete(key); groupedReplies.set(key, base); }
        const message = { id, operation, args, ...(key ? { groupingCacheKey: key } : {}),
          ...(base ? { baseReplyId: base.id } : {}) };
        let reusedProfile = false;
        if (operation === 'workAnalysis' && Array.isArray(args[0])) {
          const items = args[0], revision = profileRevision(items);
          reusedProfile = !attempt && profile?.items === items && profile.length === items.length && profile.revision === revision;
          const profileId = reusedProfile ? profile.id : ++profileSequence;
          profile = { id: profileId, items, length: items.length, revision };
          message.profileId = profileId;
          if (reusedProfile) message.args = [null, ...args.slice(1)];
        }
        let timer, job;
        try {
          return await new Promise((resolve, reject) => {
            job = { resolve, reject, key, base, input: args[0], inputRevision: groupingRevision(args[0]), profileId: message.profileId };
            jobs.set(id, job);
            timer = setTimeout(() => { jobs.delete(id); forget(job); reject(new Error('Catalog worker timeout')); }, 15000);
            worker.postMessage(message);
          });
        } catch (error) {
          if (job) forget(job);
          // A stale/evicted base or profile gets one complete worker retry.
          // No sparse result is ever accepted against a different snapshot.
          if (attempt || !worker || !(base || reusedProfile)) throw error;
        } finally { clearTimeout(timer); jobs.delete(id); }
      }
    } catch { return fallback(); }
  }
  root.DartCatalogJobs = { run };
  if (typeof module !== 'undefined') module.exports = root.DartCatalogJobs;
})(globalThis);

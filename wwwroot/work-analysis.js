(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DartWorkAnalysis = api;
})(globalThis, function (root) {
  'use strict';
  const empty = Object.freeze([]);
  function create({ logic = root.CatalogLogic, jobs = root.DartCatalogJobs, maxEntries = 3 } = {}) {
    let cache = new WeakMap(), generation = 0;
    const limit = Number.isInteger(maxEntries) && maxEntries > 0 ? Math.min(maxEntries, 3) : 3;
    const version = items => logic.recommendationInputVersion?.(items) ?? logic.groupingRevision?.(items) ?? 0;
    const preferenceKey = preferences => JSON.stringify(Object.entries(preferences).sort(([a], [b]) => a.localeCompare(b)));
    const validResult = value => value && Array.isArray(value.tags) &&
      ['names', 'copyright', 'other'].every(kind => Array.isArray(value.tagGroups?.[kind])) &&
      ['priority', 'names', 'copyright', 'other', 'combinations'].every(kind => Array.isArray(value.queryGroups?.[kind]));
    function analyze(liked = empty, preferences = {}, background = empty, options = {}) {
      try {
        const library = Array.isArray(liked) ? liked : empty;
        const ordinary = Array.isArray(background) && background.length ? background : empty;
        const includeCombinations = options?.includeCombinations !== false;
        const choices = { ...(preferences || {}) }, key = preferenceKey(choices);
        const snapshot = { length: library.length, revision: version(library),
          background: ordinary, backgroundLength: ordinary.length, backgroundRevision: version(ordinary) };
        const unchanged = entry => entry.length === library.length && entry.revision === version(library) &&
          entry.backgroundLength === entry.background.length && entry.backgroundRevision === version(entry.background);
        let entries = cache.get(library);
        if (!entries) { entries = []; cache.set(library, entries); }
        const index = entries.findIndex(entry => entry.key === key && entry.background === ordinary && unchanged(entry) &&
          (entry.includeCombinations === includeCombinations || !includeCombinations && entry.includeCombinations && entry.ready));
        if (index >= 0) {
          const [entry] = entries.splice(index, 1); entries.push(entry);
          return entry.promise;
        }
        // Do not keep obsolete revisions of this same scope alongside its
        // replacement. Their original consumers still own their promises.
        for (let index = entries.length - 1; index >= 0; index--)
          if (!unchanged(entries[index])) entries.splice(index, 1);
        let resolve, reject;
        const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
        const entry = { ...snapshot, key, promise, includeCombinations, ready: false }, epoch = generation;
        entries.push(entry);
        while (entries.length > limit) entries.shift();
        const discard = () => {
          const current = cache.get(library), index = current?.indexOf(entry) ?? -1;
          if (index >= 0) current.splice(index, 1);
        };
        const fallback = async () => {
          // Unsupported worker hosts can paint their loading state before the
          // unchanged synchronous fallback starts its heavier calculation.
          if (typeof root.setTimeout === 'function') await new Promise(resolve => root.setTimeout(resolve, 0));
          return { tags: logic.recommendationTags(library, 6),
            tagGroups: logic.recommendationTagGroups(library, 2, choices),
            queryGroups: logic.recommendationQueryGroups(library, choices, ordinary, { includeCombinations }) };
        };
        try {
          // The shared worker service snapshots arguments when it dispatches.
          // Keep the saved array itself here rather than copying tens of MB for
          // each screen. Hosts without workers retain the exact same math.
          const pending = jobs?.run ? jobs.run('workAnalysis', [library, choices, ordinary, { includeCombinations }], fallback) : Promise.resolve().then(fallback);
          Promise.resolve(pending).then(value => {
            try {
              if (!validResult(value)) throw new Error('Invalid artwork analysis result');
              entry.ready = true;
              if (epoch !== generation || !unchanged(entry)) discard();
              resolve(value);
            } catch (error) { discard(); reject(error); }
          }, error => { discard(); reject(error); });
        } catch (error) { discard(); reject(error); }
        return promise;
      } catch (error) { return Promise.reject(error); }
    }
    return { analyze, clear() { generation++; cache = new WeakMap(); } };
  }
  return { create };
});

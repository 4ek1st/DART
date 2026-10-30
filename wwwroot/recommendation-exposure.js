(function (root) {
  'use strict';
  const maxWorks = 512, maxAliases = 32;
  const validKey = key => typeof key === 'string' &&
    /^(danbooru|gelbooru|rule34|sankaku):[A-Za-z0-9]{1,64}$/.test(key);
  function cleanKeys(value) {
    const keys = new Set();
    for (const key of Array.isArray(value) ? value : []) {
      if (validKey(key)) keys.add(key);
      if (keys.size === maxAliases) break;
    }
    return [...keys];
  }

  // One slot is an artwork, even when several catalogs or versions identify it.
  // Legacy flat histories import as singleton groups without losing their keys.
  function cleanGroups(value) {
    const aliases = new Map(), entries = new Map();
    for (const raw of (Array.isArray(value) ? value : []).slice(-maxWorks * 2)) {
      const keys = cleanKeys(typeof raw === 'string' ? [raw] : raw);
      if (!keys.length) continue;
      const matches = new Set(keys.map(key => aliases.get(key)).filter(Boolean));
      const merged = cleanKeys([...keys, ...[...matches].flatMap(entry => entries.get(entry) || [])]);
      for (const entry of matches) {
        for (const key of entries.get(entry) || []) if (aliases.get(key) === entry) aliases.delete(key);
        entries.delete(entry);
      }
      const entry = {};
      entries.set(entry, merged);
      for (const key of merged) aliases.set(key, entry);
    }
    return [...entries.values()].slice(-maxWorks);
  }
  const append = (previous, groups) => cleanGroups([
    ...(Array.isArray(previous) ? previous : []), ...(Array.isArray(groups) ? groups : [])]);
  const keys = groups => [...new Set((Array.isArray(groups) ? groups : [])
    .slice(-maxWorks).flatMap(group => cleanKeys(typeof group === 'string' ? [group] : group)))];

  function createTracker({ root: viewport, getSession, getGeneration = session => session,
      getKeys, onExpose, isVisible = () => !root.document?.hidden,
      Observer = root.IntersectionObserver, now = () => root.performance?.now?.() || 0 } = {}) {
    let observer, session, generation, epoch = 0;
    const observed = new Map();
    const supported = typeof Observer === 'function';
    const allowed = () => session && getSession() === session &&
      getGeneration(session) === generation && isVisible();
    function stop() {
      observer?.disconnect(); observer = undefined;
      observed.clear(); session = undefined; generation = undefined; epoch++;
    }
    function record(entries, version) {
      if (version !== epoch || !allowed()) return;
      const shown = [];
      for (const entry of entries) {
        const state = observed.get(entry.target);
        if (!state || entry.target.isConnected === false || !entry.isIntersecting ||
            Number(entry.intersectionRatio ?? 1) < .35 ||
            typeof entry.time === 'number' && entry.time < state.since) continue;
        const current = cleanKeys(getKeys(entry.target));
        const signature = JSON.stringify(current);
        if (!current.length || state.seen === signature || state.signature !== signature) continue;
        state.seen = signature; shown.push(current);
      }
      if (shown.length && allowed()) onExpose(session, shown);
    }
    function refresh(force = false) {
      const next = getSession();
      if (!next || !isVisible()) { stop(); return; }
      const nextGeneration = getGeneration(next);
      if (force || next !== session || nextGeneration !== generation) {
        stop(); session = next; generation = nextGeneration;
        if (supported) {
          const version = epoch;
          observer = new Observer(entries => record(entries, version),
            { root: viewport, rootMargin: '0px', threshold: [.35] });
        }
      }
      const cards = new Set(viewport.querySelectorAll('article.card[data-work-key]'));
      for (const [card] of observed) if (!cards.has(card)) {
        observer?.unobserve(card); observed.delete(card);
      }
      for (const card of cards) {
        const signature = JSON.stringify(cleanKeys(getKeys(card)));
        const previous = observed.get(card);
        if (previous?.signature === signature) continue;
        if (previous) observer?.unobserve(card);
        observed.set(card, { signature, seen: previous?.seen, since: now() });
        observer?.observe(card);
      }
      if (!observer) {
        const bounds = viewport.getBoundingClientRect();
        record([...cards].map(target => {
          const box = target.getBoundingClientRect();
          const width = Math.max(0, Math.min(bounds.right, box.right) - Math.max(bounds.left, box.left));
          const height = Math.max(0, Math.min(bounds.bottom, box.bottom) - Math.max(bounds.top, box.top));
          const area = Math.max(0, box.width ?? box.right - box.left) * Math.max(0, box.height ?? box.bottom - box.top);
          return { target, isIntersecting: width > 0 && height > 0,
            intersectionRatio: area ? width * height / area : 0 };
        }), epoch);
      }
    }
    return { refresh, stop, observerSupported: supported };
  }
  const api = { cleanGroups, append, keys, createTracker, maxWorks, maxAliases };
  root.DartRecommendationExposure = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);

(function(root) {
  'use strict';
  // A route keeps visited works even when a like or the viewed filter removes
  // them from the source feed. Source pages can append without changing order.
  function create({ items = [], current, read = () => [], more = () => false,
    load = async () => {}, same = (a, b) => a.key === b.key,
    merge = (previous, incoming) => [...previous, ...incoming.filter(item =>
      !previous.some(entry => same(entry, item)))], allowed = () => true,
    changed = () => {}, maxRounds = 8 }) {
    let works = [...items], index = Math.max(0, works.findIndex(item => same(item, current))),
      wanted = index, revision = 0, pending = null, busy = false, error = false, lastRead, lastReadLength = -1;
    function sync() {
      const incoming = read();
      if (incoming === lastRead && incoming.length === lastReadLength) return works;
      lastRead = incoming; lastReadLength = incoming.length;
      const selected = works[index], offset = wanted - index;
      works = merge(works, incoming);
      if (selected) index = Math.max(0, works.findIndex(item => same(item, selected)));
      wanted = Math.max(0, index + offset);
      return works;
    }
    function adjacent(direction, start = index) {
      for (let next = start + direction; next >= 0 && next < works.length; next += direction)
        if (allowed(works[next])) return next;
      return -1;
    }
    function fetchMore() {
      if (!pending) pending = Promise.resolve().then(load).then(() => {
        sync(); error = false;
      }).catch(cause => { error = true; throw cause; }).finally(() => {
        pending = null; changed();
      });
      return pending;
    }
    const route = {
      sync,
      update(item) {
        const selected = works[index], offset = wanted - index;
        works = merge(works, [item]);
        if (selected) index = Math.max(0, works.findIndex(entry => same(entry, selected)));
        wanted = Math.max(0, index + offset); changed();
      },
      select(item) {
        sync();
        const selected = works.findIndex(entry => same(entry, item));
        if (selected >= 0) index = wanted = selected;
        revision++; busy = false; changed();
      },
      cancel() { revision++; wanted = index; busy = false; changed(); },
      async move(direction) {
        sync();
        const ticket = ++revision;
        const next = adjacent(direction, wanted);
        wanted = next >= 0 ? next : direction < 0 ? 0 : Math.max(wanted + 1, works.length);
        if (direction < 0 && next < 0) { wanted = index; busy = false; changed(); return null; }
        busy = wanted >= works.length; changed();
        try {
          for (let round = 0; wanted >= works.length && more() && round < maxRounds; round++) {
            await fetchMore();
            if (ticket !== revision) return null;
            // Hidden-only pages are real progress, so continue across them.
            while (wanted < works.length && !allowed(works[wanted])) wanted++;
          }
          if (ticket !== revision) return null;
          if (wanted >= works.length || !allowed(works[wanted])) {
            error = more(); wanted = index; return null;
          }
          index = wanted; error = false;
          return works[index];
        } catch {
          if (ticket === revision) wanted = index;
          return null;
        } finally {
          if (ticket === revision) { busy = false; changed(); }
        }
      },
      async prefetch() {
        sync();
        if (works.length - index <= 3 && more() && !error) {
          try { await fetchMore(); } catch { /* Retry remains available on Next. */ }
        }
      },
      neighbors() { sync(); return [-1, 1].map(direction => adjacent(direction))
        .filter(position => position >= 0).map(position => works[position]); },
      get state() { return { index, count: works.length, busy, error,
        previous: adjacent(-1) >= 0, next: adjacent(1) >= 0 || more() }; },
      get items() { return works; }
    };
    return route;
  }
  function shortcut(event, focused, blocked = false) {
    if (blocked || event.defaultPrevented || event.isComposing || event.ctrlKey ||
        event.metaKey || event.altKey || event.shiftKey || focused?.isContentEditable ||
        focused?.closest?.('input, textarea, select, [contenteditable], video, [role="slider"]')) return '';
    if (event.key === 'ArrowLeft') return 'previous';
    if (event.key === 'ArrowRight') return 'next';
    if (!event.repeat && (event.code === 'KeyF' || String(event.key).toLowerCase() === 'f')) return 'like';
    return '';
  }
  const api = { create, shortcut };
  root.DartArtworkNavigation = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

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
      wanted = index, remaining = 0, revision = 0, pending = null, busy = false, error = false, lastRead, lastReadLength = -1;
    function keepPositions(selected, destination) {
      if (selected) index = Math.max(0, works.findIndex(item => same(item, selected)));
      if (destination === selected) { wanted = index; return; }
      const found = destination ? works.findIndex(item => same(item, destination)) : -1;
      wanted = found >= 0 ? found : index;
    }
    function sync() {
      const incoming = read();
      if (incoming === lastRead && incoming.length === lastReadLength) return works;
      lastRead = incoming; lastReadLength = incoming.length;
      const selected = works[index], destination = works[wanted];
      works = merge(works, incoming);
      keepPositions(selected, destination);
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
        const selected = works[index], destination = works[wanted];
        works = merge(works, [item]);
        keepPositions(selected, destination); changed();
      },
      replaceGroup(expected, groups) {
        const keys = new Set([expected.key, ...(expected.memberKeys || [])]);
        const selected = works[index], destination = works[wanted];
        const matches = item => { const members = new Set([item.key, ...(item.memberKeys || [])]);
          return members.size === keys.size && [...keys].every(key => members.has(key)); };
        works = works.flatMap(item => matches(item) ? groups : [item]);
        const position = previous => works.findIndex(item => item.key === previous?.key ||
          item.memberKeys?.includes(previous?.key));
        const found = position(selected), target = position(destination);
        if (found >= 0) index = found;
        wanted = target >= 0 ? target : index; lastRead = undefined; changed();
      },
      select(item) {
        sync();
        const selected = works.findIndex(entry => same(entry, item));
        if (selected >= 0) index = wanted = selected;
        remaining = 0;
        revision++; busy = false; changed();
      },
      cancel() { revision++; wanted = index; remaining = 0; busy = false; changed(); },
      async move(direction) {
        sync();
        const ticket = ++revision;
        if (remaining) remaining += direction;
        else {
          const next = adjacent(direction, wanted);
          if (next >= 0) wanted = next;
          else if (direction > 0) remaining = 1;
          else { wanted = index; busy = false; changed(); return null; }
        }
        busy = remaining > 0; changed();
        try {
          for (let round = 0; remaining && more() && round < maxRounds; round++) {
            await fetchMore();
            if (ticket !== revision) return null;
            // Queued steps count visible works, including across hidden-only pages.
            for (let next; remaining && (next = adjacent(1, wanted)) >= 0; remaining--)
              wanted = next;
          }
          if (ticket !== revision) return null;
          if ((remaining && (more() || wanted === index)) || !allowed(works[wanted])) {
            error = more(); wanted = index; remaining = 0; return null;
          }
          index = wanted; remaining = 0; error = false;
          return works[index];
        } catch {
          if (ticket === revision) { wanted = index; remaining = 0; }
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

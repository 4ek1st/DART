(function(root) {
  'use strict';
  // The work route navigates between artworks. This controller owns only the
  // bounded, already deduplicated media pages inside the selected artwork.
  function create({ urls = [], selected, key = value => value, prepare = async url => url,
    show = () => {}, changed = () => {} }) {
    const identities = new Set();
    const pages = urls.filter(url => url && !identities.has(key(url)) && identities.add(key(url)));
    let index = Math.max(0, pages.findIndex(url => key(url) === key(selected))), wanted = index;
    let revision = 0, controller, busy = false, error = false, disposed = false;
    const state = () => ({ index, wanted, length: pages.length, busy, error });
    const notify = () => changed(state());
    async function select(next, force = false) {
      if (disposed || next < 0 || next >= pages.length || !force && next === wanted) return false;
      const ticket = ++revision;
      controller?.abort(); controller = new AbortController();
      const reader = controller;
      wanted = next; busy = true; error = false; notify();
      try {
        const ready = await prepare(pages[next], reader.signal);
        if (disposed || reader.signal.aborted || ticket !== revision) return false;
        const previous = index;
        index = next; busy = false;
        show(ready, index, previous); notify(); return true;
      } catch (cause) {
        if (disposed || reader.signal.aborted || ticket !== revision) return false;
        busy = false; error = true; notify(); return false;
      }
    }
    const gallery = {
      get state() { return state(); },
      get pages() { return pages; },
      move(step) { return select(Math.max(0, Math.min(pages.length - 1, wanted + Math.sign(step)))); },
      retry() { return select(wanted, true); },
      cancel() {
        ++revision; controller?.abort(); controller = null;
        wanted = index; busy = error = false; if (!disposed) notify();
      },
      dispose() { disposed = true; gallery.cancel(); }
    };
    return gallery;
  }
  function shortcut(event, focused) {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.isComposing || focused?.isContentEditable ||
        focused?.closest?.('input, textarea, select, [contenteditable], [role="slider"]')) return 0;
    if (event.code === 'KeyS' || ['ArrowDown', 's', 'S'].includes(event.key)) return 1;
    if (event.code === 'KeyW' || ['ArrowUp', 'w', 'W'].includes(event.key)) return -1;
    return 0;
  }
  function layout(width, height, viewportWidth, viewportHeight) {
    // Neighbors live outside the existing fitted image. They never contribute
    // to its size or centering, even when only one neighbor exists.
    const gap = Math.max(12, Math.min(40, viewportHeight * .026));
    return {
      peekHeight: Math.max(0, Math.min(48, viewportHeight * .033, (viewportHeight - height) / 2 - gap - 2)),
      panelLeft: (viewportWidth - width) / 2 >= 80 ? -72 : 8
    };
  }
  function wheelMode({ length, scale, ctrlKey, video }) {
    if (ctrlKey) return video ? 'native' : 'zoom';
    if (length > 1) return scale > 1.01 ? 'pan' : 'page';
    return video ? 'native' : 'zoom';
  }
  function wheelGesture() {
    let last = -Infinity, direction = 0, amount = 0;
    return (delta, now) => {
      const next = Math.sign(delta);
      if (!next) return 0;
      const fresh = now - last > 180 || next !== direction;
      last = now;
      if (fresh) { direction = next; amount = 0; }
      if (amount === Infinity) return 0;
      amount += Math.abs(delta);
      if (amount < 24) return 0;
      amount = Infinity; return next;
    };
  }
  const api = { create, shortcut, layout, wheelMode, wheelGesture };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.DartPreviewGallery = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

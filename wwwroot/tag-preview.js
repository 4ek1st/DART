(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DartTagPreview = api;
})(globalThis, function () {
  'use strict';
  const normalizedTags = new Map();
  function normalizeTag(value) {
    const original = String(value || ''), cached = normalizedTags.get(original);
    if (cached !== undefined) return cached;
    const input = original.normalize('NFKC');
    if (/[\x00-\x1f\x7f]/.test(input)) return '';
    const raw = input.trim().replace(/^#+/, '');
    const tag = raw.toLowerCase().replace(/\s+/g, '_');
    const result = tag && tag.length <= 100 && !/[\x00-\x1f\x7f*?]/.test(raw) && !tag.startsWith('-') &&
      !/^(order|sort|rating|source|id|date|score|user|fav):/.test(tag) ? tag : '';
    if (original.length <= 200) {
      if (normalizedTags.size >= 4096) normalizedTags.delete(normalizedTags.keys().next().value);
      normalizedTags.set(original, result);
    }
    return result;
  }
  function matchesTag(item, value) {
    const tag = normalizeTag(value);
    return !!tag && [item, ...(item?.groupMembers || [])].some(work =>
      ['tags', 'allTags', 'characterTags', 'copyrightTags'].some(field =>
        (work?.[field] || []).some(candidate => normalizeTag(candidate) === tag)));
  }
  const aborted = signal => { if (signal?.aborted) throw new DOMException('Preview cancelled', 'AbortError'); };
  function createResolver({ getViewed = () => [], search, allowed = () => true,
    clock = Date.now, ttl = 120000, emptyTtl = 15000, maxEntries = 48 } = {}) {
    const cache = new Map();
    let revision = 0;
    const eligible = (item, tag, scope) => item && matchesTag(item, tag) && allowed(item, scope);
    return {
      async resolve(value, scope = {}, signal) {
        aborted(signal);
        const tag = normalizeTag(value);
        if (!tag || scope.rating === 'none') return null;
        const generation = revision;
        const viewed = await getViewed(tag, scope, signal);
        aborted(signal);
        for (const item of viewed || []) if (eligible(item, tag, scope)) return { item, origin: 'viewed' };
        const key = JSON.stringify([scope.key || '', tag]), cached = cache.get(key);
        if (cached && cached.until > clock() && (!cached.item || eligible(cached.item, tag, scope))) {
          cache.delete(key); cache.set(key, cached);
          return cached.item ? { item: cached.item, origin: 'search' } : null;
        }
        cache.delete(key);
        const items = await search(tag, scope, signal);
        aborted(signal);
        const item = (items || []).find(candidate => eligible(candidate, tag, scope)) || null;
        if (generation === revision) {
          cache.set(key, { item, until: clock() + (item ? ttl : emptyTtl) });
          while (cache.size > maxEntries) cache.delete(cache.keys().next().value);
        }
        return item ? { item, origin: 'search' } : null;
      },
      clear() { revision++; cache.clear(); }
    };
  }
  function create({ document: doc = globalThis.document, selector, getTag, getScope,
    resolver, loadImage, translate = value => value, delay = 300, timeout = 10000 } = {}) {
    const win = doc.defaultView || globalThis;
    const tip = doc.createElement('div');
    tip.id = 'tag-hover-preview'; tip.className = 'tag-hover-preview';
    tip.setAttribute('role', 'tooltip'); tip.hidden = true;
    const label = doc.createElement('div'); label.className = 'tag-preview-label';
    label.dataset.tagPreviewLabel = ''; label.setAttribute('data-no-i18n', '');
    const frame = doc.createElement('div'); frame.className = 'tag-preview-frame';
    const image = doc.createElement('img'); image.dataset.tagPreviewImage = ''; image.alt = '';
    image.decoding = 'async'; image.draggable = false;
    const state = doc.createElement('span'); state.className = 'tag-preview-state'; state.dataset.tagPreviewState = '';
    frame.append(image, state); tip.append(label, frame); doc.body.append(tip);
    const listeners = [];
    let target = null, targetTag = '', targetScope = '', timer = null, controller = null, generation = 0, release = null, nativeTitle = null;
    let touchUntil = 0, disposed = false;
    const on = (node, type, fn, options) => { node.addEventListener(type, fn, options); listeners.push(() => node.removeEventListener(type, fn, options)); };
    function position() {
      if (!target || tip.hidden) return;
      const rect = target.getBoundingClientRect(), bounds = tip.getBoundingClientRect(), gap = 10;
      const width = win.innerWidth || doc.documentElement.clientWidth;
      const height = win.innerHeight || doc.documentElement.clientHeight;
      const left = Math.max(8, Math.min(rect.left, width - bounds.width - 8));
      const top = rect.bottom + gap + bounds.height <= height - 8 ? rect.bottom + gap : rect.top - gap - bounds.height;
      tip.style.left = left + 'px';
      tip.style.top = Math.max(8, Math.min(top, height - bounds.height - 8)) + 'px';
    }
    function hide() {
      generation++; clearTimeout(timer); timer = null;
      controller?.abort(); controller = null;
      release?.(); release = null;
      if (target) {
        const ids = (target.getAttribute('aria-describedby') || '').split(/\s+/).filter(id => id && id !== tip.id);
        if (ids.length) target.setAttribute('aria-describedby', ids.join(' '));
        else target.removeAttribute('aria-describedby');
        if (nativeTitle !== null && !target.hasAttribute('title')) target.setAttribute('title', nativeTitle);
      }
      nativeTitle = null; target = null; targetTag = ''; targetScope = '';
      tip.hidden = true; tip.classList.remove('ready');
      image.removeAttribute('src'); delete tip.dataset.tag; delete tip.dataset.origin;
    }
    function reconcile() {
      if (target && (!target.isConnected || normalizeTag(getTag(target)) !== targetTag || getScope(target)?.key !== targetScope)) hide();
      else if (target) {
        if (target.hasAttribute('title')) {
          nativeTitle = target.getAttribute('title'); target.removeAttribute('title');
        }
        if (!tip.hidden) {
          const ids = new Set((target.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
          if (!ids.has(tip.id)) { ids.add(tip.id); target.setAttribute('aria-describedby', [...ids].join(' ')); }
        }
      }
    }
    async function show(trigger, tag, ticket) {
      if (disposed || ticket !== generation || !trigger.isConnected) return;
      const scope = getScope(trigger);
      if (!scope || scope.rating === 'none' || scope.key !== targetScope) return hide();
      const active = controller = new AbortController();
      const bounded = AbortSignal.any([active.signal, AbortSignal.timeout(timeout)]);
      const current = () => !disposed && ticket === generation && target === trigger && trigger.isConnected &&
        !active.signal.aborted && normalizeTag(getTag(trigger)) === tag && getScope(trigger)?.key === scope.key;
      const unavailable = () => {
        if (!current()) return;
        release?.(); release = null; image.removeAttribute('src'); tip.classList.remove('ready');
        state.textContent = translate('No preview available');
      };
      bounded.addEventListener('abort', unavailable, { once: true });
      tip.dataset.tag = tag; label.textContent = '#' + tag.replaceAll('_', ' ');
      state.textContent = translate('Loading preview…'); tip.hidden = false;
      (trigger.closest('dialog[open]') || doc.body).append(tip);
      const ids = new Set((trigger.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
      ids.add(tip.id); trigger.setAttribute('aria-describedby', [...ids].join(' '));
      position();
      try {
        const result = await resolver.resolve(tag, scope, bounded);
        if (!current()) return;
        if (!result) { state.textContent = translate('No preview available'); return; }
        const loaded = await loadImage(result.item, bounded);
        if (!current() || bounded.aborted) { loaded?.release?.(); return; }
        release = loaded.release || null;
        image.src = loaded.url;
        await image.decode?.();
        if (!current()) return;
        aborted(bounded);
        tip.dataset.origin = result.origin;
        state.textContent = translate(result.origin === 'viewed' ? 'Previously viewed' : 'Search preview');
        tip.classList.add('ready');
      } catch {
        if (current()) {
          release?.(); release = null;
          state.textContent = translate('No preview available');
        }
      } finally {
        bounded.removeEventListener('abort', unavailable);
        if (target === trigger && ticket === generation && (!trigger.isConnected || getScope(trigger)?.key !== scope.key)) hide();
      }
    }
    function enter(trigger) {
      if (!trigger || disposed || target === trigger) return;
      const tag = normalizeTag(getTag(trigger));
      hide();
      if (!tag) return;
      const scope = getScope(trigger);
      if (!scope || scope.rating === 'none') return;
      target = trigger; targetTag = tag; targetScope = scope.key;
      nativeTitle = trigger.getAttribute('title'); trigger.removeAttribute('title');
      const ticket = generation;
      timer = setTimeout(() => { timer = null; void show(trigger, tag, ticket); }, delay);
    }
    on(doc, 'pointerover', event => {
      if (event.pointerType === 'touch') return;
      const trigger = event.target.closest?.(selector);
      if (trigger && !trigger.contains(event.relatedTarget)) enter(trigger);
    });
    on(doc, 'pointerout', event => {
      if (target?.contains(event.target) && !target.contains(event.relatedTarget)) hide();
    });
    on(doc, 'focusin', event => { if (Date.now() >= touchUntil) enter(event.target.closest?.(selector)); });
    on(doc, 'focusout', event => { if (target?.contains(event.target) && !target.contains(event.relatedTarget)) hide(); });
    on(doc, 'pointerdown', event => { if (event.pointerType === 'touch') touchUntil = Date.now() + 1000; hide(); }, true);
    on(doc, 'contextmenu', hide, true);
    on(doc, 'keydown', event => { if (event.key === 'Escape') hide(); }, true);
    on(doc, 'scroll', hide, true); on(win, 'resize', hide); on(win, 'blur', hide);
    on(doc, 'visibilitychange', () => { if (doc.hidden) hide(); });
    const mutations = typeof win.MutationObserver === 'function' ? new win.MutationObserver(reconcile) : null;
    mutations?.observe(doc.body, { childList: true, subtree: true, attributes: true,
      attributeFilter: ['data-query', 'data-tag', 'data-context-tag', 'data-recommendation-tag', 'title', 'aria-describedby'] });
    return { hide, reconcile, clear() { hide(); resolver.clear(); },
      dispose() { disposed = true; hide(); mutations?.disconnect(); listeners.forEach(remove => remove()); tip.remove(); } };
  }
  return { normalizeTag, matchesTag, createResolver, create };
});

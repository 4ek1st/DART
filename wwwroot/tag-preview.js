(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DartTagPreview = api;
})(globalThis, function () {
  'use strict';
  const normalizedTags = new Map();
  const tagFields = ['tags', 'allTags', 'characterTags', 'copyrightTags'];
  const thumbnailOwners = item => item?.groupMembers?.length ? item.groupMembers : [item];
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
    return !!tag && [item, ...(item?.groupMembers || [])].some(work => hasTag(work, tag));
  }
  const hasTag = (work, tag) => tagFields.some(field =>
    (work?.[field] || []).some(candidate => normalizeTag(candidate) === tag));
  function exclusionTokens(item, logic) {
    const tokens = new Set();
    for (const work of [item, ...(item?.groupMembers || [])]) {
      if (!work) continue;
      // A shared publication/parent is not proof of the same drawing. Reuse
      // only confirmed file identities and actual grouped member keys.
      for (const token of logic.workHistoryTokens(work))
        if (/^(key:|hash:|group:media:)/.test(token)) tokens.add(token);
      for (const url of [work.thumbnail, ...(work.images || [])])
        if (url) tokens.add('file:' + logic.mediaCacheKey(url));
    }
    return [...tokens].sort();
  }
  function excludes(item, tokens, logic) {
    return !!tokens?.size && exclusionTokens(item, logic).some(token => tokens.has(token));
  }
  function representativeCandidates(item, value) {
    const tag = normalizeTag(value);
    if (!tag) return [];
    // The group's union of tags can describe another version than its cover.
    // Use metadata belonging to the actual thumbnail owner, without mutating
    // the saved group or borrowing tags from its other members.
    return thumbnailOwners(item).filter(work => hasTag(work, tag));
  }
  function exampleScore(item, value, scope = {}) {
    const tag = normalizeTag(value);
    if (!tag) return 0;
    const tags = new Set(['tags', 'allTags'].flatMap(field => (item?.[field] || []).map(normalizeTag)));
    const characters = new Set((item?.characterTags || []).map(normalizeTag)
      .filter(name => name && !['original_character', 'character_request'].includes(name)));
    const has = (...names) => names.some(name => tags.has(name));
    const shortSide = Math.min(Number(item?.width) || 0, Number(item?.height) || 0);
    let score = (has(tag + '_focus') ? 100 : 0) + (shortSide >= 1200 ? 2 : shortSide >= 640 ? 1 : 0);
    const character = scope.tagKind === 'character' || characters.has(tag);
    if (character) {
      if (characters.has(tag)) score += 40;
      if (characters.size === 1 && characters.has(tag)) score += 80;
      if (characters.size > 1) score -= 30 * Math.min(4, characters.size - 1);
      if (has('solo', 'solo_focus') && characters.size <= 1) score += 20;
      if (has('2girls', '2boys', 'multiple_girls', 'multiple_boys', 'group')) score -= 20;
      if (has('simple_background', 'white_background', 'transparent_background')) score += 4;
      return score;
    }
    const regions = [
      [/(?:^|_)(?:eyes?|pupils?|iris|eyelashes|heterochromia)(?:_|$)/, ['eye_focus', 'eyes_focus', 'face_focus'], ['portrait']],
      [/(?:^|_)hair(?:_|$)/, ['hair_focus', 'face_focus'], ['portrait', 'upper_body']],
      [/(?:^|_)(?:hands?|fingers?|nails?|bracelet|rings?)(?:_|$)/, ['hand_focus', 'hands_focus'], []],
      [/(?:^|_)(?:feet|foot|barefoot|toes?|shoes?)(?:_|$)/, ['foot_focus', 'feet_focus'], []],
      [/(?:^|_)(?:legs?|thighs?|stockings?)(?:_|$)/, ['leg_focus', 'legs_focus'], ['full_body']]
    ];
    const region = regions.find(([pattern]) => pattern.test(tag));
    if (region) {
      if (has(...region[1])) score += 60;
      if (has(...region[2])) score += 8;
      // A generic face close-up does not make a shoe or a leg more visible.
      if (!/feet|foot|barefoot|toes?|shoes?|legs?|thighs?|stockings?/.test(tag) && has('close_up', 'close-up')) score += 5;
      if (has('simple_background', 'white_background', 'transparent_background')) score += 3;
    }
    return score;
  }
  function createExamplePool({ tag, scope, logic, allowed = () => true, limit = 48 } = {}) {
    const items = [], identities = new Map();
    return { items, add(item) {
      if (!matchesTag(item, tag) || !allowed(item, scope)) return false;
      const tokens = exclusionTokens(item, logic);
      const previous = tokens.map(token => identities.get(token)).find(index => index !== undefined);
      const index = previous === undefined ? items.length : previous;
      if (previous === undefined && items.length >= limit) return true;
      if (previous === undefined) items.push(item);
      else if (exampleScore(item, tag, scope) > exampleScore(items[index], tag, scope)) items[index] = item;
      for (const token of tokens) identities.set(token, index);
      return items.length >= limit;
    } };
  }
  function createViewedExamplePicker(entries, { scope, allowed, wasViewed }) {
    const requested = new Map(entries.map(({tag, kind}) => [tag, { tagKind: kind }]));
    const items = new Map(), scores = new Map(), seen = new WeakSet();
    return {
      items,
      visit(item, needsProof) {
        if (!item || seen.has(item)) return;
        seen.add(item);
        let eligible;
        for (const work of thumbnailOwners(item)) {
          if (!work?.thumbnail) continue;
          let matching;
          for (const field of tagFields) for (const value of work[field] || []) {
            const tag = normalizeTag(value);
            if (requested.has(tag)) (matching ||= new Set()).add(tag);
          }
          if (!matching) continue;
          eligible ??= allowed(item, scope) && (!needsProof || wasViewed(item));
          if (!eligible) return;
          if (work !== item && !allowed(work, scope)) continue;
          for (const tag of matching) {
            const score = exampleScore(work, tag, requested.get(tag));
            if (score <= (scores.get(tag) ?? -Infinity)) continue;
            scores.set(tag, score);
            items.set(tag, work);
          }
        }
      }
    };
  }
  const aborted = signal => { if (signal?.aborted) throw new DOMException('Preview cancelled', 'AbortError'); };
  function createResolver({ getViewed = () => [], search, allowed = () => true,
    score = () => 0, clock = Date.now, ttl = 120000, emptyTtl = 15000, maxEntries = 48 } = {}) {
    const cache = new Map();
    let revision = 0;
    const eligible = (item, tag, scope) => item && matchesTag(item, tag) && allowed(item, scope);
    function choose(items, tag, scope) {
      let best = null, bestScore = -Infinity;
      for (const item of items || []) if (eligible(item, tag, scope)) {
        const value = Number(score(item, tag, scope)) || 0;
        if (value > bestScore) { best = item; bestScore = value; }
      }
      return best;
    }
    return {
      async resolve(value, scope = {}, signal) {
        aborted(signal);
        const tag = normalizeTag(value);
        if (!tag || scope.rating === 'none') return null;
        const generation = revision;
        const viewed = await getViewed(tag, scope, signal);
        aborted(signal);
        const seen = choose(viewed, tag, scope);
        if (seen) return { item: seen, origin: 'viewed' };
        const key = JSON.stringify([scope.key || '', tag]), cached = cache.get(key);
        if (cached && cached.until > clock() && (!cached.item || eligible(cached.item, tag, scope))) {
          cache.delete(key); cache.set(key, cached);
          return cached.item ? { item: cached.item, origin: 'search' } : null;
        }
        cache.delete(key);
        const items = await search(tag, scope, signal);
        aborted(signal);
        const item = choose(items, tag, scope);
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
  return { normalizeTag, matchesTag, exclusionTokens, excludes, representativeCandidates, exampleScore,
    createExamplePool, createViewedExamplePicker, createResolver, create };
});

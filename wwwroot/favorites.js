(function (root) {
  'use strict';
  const ordinary = new Set(['g', 'general', 's', 'sensitive', 'safe', 'sfw']);
  const generic = new Set(['solo', '1girl', '1boy', '2girls', '2boys', 'multiple_girls', 'multiple_boys',
    'sex', 'female', 'male', 'original', 'original_character', 'highres', 'absurdres', 'artist_name',
    'signature', 'watermark', 'commentary_request', 'translation_request', 'looking_at_viewer']);
  const canonical = value => String(value || '').normalize('NFKC').trim().toLowerCase().replace(/\s+/g, '_');
  function normalize(value) {
    const tag = String(value || '').normalize('NFKC').trim().toLowerCase();
    return tag.length > 0 && tag.length <= 100 && !/\s|[\x00-\x1f\x7f]/.test(tag) &&
      !tag.startsWith('-') && !/^(order|sort|rating|source|id|date|score|user|fav):/.test(tag) ? tag : '';
  }
  function ratingMatches(work, rating) {
    return !rating || rating === 'all' || (rating === 'general' ? ordinary.has(work.rating) : !ordinary.has(work.rating));
  }
  function collections({ summary = {}, tags = [], recent = [], known = [], type = 'character', origin = 'mine',
    rating = 'all', allowed = () => true } = {}) {
    const characters = new Set();
    for (const work of [...known, ...recent]) for (const tag of work?.characterTags || []) characters.add(canonical(tag));
    const entries = new Map((summary.entries || []).map(entry => [canonical(entry.tag), entry]));
    for (const entry of entries.values()) if (entry.kind === 'character') characters.add(canonical(entry.tag));
    const manual = new Set(tags.map(canonical));
    const covers = new Map((summary.works || []).map(work => [work.key, work]));
    const kindFor = tag => summary.kinds?.[tag] || (characters.has(tag) ? 'character' : 'tag');
    const selected = origin === 'system' ? [...entries.keys()].filter(tag => entries.get(tag).kind === type &&
      entries.get(tag).count >= 3 && (type === 'character' || !generic.has(tag))) : [...manual].filter(tag => kindFor(tag) === type);
    const recentByTag = new Map();
    for (const work of recent) for (const value of [...(work.characterTags || []), ...(work.allTags || []), ...(work.tags || [])]) {
      const tag = canonical(value); if (!recentByTag.has(tag)) recentByTag.set(tag, work);
    }
    return selected.map(tag => {
      const entry = entries.get(tag);
      // A filtered latest cover stays blank; using an older cover would mislabel it as the latest view.
      const candidate = entry ? covers.get(entry.lastWorkKey) : recentByTag.get(tag);
      const cover = candidate && candidate.thumbnail && ratingMatches(candidate, rating) && allowed(candidate) ? candidate : null;
      return { tag, kind: origin === 'system' ? entry.kind : kindFor(tag), favorite: manual.has(tag), cover,
        count: entry?.count ?? null, activeDays: entry?.activeDays || 0, lastViewedAt: entry?.lastViewedAt || null,
        share: entry && summary.totalWorks ? Math.min(100, Math.round(entry.count / summary.totalWorks * 100)) : null };
    }).sort((a, b) => (b.count || 0) - (a.count || 0) ||
      String(b.lastViewedAt || '').localeCompare(String(a.lastViewedAt || '')) || a.tag.localeCompare(b.tag));
  }
  function slim(item) {
    if (!item?.key || !item.source || !item.id) return null;
    const result = {};
    for (const key of ['key', 'source', 'id', 'title', 'thumbnail', 'rating', 'contentHash', 'groupKey', 'pixivGroupKey',
      'originalUrl', 'creatorTag', 'creatorName']) if (typeof item[key] === 'string') result[key] = item[key].slice(0, key === 'title' ? 200 : 2000);
    for (const key of ['tags', 'allTags', 'characterTags', 'copyrightTags'])
      result[key] = [...new Set((item[key] || []).filter(value => typeof value === 'string' && value.length <= 100))].slice(0, 256);
    result.memberKeys = (item.memberKeys || []).slice(0, 128);
    result.participants = (item.participants || []).slice(0, 16).map(({ tag, name, role }) => ({ tag, name, role }));
    result.images = (item.images || []).slice(0, 1);
    result.imageRecords = (item.imageRecords || []).filter(record => /^[a-f0-9]{32}$/i.test(record?.hash || '')).slice(0, 32)
      .map(record => ({ hash: record.hash }));
    // Unicode-heavy provider tags must still fit a keepalive request at shutdown.
    const size = () => new TextEncoder().encode(JSON.stringify(result)).length;
    for (const field of ['allTags', 'tags', 'copyrightTags', 'characterTags'])
      while (result[field].length && size() > 30000) result[field].pop();
    return result;
  }
  const escape = text => String(text ?? '').replace(/[&<>"']/g, value => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[value]));
  function create(deps) {
    const { request, getTags = () => [], setTags = () => {}, getRecent = () => [], getKnown = () => [],
      changed = () => {}, toast = () => {}, allowed = () => true, save = () => {}, svg = () => '',
      openSearch = () => {}, openDetail = () => {}, schedule = setTimeout, unschedule = clearTimeout } = deps;
    const pending = new Set(), optimistic = new Map(), observed = new Map(), cache = new Map();
    let saving = Promise.resolve(), queue = [], timer = null, sending = null, revision = 0, disposed = false;
    let lastKinds = {};
    let artworks = [], artworkLoaded = false, artworkLoading = null, artworkRevision = 0, artworkSaving = Promise.resolve();
    let membershipItems = null, membership = new Set();
    const pendingArtworks = new Set();
    const t = value => deps.t?.(value) || value;
    function mark() { revision++; cache.clear(); }
    const workTokens = item => (deps.workTokens?.(item) || [item?.key, ...(item?.memberKeys || []),
      item?.contentHash && `hash:${item.contentHash}`]).filter(token => token && !/^group:(danbooru|gelbooru|rule34|sankaku):parent:/.test(token));
    function isArtworkFavorite(item) {
      if (membershipItems !== artworks) { membershipItems = artworks; membership = new Set(artworks.flatMap(workTokens)); }
      return workTokens(item).some(token => membership.has(token));
    }
    async function loadArtworks() {
      if (artworkLoading) return artworkLoading;
      const version = artworkRevision;
      artworkLoading = request('/api/favorite-artworks').then(items => {
        if (version === artworkRevision) artworks = items;
        artworkLoaded = true; changed(); return true;
      }).catch(() => false).finally(() => { artworkLoading = null; });
      return artworkLoading;
    }
    async function toggleArtwork(item) {
      if (!item?.key || pendingArtworks.has(item.key)) return false;
      if (!artworkLoaded && !await loadArtworks()) { toast('Could not load favorite artworks. Please try again.'); return false; }
      const favorite = !isArtworkFavorite(item), previous = artworks;
      pendingArtworks.add(item.key); artworkRevision++;
      const tokens = new Set(workTokens(item));
      artworks = artworks.filter(saved => !workTokens(saved).some(token => tokens.has(token)));
      if (favorite) artworks = [item, ...artworks];
      changed();
      const result = artworkSaving.then(async () => {
        try {
          const saved = await request('/api/favorite-artworks', { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item, favorite }) });
          // Other optimistic operations are reconciled by their later serialized replies.
          if (pendingArtworks.size === 1) artworks = saved;
          return true;
        } catch {
          const currentTokens = new Set(workTokens(item));
          artworks = artworks.filter(saved => !workTokens(saved).some(token => currentTokens.has(token)));
          const restore = previous.filter(saved => workTokens(saved).some(token => currentTokens.has(token)));
          artworks = [...artworks, ...restore];
          toast('Could not save Favorite. Please try again.'); return false;
        } finally { pendingArtworks.delete(item.key); changed(); }
      });
      artworkSaving = result.catch(() => {}); return result;
    }
    function artworkButton(item, extra = '') {
      const favorite = isArtworkFavorite(item), label = t(favorite ? 'Remove favorite artwork' : 'Save favorite artwork');
      return `<button type="button" class="favorite-artwork-button ${extra}" data-action="favorite-artwork" data-key="${escape(item.key)}"
        aria-label="${label}" title="${label}" aria-pressed="${favorite}"${pendingArtworks.has(item.key) ? ' disabled' : ''}>${svg('star') || '☆'}</button>`;
    }
    async function load(tab, force = false) {
      if (tab.favoriteLoading) return;
      if (!force && tab.favoriteRevision === revision && tab.favoriteLoadedAt > Date.now() - 15000) return;
      tab.favoriteLoading = true; tab.favoriteError = ''; changed();
      try {
        const rating = tab.rating || 'all', version = revision;
        const [summary, tags, worksReady] = await Promise.all([request(`/api/favorites?rating=${rating}`, { priority: 'background' }), request('/api/favorite-tags'), loadArtworks()]);
        if (!worksReady) throw new Error('Favorite artworks unavailable');
        if ((tab.rating || 'all') !== rating) { tab.favoriteLoading = false; return load(tab, true); }
        tab.favoriteSummary = summary; lastKinds = summary.kinds || {};
        const merged = new Set(tags);
        for (const [tag, favorite] of optimistic) favorite ? merged.add(tag) : merged.delete(tag);
        setTags([...merged]); tab.favoriteRevision = version; tab.favoriteLoadedAt = Date.now();
      } catch { tab.favoriteError = 'Could not load Favorites. Your choices are still saved.'; }
      finally { tab.favoriteLoading = false; changed(); }
    }
    function toggle(value, kind = null, requested) {
      const tag = normalize(value);
      if (!tag || pending.has(tag)) return Promise.resolve(false);
      const was = getTags().includes(tag), favorite = requested ?? !was;
      pending.add(tag); optimistic.set(tag, favorite);
      setTags(favorite ? [...new Set([...getTags(), tag])] : getTags().filter(value => value !== tag));
      const previousKind = lastKinds[tag];
      if (kind) lastKinds[tag] = kind;
      changed();
      const result = saving.then(async () => {
        try {
          const tags = await request('/api/favorite-tags', { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tag, kind: kind || undefined, favorite }) });
          optimistic.delete(tag);
          const merged = new Set(tags);
          for (const [other, state] of optimistic) state ? merged.add(other) : merged.delete(other);
          setTags([...merged]); mark(); return true;
        } catch {
          optimistic.delete(tag);
          if (previousKind) lastKinds[tag] = previousKind; else delete lastKinds[tag];
          setTags(was ? [...new Set([...getTags(), tag])] : getTags().filter(value => value !== tag));
          toast('Could not save Favorite. Please try again.'); return false;
        } finally { pending.delete(tag); changed(); }
      });
      saving = result.catch(() => {}); return result;
    }
    function enqueue(item, metadataOnly) {
      const value = slim(item); if (!value) return;
      const fingerprint = JSON.stringify(value);
      if (metadataOnly && (!observed.has(value.key) || observed.get(value.key) === fingerprint)) return;
      observed.delete(value.key); observed.set(value.key, fingerprint);
      if (observed.size > 512) observed.delete(observed.keys().next().value);
      // Repeated opens within one batch still represent one distinct artwork.
      const existing = queue.find(record => record.item.key === value.key && record.metadataOnly === metadataOnly);
      if (existing) existing.item = value; else queue.push({ item: value, metadataOnly });
      mark();
      if (timer === null && !disposed) timer = schedule(() => { timer = null; void flush(); }, 300);
    }
    async function flush(keepalive = false) {
      if (timer !== null) { unschedule(timer); timer = null; }
      if (sending) { await sending; if (!keepalive) return queue.length ? flush() : undefined; }
      if (!queue.length) return;
      const batch = []; let bytes = 2;
      while (queue.length && batch.length < 16) {
        const size = new TextEncoder().encode(JSON.stringify(queue[0])).length + 1;
        if (bytes + size > (keepalive ? 45000 : 150000)) { if (!batch.length) queue.shift(); break; }
        bytes += size; batch.push(queue.shift());
      }
      if (!batch.length) return;
      let failed = false;
      sending = (async () => {
        try {
          await request('/api/favorites/activity', { method: 'POST', keepalive, priority: 'background',
            headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(batch) }); mark();
        } catch { queue.unshift(...batch); failed = true; }
      })();
      await sending; sending = null;
      if (queue.length && !keepalive && !disposed && timer === null)
        timer = schedule(() => { timer = null; void flush(); }, failed ? 5000 : 0);
    }
    function cards(tab) {
      const summary = { ...(tab.favoriteSummary || {}), kinds: { ...tab.favoriteSummary?.kinds, ...lastKinds } };
      const key = [tab, summary.entries, getTags(), getRecent(), getKnown(), tab.favoriteType, tab.favoriteOrigin, tab.rating, revision, deps.getPreferences?.()];
      const old = cache.get(tab);
      if (old && key.every((value, i) => old.key[i] === value)) return old.cards;
      const values = collections({ summary, tags: getTags(), recent: getRecent(), known: getKnown(),
        type: tab.favoriteType || 'character', origin: tab.favoriteOrigin || 'mine', rating: tab.rating, allowed });
      cache.set(tab, { key, cards: values }); return values;
    }
    const button = (action, label, attrs = '') => `<button type="button" data-action="favorites-${action}" ${attrs}>${label}</button>`;
    function render(tab) {
      const type = tab.favoriteType || 'character', origin = tab.favoriteOrigin || 'mine';
      if (type === 'artwork') {
        tab.items = artworks.filter(item => ratingMatches(item, tab.rating) && allowed(item));
        return `<section class="content favorites-page"><header class="favorites-heading"><div><h1>Favorites</h1><p>Favorite characters, tags and artworks</p></div></header>
          <div class="favorites-toolbar"><div class="favorites-switch" aria-label="${t('Favorite category')}">
          ${['character', 'tag', 'artwork'].map((value, i) => button('type', t(['Characters', 'Tags', 'Artworks'][i]), `data-value="${value}" aria-pressed="${value === type}"`)).join('')}</div>
          <div class="favorites-rating" aria-label="${t('Rating')}">${['general', 'explicit', 'all'].map((rating, i) => button('rating', ['SFW', 'NSFW', t('All images')][i],
          `data-value="${rating}" aria-pressed="${tab.rating === rating}"`)).join('')}</div></div>
          <div class="favorites-caption"><p>Saved artworks. Use the star on an artwork to add or remove it.</p>${button('refresh', t('Refresh'), tab.favoriteLoading ? 'disabled' : '')}</div>
          ${tab.favoriteError ? `<div class="favorites-message" role="alert"><p>${t(tab.favoriteError)}</p>${button('refresh', t('Try again'))}</div>` : ''}
          ${!artworkLoaded && tab.favoriteLoading ? '<div class="favorites-message" role="status">Loading Favorites…</div>' : ''}
          ${tab.items.length ? deps.renderArtworks?.(tab.items) || '' : !tab.favoriteLoading ? '<div class="favorites-empty"><h2>No favorite artworks yet</h2><p>Save an artwork with the star in its viewer or right-click menu.</p></div>' : ''}</section>`;
      }
      const values = cards(tab), summary = tab.favoriteSummary;
      const select = (group, value, label) => button(group, t(label), `data-value="${value}" aria-pressed="${(group === 'type' ? type : origin) === value}"`);
      return `<section class="content favorites-page"><header class="favorites-heading"><div><h1>Favorites</h1><p>Favorite characters, tags and artworks</p></div>
        ${button('add', `${svg('plus')}<span>${t('Add Favorite')}</span>`, `aria-expanded="${!!tab.favoriteAdding}"`)}</header>
        <div class="favorites-toolbar"><div class="favorites-switch" aria-label="${t('Favorite category')}">
        ${select('type', 'character', 'Characters')}${select('type', 'tag', 'Tags')}${select('type', 'artwork', 'Artworks')}</div>
        <div class="favorites-switch" aria-label="${t('Collection')}">${select('origin', 'mine', 'Mine')}${select('origin', 'system', 'System picks')}</div>
        <div class="favorites-rating" aria-label="${t('Rating')}">${['general', 'explicit', 'all'].map((rating, i) => button('rating', ['SFW', 'NSFW', t('All images')][i],
          `data-value="${rating}" aria-pressed="${tab.rating === rating}"`)).join('')}</div></div>
        ${tab.favoriteAdding ? `<form class="favorites-add-form"><label for="favorite-new-tag">${type === 'character' ? t('Character tag') : t('Content tag')}</label>
          <div><input id="favorite-new-tag" name="tag" required maxlength="100" autocomplete="off" placeholder="${type === 'character' ? 'fern_(sousou_no_frieren)' : 'rain'}" value="${escape(tab.favoriteDraft || '')}" data-no-i18n>
          <button type="submit">${t('Add Favorite')}</button>${button('cancel', t('Cancel'))}</div><small>Use one tag with underscores, as on the source website.</small></form>` : ''}
        <div class="favorites-caption"><p>${origin === 'mine' ? t('Saved by you. System picks never change this collection.') : t('Based on at least 3 different works you opened. Save any pick with the star.')}</p>
          ${button('refresh', t('Refresh'), tab.favoriteLoading ? 'disabled' : '')}</div>
        <div class="favorites-stats" aria-live="polite">${summary ? `<strong>${summary.totalWorks}</strong> <span>different works · Last 30 days</span>` : '<span>Last 30 days</span>'}
          <small>Viewing statistics are collected from this update onward.</small>${summary?.incomplete ? '<small>Some activity could not be counted. Figures are partial.</small>' : ''}</div>
        ${tab.favoriteError ? `<div class="favorites-message" role="alert"><p>${t(tab.favoriteError)}</p>${button('refresh', t('Try again'))}</div>` : ''}
        ${tab.favoriteLoading && !summary ? '<div class="favorites-message" role="status">Loading Favorites…</div>' : ''}
        <div class="favorites-grid">${values.map(card => `<article class="favorite-card" data-favorite-card="${escape(card.tag)}">
          <div class="favorite-cover">${button('cover', card.cover ? `<img data-image-url="${escape(card.cover.thumbnail)}" alt="" decoding="async" draggable="false">` : `<span class="favorite-no-cover">${svg(type === 'character' ? 'users' : 'tag')}<span>${t('No viewed preview yet')}</span></span>`,
            `class="favorite-cover-open" data-tag="${escape(card.tag)}" ${card.cover ? `aria-label="${t('Open last viewed artwork')}: ${escape(card.tag)}"` : `disabled aria-label="${t('No viewed preview yet')}"`}`)}
          ${button('star', svg('star') || '☆', `class="favorite-star" data-tag="${escape(card.tag)}" aria-label="${t(card.favorite ? 'Remove Favorite' : 'Save Favorite')}: ${escape(card.tag)}" aria-pressed="${card.favorite}" ${pending.has(card.tag) ? 'disabled' : ''}`)}
          ${card.cover ? `<span class="favorite-last-view">${t(card.lastViewedAt ? 'Last viewed artwork' : 'Earlier browsing history')}</span>` : ''}</div>
          ${button('search', `<span data-no-i18n>${type === 'character' ? '' : '#'}${escape(card.tag.replaceAll('_', ' '))}</span>${svg('external')}`, `class="favorite-name" data-tag="${escape(card.tag)}" title="${escape(card.tag)}"`)}
          <div class="favorite-card-stats"><span>${card.count === null ? t('No dated views yet') : `<b>${card.count}</b> ${t('different works')}`}</span><b>${card.share === null ? '—' : `${card.share}%`}</b></div>
          <div class="favorite-share" aria-hidden="true"><i style="width:${card.share || 0}%"></i></div></article>`).join('')}</div>
        ${!values.length && !tab.favoriteLoading ? `<div class="favorites-empty">${svg('star')}<h2>${t(origin === 'mine' ? 'Your Favorites start here' : 'Keep exploring')}</h2>
          <p>${t(origin === 'mine' ? 'Add a character or tag, or save a System pick with the star.' : 'Open different artworks to discover your most viewed characters and tags.')}</p>
          ${origin === 'mine' ? button('add', t('Add Favorite')) : ''}</div>` : ''}
        <p class="favorites-footnote">Counts are different artworks, not repeated opens. Copies from different sources count once.</p></section>`;
    }
    function handle(control, tab) {
      if (!control?.dataset?.action?.startsWith('favorites-') || !tab) return false;
      const action = control.dataset.action.slice(10), tag = control.dataset.tag;
      if (action === 'type') tab.favoriteType = ['tag', 'artwork'].includes(control.dataset.value) ? control.dataset.value : 'character';
      else if (action === 'origin') tab.favoriteOrigin = control.dataset.value === 'system' ? 'system' : 'mine';
      else if (action === 'rating') { tab.rating = control.dataset.value; void load(tab, true); }
      else if (action === 'add') tab.favoriteAdding = !tab.favoriteAdding;
      else if (action === 'cancel') { tab.favoriteAdding = false; tab.favoriteDraft = ''; }
      else if (action === 'refresh') { void load(tab, true); return true; }
      else if (action === 'star') { void toggle(tag, tab.favoriteType || 'character'); return true; }
      else if (action === 'search') { openSearch(tag, { rating: tab.rating }); return true; }
      else if (action === 'cover') { const work = cards(tab).find(card => card.tag === tag)?.cover; if (work) openDetail(work); return true; }
      else return false;
      save(); changed(); return true;
    }
    async function add(tab, value) {
      const tag = normalize(value);
      if (!tag) { toast('Enter one tag with underscores, without search commands.'); return false; }
      if (await toggle(tag, tab.favoriteType || 'character', true)) {
        tab.favoriteAdding = false; tab.favoriteDraft = ''; tab.favoriteOrigin = 'mine'; save(); changed(); return true;
      }
      return false;
    }
    return { load, render, handle, add, toggle, cards, invalidate: mark, loadArtworks, toggleArtwork, isArtworkFavorite, artworkButton,
      isArtworkPending: item => pendingArtworks.has(item?.key),
      record: item => enqueue(item, false), metadata: item => enqueue(item, true), flush,
      dispose() { disposed = true; if (timer !== null) unschedule(timer); timer = null; } };
  }
  const api = { normalize, collections, slim, create };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.DartFavorites = api;
})(globalThis);

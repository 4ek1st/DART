(function (root) {
  'use strict';
  const ordinary = new Set(['g', 'general', 's', 'sensitive', 'safe', 'sfw']);
  const generic = new Set(['solo', '1girl', '1boy', '2girls', '2boys', 'multiple_girls', 'multiple_boys',
    'sex', 'female', 'male', 'original', 'original_character', 'highres', 'absurdres', 'artist_name',
    'signature', 'watermark', 'commentary_request', 'translation_request', 'looking_at_viewer',
    'cum', 'cumming', 'cum_on_face', 'cum_on_body', 'cum_in_mouth', 'cum_in_pussy', 'cum_in_ass',
    'cum_inside', 'cumdrip', 'cumshot', 'ejaculation', 'creampie', 'breasts', 'nipples', 'pussy', 'penis']);
  const canonical = value => String(value || '').normalize('NFKC').trim().toLowerCase().replace(/\s+/g, '_');
  const contentTag = (tag, logic = root.CatalogLogic) => generic.has(tag) ||
    !!logic?.isBroadRecommendationTag?.(tag);
  function systemSuggestions(liked = [], preferences = {}, logic = root.CatalogLogic, selected = null) {
    if (!selected && !logic?.recommendationQueryGroups) return [];
    // Recommendation names also include legacy title guesses. Favorites needs
    // typed character evidence and must reject stale content-category mistakes.
    const names = new Set(liked.flatMap(work => work?.characterTags || []).map(canonical)
      .filter(tag => tag && !contentTag(tag, logic)));
    // Favorites uses the same entity evidence as recommendations, but never
    // consumes their joint search streams. Avoid building those unused pairs.
    selected ||= logic.recommendationQueryGroups(liked, preferences, [], { includeCombinations: false });
    const result = new Map();
    for (const entry of [...selected.priority, ...selected.names, ...selected.copyright, ...selected.other]) {
      const tag = canonical(entry.query || entry.tag);
      if (!result.has(tag)) result.set(tag, { tag, kind: names.has(tag) ? 'character' : 'tag',
        likedCount: entry.count, priority: preferences[entry.tag] === 'priority' });
    }
    return [...result.values()];
  }
  function normalize(value) {
    const tag = String(value || '').normalize('NFKC').trim().toLowerCase();
    return tag.length > 0 && tag.length <= 100 && !/\s|[\x00-\x1f\x7f]/.test(tag) &&
      !tag.startsWith('-') && !/^(order|sort|rating|source|id|date|score|user|fav):/.test(tag) ? tag : '';
  }
  function ratingMatches(work, rating) {
    if (root.CatalogLogic?.matchesRating) return root.CatalogLogic.matchesRating(work, rating || 'all');
    return !rating || rating === 'all' || (rating === 'general' ? ordinary.has(work.rating) : !ordinary.has(work.rating));
  }
  function collections({ summary = {}, tags = [], recent = [], known = [], liked = [], suggestions = null,
    preferences = {}, type = 'character', origin = 'mine', rating = 'all', allowed = () => true } = {}) {
    suggestions ||= systemSuggestions(liked, preferences);
    const characters = new Set();
    for (const work of [...known, ...recent, ...liked]) for (const tag of work?.characterTags || [])
      if (!contentTag(canonical(tag))) characters.add(canonical(tag));
    const entries = new Map((summary.entries || []).map(entry => [canonical(entry.tag), entry]));
    for (const entry of entries.values()) if (entry.kind === 'character' && !contentTag(canonical(entry.tag)))
      characters.add(canonical(entry.tag));
    const manual = new Set(tags.map(canonical));
    const covers = new Map((summary.works || []).map(work => [work.key, work]));
    const rich = new Map();
    for (const work of [...recent, ...known, ...liked]) for (const key of [work?.key, ...(work?.memberKeys || [])])
      if (key && !rich.has(key)) rich.set(key, work);
    const suggested = new Map(suggestions.map(entry => {
      const tag = canonical(entry.tag);
      return [tag, { ...entry, kind: !contentTag(tag) && (entry.kind === 'character' || characters.has(tag))
        ? 'character' : 'tag' }];
    }));
    const kindFor = tag => summary.kinds?.[tag] || (characters.has(tag) ? 'character' : 'tag');
    const selected = origin === 'system' ? [...suggested.keys()].filter(tag => suggested.get(tag).kind === type) : [...manual].filter(tag => kindFor(tag) === type);
    const recentByTag = new Map();
    if (type !== 'character') for (const work of recent) for (const value of [...(work.characterTags || []), ...(work.allTags || []), ...(work.tags || [])]) {
      const tag = canonical(value); if (!recentByTag.has(tag)) recentByTag.set(tag, work);
    }
    const enrich = work => work && rich.has(work.key) ? { ...work, ...rich.get(work.key) } : work;
    const eligible = work => work && work.filteringComplete !== false && work.thumbnail && ratingMatches(work, rating) && allowed(work);
    const characterCovers = new Map();
    if (type === 'character') {
      const wanted = new Set(selected);
      const choose = (work, coverOrigin, expected = null) => {
        const candidate = enrich(work); if (!candidate) return;
        const names = new Set((candidate.characterTags || []).map(canonical).filter(Boolean));
        if (names.size !== 1) return;
        const tag = names.values().next().value;
        if (!wanted.has(tag) || expected && expected !== tag || characterCovers.has(tag) || !eligible(candidate)) return;
        characterCovers.set(tag, { cover: candidate, coverOrigin });
      };
      // The dated latest view wins when it belongs only to this character.
      // Otherwise choose an older eligible history cover, then a like. A solo
      // content tag is optional and cannot override another typed character.
      for (const tag of selected) choose(covers.get(entries.get(tag)?.lastWorkKey), 'viewed', tag);
      const scan = (works, origin) => {
        for (const work of works) { if (characterCovers.size === wanted.size) break; choose(work, origin); }
      };
      scan(recent, 'recent');
      if (characterCovers.size < wanted.size && covers.size) {
        const dates = new Map();
        for (const entry of entries.values()) {
          const at = Date.parse(entry.lastViewedAt) || 0;
          if (at > (dates.get(entry.lastWorkKey) || 0)) dates.set(entry.lastWorkKey, at);
        }
        scan([...covers.values()].sort((a, b) => (dates.get(b.key) || 0) - (dates.get(a.key) || 0)), 'viewed');
      }
      scan(liked, 'liked');
    }
    const likedByTag = new Map();
    const neededLikes = new Set(type === 'character' ? [] : selected.filter(tag => {
      const entry = entries.get(tag);
      return !(entry ? covers.get(entry.lastWorkKey) : recentByTag.get(tag));
    }));
    // Keep the first matching like, including an ineligible one: falling back
    // to an older work after filtering would misrepresent the selected cover.
    for (const work of liked) {
      if (!neededLikes.size) break;
      for (const value of [...(work.characterTags || []), ...(work.copyrightTags || []), ...(work.tags || []), ...(work.allTags || [])]) {
        const tag = canonical(value);
        if (neededLikes.delete(tag)) likedByTag.set(tag, work);
      }
    }
    return selected.map(tag => {
      const entry = entries.get(tag);
      const character = characterCovers.get(tag);
      // Tag covers retain the latest-view rule. Character covers instead use
      // the newest eligible single-character candidate selected above.
      let candidate = type === 'character' ? character?.cover : entry ? covers.get(entry.lastWorkKey) : recentByTag.get(tag);
      let coverOrigin = type === 'character' ? character?.coverOrigin || 'recent' : entry ? 'viewed' : 'recent';
      if (type !== 'character' && !candidate) { candidate = likedByTag.get(tag); coverOrigin = 'liked'; }
      if (type !== 'character') candidate = enrich(candidate);
      const cover = eligible(candidate) ? candidate : null;
      return { tag, kind: origin === 'system' ? suggested.get(tag).kind : kindFor(tag), favorite: manual.has(tag), cover, coverOrigin,
        likedCount: suggested.get(tag)?.likedCount ?? null, priority: suggested.get(tag)?.priority || false,
        count: entry?.count ?? null, activeDays: entry?.activeDays || 0, lastViewedAt: entry?.lastViewedAt || null,
        share: entry && summary.totalWorks ? Math.min(100, Math.round(entry.count / summary.totalWorks * 100)) : null };
    }).sort((a, b) => (origin === 'system' ? Number(b.priority)-Number(a.priority) || (b.likedCount||0)-(a.likedCount||0) : 0) || (b.count || 0) - (a.count || 0) ||
      String(b.lastViewedAt || '').localeCompare(String(a.lastViewedAt || '')) || a.tag.localeCompare(b.tag));
  }
  function slim(item) {
    if (!item?.key || !item.source || !item.id) return null;
    const result = {};
    for (const key of ['key', 'source', 'id', 'title', 'thumbnail', 'rating', 'contentHash', 'groupKey', 'pixivGroupKey',
      'originalUrl', 'creatorTag', 'creatorName', 'uploaderId', 'uploaderName', 'artistId', 'artist', 'published']) if (typeof item[key] === 'string') result[key] = item[key].slice(0, key === 'title' ? 200 : 2000);
    for(const key of ['width','height','groupingVersion'])if(Number.isInteger(item[key]))result[key]=item[key];
    result.filteringComplete = true;
    for (const key of ['tags', 'allTags', 'characterTags', 'copyrightTags'])
      {
        const values = [...new Set((item[key] || []).filter(value => typeof value === 'string' && value.length <= 100))];
        result[key] = values.slice(0, 256); if (values.length > 256) result.filteringComplete = false;
      }
    result.memberKeys = (item.memberKeys || []).slice(0, 128);
    result.participants = (item.participants || []).slice(0, 16).map(({ tag, name, role }) => ({ tag, name, role }));
    result.images = [...new Set((item.images || []).filter(value=>typeof value==='string'&&value.length<=2000))].slice(0,100);
    result.imageRecords = (item.imageRecords || []).filter(record => record && (record.url || /^[a-f0-9]{32}$/i.test(record.hash || ''))).slice(0,100)
      .map(record => ({ url: String(record.url||'').slice(0,2000), hash: /^[a-f0-9]{32}$/i.test(record.hash||'')?record.hash:'',owner:String(record.owner||'').slice(0,200) }));
    result.groupMembers = (item.groupMembers || []).slice(0, 32).map(member => {
      const value = {};
      for (const key of ['key', 'source', 'id', 'creatorTag', 'creatorName', 'uploaderId', 'uploaderName', 'artistId', 'artist'])
        if (typeof member[key] === 'string') value[key] = member[key].slice(0, 200);
      value.tags = [...new Set([...(member.tags || []), ...(member.allTags || []), ...(member.characterTags || []), ...(member.copyrightTags || [])])].slice(0, 256);
      value.participants = (member.participants || []).slice(0, 16);
      if (value.tags.length < new Set([...(member.tags || []), ...(member.allTags || []), ...(member.characterTags || []), ...(member.copyrightTags || [])]).size) result.filteringComplete = false;
      return value;
    });
    if ((item.groupMembers || []).length > 32) result.filteringComplete = false;
    // Unicode-heavy provider tags must still fit a keepalive request at shutdown.
    const encoder = new TextEncoder(), size = value => encoder.encode(JSON.stringify(value)).length;
    let total = size(result);
    const trim = (field, minimum = 0, incomplete = false) => {
      const values = result[field];
      if (values.length <= minimum || total <= 30000) return;
      if (incomplete && result.filteringComplete) { result.filteringComplete = false; total++; }
      const original = size(values), budget = 30000 - (total - original);
      let low = minimum, high = values.length - 1, keep = minimum;
      // Prefix sizes are monotonic. Measure only this array while searching,
      // rather than serializing the whole grouped artwork for every tag pop.
      while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        if (size(values.slice(0, middle)) <= budget) { keep = middle; low = middle + 1; }
        else high = middle - 1;
      }
      result[field] = values.slice(0, keep);
      total += size(result[field]) - original;
    };
    for (const field of ['allTags', 'tags', 'copyrightTags', 'characterTags']) trim(field, 0, true);
    trim('groupMembers', 0, true);
    trim('imageRecords');
    trim('images', 1);
    return result;
  }
  const escape = text => String(text ?? '').replace(/[&<>"']/g, value => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[value]));
  function create(deps) {
    const { request, getTags = () => [], setTags = () => {}, getRecent = () => [], getKnown = () => [],
      changed = () => {}, toast = () => {}, allowed = () => true, save = () => {}, svg = () => '',
      openSearch = () => {}, openDetail = () => {}, schedule = setTimeout, unschedule = clearTimeout } = deps;
    const pending = new Set(), optimistic = new Map(), observed = new Map(), cache = new Map();
    const ratedEvidence = new Map(), previousSuggestions = new Map(), emptyLikes = [];
    let evidenceInputs = null;
    let saving = Promise.resolve(), queue = [], timer = null, sending = null, inFlight = [], revision = 0, manualRevision = 0, disposed = false;
    let outboxSequence = 0;
    let lastKinds = {};
    let artworks = [], artworkLoaded = false, artworkLoading = null, artworkRevision = 0, artworkSaving = Promise.resolve();
    let membershipItems = null, membership = new Set();
    const pendingArtworks = new Set();
    const t = value => deps.t?.(value) || value;
    function mark() { revision++; cache.clear(); }
    function evidenceContext() {
      const liked = deps.getLiked?.() || emptyLikes, preferences = deps.getTagPreferences?.() || {};
      const preferenceKey = JSON.stringify(preferences), grouping = root.CatalogLogic?.groupingRevision?.(liked) || 0;
      const inputVersion = root.CatalogLogic?.recommendationInputVersion?.(liked) || '';
      const inputs = [liked, liked.length, grouping, inputVersion, preferenceKey];
      if (!evidenceInputs || !inputs.every((value, index) => evidenceInputs[index] === value)) {
        evidenceInputs = inputs; ratedEvidence.clear();
      }
      return { liked, preferences, preferenceKey, grouping, inputVersion, inputs: evidenceInputs };
    }
    function evidenceCurrent(evidence) {
      return !disposed && evidenceContext().inputs === evidence.inputs && ratedEvidence.get(evidence.rating) === evidence;
    }
    function notifyEvidence(evidence) {
      const active = deps.getActiveTab?.();
      if (deps.getActiveTab && (!active || !evidence.tabs.has(active) || active.favoriteType === 'artwork' ||
          (deps.effectiveRating?.(active) || active.rating || 'all') !== evidence.rating)) return;
      // The data load awaits this same evidence and paints its final state.
      // Avoid two full card reconciliations in the completion microtasks.
      if (active?.favoriteLoading) return;
      changed();
    }
    function evidenceFor(rating, tab, retryFailed = false, context = evidenceContext()) {
      let evidence = ratedEvidence.get(rating);
      if (evidence && !(retryFailed && evidence.state === 'failed')) {
        if (tab && evidence.state === 'pending') evidence.tabs.add(tab);
        return evidence;
      }
      const items = rating === 'all' ? context.liked : context.liked.filter(item => ratingMatches(item, rating));
      evidence = { rating, items, inputs: context.inputs, preferenceKey: context.preferenceKey,
        tabs: new Set(), state: 'ready', suggestions: null, promise: null };
      ratedEvidence.set(rating, evidence);
      if (!deps.analyze) {
        evidence.suggestions = systemSuggestions(items, context.preferences);
        return evidence;
      }
      evidence.state = 'pending';
      if (tab) evidence.tabs.add(tab);
      const preferences = { ...context.preferences };
      evidence.promise = Promise.resolve().then(() => deps.analyze(items, preferences, { includeCombinations: false })).then(analysis => {
        if (!evidenceCurrent(evidence)) { evidence.state = 'stale'; return evidence; }
        if (!analysis?.queryGroups) throw new Error('Favorite analysis unavailable');
        evidence.suggestions = systemSuggestions(items, preferences, root.CatalogLogic, analysis.queryGroups);
        evidence.state = 'ready';
        previousSuggestions.set(rating, { preferenceKey: evidence.preferenceKey, suggestions: evidence.suggestions });
        notifyEvidence(evidence);
        return evidence;
      }).catch(() => {
        if (evidenceCurrent(evidence)) { evidence.state = 'failed'; notifyEvidence(evidence); }
        else evidence.state = 'stale';
        return evidence;
      }).finally(() => evidence.tabs.clear());
      return evidence;
    }
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
        if (version === artworkRevision && !pendingArtworks.size) artworks = items;
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
        } finally { pendingArtworks.delete(item.key); artworkRevision++; changed(); }
      });
      artworkSaving = result.catch(() => {}); return result;
    }
    async function load(tab, force = false) {
      if (disposed) return;
      if (tab.favoriteLoading) return;
      if (!force && tab.favoriteRevision === revision && tab.favoriteLoadedAt > Date.now() - 15000) return;
      tab.favoriteLoading = true; tab.favoriteError = ''; changed();
      try {
        while (!disposed) {
          const rating = deps.effectiveRating?.(tab) || tab.rating || 'all', version = revision, choicesVersion = manualRevision;
          const evidence = deps.analyze && tab.favoriteType !== 'artwork' && rating !== 'none'
            ? evidenceFor(rating, tab, force) : null;
          const [summary, tags, worksReady] = await Promise.all([
            request(`/api/favorites?rating=${rating}`, { priority: 'background' }), request('/api/favorite-tags'), loadArtworks(), evidence?.promise
          ]);
          if (disposed) return;
          if (!worksReady) throw new Error('Favorite artworks unavailable');
          if ((deps.effectiveRating?.(tab) || tab.rating || 'all') !== rating) continue;
          if (evidence && tab.favoriteType !== 'artwork') {
            let current = evidenceFor(rating, tab);
            while (current.state === 'pending' || current.state === 'stale') {
              await current.promise;
              if (disposed) return;
              if ((deps.effectiveRating?.(tab) || tab.rating || 'all') !== rating) break;
              current = evidenceFor(rating, tab);
            }
            if ((deps.effectiveRating?.(tab) || tab.rating || 'all') !== rating) continue;
            if (current.state === 'failed') throw new Error('Favorite analysis unavailable');
          }
          tab.favoriteSummary = summary;
          const merged = new Set(tags);
          for (const [tag, favorite] of optimistic) favorite ? merged.add(tag) : merged.delete(tag);
          if (choicesVersion === manualRevision) {
            setTags([...merged]); lastKinds = summary.kinds || {};
          }
          tab.favoriteRevision = version; tab.favoriteLoadedAt = Date.now();
          break;
        }
      } catch { tab.favoriteError = 'Could not load Favorites. Your choices are still saved.'; }
      finally {
        tab.favoriteLoading = false;
        if (!disposed && (!deps.getActiveTab || deps.getActiveTab() === tab)) changed();
        if (!disposed && !tab.favoriteError && tab.favoriteRevision !== revision && deps.getActiveTab?.() === tab) void load(tab, true);
      }
    }
    function toggle(value, kind = null, requested) {
      const tag = normalize(value);
      if (!tag || pending.has(tag)) return Promise.resolve(false);
      const was = getTags().includes(tag), favorite = requested ?? !was;
      pending.add(tag); optimistic.set(tag, favorite);
      manualRevision++;
      setTags(favorite ? [...new Set([...getTags(), tag])] : getTags().filter(value => value !== tag));
      const previousKind = lastKinds[tag];
      if (kind) lastKinds[tag] = kind;
      changed();
      const result = saving.then(async () => {
        try {
          const tags = await request('/api/favorite-tags', { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tag, kind: kind || undefined, favorite }) });
          manualRevision++;
          optimistic.delete(tag);
          const merged = new Set(tags);
          for (const [other, state] of optimistic) state ? merged.add(other) : merged.delete(other);
          setTags([...merged]); mark(); return true;
        } catch {
          manualRevision++;
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
      const viewedAt = new Date().toISOString();
      const existing = queue.findIndex(record => record.item.key === value.key && record.metadataOnly === metadataOnly && record.viewedAt.slice(0, 10) === viewedAt.slice(0, 10));
      if (existing >= 0) queue.splice(existing, 1);
      queue.push({ item: value, metadataOnly, filteringComplete: value.filteringComplete,
        viewedAt, eventId: root.crypto?.randomUUID?.() || `${Date.now()}-${++outboxSequence}-${Math.random()}` });
      if (queue.length > 256) queue.splice(0, queue.length - 256);
      mark();
      deps.outboxChanged?.();
      if (timer === null && !disposed) timer = schedule(() => { timer = null; void flush(); }, 300);
    }
    function outboxSnapshot() { return [...inFlight, ...queue].slice(-256); }
    function restoreOutbox(records) {
      if (!Array.isArray(records)) return;
      const known = new Set(outboxSnapshot().map(record => record.eventId));
      for (const record of records.slice(-256)) {
        const at = Date.parse(record?.viewedAt);
        if (!record?.item?.key || typeof record.eventId !== 'string' || known.has(record.eventId) ||
            !Number.isFinite(at) || at < Date.now() - 30 * 86400000 || at > Date.now() + 60000) continue;
        queue.push(record); known.add(record.eventId);
      }
      if (queue.length && timer === null) timer = schedule(() => { timer = null; void flush(); }, 0);
    }
    async function flush(keepalive = false, budget = 45000) {
      if (timer !== null) { unschedule(timer); timer = null; }
      if (keepalive) {
        // Native normal-close has already persisted this snapshot through
        // flushClientState. Browser teardown also attempts immediate delivery;
        // it must never await a request which may die with the page.
        deps.outboxChanged?.();
        const batch = []; let bytes = 2;
        for (const record of outboxSnapshot()) {
          const size = new TextEncoder().encode(JSON.stringify(record)).length + 1;
          if (batch.length >= 16 || bytes + size > budget) break;
          bytes += size; batch.push(record);
        }
        if (batch.length) try { await request('/api/favorites/activity', { method: 'POST', keepalive: true,
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(batch) }); } catch { /* Durable outbox replays at startup. */ }
        return;
      }
      if (sending) { await sending; return queue.length ? flush() : undefined; }
      if (!queue.length) return;
      const batch = []; let bytes = 2;
      while (queue.length && batch.length < 16) {
        const size = new TextEncoder().encode(JSON.stringify(queue[0])).length + 1;
        if (bytes + size > (keepalive ? 45000 : 150000)) { if (!batch.length) queue.shift(); break; }
        bytes += size; batch.push(queue.shift());
      }
      if (!batch.length) return;
      let failed = false;
      inFlight = batch;
      sending = (async () => {
        try {
          await request('/api/favorites/activity', { method: 'POST', keepalive, priority: 'background',
            headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(batch) }); mark();
        } catch { queue.unshift(...batch); failed = true; }
      })();
      await sending; sending = null; inFlight = []; deps.outboxChanged?.();
      const active = deps.getActiveTab?.();
      if (!failed && active?.kind === 'favorites') void load(active, true);
      if (queue.length && !keepalive && !disposed && timer === null)
        timer = schedule(() => { timer = null; void flush(); }, failed ? 5000 : 0);
    }
    function cards(tab) {
      const summary = { ...(tab.favoriteSummary || {}), kinds: { ...tab.favoriteSummary?.kinds, ...lastKinds } };
      const context = evidenceContext(), { liked, preferences, preferenceKey, grouping, inputVersion } = context;
      const rating = deps.effectiveRating?.(tab) || tab.rating || 'all';
      const tags = getTags(), recent = getRecent(), known = getKnown();
      const evidence = evidenceFor(rating, tab, false, context);
      tab.favoriteEvidenceLoading = evidence.state === 'pending';
      tab.favoriteEvidenceError = evidence.state === 'failed' ? 'Could not load Favorites. Your choices are still saved.' : '';
      const key = [tab, summary.entries, tags, recent, known, liked, liked.length, grouping, inputVersion, preferenceKey,
        evidence, evidence.state,
        tab.favoriteType, tab.favoriteOrigin, rating, revision, deps.getPreferences?.(), deps.visibilityRevision?.()];
      const old = cache.get(tab);
      if (old && key.every((value, i) => old.key[i] === value)) return old.cards;
      const previous = previousSuggestions.get(rating);
      const suggestions = evidence.state === 'ready' ? evidence.suggestions : previous?.preferenceKey === preferenceKey ? previous.suggestions : null;
      // Rendering never starts synchronous library analysis in worker mode.
      // While a refreshed like snapshot is processed, rebuild only the cheap
      // cards from prior evidence and current choices/filters/cover metadata.
      if (!suggestions) return [];
      const values = collections({ summary, tags, recent, known, liked: evidence.items, suggestions, preferences,
        type: tab.favoriteType || 'character', origin: tab.favoriteOrigin || 'mine', rating, allowed });
      cache.set(tab, { key, cards: values }); return values;
    }
    const button = (action, label, attrs = '') => `<button type="button" data-action="favorites-${action}" ${attrs}>${label}</button>`;
    function render(tab) {
      const type = tab.favoriteType || 'character', origin = tab.favoriteOrigin || 'mine';
      const rating = deps.effectiveRating?.(tab) || tab.rating;
      const values = type === 'artwork' || rating === 'none' ? [] : cards(tab);
      const evidenceLoading = type !== 'artwork' && rating !== 'none' && tab.favoriteEvidenceLoading;
      const loading = tab.favoriteLoading || evidenceLoading;
      const error = tab.favoriteError || (type !== 'artwork' ? tab.favoriteEvidenceError : '');
      tab.items = type === 'artwork' ? artworks.filter(item => ratingMatches(item, rating) && allowed(item)) :
        [...new Map(values.filter(card => card.cover).map(card => [card.cover.key, card.cover])).values()];
      const choose = (action, value, label, active) => button(action,t(label),`class="filter-button${action==='rating'&&value==='explicit'?' adult-filter':''}${active ? ' active' : ''}" data-value="${value}" aria-pressed="${active}"`);
      const entity = card => {
        const title = card.tag.replaceAll('_',' ');
        const preview = deps.renderEntityCard?.(card) || '';
        const fallback = `<article class="card"><div class="card-art favorite-empty-preview"><span>${t('No viewed preview yet')}</span></div><button type="button" class="card-title" data-action="query" data-query="${escape(card.tag)}" data-context-tag="${escape(card.tag)}" data-no-i18n>${escape(title)}</button></article>`;
        return `<div class="favorite-entity" data-render-key="favorite:${escape(card.tag)}">${preview || fallback}
          <div class="favorite-entity-stats">${card.likedCount !== null ? `<span>${card.likedCount} ${t('liked artworks')}</span>` : ''}
          <span>${card.count === null ? t('No dated views yet') : `${card.count} ${t('viewed artworks')}`}</span>
          ${card.priority ? '<span class="favorite-priority">Priority</span>' : ''}</div>
          ${card.cover ? `<small class="favorite-preview-origin">${t(card.coverOrigin === 'liked' ? 'From liked artworks' : card.coverOrigin === 'recent' ? 'Earlier browsing history' : type === 'character' ? 'Last matching viewed artwork' : 'Last viewed artwork')}</small>` : ''}</div>`;
      };
      const summary = tab.favoriteSummary;
      return `<section class="content favorites-page"><div class="section-head"><h1>Favorites</h1>
        ${type !== 'artwork' ? button('add',t('Add Favorite'),`class="filter-button" aria-expanded="${!!tab.favoriteAdding}"`) : ''}</div>
        <p class="subtitle">Favorite characters, tags and artworks</p>
        <div class="search-tools favorites-filters"><div class="source-filters control-group favorites-category" aria-label="${t('Favorite category')}">
          ${['character','tag','artwork'].map((value,i)=>choose('type',value,['Characters','Tags','Artworks'][i],type===value)).join('')}</div>
          ${type !== 'artwork' ? `<div class="source-filters control-group favorites-origin" aria-label="${t('Collection')}">${choose('origin','mine','Mine',origin==='mine')}${choose('origin','system','System picks',origin==='system')}</div>` : ''}
          <div class="source-filters control-group favorites-rating" aria-label="${t('Rating')}">${['general','explicit','all'].map((value,i)=>choose('rating',value,['SFW','NSFW','All images'][i],tab.rating===value)).join('')}</div></div>
        ${tab.favoriteAdding && type !== 'artwork' ? `<form class="favorites-add-form"><label for="favorite-new-tag">${t(type==='character'?'Character tag':'Content tag')}</label>
          <div><input id="favorite-new-tag" name="tag" required maxlength="100" autocomplete="off" placeholder="${type==='character'?'fern_(sousou_no_frieren)':'rain'}" value="${escape(tab.favoriteDraft||'')}" data-no-i18n>
          <button type="submit" class="primary-button">${t('Add Favorite')}</button>${button('cancel',t('Cancel'),'class="secondary-button"')}</div>
          <small>Use one tag with underscores, as on the source website.</small></form>` : ''}
        <div class="section-head favorites-description"><p>${t(type==='artwork' ? 'Saved artworks. Right-click an artwork to manage Favorites.' : origin==='mine' ?
          'Saved by you. System picks never change this collection.' : 'Based on your likes and recommendation tag preferences.')}</p>${button('refresh',t('Refresh'),`class="link-button"${loading?' disabled':''}`)}</div>
        ${type !== 'artwork' ? `<p class="favorites-history-note">${summary ? `${summary.totalWorks} ${t('different works · Last 30 days')}` : t('Last 30 days')}. <span>Viewing statistics are collected from this update onward.</span></p>` : ''}
        ${summary?.incomplete && type!=='artwork' ? '<p class="settings-hint">Some activity could not be counted. Figures are partial.</p>' : ''}
        ${error ? `<div class="error" role="alert">${t(error)} ${button('refresh',t('Try again'),'class="inline-retry"')}</div>` : ''}
        ${loading && (!summary || !values.length && type !== 'artwork') ? '<div class="empty" role="status">Loading Favorites…</div>' : ''}
        ${rating==='none' ? deps.emptyRating?.()||'<div class="empty">No NSFW ratings selected. Right-click NSFW to enable Q or NSFW.</div>' : type==='artwork' ? (tab.items.length ? deps.renderArtworks?.(tab.items)||'' : !loading ? artworks.length ? '<div class="empty">No favorite artworks match these filters.</div>' : '<div class="empty">No favorite artworks yet<br>Right-click an artwork or use its more menu to add it.</div>' : '') :
          values.length ? `<div class="grid favorites-entity-grid">${values.map(entity).join('')}</div>` : !loading && !error ?
            `<div class="empty"><h2>${t(origin==='mine'?'Your Favorites start here':'Keep exploring')}</h2><p>${t(origin==='mine'?'Add a character or tag, or save a System pick from its menu.':'Like artworks or prioritize tags in Recommendations to discover your favorites.')}</p></div>` : ''}
      </section>`;
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
    return { load, render, handle, add, toggle, cards, invalidate: mark, loadArtworks, toggleArtwork, isArtworkFavorite, outboxSnapshot, restoreOutbox,
      artworks:()=>artworks, isArtworkPending: item => pendingArtworks.has(item?.key),
      record: item => enqueue(item, false), metadata: item => enqueue(item, true), flush,
      dispose() { disposed = true; if (timer !== null) unschedule(timer); timer = null; } };
  }
  const api = { normalize, collections, slim, create, systemSuggestions };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.DartFavorites = api;
})(globalThis);

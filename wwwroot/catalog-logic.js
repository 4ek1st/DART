(function (root) {
  const supportedSources = Object.freeze(['danbooru', 'gelbooru', 'rule34', 'sankaku']);
  const ordinaryRatings = Object.freeze(['g', 'general', 's', 'sensitive', 'safe', 'sfw']);

  const attributionCache = new WeakMap(), sampleCache = new WeakMap(), contentCache = new WeakMap();
  const identityCache = new WeakMap();
  const attributionFields = ['source', 'creatorTag', 'creatorName', 'artistId', 'artist',
    'participants', 'uploaderId', 'uploaderName', 'originalUrl'];
  const sampleFields = [...attributionFields, 'visualSamples', 'visualHash', 'visualPHash',
    'visualAspectRatio', 'tags', 'characterTags', 'published'];
  const contentFields = [...attributionFields, 'tags', 'allTags', 'followedArtistTag'];
  function derived(cache, item, fields, compute) {
    if (!item || typeof item !== 'object') return compute();
    const values = fields.flatMap(field => Array.isArray(item[field]) ? [item[field], item[field].length] : [item[field]]);
    const cached = cache.get(item);
    if (cached && values.every((value, index) => value === cached.values[index]) &&
        values.length === cached.values.length) return cached.result;
    const result = compute();
    cache.set(item, { values, result });
    return result;
  }

  function navigationSection(tab) {
    return tab?.kind === 'search' ? (tab.rating === 'explicit' ? 'adult' : 'search') : tab?.kind;
  }

  function filterCatalogItems(items) {
    if (!Array.isArray(items)) return [];
    const filtered = items.filter(item => supportedSources.includes(item?.source));
    return filtered.length === items.length ? items : filtered;
  }

  function catalogSort(tab) {
    return tab?.sort === 'popular' || tab?.sort === 'curated' && tab.curationBaseSort === 'popular'
      ? 'popular' : 'recent';
  }

  function cleanClientState(value) {
    const state = value && typeof value === 'object' ? { ...value } : {};
    if (Array.isArray(state.recent)) state.recent = filterCatalogItems(state.recent);
    if (!Array.isArray(state.session?.tabs)) return state;
    const legacyBookmarks = !(state.session.savedWorksVersion >= 1);
    const kinds = ['home', 'search', 'detail', 'profile', 'bookmarks', 'likes',
      'recommendations', 'follows', 'recent', 'settings'];
    const fields = ['kind', 'title', 'query', 'searchQuery', 'selectedSources', 'rating',
      'sort', 'feed', 'item', 'profileRef', 'settingsSection', 'preview', 'pinned', 'scrollTop'];
    const originalActive = Number(state.session.activeIndex) || 0;
    let activeIndex = -1;
    const tabs = [];
    state.session.tabs.forEach((tab, index) => {
      if (!tab || !kinds.includes(tab.kind) ||
          ['home', 'search'].includes(tab.kind) && tab.feed && tab.feed !== 'illustrations' ||
          tab.kind === 'detail' && !supportedSources.includes(tab.item?.source) ||
          tab.kind === 'profile' && tab.profileRef?.source !== 'artist' &&
            !supportedSources.includes(tab.profileRef?.source)) return;
      const sources = Array.isArray(tab.selectedSources)
        ? [...new Set(tab.selectedSources.filter(source => supportedSources.includes(source)))] : [];
      if (tab.selectedSources?.length && !sources.length && ['home', 'search'].includes(tab.kind)) return;
      const clean = Object.fromEntries(fields.filter(field => field in tab).map(field => [field, tab[field]]));
      if (tab.sort === 'curated') clean.sort = catalogSort(tab);
      if (legacyBookmarks && clean.kind === 'bookmarks') {
        clean.kind = 'likes'; clean.title = 'Liked';
      }
      clean.selectedSources = sources.length ? sources : [...supportedSources];
      clean.feed = 'illustrations';
      if (index === originalActive) activeIndex = tabs.length;
      tabs.push(clean);
    });
    state.session = { ...state.session, tabs, savedWorksVersion: 1, activeIndex: activeIndex >= 0 ? activeIndex
      : Math.max(0, Math.min(tabs.length - 1, originalActive)) };
    return state;
  }

  const genericTags = new Set([
    '1girl', '2girls', '1boy', 'solo', 'multiple girls', 'original', 'female',
    'male', 'art', 'illustration', 'anime', 'hentai', 'sfw', 'nsfw', 'r 18',
    'rating general', 'rating explicit', 'highres', 'absurdres', 'commentary', 'alt text', 'commentary request',
    'english text', 'japanese text', 'color', 'full color'
  ]);
  const broadRecommendationTags = new Set([
    'sex', 'breasts', 'nipples', 'nude', 'blush', 'pussy', 'penis', 'hetero',
    'looking at viewer', 'long hair', 'short hair', 'open mouth',
    'red eyes', 'blue eyes', 'navel', 'ass', 'smile', 'uncensored',
    'censored', 'completely nude', 'ai generated', 'english commentary',
    'anus', 'small breasts', 'medium breasts', 'large breasts',
    'very large breasts', 'huge breasts', 'thighs', 'feet', 'tongue',
    'gloves', 'sweat', 'animal ears', 'male only', 'female only',
    'heart', 'solo focus', 'lying', 'simple background', 'stomach',
    'hair ornament', 'bar censor', 'mosaic censoring', 'ahoge',
    'tail', 'very long hair', 'barefoot', 'pointy ears', 'tongue out',
    'teeth', 'on back', 'hair between eyes', 'white background',
    'toes', 'collarbone', 'dark skin',
    // Catalogs use different spellings for equally broad attributes. Keep
    // their raw tags for searching and explicit choices, but not as taste.
    'clothing', 'clothes', 'busty', 'vagina', 'bodily fluids', 'straight',
    'female focus', 'male focus', 'legwear', 'flat chest'
  ]);

  function isBroadRecommendationTag(tag) {
    const normalized = normalizeTag(tag);
    return broadRecommendationTags.has(normalized) ||
      /^(?:(?:very|extremely|absolutely|incredibly|ridiculously|ultra) )*(?:lowres|highres|absurdres|(?:low|high|absurd|huge|original|full) resolution)$/.test(normalized) ||
      /^(?:(?:very|extremely|ultra|large|huge|massive|small|medium|high|low) )*(?:filesize|file size)$/.test(normalized) ||
      /^(?:black|brown|blonde|red|blue|green|grey|gray|white|pink|purple|silver|orange|yellow|golden|multicolored) (?:hair|eyes)$/.test(normalized);
  }

  function normalizeSearch(input) {
    const tokens = String(input || '').normalize('NFKC').toLowerCase()
      .replace(/[#，,、;]+/g, ' ').trim().split(/\s+/).filter(Boolean);
    return [...new Set(tokens)].join(' ');
  }

  function favoriteTagFromQuery(query) {
    const tag = normalizeSearch(query);
    return tag && tag.length <= 100 && !/\s/.test(tag) && !tag.startsWith('-')
      ? tag : '';
  }

  function advanceSearchSources(currentPages, currentPaused, requested, response) {
    const pages = { ...currentPages };
    const paused = { ...currentPaused };
    const more = new Set(response.hasMoreSources || []);
    for (const source of requested) {
      if (Object.hasOwn(response.errors || {}, source)) {
        paused[source] = true;
        continue;
      }
      delete paused[source];
      if (more.has(source)) pages[source] += 1;
      else delete pages[source];
    }
    return { pages, paused };
  }

  function completeTag(input, tag) {
    const tokens = normalizeSearch(input).split(' ').filter(Boolean);
    if (tokens.length) tokens.pop();
    return normalizeSearch([...tokens, tag].join(' '));
  }

  function rememberSearchPageStats(current, response, requestedPages, errors) {
    const pages = { ...current };
    for (const [source, page] of Object.entries(requestedPages || {})) {
      if (!errors?.[source] && response?.[source])
        pages[`${source}:${page}`] = { ...response[source], source };
    }
    return pages;
  }

  function searchResultCounts(items, preferences = {}, knownTokens = new Set()) {
    const grouped = groupWorks(items || []);
    const filtered = filterWorks(grouped, preferences);
    const shown = preferences.hideViewedAndSaved ? hideViewedWorks(filtered, knownTokens) : filtered;
    return { records: items?.length || 0, works: grouped.length, shown: shown.length,
      grouped: (items?.length || 0) - grouped.length,
      hiddenContent: grouped.length - filtered.length, hiddenKnown: filtered.length - shown.length };
  }

  function removeNavigationEntry(history, position, id) {
    const removedBefore = history.slice(0, position).filter(entry => entry === id).length;
    const next = history.filter(entry => entry !== id);
    return { history: next,
      position: next.length ? Math.max(0, Math.min(position - removedBefore, next.length - 1)) : -1 };
  }

  function originalPostIdentity(rawUrl) {
    if (!rawUrl) return '';
    let url;
    try { url = new URL(rawUrl); } catch { return ''; }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
    const host = url.hostname.toLowerCase().replace(/^(?:www|mobile)\./, '');
    if (host === 'x.com' || host === 'twitter.com') {
      const match = /^\/(?:[^/]+\/status|i\/web\/status)\/(\d{5,25})(?:\/|$)/i.exec(url.pathname);
      return match ? `original:x-status:${match[1]}` : '';
    }
    if (host === 'pixiv.net') {
      const match = /^\/(?:en\/)?artworks\/(\d{5,12})(?:\/|$)/i.exec(url.pathname);
      return match ? `group:pixiv:${match[1]}` : '';
    }
    if (host === 'i.pximg.net' && /^\/img-(?:original|master)\//i.test(url.pathname)) {
      const match = /\/(\d{5,12})(?:-[a-f0-9]{32})?_p\d+(?:_[^/.]+)?\.(?:jpe?g|png|gif|webp)$/i
        .exec(url.pathname);
      return match ? `group:pixiv:${match[1]}` : '';
    }
    if (host === 'cdn.discordapp.com' || host === 'media.discordapp.net') {
      // Attachment IDs identify the file; expiry, signatures and resize parameters do not.
      const match = /^\/attachments\/(\d{5,25})\/(\d{5,25})\/[^/]+$/.exec(url.pathname);
      return match ? `original:discord-attachment:${match[1]}:${match[2]}` : '';
    }
    if (host === 'i.pximg.net' && /^\/img-(?:zip-ugoira|ugoira)\//i.test(url.pathname)) {
      const match = /\/(\d{5,12})_ugoira\d+x\d+\.(?:zip|webm|mp4)$/i.exec(url.pathname);
      return match ? `group:pixiv:${match[1]}` : '';
    }
    return '';
  }

  function itemIdentities(item) {
    // Snapshot values, including array entries: listings and learned file hashes
    // can update an existing object without replacing its arrays.
    const values = [item.key, item.contentHash, item.groupKey, item.pixivGroupKey, item.originalUrl,
      (item.memberKeys || []).length, ...(item.memberKeys || []),
      (item.identityKeys || []).length, ...(item.identityKeys || []),
      (item.images || []).length, ...(item.images || []),
      (item.imageRecords || []).length, ...(item.imageRecords || []).flatMap(record => [record?.url, record?.hash])];
    const cached = identityCache.get(item);
    if (cached && values.length === cached.values.length &&
        values.every((value, index) => value === cached.values[index])) return cached.result;
    const result = buildItemIdentities(item);
    identityCache.set(item, { values, result });
    return result;
  }
  function buildItemIdentities(item) {
    const hash = /^[a-f0-9]{32}$/i.test(item.contentHash || '')
      ? `hash:${item.contentHash.toLowerCase()}` : '';
    const members = [item.key, ...(item.memberKeys || [])].filter(key =>
      typeof key === 'string' && /^(danbooru|gelbooru|rule34|sankaku):[a-z0-9]+$/i.test(key));
    return [...new Set([...(item.identityKeys || []),
      ...members.map(key => `key:${key}`),
      // A child can point at a parent whose response omits has_children. Include
      // every member's own parent identity, including members of saved groups.
      ...members.map(key => `group:${key.replace(':', ':parent:')}`),
      item.groupKey && `group:${item.groupKey}`,
      item.pixivGroupKey && `group:${item.pixivGroupKey}`,
      originalPostIdentity(item.originalUrl), hash,
      ...itemImageRecords(item).map(record => mediaUrlIdentity(record.url)),
      ...itemImageRecords(item).filter(record => /^[a-f0-9]{32}$/i.test(record.hash || ''))
        .map(record => `hash:${record.hash.toLowerCase()}`)].filter(Boolean))];
  }

  function workHistoryTokens(item) {
    const keys = [item?.key, ...(item?.memberKeys || [])]
      .filter(Boolean).map(key => `key:${key}`);
    const identities = itemIdentities(item || {});
    // A related post is not proof that a different confirmed publication was
    // viewed. Existing history still matches its own keys, hashes and source.
    const knownPublication = publicationIdentities(item || {}).size > 0;
    return [...new Set([...keys, ...identities.filter(token => !knownPublication ||
      !/^group:(danbooru|gelbooru|rule34|sankaku):parent:/.test(token))])];
  }

  function sameWork(first, second) {
    if (first === second) return true;
    const keys = new Set([first?.key, ...(first?.memberKeys || [])].filter(Boolean));
    // Grouping already decides which source records belong together. Viewer
    // selection must not reintroduce weak relationships between those groups.
    return [second?.key, ...(second?.memberKeys || [])].some(key => key && keys.has(key));
  }

  function hideViewedWorks(items, viewedTokens) {
    if (!items?.length || !viewedTokens?.size) return items || [];
    return items.filter(item => !workHistoryTokens(item)
      .some(token => viewedTokens.has(token)));
  }

  function itemImageRecords(item) {
    const images = item.images || [];
    const hash = images.length === 1 && /^[a-f0-9]{32}$/i.test(item.contentHash || '')
      ? item.contentHash.toLowerCase() : '';
    const known = new Map((item.imageRecords || []).filter(record => record?.url)
      .map(record => [record.url, record]));
    return images.map(url => {
      const record = known.get(url) || { url };
      const owner = record.owner || (memberKeysOf(item).length === 1 ? item.key : '');
      return { ...record, hash: String(record.hash || mediaFileHash(url) || hash).toLowerCase(),
        ...(owner ? { owner } : {}) };
    });
  }

  function mediaFileHash(value) {
    try {
      const url = new URL(value);
      if (!/^https?:$/.test(url.protocol) ||
          !/(^|\.)(donmai\.us|gelbooru\.com|rule34\.xxx|sankakucomplex\.com)$/i.test(url.hostname)) return '';
      // These catalog CDNs name originals and resized samples after the original MD5.
      // Never infer identity from a shared post, artist, dimensions or a visual group hash.
      const match = /\/(?:sample-|thumbnail_|sample_)?([a-f0-9]{32})\.(?:jpe?g|png|webp|gif|avif|mp4|webm|m4v|ogv)$/i.exec(url.pathname);
      return match?.[1].toLowerCase() || '';
    } catch { return ''; }
  }

  function uniqueImageRecords(records) {
    const result = [], urls = new Map(), hashes = new Map();
    for (const record of records) {
      if (!record?.url) continue;
      const identity = mediaCacheKey(record.url);
      const hash = String(record.hash || mediaFileHash(record.url) || '').toLowerCase();
      const exactHash = /^[a-f0-9]{32}$/.test(hash) ? hash : '';
      const previous = urls.get(identity) || (exactHash && hashes.get(exactHash));
      if (previous) {
        if (!previous.hash && hash) previous.hash = hash;
        urls.set(identity, previous);
        if (exactHash) hashes.set(exactHash, previous);
        continue;
      }
      if (result.length >= 100) continue;
      const next = { ...record, hash };
      result.push(next); urls.set(identity, next);
      if (exactHash) hashes.set(exactHash, next);
    }
    return result;
  }

  function artworkMedia(item) {
    const imageRecords = uniqueImageRecords(itemImageRecords(item));
    return { images: imageRecords.map(record => record.url), imageRecords };
  }

  function previewMedia(item) {
    const images = artworkMedia(item).images;
    return images.find(videoMimeType) || images[0] || item.thumbnail || '';
  }

  function videoMimeType(url) {
    try {
      const path = new URL(url).pathname.toLowerCase();
      if (/\.(mp4|m4v)$/.test(path)) return 'video/mp4';
      if (/\.webm$/.test(path)) return 'video/webm';
      if (/\.ogv$/.test(path)) return 'video/ogg';
    } catch {}
    return '';
  }

  function mediaCacheKey(value) {
    if (typeof value !== 'string' || !value.includes('sankakucomplex.com')) return value;
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' ||
          !/(^|\.)sankakucomplex\.com$/i.test(url.hostname)) return value;
      const signed = [['e', 'm'], ['expires', 'token']].filter(([expiry, signature]) =>
        url.searchParams.has(expiry) && url.searchParams.has(signature));
      if (!signed.length) return value;
      // Sankaku renews both signing pairs for the same CDN file.
      for (const pair of signed) for (const name of pair) url.searchParams.delete(name);
      // The CDN can move /o files from s. to v./data. A known hash filename
      // identifies that same original; preview/sample derivatives stay separate.
      const file = /^\/(?:o|data)\/[a-f0-9]{2}\/[a-f0-9]{2}\/([a-f0-9]{32}\.[a-z0-9]+)$/i.exec(url.pathname);
      if (file) return `https://sankakucomplex.com/media/original/${file[1].toLowerCase()}${url.search}`;
      return url.href;
    } catch { return value; }
  }

  const mediaIdentityCache = new Map();
  const sha256Constants = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ]);
  function sha256Text(value) {
    const input = new TextEncoder().encode(value);
    const bytes = new Uint8Array(Math.ceil((input.length + 9) / 64) * 64);
    bytes.set(input); bytes[input.length] = 0x80;
    const view = new DataView(bytes.buffer);
    view.setUint32(bytes.length - 8, Math.floor(input.length / 0x20000000));
    view.setUint32(bytes.length - 4, input.length * 8);
    const state = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
      0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
    const words = new Uint32Array(64), rotate = (word, bits) => word >>> bits | word << (32 - bits);
    for (let offset = 0; offset < bytes.length; offset += 64) {
      for (let index = 0; index < 16; index++) words[index] = view.getUint32(offset + index * 4);
      for (let index = 16; index < 64; index++) {
        const a = words[index - 15], b = words[index - 2];
        words[index] = words[index - 16] + (rotate(a, 7) ^ rotate(a, 18) ^ a >>> 3) +
          words[index - 7] + (rotate(b, 17) ^ rotate(b, 19) ^ b >>> 10);
      }
      let [a, b, c, d, e, f, g, h] = state;
      for (let index = 0; index < 64; index++) {
        const first = (h + (rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25)) +
          (e & f ^ ~e & g) + sha256Constants[index] + words[index]) >>> 0;
        const second = ((rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22)) +
          (a & b ^ a & c ^ b & c)) >>> 0;
        h = g; g = f; f = e; e = (d + first) >>> 0;
        d = c; c = b; b = a; a = (first + second) >>> 0;
      }
      [a, b, c, d, e, f, g, h].forEach((word, index) => { state[index] += word; });
    }
    return [...state].map(word => word.toString(16).padStart(8, '0')).join('');
  }
  function mediaUrlIdentity(value) {
    try {
      const url = new URL(mediaCacheKey(value));
      if (!/^https?:$/.test(url.protocol)) return '';
      url.hash = '';
      const key = url.href;
      if (!mediaIdentityCache.has(key)) {
        // Keep signed URLs out of history tokens and stay within its 250-character limit.
        mediaIdentityCache.set(key, `group:media:${sha256Text(key)}`);
        while (mediaIdentityCache.size > 2000) mediaIdentityCache.delete(mediaIdentityCache.keys().next().value);
      }
      return mediaIdentityCache.get(key);
    } catch { return ''; }
  }

  function signedMediaExpired(value, now = Date.now()) {
    if (mediaCacheKey(value) === value) return false;
    try {
      const params = new URL(value).searchParams;
      return [['expires', 'token'], ['e', 'm']].some(([expiry, signature]) =>
        params.has(signature) && /^\d+$/.test(params.get(expiry) || '') &&
        Number(params.get(expiry)) * 1000 <= now + 15000);
    } catch { return false; }
  }

  function renewWorkMedia(item, detail) {
    if (detail?.source !== 'sankaku') return item;
    if (![item.thumbnail, ...(item.images || []), ...(item.imageRecords || []).map(record => record.url)]
        .some(url => typeof url === 'string' && url.includes('sankakucomplex.com'))) return item;
    const replacements = new Map([detail.thumbnail, ...(detail.images || [])].filter(Boolean)
      .map(url => [mediaCacheKey(url), url]));
    const renew = url => replacements.get(mediaCacheKey(url)) || url;
    const thumbnail = item.key === detail.key && detail.thumbnail ? detail.thumbnail : renew(item.thumbnail);
    const images = (item.images || []).map(renew);
    const imageRecords = (item.imageRecords || []).map(record => ({ ...record, url: renew(record.url) }));
    const groupMembers = (item.groupMembers || []).map(member => renewWorkMedia(member, detail));
    if (thumbnail === item.thumbnail && images.every((url, index) => url === item.images[index]) &&
        imageRecords.every((record, index) => record.url === item.imageRecords[index].url) &&
        groupMembers.every((member, index) => member === item.groupMembers[index])) return item;
    return { ...item, thumbnail, images, imageRecords, groupMembers };
  }

  const validVisualHash = hash => /^[a-f0-9]{16}$/i.test(hash || '');
  const visualTags = tags => [...new Set((tags || []).map(normalizeFilterTag))].filter(Boolean).sort();
  const knownUploader = value => value && !/^(anonymous|unknown|none|0)$/i.test(value);
  const visualPublication = url => {
    const identity = originalPostIdentity(url);
    return identity.startsWith('original:discord-attachment:') ? '' : identity;
  };

  function visualCreator(item) {
    const tag = normalizeFilterTag(workAttribution(item).creator?.follow?.artistId || '');
    return /^(artist request|unknown artist|anonymous artist|anonymous|unknown)$/.test(tag) ? '' : tag;
  }

  function needsVisualFingerprint(item) {
    return supportedSources.includes(item?.source) && item.thumbnail &&
      !(item.images || []).some(videoMimeType) &&
      (visualCreator(item) && (item.tags || []).length >= 12 ||
       item.source === 'rule34' && knownUploader(item.uploaderId || item.artistId) && (item.tags || []).length >= 12);
  }

  function itemVisualSamples(item) {
    return derived(sampleCache, item, sampleFields, () => buildVisualSamples(item));
  }
  function buildVisualSamples(item) {
    const creator = visualCreator(item);
    const samples = (item.visualSamples || []).filter(sample =>
      validVisualHash(sample?.hash) && sample.owner && Array.isArray(sample.tags)).map(sample => {
        // Upgrade old saved evidence without assigning the preferred source's
        // uploader to images that came from another catalog.
        const confirmed = normalizeFilterTag(sample.creator ||
          /^sankaku:creator:(.+)$/.exec(sample.owner)?.[1] ||
          (sample.hash === item.visualHash ? creator : ''));
        const source = sample.source || item.source;
        const legacyUploader = /^\w+:uploader:(.+)$/.exec(sample.owner)?.[1] ||
          (source === 'rule34' && !sample.owner.includes(':') ? sample.owner : '');
        const uploader = String(sample.uploader || legacyUploader).trim().toLowerCase();
        return { ...sample, hash: sample.hash.toLowerCase(), creator: confirmed, source,
          tags: visualTags(sample.tags), characters: visualTags(sample.characters),
          owner: confirmed ? `creator:${confirmed}` : `${source}:uploader:${uploader}`, uploader };
      }).filter(sample => sample.creator || sample.source === 'rule34' && knownUploader(sample.uploader));
    if (supportedSources.includes(item.source) && validVisualHash(item.visualHash)) {
      const tags = visualTags(item.tags);
      const uploader = String(item.uploaderId || item.artistId || '').trim().toLowerCase();
      if (creator && tags.length >= 12 || item.source === 'rule34' && knownUploader(uploader) && tags.length >= 3) {
        const sample = { hash: item.visualHash.toLowerCase(), creator,
          owner: creator ? `creator:${creator}` : `${item.source}:uploader:${uploader}`,
          source: item.source, tags, characters: visualTags(item.characterTags), uploader,
          published: item.published || '', publication: visualPublication(item.originalUrl),
          perceptualHash: item.visualPHash || '', aspectRatio: item.visualAspectRatio || 0 };
        const existing = samples.findIndex(saved => saved.hash === sample.hash && saved.source === sample.source);
        if (existing >= 0) samples[existing] = { ...samples[existing], ...sample,
          perceptualHash: sample.perceptualHash || samples[existing].perceptualHash,
          aspectRatio: sample.aspectRatio || samples[existing].aspectRatio };
        else samples.push(sample);
      }
    }
    return samples;
  }

  function perceptualImageHash(pixels) {
    if (pixels?.length !== 32 * 32 * 4) return '';
    // Low-frequency DCT complements the existing edge hash. The separable
    // transform needs about 10k operations per cached thumbnail.
    const cosine = perceptualImageHash.cosine ||= Array.from({ length: 8 }, (_, u) =>
      Array.from({ length: 32 }, (_, x) => Math.cos((2 * x + 1) * u * Math.PI / 64)));
    const rows = new Float64Array(32 * 8), coefficients = [];
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const offset = (y * 32 + x) * 4;
      const gray = pixels[offset] * .299 + pixels[offset + 1] * .587 + pixels[offset + 2] * .114;
      for (let u = 0; u < 8; u++) rows[y * 8 + u] += gray * cosine[u][x];
    }
    for (let v = 0; v < 8; v++) for (let u = 0; u < 8; u++) {
      let value = 0;
      for (let y = 0; y < 32; y++) value += rows[y * 8 + u] * cosine[v][y];
      coefficients.push(value);
    }
    const median = coefficients.slice(1).sort((a, b) => a - b)[31];
    let hash = '';
    for (let i = 0; i < 64; i += 4) {
      let nibble = 0;
      for (let bit = 0; bit < 4; bit++) nibble = nibble * 2 + Number(coefficients[i + bit] > median);
      hash += nibble.toString(16);
    }
    return hash;
  }

  function visualDistance(first, second) {
    const countBits = value => {
      value -= (value >>> 1) & 0x55555555;
      value = (value & 0x33333333) + ((value >>> 2) & 0x33333333);
      return (((value + (value >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
    };
    return countBits(parseInt(first.slice(0, 8), 16) ^ parseInt(second.slice(0, 8), 16)) +
      countBits(parseInt(first.slice(8), 16) ^ parseInt(second.slice(8), 16));
  }

  function similarVisualTags(first, second) {
    const firstTags = new Set(first);
    const secondTags = new Set(second);
    let overlap = 0;
    for (const tag of firstTags) if (secondTags.has(tag)) overlap++;
    return overlap >= 3 && overlap / (firstTags.size + secondTags.size - overlap) >= 0.65;
  }

  function compatibleVisualSamples(first, second, distance) {
    if (!similarVisualTags(first.tags, second.tags)) return false;
    const characters = first.characters || [];
    const otherCharacters = second.characters || [];
    if (characters.length && otherCharacters.length &&
        !characters.some(tag => otherCharacters.includes(tag))) return false;
    if (first.publication && second.publication && first.publication !== second.publication &&
        !crossPlatformVisualRepost(first, second, distance)) return false;
    if (first.creator && first.creator === second.creator &&
        validVisualHash(first.perceptualHash) && validVisualHash(second.perceptualHash))
      return dualVisualMatch(first, second, distance);
    if (distance > 8 || first.source !== second.source) return false;
    if (first.source === 'rule34') return true;
    // Near-identical copies can be uploaded again later. Larger changes (text,
    // clothing, translations) need evidence of the same compact upload batch.
    if (distance <= 2) return true;
    const time = Date.parse(first.published || '');
    const otherTime = Date.parse(second.published || '');
    return first.tags.length >= 12 && second.tags.length >= 12 &&
      first.uploader && first.uploader === second.uploader &&
      Number.isFinite(time) && Number.isFinite(otherTime) &&
      Math.abs(time - otherTime) <= 20 * 60 * 1000;
  }

  function dualVisualMatch(first, second, distance, edgeLimit = 12, perceptualLimit = 12) {
    return first.creator && first.creator === second.creator &&
      first.tags.length >= 12 && second.tags.length >= 12 &&
      validVisualHash(first.perceptualHash) && validVisualHash(second.perceptualHash) &&
      first.aspectRatio > 0 && second.aspectRatio > 0 &&
      Math.abs(Math.log(first.aspectRatio / second.aspectRatio)) <= .05 && distance <= edgeLimit &&
      visualDistance(first.perceptualHash, second.perceptualHash) <= perceptualLimit;
  }
  const publicationFamily = token => /^group:pixiv:/.test(token || '') ? 'pixiv' :
    /^original:x-status:/.test(token || '') ? 'x' : '';
  function crossPlatformVisualRepost(first, second, distance) {
    const family = publicationFamily(first.publication), other = publicationFamily(second.publication);
    const confirmed = tags => (tags || []).filter(tag => !['original character', 'character request'].includes(tag));
    const characters = confirmed(first.characters), otherCharacters = confirmed(second.characters);
    // Cross-posted variants need substantially closer evidence than ordinary
    // within-publication matches, including the same confirmed characters.
    return family && other && family !== other &&
      characters.length && characters.length === otherCharacters.length &&
      characters.every(tag => otherCharacters.includes(tag)) &&
      dualVisualMatch(first, second, distance, 2, 6);
  }
  function conflictingPublicationFamilies(first, second) {
    return ['pixiv', 'x'].some(family => {
      const keys = [...first].filter(key => publicationFamily(key) === family);
      return keys.length && [...second].some(key => publicationFamily(key) === family) &&
        !keys.some(key => second.has(key));
    });
  }

  const groupedCache = new WeakMap();
  const groupingRevisions = new WeakMap();
  function groupingRevision(items) { return groupingRevisions.get(items) || 0; }
  const groupingVersion = 2;
  const memberKeysOf = item => [...new Set([item?.key, ...(item?.memberKeys || [])].filter(Boolean))];
  function hasGroupMembers(item) {
    const keys = memberKeysOf(item);
    return item?.groupingVersion === groupingVersion && (keys.length === 1 ||
      Array.isArray(item.groupMembers) && item.groupMembers.length <= 100 &&
      item.groupMembers.length === keys.length &&
      keys.every(key => item.groupMembers.some(member => member?.key === key &&
        (!member.groupMembers?.length) && memberKeysOf(member).length === 1)));
  }
  function needsGroupRepair(item) {
    if (hasGroupMembers(item)) return !!item.groupMembers?.length && groupWorks([item]).length > 1;
    return !hasGroupMembers(item) && memberKeysOf(item).length > 1 && memberKeysOf(item).length <= 100 &&
      (/:parent:/.test(item?.groupKey || '') ||
       (item?.identityKeys || []).filter(key => /^group:pixiv:|^original:x-status:/.test(key)).length > 1);
  }
  function repairLegacyGroup(item, fresh) {
    const keys = memberKeysOf(item), records = new Map((fresh || []).map(member => [member?.key, member]));
    if (!keys.every(key => records.get(key)?.images?.length)) return null;
    const knownUrls = new Set(fresh.flatMap(member => member.images || []).map(mediaCacheKey));
    const knownHashes = new Set(fresh.flatMap(itemImageRecords).map(record => record.hash).filter(Boolean));
    // Incomplete source metadata must not silently discard a saved variant.
    if (itemImageRecords(item).some(record => !knownUrls.has(mediaCacheKey(record.url)) &&
        (!record.hash || !knownHashes.has(record.hash)))) return null;
    return groupWorks(keys.map(key => ({ ...records.get(key), memberKeys: [key], identityKeys: [],
      groupMembers: [], groupingVersion: 0 })));
  }
  function replaceRepairedGroups(items, expected, groups) {
    if (!Array.isArray(items)) return items;
    const keys = memberKeysOf(expected), matches = item => memberKeysOf(item).length === keys.length &&
      keys.every(key => memberKeysOf(item).includes(key));
    if (!items.some(matches)) return items;
    return items.flatMap(item => matches(item) ? groups : [item]);
  }
  function publicationIdentities(item) {
    return new Set([item.pixivGroupKey && `group:${item.pixivGroupKey}`,
      /^pixiv:/.test(item.groupKey || '') && `group:${item.groupKey}`,
      originalPostIdentity(item.originalUrl)].filter(key => /^group:pixiv:|^original:x-status:/.test(key || '')));
  }
  function groupInputs(items) {
    const works = [], positions = new Map();
    for (const item of items || []) {
      if (!item?.key) continue;
      const members = hasGroupMembers(item) && item.groupMembers?.length ? item.groupMembers : [item];
      for (const member of members) {
        const raw = memberKeysOf(member).length === 1 && member.identityKeys?.length
          ? { ...member, identityKeys: [] } : member;
        if (positions.has(raw.key)) {
          const position = positions.get(raw.key);
          // The later source response supplies corrected publication/creator
          // fields; retain missing fields and media learned from the older one.
          const previous = works[position];
          works[position] = { ...works[position], ...raw };
          retainMediaEvidence(previous, raw, works[position]);
          for (const field of ['pixivGroupKey', 'originalUrl'])
            if (!raw[field] && previous[field]) works[position][field] = previous[field];
          if (raw.creatorTag && raw.creatorTag !== previous.creatorTag && !raw.participants?.length)
            works[position].participants = workParticipants(raw);
          if (memberKeysOf(works[position]).length === 1) works[position].identityKeys = [];
        } else { positions.set(raw.key, works.length); works.push(raw); }
      }
    }
    return works;
  }
  function retainMediaEvidence(previous, incoming, merged) {
    const oldUrls = new Set((previous.images || []).map(mediaCacheKey));
    const urls = incoming.images || [];
    const unchanged = !urls.length || oldUrls.size === urls.length &&
      urls.every(url => oldUrls.has(mediaCacheKey(url)));
    if (!unchanged || incoming.contentHash && previous.contentHash &&
        incoming.contentHash.toLowerCase() !== previous.contentHash.toLowerCase()) return;
    if (!incoming.contentHash && previous.contentHash) merged.contentHash = previous.contentHash;
    if (!urls.length && previous.images?.length) merged.images = previous.images;
    // An omitted listing field cannot erase a previously verified hash for that file.
    merged.imageRecords = uniqueImageRecords([...itemImageRecords(incoming), ...itemImageRecords(previous)]);
  }
  function replacesMedia(previous, incoming) {
    if (!incoming.images?.length || !previous.images?.length) return false;
    const oldHash = String(previous.contentHash || '').toLowerCase();
    const newHash = String(incoming.contentHash || '').toLowerCase();
    if (/^[a-f0-9]{32}$/.test(oldHash) && /^[a-f0-9]{32}$/.test(newHash)) return oldHash !== newHash;
    const oldUrls = new Set(previous.images.map(url => mediaUrlIdentity(url) || mediaCacheKey(url)));
    return !incoming.images.some(url => oldUrls.has(mediaUrlIdentity(url) || mediaCacheKey(url)));
  }
  function invalidateGrouping(items) {
    if (!Array.isArray(items)) return;
    groupingRevisions.set(items, groupingRevision(items) + 1);
    groupedCache.delete(items);
    for (const item of items) if (item && typeof item === 'object') {
      groupingEvidenceCache.delete(item);
      identityCache.delete(item);
      attributionCache.delete(item); sampleCache.delete(item); contentCache.delete(item);
    }
  }
  function groupWorks(items) {
    if (Array.isArray(items) && groupedCache.has(items)) return groupedCache.get(items);
    const works = groupInputs(items);
    const roots = works.map((_, index) => index);
    const publications = works.map(publicationIdentities);
    const find = index => {
      while (roots[index] !== index) {
        roots[index] = roots[roots[index]];
        index = roots[index];
      }
      return index;
    };
    const join = (first, second, weak = false, visualRepost = false) => {
      const a = find(first), b = find(second);
      if (a === b) return;
      if (weak && publications[a].size && publications[b].size &&
          ![...publications[a]].some(key => publications[b].has(key)) &&
          (!visualRepost || conflictingPublicationFamilies(publications[a], publications[b]))) return;
      roots[a] = b;
      for (const identity of publications[a]) publications[b].add(identity);
    };
    const linked = new Map(), parents = new Map();
    works.forEach((item, index) => {
      for (const identity of itemIdentities(item)) {
        if (/^group:(danbooru|gelbooru|rule34|sankaku):parent:/.test(identity)) {
          if (!parents.has(identity)) parents.set(identity, []);
          parents.get(identity).push(index); continue;
        }
        if (linked.has(identity)) join(index, linked.get(identity));
        else linked.set(identity, index);
      }
    });
    // Resolve exact files and publications first. A parent can mean a related
    // work; it cannot override conflicting known publications, even via a
    // metadata-poor mirror which would otherwise bridge both components.
    for (const indices of parents.values())
      for (let position = 1; position < indices.length; position++)
        for (const previous of indices.slice(0, position)) join(indices[position], previous, true);
    // Some boorus omit both the parent post and original publication URL. In
    // that case, infer only a compact upload batch by a verified artist tag,
    // uploader, dense tag overlap, close post IDs and publication times.
    const seriesBuckets = new Map();
    const candidates = works.map((item, index) => {
      const id = Number(item.id);
      const time = Date.parse(item.published || '');
      const creator = visualCreator(item);
      const uploader = String(item.uploaderId || '').trim().toLowerCase();
      const tags = new Set((item.tags || []).map(tag => String(tag).toLowerCase()));
      const memberIds = (item.memberKeys || [item.key]).map(key => {
        const prefix = `${item.source}:`;
        return key.startsWith(prefix) && /^\d+$/.test(key.slice(prefix.length))
          ? Number(key.slice(prefix.length)) : NaN;
      });
      const rating = ['e', 'explicit', 'q', 'questionable'].includes(item.rating)
        ? 'adult' : ordinaryRatings.includes(item.rating) ? 'general' : '';
      if (!supportedSources.includes(item.source) ||
          !Number.isSafeInteger(id) || id < 1 || !Number.isFinite(time) ||
          !creator || !knownUploader(uploader) || !rating || tags.size < 12 ||
          item.groupKey || item.pixivGroupKey || originalPostIdentity(item.originalUrl) ||
          memberIds.some(value => !Number.isSafeInteger(value) || value < 1)) return null;
      return { index, id: Math.max(id, ...memberIds), minId: Math.min(id, ...memberIds), time, tags,
        bucket: JSON.stringify([item.source, creator, uploader, rating, visualTags(item.characterTags)]) };
    }).filter(Boolean).sort((first, second) => second.id - first.id);
    const sameSeries = (anchor, candidate) => {
      if (Math.max(anchor.id, candidate.id) - Math.min(anchor.minId, candidate.minId) > 12 ||
          Math.abs(anchor.time - candidate.time) > 10 * 60 * 1000) return false;
      let common = 0;
      for (const tag of candidate.tags) if (anchor.tags.has(tag)) common++;
      return common >= 12 && common /
        (anchor.tags.size + candidate.tags.size - common) >= 0.78;
    };
    for (const candidate of candidates) {
      if (!seriesBuckets.has(candidate.bucket)) seriesBuckets.set(candidate.bucket, []);
      const anchors = seriesBuckets.get(candidate.bucket);
      const match = anchors.find(anchor => sameSeries(anchor, candidate));
      if (match) {
        join(candidate.index, match.index, true);
        match.minId = Math.min(match.minId, candidate.minId);
      }
      else anchors.push(candidate);
    }
    const samples = works.map(itemVisualSamples);
    // Opaque IDs cannot use the numeric upload-batch fallback. A short scene
    // batch needs exact, confirmed characters and creator, a named uploader,
    // dense tag overlap and a total span of at most 45 seconds. Keep each frame.
    const sceneBuckets = new Map();
    samples.forEach((entries, index) => {
      for (const sample of entries) {
        const time = Date.parse(sample.published || '');
        const characters = sample.characters.filter(tag => !['original character', 'character request'].includes(tag));
        if (!sample.creator || !knownUploader(sample.uploader) || !Number.isFinite(time) ||
            !/T\d{2}:\d{2}:\d{2}/.test(sample.published || '') ||
            sample.publication || !characters.length || sample.tags.length < 35 ||
            works[index].groupKey || works[index].pixivGroupKey || (works[index].images || []).some(videoMimeType)) continue;
        const bucket = JSON.stringify([sample.source, sample.creator, sample.uploader, characters]);
        if (!sceneBuckets.has(bucket)) sceneBuckets.set(bucket, []);
        sceneBuckets.get(bucket).push({ sample, index, time, characters });
      }
    });
    for (const entries of sceneBuckets.values()) {
      const ranges = new Map(), anchors = [];
      for (const entry of entries) {
        const root = find(entry.index), range = ranges.get(root) || [entry.time, entry.time];
        ranges.set(root, [Math.min(range[0], entry.time), Math.max(range[1], entry.time)]);
      }
      for (const entry of entries.sort((a, b) => a.time - b.time)) {
        const match = anchors.find(anchor => {
          const first = ranges.get(find(anchor.index)), second = ranges.get(find(entry.index));
          if (Math.max(first[1], second[1]) - Math.min(first[0], second[0]) > 45000) return false;
          const tags = new Set(anchor.sample.tags);
          const common = entry.sample.tags.filter(tag => tags.has(tag)).length;
          const multiple = entry.characters.length > 1;
          return common >= (multiple ? 35 : 40) && common /
            (tags.size + entry.sample.tags.length - common) >= (multiple ? .58 : .9);
        });
        if (match) {
          const root = find(match.index), other = find(entry.index);
          const a = ranges.get(root), b = ranges.get(other);
          roots[other] = root;
          ranges.set(root, [Math.min(a[0], b[0]), Math.max(a[1], b[1])]);
        } else anchors.push(entry);
      }
    }
    const visualTrees = new Map();
    const findVisualMatches = (node, sample, index) => {
      if (!node) return;
      const distance = visualDistance(sample.hash, node.hash);
      if (distance <= 12)
        for (const previous of node.entries)
          if (compatibleVisualSamples(sample, previous.sample, distance))
            join(index, previous.index, true, crossPlatformVisualRepost(sample, previous.sample, distance));
      for (const [edge, child] of node.children)
        if (edge >= distance - 12 && edge <= distance + 12)
          findVisualMatches(child, sample, index);
    };
    const addVisualSample = (root, sample, index) => {
      let node = root;
      while (node) {
        const distance = visualDistance(sample.hash, node.hash);
        if (distance === 0) {
          if (!node.entries.some(entry => entry.index === index &&
              entry.sample.tags.join(' ') === sample.tags.join(' ')))
            node.entries.push({ sample, index });
          return;
        }
        if (!node.children.has(distance)) {
          node.children.set(distance, { hash: sample.hash,
            entries: [{ sample, index }], children: new Map() });
          return;
        }
        node = node.children.get(distance);
      }
    };
    works.forEach((item, index) => {
      for (const sample of samples[index]) {
        const tree = visualTrees.get(sample.owner);
        if (tree) {
          findVisualMatches(tree, sample, index);
          addVisualSample(tree, sample, index);
        } else visualTrees.set(sample.owner, { hash: sample.hash,
          entries: [{ sample, index }], children: new Map() });
      }
    });
    const components = new Map();
    works.forEach((item, index) => {
      const root = find(index);
      if (!components.has(root)) components.set(root, []);
      components.get(root).push(item);
    });
    const result = [...components.values()].map(members => {
      const preferred = members.find(item => item.source === 'danbooru') || members[0];
      const records = [];
      const keys = new Set();
      const identities = new Set();
      const allTags = new Set();
      const visualSamples = [];
      const seenVisualSamples = new Set();
      for (const item of [preferred, ...members.filter(entry => entry !== preferred)]) {
        for (const tag of [...(item.tags || []), ...(item.allTags || [])])
          if (tag) allTags.add(tag);
        for (const key of [item.key, ...(item.memberKeys || [])])
          if (key) keys.add(key);
        for (const identity of itemIdentities(item)) identities.add(identity);
        for (const sample of itemVisualSamples(item)) {
          const signature = JSON.stringify(sample);
          if (!seenVisualSamples.has(signature) && visualSamples.length < 100) {
            visualSamples.push(sample);
            seenVisualSamples.add(signature);
          }
        }
        records.push(...itemImageRecords(item));
      }
      const imageRecords = uniqueImageRecords(records);
      const images = imageRecords.map(record => record.url);
      const count = Math.max(1, imageRecords.length);
      const explicit = members.some(item => ['e', 'explicit'].includes(item.rating));
      const questionable = members.some(item => ['q', 'questionable'].includes(item.rating));
      const participants = mergeParticipants([preferred, ...members.filter(item => item !== preferred)]);
      const creator = workAttribution({ ...preferred, participants }).creator;
      const original = members.find(item => item.originalUrl)?.originalUrl || '';
      const characterTags = [...new Set(members.flatMap(item => item.characterTags || []))];
      const copyrightTags = [...new Set(members.flatMap(item => item.copyrightTags || []))];
      const complete = members.every(item => memberKeysOf(item).length === 1);
      return { ...preferred, images, imageRecords, allTags: [...allTags], groupCount: count,
        characterTags, copyrightTags, title: titleFromCharacters(preferred.title, characterTags),
        participants, creatorTag: creator?.follow.artistId || '',
        creatorName: creator?.name || (participants.length ? '' : preferred.creatorName || ''),
        originalUrl: preferred.originalUrl || original,
        memberKeys: [...keys], identityKeys: [...identities], visualSamples,
        groupingVersion: complete ? groupingVersion : 0,
        groupMembers: complete && members.length > 1 ? members.map(item => ({ ...item,
          memberKeys: [item.key], identityKeys: [], groupMembers: [], groupingVersion: 0 })) : [],
        rating: explicit ? 'e' : questionable ? 'q' : preferred.rating };
    });
    if (Array.isArray(items)) groupedCache.set(items, result);
    return result;
  }

  const groupingEvidenceCache = new WeakMap();
  function groupingEvidence(item) {
    if (groupingEvidenceCache.has(item)) return groupingEvidenceCache.get(item);
    // Every inferred series/visual match shares a creator or sample owner;
    // exact copies and explicit relationships share an identity token.
    const creator = visualCreator(item);
    const evidence = [...new Set([...memberKeysOf(item).map(key => `key:${key}`), ...itemIdentities(item),
      ...(creator ? [`bucket:creator:${creator}`] : []),
      ...itemVisualSamples(item).map(sample => `bucket:${sample.owner}`)])];
    groupingEvidenceCache.set(item, evidence);
    return evidence;
  }

  function mergeGroupedWorks(previous, incoming) {
    incoming = (incoming || []).filter(item => item?.key);
    if (!incoming?.length) return previous || [];
    if (!previous?.length) return groupWorks(incoming);
    const known = new Set(previous);
    if (incoming.every(item => known.has(item))) return previous;
    const buckets = new Map();
    previous.forEach((item, index) => {
      for (const evidence of groupingEvidence(item)) {
        if (!buckets.has(evidence)) buckets.set(evidence, []);
        buckets.get(evidence).push(index);
      }
    });
    const affected = new Set(), visited = new Set(), pending = [...incoming];
    for (let position = 0; position < pending.length; position++) {
      for (const evidence of groupingEvidence(pending[position])) {
        if (visited.has(evidence)) continue;
        visited.add(evidence);
        for (const index of buckets.get(evidence) || []) {
          if (affected.has(index)) continue;
          affected.add(index); pending.push(previous[index]);
        }
      }
    }
    // Keep unrelated works intact. Regroup the complete connected component
    // with the same rules as a full catalog pass, then retain feed order.
    const changed = groupWorks([...previous.filter((_, index) => affected.has(index)), ...incoming]);
    return stableFeedItems(previous,
      [...previous.filter((_, index) => !affected.has(index)), ...changed]);
  }

  function refineGrouping(items, enriched) {
    const previous = groupedCache.get(items);
    for (const item of enriched) {
      const member = item.groupMembers?.find(member => member.key === item.key);
      if (member) for (const field of ['visualHash', 'visualPHash', 'visualAspectRatio'])
        if (item[field]) member[field] = item[field];
    }
    invalidateGrouping(enriched);
    if (previous) {
      groupingRevisions.set(items, groupingRevision(items) + 1);
      groupedCache.set(items, mergeGroupedWorks(previous, enriched));
    }
    else invalidateGrouping(items);
  }

  function titleFromCharacters(title, characters) {
    const names = characters.filter(tag => normalizeFilterTag(tag) !== 'original character');
    const generatedTitle = characters.map(tag => tag.replaceAll('_', ' ')).join(', ');
    return names.length && (/^Работа #\d+$/.test(title || '') ||
      names.length !== characters.length && title === generatedTitle)
      ? names.map(tag => tag.replaceAll('_', ' ')).join(', ') : title;
  }

  function mergeWorkMetadata(previous, incoming) {
    if (previous === incoming) return incoming;
    if (!previous || previous.key !== incoming?.key || previous.source !== incoming.source)
      return incoming;
    if (hasGroupMembers(previous) && !hasGroupMembers(incoming) && memberKeysOf(incoming).length > 1)
      return previous; // A late legacy cache response cannot restore a repaired union.
    const merged = { ...previous, ...incoming };
    retainMediaEvidence(previous, incoming, merged);
    const replacedMedia = memberKeysOf(previous).length === 1 && replacesMedia(previous, incoming);
    merged.memberKeys = [...new Set([previous.key, ...(previous.memberKeys || []),
      ...(incoming.memberKeys || [])].filter(Boolean))];
    if (hasGroupMembers(previous) && !replacedMedia) {
      const leaves = new Map((previous.groupMembers?.length ? previous.groupMembers :
        [{ ...previous, groupingVersion: 0, groupMembers: [], memberKeys: [previous.key] }]).map(member => [member.key, member]));
      for (const member of (hasGroupMembers(incoming) && incoming.groupMembers?.length ? incoming.groupMembers : [incoming])) {
        const raw = { ...member, groupingVersion: 0, groupMembers: [], memberKeys: [member.key], identityKeys: [] };
        leaves.set(raw.key, mergeWorkMetadata(leaves.get(raw.key), raw));
      }
      merged.groupingVersion = groupingVersion;
      merged.groupMembers = leaves.size > 1 ? [...leaves.values()] : [];
      merged.images = [...new Set([...(previous.images || []), ...(incoming.images || [])])];
      merged.imageRecords = [...itemImageRecords(previous), ...itemImageRecords(incoming)];
    }
    if (replacedMedia) {
      merged.contentHash = incoming.contentHash || '';
      merged.images = incoming.images;
      merged.imageRecords = itemImageRecords(incoming);
      merged.identityKeys = [];
      merged.groupMembers = [];
    }
    merged.visualHash = incoming.visualHash || (!replacedMedia && previous.visualHash) || '';
    if (!(incoming.width > 0 && incoming.height > 0)) {
      merged.width = previous.width;
      merged.height = previous.height;
    }
    merged.visualPHash = incoming.visualPHash || (!replacedMedia && previous.visualPHash) || '';
    merged.visualAspectRatio = incoming.visualAspectRatio || (!replacedMedia && previous.visualAspectRatio) || 0;
    merged.visualSamples = [...new Map([...(replacedMedia ? [] : itemVisualSamples(previous)), ...itemVisualSamples(incoming)]
      .map(sample => [JSON.stringify(sample), sample])).values()].slice(0, 100);
    if (merged.memberKeys.length > 1) merged.allTags = [...new Set([
      ...(previous.allTags || previous.tags || []), ...(incoming.allTags || []), ...(incoming.tags || [])])];
    if (incoming.source === 'sankaku') Object.assign(merged,
      refreshSankakuMedia(previous, incoming, incoming.images || []));
    Object.assign(merged, artworkMedia(merged));
    // Post listings contain flat tags and may omit categories learned from a detail response.
    const characters = [...new Set(incoming.characterTags?.length
      ? incoming.characterTags : previous.characterTags || [])];
    merged.characterTags = characters.filter(tag => normalizeFilterTag(tag) !== 'original character');
    merged.copyrightTags = [...new Set(incoming.copyrightTags?.length
      ? incoming.copyrightTags : previous.copyrightTags || [])];
    merged.title = titleFromCharacters(merged.title, characters);
    // Search and grouped mirrors may omit an artist already confirmed by a detail response.
    // Preserve the identifier/name pair; a new confirmed artist replaces both together.
    const participants = incoming.participants?.length
      ? (previous.memberKeys?.length > 1 ? mergeParticipants([incoming, previous]) : workParticipants(incoming))
      : previous.participants?.length ? workParticipants(previous) : mergeParticipants([incoming]);
    if (participants.length) merged.participants = participants;
    const creator = participants.length ? workAttribution({ ...merged, participants }).creator
      : workAttribution(incoming).creator || workAttribution(previous).creator;
    if (creator) {
      merged.creatorTag = creator.follow.artistId;
      merged.creatorName = creator.name;
    } else if (participants.length) {
      merged.creatorTag = ''; merged.creatorName = '';
    }
    return merged;
  }

  function mergeDetailPages(grouped, detail) {
    const knownKeys = [grouped?.key, ...(grouped?.memberKeys || [])].filter(Boolean);
    if (!detail || !knownKeys.includes(detail.key)) return detail;
    const memberKeys = [...new Set([...knownKeys, ...(detail.memberKeys || [])])];
    const images = [...new Set([...(grouped.images || []), ...(detail.images || [])])].slice(0, 100);
    const characterTags = [...new Set([...(grouped.characterTags || []),
      ...(detail.characterTags || [])])];
    const copyrightTags = [...new Set([...(grouped.copyrightTags || []),
      ...(detail.copyrightTags || [])])];
    const participants = memberKeys.length > 1 ? mergeParticipants([detail, grouped])
      : detail.participants?.length ? workParticipants(detail) : mergeParticipants([detail, grouped]);
    const creator = workAttribution({ ...detail, participants }).creator;
    const media = detail.source === 'sankaku' ? refreshSankakuMedia(grouped, detail, images)
      : artworkMedia({ images, imageRecords: [...itemImageRecords(grouped), ...itemImageRecords(detail)] });
    const groupMembers = hasGroupMembers(grouped) && grouped.groupMembers?.length
      ? grouped.groupMembers.map(member => member.key === detail.key ? mergeWorkMetadata(member, detail) : member) : [];
    return { ...detail, ...media, groupCount: Math.max(1, media.images.length),
      groupingVersion: grouped.groupingVersion || 0, groupMembers,
      characterTags, copyrightTags, title: titleFromCharacters(detail.title, characterTags),
      participants, creatorTag: creator?.follow.artistId || '',
      creatorName: creator?.name || (participants.length ? '' : detail.creatorName || grouped.creatorName || ''),
      originalUrl: detail.originalUrl || grouped.originalUrl || '',
      memberKeys: [...memberKeys], identityKeys: grouped.identityKeys || [],
      visualSamples: grouped.visualSamples || [],
      allTags: [...new Set([...(grouped.allTags || grouped.tags || []),
        ...(detail.allTags || detail.tags || [])])] };
  }

  function refreshSankakuMedia(previous, incoming, images) {
    const identity = value => {
      try {
        const url = new URL(value);
        return url.protocol === 'https:' && /(^|\.)sankakucomplex\.com$/i.test(url.hostname)
          ? url.origin + url.pathname : value;
      } catch { return value; }
    };
    const fresh = new Map((incoming.images || []).map(url => [identity(url), url]));
    const updated = url => fresh.get(identity(url)) || url;
    const nextImages = [...new Set(images.map(updated))].slice(0, 100);
    const records = [...itemImageRecords(previous), ...itemImageRecords(incoming)].map(record =>
      ({ ...record, url: updated(record.url) })).filter(record => nextImages.includes(record.url));
    const imageRecords = uniqueImageRecords(records);
    return { images: imageRecords.map(record => record.url), imageRecords };
  }

  function normalizeFilterTag(tag) {
    return String(tag || '').normalize('NFKC').toLowerCase().trim()
      .replace(/^#+/, '').replace(/[_\-\s]+/g, ' ').trim();
  }

  function normalizeExcludedTags(tags) {
    return [...new Set((Array.isArray(tags) ? tags : []).map(normalizeFilterTag)
      .filter(tag => tag && tag.length <= 100))].slice(0, 100);
  }

  function hiddenAuthorKey(author) {
    const source = author?.source;
    const id = String(author?.artistId || '').normalize('NFKC').toLowerCase().trim().replace(/\s+/g, '_');
    return (source === 'artist' || supportedSources.includes(source)) && id && id.length <= 100
      ? `${source}:${id}` : '';
  }

  function isAuthorHidden(item, preferences = {}) {
    const hidden = preferences.hiddenAuthorSet || new Set((preferences.hiddenAuthors || []).map(hiddenAuthorKey).filter(Boolean));
    if (!hidden.size) return false;
    const authors = contentEvidence(item).authors;
    for (const key of hidden) if (authors.has(key)) return true;
    // Mirrors keep their own uploader identity. Read nested provenance directly
    // so a corrected member cannot leave a previously cached group visible.
    for (const member of item?.groupMembers || [])
      if (hidden.has(uploaderAuthorKey(member))) return true;
    return false;
  }
  function uploaderAuthorKey(item) {
    return hiddenAuthorKey({ source: item?.source,
      artistId: item?.uploaderId || (item?.source !== 'danbooru' ? item?.artistId : '') });
  }

  function contentEvidence(item) {
    return derived(contentCache, item, contentFields, () => {
      const tags = [...new Set([...(item?.tags || []), ...(item?.allTags || [])]
        .map(normalizeFilterTag).filter(Boolean))];
      const artists = [...workParticipants(item).map(person => person.tag), item?.followedArtistTag,
        ...(item?.tags || []), ...(item?.allTags || [])];
      return { tags, authors: new Set([...artists.map(artistId =>
        hiddenAuthorKey({ source: 'artist', artistId })),
        uploaderAuthorKey(item)].filter(Boolean)) };
    });
  }

  function artworkTagKind(item, tag) {
    const normalized = normalizeFilterTag(tag);
    if (normalized !== 'original character' && (item?.characterTags || []).some(character =>
      normalizeFilterTag(character) === normalized)) return 'character';
    if ((item?.copyrightTags || []).some(copyright =>
      normalizeFilterTag(copyright) === normalized)) return 'copyright';
    if (normalized === 'original') return 'original';
    return '';
  }

  function artworkTags(item, query = '') {
    const seen = new Set();
    const tags = [];
    for (const tag of [...(item?.tags || []), ...(item?.allTags || []),
      ...(item?.characterTags || []), ...(item?.copyrightTags || [])]) {
      const exact = String(tag || '').normalize('NFKC').toLowerCase().trim();
      if (!exact || seen.has(exact)) continue;
      seen.add(exact);
      tags.push(tag);
    }
    const requested = normalizeSearch(query).split(' ')
      .map(normalizeFilterTag).filter(Boolean);
    const rank = tag => {
      const kind = artworkTagKind(item, tag);
      if (kind === 'character') return -3;
      if (kind === 'copyright') return -2;
      if (kind === 'original') return -1;
      const index = requested.indexOf(normalizeFilterTag(tag));
      return index < 0 ? requested.length : index;
    };
    return tags.sort((a, b) => rank(a) - rank(b));
  }

  const generatedTags = new Set([
    'ai generated', 'ai created', 'ai art', 'ai artwork', 'ai image', 'ai illustration',
    'stable diffusion', 'nai diffusion', 'novelai', 'midjourney',
    'dall e', 'dall e 2', 'dall e 3', 'comfyui', 'automatic1111',
    'thisanimedoesnotexist', 'generated with ai', 'made with ai'
  ]);
  const assistedTags = new Set(['ai assisted', 'ai aided', 'ai enhanced']);
  const generatedPrefixes = [...generatedTags].map(tag => tag + ' ');
  const assistedPrefixes = [...assistedTags].map(tag => tag + ' ');
  const matchesMarker = (tag, markers) =>
    markers.has(tag) || (markers === generatedTags ? generatedPrefixes : assistedPrefixes)
      .some(prefix => tag.startsWith(prefix));

  // Explicit content tags only. Animal ears, tails, fur clothing and artist names
  // do not establish furry content. Keep aliases and known implication tags exact.
  const furryTags = new Set([
    'furry', 'anthro', 'anthropomorphic', 'furrification', 'furry character',
    'furry female', 'furry male', 'furry boy', 'furry girl', 'furry futa',
    'furry intersex', 'furry only', 'furry female only', 'furry male only',
    'furry with furry', 'furry with non furry', 'furry with nonfurry', 'furry and animal',
    'furry (japanese)', 'furry on furry', 'human on furry', 'male on furry',
    'human male on female furry', 'anthropomorphic animal', 'anthropomorphic furry',
    // Sankaku also returns these explicit anthro tags without the parent marker.
    'anthro on anthro', 'muscular anthro', 'anthro penetrating anthro',
    'human on anthro', 'young anthro', 'overweight anthro', 'mature anthro',
    'female anthro', 'male anthro', 'male on anthro', 'human penetrating anthro',
    'larger anthro', 'nude anthro', 'semi anthro', 'athletic anthro', 'smaller anthro',
    'male penetrating anthro', 'female on anthro', 'obese anthro', 'clothed anthro',
    'humanoid on anthro', 'submissive anthro', 'dominant anthro',
    'feral penetrating anthro', 'pregnant anthro', 'bottomless anthro',
    'slightly chubby anthro', 'human to anthro', 'topless anthro', 'younger anthro'
  ]);

  function excludedContentTags(tags) {
    const blocked = new Set(normalizeExcludedTags(tags));
    // These sites name the same content category differently. Expand only
    // explicit markers, never substrings of artist names or animal-ear tags.
    if (['furry', 'anthro', 'anthropomorphic'].some(tag => blocked.has(tag)))
      for (const tag of furryTags) blocked.add(tag);
    return blocked;
  }

  function isWorkHidden(item, preferences = {}) {
    if (isAuthorHidden(item, preferences)) return true;
    const aiMode = preferences.aiMode || 'all';
    const blocked = preferences.excludedTagSet || excludedContentTags(preferences.excludedTags);
    const hideFurry = preferences.hideFurry === true;
    if (aiMode === 'all' && !blocked.size && !hideFurry) return false;
    const tags = contentEvidence(item).tags;
    return tags.some(tag => blocked.has(tag) || hideFurry && furryTags.has(tag) ||
      aiMode !== 'all' && matchesMarker(tag, generatedTags) ||
      aiMode === 'generated-and-assisted' && matchesMarker(tag, assistedTags));
  }

  function filterWorks(items, preferences) {
    if (!items?.length) return items || [];
    if ((!preferences?.aiMode || preferences.aiMode === 'all') &&
        preferences?.hideFurry !== true && !preferences?.excludedTags?.length &&
        !preferences?.hiddenAuthors?.length) return items;
    const compiled = { ...preferences,
      excludedTagSet: excludedContentTags(preferences?.excludedTags),
      hiddenAuthorSet: new Set((preferences?.hiddenAuthors || []).map(hiddenAuthorKey).filter(Boolean)) };
    if (compiled.aiMode === 'all' && compiled.hideFurry !== true &&
        !compiled.excludedTagSet.size && !compiled.hiddenAuthorSet.size) return items;
    return items.filter(item => !isWorkHidden(item, compiled));
  }

  function sourceProvenance(item) {
    const keys = [...new Set([item?.key, ...(item?.memberKeys || [])].filter(Boolean))];
    const counts = {};
    for (const key of keys) {
      const prefix = key.split(':', 1)[0];
      const source = supportedSources.includes(prefix)
        ? prefix : item?.source || prefix;
      counts[source] = (counts[source] || 0) + 1;
    }
    return { total: keys.length, extra: Math.max(0, keys.length - 1), counts };
  }

  function workSources(item) {
    const records = [];
    for (const key of new Set([item?.key, ...(item?.memberKeys || [])])) {
      if (typeof key !== 'string') continue;
      const match = key.match(/^(danbooru|gelbooru|rule34|sankaku):([A-Za-z0-9]{1,64})$/);
      if (!match || match[1] !== 'sankaku' && !/^\d+$/.test(match[2])) continue;
      const [, source, id] = match;
      const url = source === 'danbooru' ? `https://danbooru.donmai.us/posts/${id}`
        : source === 'gelbooru' ? `https://gelbooru.com/index.php?page=post&s=view&id=${id}`
        : source === 'rule34' ? `https://rule34.xxx/index.php?page=post&s=view&id=${id}`
        : `https://sankaku.app/posts/${id}`;
      records.push({ key, source, id, url });
    }
    return records;
  }

  const normalizedTags = new Map();
  function normalizeTag(tag) {
    const text = String(tag || '');
    const cached = normalizedTags.get(text);
    if (cached !== undefined) return cached;
    const normalized = text.normalize('NFKC').toLowerCase()
      .replace(/[_:]+/g, ' ').replace(/\s+/g, ' ').trim();
    // Pure string results are shared across works; long input is not retained.
    if (text.length <= 512) {
      if (normalizedTags.size >= 32768) normalizedTags.delete(normalizedTags.keys().next().value);
      normalizedTags.set(text, normalized);
    }
    return normalized;
  }

  function firstTagSpellings(tags) {
    const spellings = new Map();
    for (const value of tags) {
      const tag = normalizeTag(value);
      if (!spellings.has(tag)) spellings.set(tag, value);
    }
    return spellings;
  }

  function meaningfulTags(tags) {
    return [...new Set((tags || []).map(normalizeTag))]
      .filter(tag => tag.length >= 3 && !genericTags.has(tag) &&
        !/^\d+(?:girls?|boys?)$/.test(tag) && !/^\d+$/.test(tag));
  }

  function relatedQueries(item) {
    const raw = artworkTags(item);
    const authors = new Set([...workParticipants(item).flatMap(person => [person.tag, person.name]),
      item.creatorTag, item.creatorName].filter(Boolean).map(normalizeTag));
    const tags = meaningfulTags(raw).filter(tag => !authors.has(tag) &&
      !/^(?:.* commentary|commission|translated|translation request|tagme|artist name|signature|watermark)$/.test(tag));
    const title = normalizeTag(item.title);
    const titleMatch = tags.find(tag => title.split(/[^\p{L}\p{N}]+/u).includes(tag));
    const related = normalizeTag(item.relatedQuery);
    const characters = (item.characterTags || []).map(normalizeTag).filter(tag => tags.includes(tag));
    const focused = tags.filter(tag => !isBroadRecommendationTag(tag));
    const ordered = [...new Set([...characters, ...(tags.includes(related) ? [related] : []),
      ...(titleMatch ? [titleMatch] : []), ...focused])];
    // With only broad attributes, require a pair instead of a catalog-wide single tag.
    if (!ordered.length && tags.length >= 2) ordered.push(tags.slice(0, 2).join('\u0000'));
    const spellings = firstTagSpellings(raw);
    return ordered.map(tag => tag.split('\u0000').map(part => {
      const original = spellings.get(part);
      return String(original || part).normalize('NFKC').trim().replace(/\s+/g, '_');
    }).join(' ')).filter(query => query.length <= 200);
  }

  function pickRelatedAnchor(item) {
    return relatedQueries(item)[0] || '';
  }

  function tagOverlap(reference, candidate) {
    let score = 0;
    for (const tag of reference) {
      if (candidate.includes(tag)) { score += 4; continue; }
      if (tag.length < 4) continue;
      if (candidate.some(other => other.startsWith(tag + ' '))) score += 1;
    }
    return score;
  }

  function rankRelated(item, candidates, limit = 24, context = {}) {
    const authorTags = new Set(workParticipants(item).flatMap(person => [person.tag, person.name]).map(normalizeTag));
    const reference = meaningfulTags(artworkTags(item)).filter(tag => !authorTags.has(tag));
    const seen = new Set([item.key]);
    const scored = [];
    const referenceArtist = item.artistId || '';
    for (const candidate of groupWorks([item, ...(candidates || [])])) {
      if (!candidate?.key || seen.has(candidate.key) ||
          candidate.memberKeys.includes(item.key)) continue;
      seen.add(candidate.key);
      const score = tagOverlap(reference, meaningfulTags(candidate.tags));
      if (!score) continue;
      const candidateArtist = candidate.artistId || '';
      const sameArtist = !!referenceArtist && item.source === candidate.source &&
        referenceArtist === candidateArtist;
      scored.push({ candidate, sameArtist, authorKey: candidate.source + ':' +
        (candidateArtist || candidate.key),
      score: score + (candidate.source !== item.source ? 0.25 : 0) -
        (sameArtist ? 5 : 0), index: scored.length });
    }
    const boosts = curationBoosts(scored.map(entry => entry.candidate), context.curation, context);
    for (const entry of scored) entry.score *= boosts.get(entry.candidate.key) || 1;
    scored.sort((a, b) => b.score - a.score || a.index - b.index);
    const selected = [];
    const artistCounts = new Map();
    for (const entry of scored) {
      if (entry.sameArtist) continue;
      const count = artistCounts.get(entry.authorKey) || 0;
      if (count >= 3) continue;
      selected.push(entry);
      artistCounts.set(entry.authorKey, count + 1);
      if (selected.length === limit) break;
    }
    if (selected.length < limit)
      for (const entry of scored) {
        if (selected.includes(entry)) continue;
        selected.push(entry);
        if (selected.length === limit) break;
      }
    return selected.map(entry => entry.candidate);
  }

  const recommendationProfiles = new WeakMap();
  function recommendationRawTags(item) {
    return [...(item?.tags || []), ...(item?.allTags || []),
      ...(item?.characterTags || []), ...(item?.copyrightTags || [])];
  }

  function recommendationWorkTags(item) {
    const authors = new Set(workParticipants(item).map(person => normalizeTag(person.tag)));
    return meaningfulTags(recommendationRawTags(item)).filter(tag => !authors.has(tag) &&
      !/^(?:.* commentary|commission|translated|translation request|tagme|artist name|signature|watermark)$/.test(tag));
  }

  function recommendationAuthor(item) {
    const artist = workParticipants(item).find(person => person.role === 'artist')?.tag;
    return artist ? normalizeTag(artist) : '';
  }

  function recommendationProfile(liked) {
    const cached = recommendationProfiles.get(liked);
    const revision = groupingRevision(liked);
    if (cached && cached.revision === revision && cached.length === liked.length) return cached.profile;
    const profile = new Map();
    const names = new Set();
    const typedNames = new Set();
    const copyrights = new Set();
    const authorTotals = new Map();
    const records = [];
    const canonicalQueries = new Map();
    // Snapshot once before grouping: metadata consumers must share one scan,
    // including saved-work objects whose tag arrays are exposed through getters.
    const works = groupWorks((liked || []).map(item => ({ ...item })));
    for (const item of works) {
      const subject = normalizeTag(item.relatedQuery);
      const title = normalizeTag(item.title);
      const raw = recommendationRawTags(item);
      const spellings = firstTagSpellings(raw);
      const tags = recommendationWorkTags(item);
      for (const tag of item.characterTags || []) { names.add(normalizeTag(tag)); typedNames.add(normalizeTag(tag)); }
      for (const tag of item.copyrightTags || []) copyrights.add(normalizeTag(tag));
      // Legacy saved works may lack typed metadata. Keep the existing subject
      // fallback, but authoritative character/Copyright metadata takes precedence.
      if (!item.characterTags?.length && !copyrights.has(title) && tags.includes(title) &&
          (item.source === 'danbooru' || !item.source && subject === title)) names.add(title);
      const author = recommendationAuthor(item) || item.key;
      authorTotals.set(author, (authorTotals.get(author) || 0) + 1);
      records.push({ tags, author });
      for (const tag of tags) {
        const original = String(spellings.get(tag) || tag);
        let query = canonicalQueries.get(original);
        if (query === undefined) {
          query = original.normalize('NFKC').toLowerCase().trim().replace(/\s+/g, '_');
          canonicalQueries.set(original, query);
        }
        const entry = profile.get(tag) || { tag, query, count: 0, weight: 0, subjectCount: 0, authors: new Map() };
        // Prefer a spelling that retains canonical punctuation over a saved label.
        if (query.includes(':')) entry.query = query;
        entry.count++;
        entry.authors.set(author, (entry.authors.get(author) || 0) + 1);
        entry.weight += 1 + (tag === subject ? 4 : 0) + (tag === title ? 3 : 0);
        if (tag === subject) entry.subjectCount++;
        profile.set(tag, entry);
      }
    }
    const ordered = [...profile.values()].sort((a, b) =>
      Number(b.subjectCount >= 2) - Number(a.subjectCount >= 2) ||
      b.weight - a.weight || b.count - a.count);
    for (const tag of copyrights) if (!typedNames.has(tag)) names.delete(tag);
    for (const entry of ordered) entry.support = [...entry.authors.values()]
      .reduce((sum, count) => sum + Math.sqrt(count), 0);
    if (Array.isArray(liked)) recommendationProfiles.set(liked, { profile: ordered, names, copyrights, records, revision, length: liked.length,
      total: works.length, supportTotal: [...authorTotals.values()].reduce((sum, count) => sum + Math.sqrt(count), 0) });
    return ordered;
  }

  function recommendationTags(liked, limit = 4) {
    return recommendationProfile(liked).slice(0, limit)
      .map(({ tag, count }) => ({ tag, count }));
  }

  function recommendationTagGroups(liked, minCount = 2, preferences = {}) {
    const profile = recommendationProfile(liked);
    const names = recommendationProfiles.get(liked)?.names || new Set();
    const copyrights = recommendationProfiles.get(liked)?.copyrights || new Set();
    const groups = { names: [], copyright: [], other: [] };
    for (const { tag, count, query } of profile) {
      if (count < minCount && !preferences[tag]) continue;
      const entry = { tag, count };
      if (query !== tag.replaceAll(' ', '_')) entry.query = query;
      (names.has(tag) ? groups.names : copyrights.has(tag) ? groups.copyright : groups.other).push(entry);
    }
    for (const [tag, mode] of Object.entries(preferences))
      if (['priority', 'disabled'].includes(mode) && !profile.some(entry => entry.tag === tag))
        groups.other.push({ tag, count: 0 });
    groups.other.sort((a, b) =>
      Number(isBroadRecommendationTag(a.tag)) - Number(isBroadRecommendationTag(b.tag)) ||
      b.count - a.count);
    return groups;
  }

  function recommendationQueryGroups(liked, preferences = {}, background = []) {
    let groups = recommendationTagGroups(liked, 2, preferences);
    const weights = recommendationWeights(liked, preferences, background);
    const usable = ({ tag }) => preferences[tag] !== 'disabled' &&
      (!isBroadRecommendationTag(tag) || preferences[tag] === 'priority') && weights.has(tag);
    if (![...groups.names, ...groups.copyright, ...groups.other].some(usable))
      groups = recommendationTagGroups(liked, 1, preferences);
    const active = entries => entries.filter(usable);
    const priority = [...active(groups.names), ...active(groups.copyright), ...active(groups.other)]
      .filter(({ tag }) => preferences[tag] === 'priority')
      .sort((a, b) => b.count - a.count);
    const minimumNameCount = Math.max(3,
      Math.ceil(Math.log2((liked || []).length + 1)) - 1);
    const names = active(groups.names).filter(({ tag, count }) =>
      preferences[tag] !== 'priority' && count >= minimumNameCount);
    const minimumContentCount = recommendationMinimumEvidence((liked || []).length);
    const copyright = active(groups.copyright).filter(({ tag, count }) =>
      preferences[tag] !== 'priority' && count >= minimumNameCount);
    const other = active(groups.other).filter(({ tag, count }) => preferences[tag] !== 'priority' &&
      count >= minimumContentCount)
      .sort((a, b) => (weights.get(b.tag) || 0) - (weights.get(a.tag) || 0) || b.count - a.count);
    if (!priority.length && !names.length && !copyright.length && !other.length)
      names.push(...active(groups.names).filter(({ tag }) =>
        preferences[tag] !== 'priority').slice(0, 1));
    const pending = [...recommendationCombinations(liked, preferences, background)];
    const combinations = [], usedTags = new Map();
    while (pending.length && combinations.length < 24) {
      let best = 0, bestScore = -1;
      pending.forEach((pair, index) => {
        const repetitions = pair.tags.reduce((sum, tag) => sum + (usedTags.get(tag) || 0), 0);
        const adjusted = pair.weight / (1 + repetitions * 1.5);
        if (adjusted > bestScore) { best = index; bestScore = adjusted; }
      });
      const [pair] = pending.splice(best, 1);
      combinations.push({ tag: pair.tags.join('\u0000'), query: pair.query, count: pair.count });
      for (const tag of pair.tags) usedTags.set(tag, (usedTags.get(tag) || 0) + 1);
    }
    return { priority, names, copyright, other, combinations };
  }

  function matchesRating(item, rating) {
    if (rating === 'all') return true;
    return rating === 'explicit'
      ? ['q', 'questionable', 'e', 'explicit'].includes(item.rating)
      : ordinaryRatings.includes(item.rating);
  }

  function recommendationVariety(key, seed) {
    let hash = (2166136261 ^ seed) >>> 0;
    for (const character of String(key))
      hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
    hash ^= hash >>> 16;
    hash = Math.imul(hash, 0x7feb352d) >>> 0;
    hash ^= hash >>> 15;
    hash = Math.imul(hash, 0x846ca68b) >>> 0;
    return ((hash ^ hash >>> 16) >>> 0) / 0xffffffff;
  }

  function recommendationWeights(liked, preferences, background = []) {
    const profile = recommendationProfile(liked);
    const state = recommendationProfiles.get(liked);
    const minimumEvidence = recommendationMinimumEvidence(state?.total || (liked || []).length);
    const minimumNameCount = Math.max(3, Math.ceil(Math.log2((liked || []).length + 1)) - 1);
    const ordinary = groupWorks(background);
    const prevalence = new Map();
    for (const item of ordinary)
      for (const tag of recommendationWorkTags(item)) prevalence.set(tag, (prevalence.get(tag) || 0) + 1);
    const weights = new Map();
    for (const { tag, count, support } of profile) {
      if (preferences[tag] === 'disabled' || isBroadRecommendationTag(tag) && preferences[tag] !== 'priority') continue;
      // A large collection contains many incidental one-off details. Only
      // recurring independent evidence can admit a work automatically; an
      // explicit priority remains effective even without supporting likes.
      if (preferences[tag] !== 'priority' && support < minimumEvidence) continue;
      // Repeated versions by one creator provide less independent evidence than
      // matching interests across many artists. Smooth small samples strongly.
      let weight = Math.max(0.25, Math.log2(support + 1) - 0.75) * (support / (support + 1)) ** 2;
      if (state?.names.has(tag) || state?.copyrights.has(tag))
        weight *= count < minimumNameCount ? 0.35 : 0.9;
      else weight *= 1.45;
      if (ordinary.length >= 24 && preferences[tag] !== 'priority') {
        // This is a fresh, unpersonalized local sample, not a claim about the
        // entire site's frequency. Smoothing prevents zero-count overconfidence.
        const likedRate = (support + 1) / ((state?.supportTotal || liked.length) + 2);
        const ordinaryRate = ((prevalence.get(tag) || 0) + 1) / (ordinary.length + 2);
        const lift = likedRate / ordinaryRate;
        const specificity = Math.max(0.08, Math.min(2.4, Math.log2(1 + lift) - 0.8));
        const confidence = ordinary.length / (ordinary.length + 80);
        weight *= 1 + (specificity - 1) * confidence;
      }
      weights.set(tag, preferences[tag] === 'priority' ? Math.max(2.5, weight) : weight);
    }
    // An explicit choice keeps working after the last matching like disappears.
    for (const [tag, mode] of Object.entries(preferences))
      if (mode === 'priority' && !weights.has(tag)) weights.set(tag, 2.5);
    return weights;
  }

  function recommendationCandidateTags(item, preferences) {
    return [...new Set([...recommendationWorkTags(item), ...recommendationRawTags(item)
      .map(normalizeTag).filter(tag => preferences[tag] === 'priority')])];
  }

  function recommendationMinimumEvidence(total) {
    // Cold start still explores the few interests available. As evidence
    // grows, share the existing query confidence rule with ranking.
    return total < 12 ? 1 : Math.max(2, Math.min(8, Math.ceil(Math.log2(total + 1) / 2)));
  }

  function recommendationCombinations(liked, preferences = {}, background = []) {
    const profile = recommendationProfile(liked);
    const state = recommendationProfiles.get(liked);
    if (!state || state.total < 6) return [];
    const weights = recommendationWeights(liked, preferences, background);
    const byTag = new Map(profile.map(entry => [entry.tag, entry]));
    const preferenceKey = JSON.stringify(Object.entries(preferences).sort(([a], [b]) => a.localeCompare(b)));
    if (state.combinationPreferenceKey !== preferenceKey) {
      const minimum = Math.max(3, Math.min(6, Math.ceil(Math.log2(state.total + 1) / 2)));
      const blocked = new Set([...excludedContentTags(Object.entries(preferences)
        .filter(([, mode]) => mode === 'disabled').map(([tag]) => tag))].map(normalizeTag));
      const usable = profile.filter(entry => entry.count >= minimum && !blocked.has(entry.tag) &&
        (!isBroadRecommendationTag(entry.tag) || preferences[entry.tag] === 'priority'));
      const identity = tag => state.names.has(tag) || state.copyrights.has(tag);
      const strongest = entries => entries.sort((a, b) => b.support - a.support || a.tag.localeCompare(b.tag));
      const focused = new Set([
        ...strongest(usable.filter(entry => !identity(entry.tag))).slice(0, 128),
        ...strongest(usable.filter(entry => state.names.has(entry.tag))).slice(0, 64),
        ...strongest(usable.filter(entry => state.copyrights.has(entry.tag))).slice(0, 32),
        ...usable.filter(entry => preferences[entry.tag] === 'priority')
      ].map(entry => entry.tag));
      const pairs = new Map();
      for (const record of state.records) {
        const tags = record.tags.filter(tag => focused.has(tag)).sort((a, b) =>
          Number(preferences[b] === 'priority') - Number(preferences[a] === 'priority') ||
          Number(identity(b)) - Number(identity(a)) || byTag.get(b).support - byTag.get(a).support ||
          a.localeCompare(b)).slice(0, 20);
        for (let a = 0; a < tags.length; a++) for (let b = a + 1; b < tags.length; b++) {
          // Character + series is usually the same identity described twice.
          if (identity(tags[a]) && identity(tags[b])) continue;
          if (` ${tags[a]} `.includes(` ${tags[b]} `) || ` ${tags[b]} `.includes(` ${tags[a]} `)) continue;
          const tagPair = [tags[a], tags[b]].sort();
          const key = tagPair.join('\u0000');
          const pair = pairs.get(key) || { tags: tagPair, count: 0, authors: new Map() };
          pair.count++;
          pair.authors.set(record.author, (pair.authors.get(record.author) || 0) + 1);
          pairs.set(key, pair);
        }
      }
      state.combinationProfile = [...pairs.values()].filter(pair => pair.count >= minimum && pair.authors.size >= 2)
        .map(pair => ({ tags: pair.tags, count: pair.count,
          support: [...pair.authors.values()].reduce((sum, count) => sum + Math.sqrt(count), 0) }))
        .sort((a, b) => b.support - a.support || a.tags.join('\u0000').localeCompare(b.tags.join('\u0000')))
        .slice(0, 512);
      state.combinationPreferenceKey = preferenceKey;
    }
    const ordinary = groupWorks(background).map(item => new Set(recommendationWorkTags(item)));
    const prevalence = new Map();
    for (const tags of ordinary) for (const tag of tags) prevalence.set(tag, (prevalence.get(tag) || 0) + 1);
    const result = [];
    for (const pair of state.combinationProfile) {
      const [a, b] = pair.tags;
      if (!weights.has(a) || !weights.has(b)) continue;
      const expected = byTag.get(a).support * byTag.get(b).support / state.supportTotal;
      let association = Math.log2((pair.support + 1) / (expected + 1));
      if (ordinary.length >= 24 && (prevalence.get(a) || 0) >= 3 && (prevalence.get(b) || 0) >= 3) {
        const together = ordinary.filter(tags => tags.has(a) && tags.has(b)).length;
        const expectedOrdinary = prevalence.get(a) * prevalence.get(b) / ordinary.length;
        const ordinaryAssociation = Math.max(0, Math.log2((together + 1) / (expectedOrdinary + 1)));
        association -= ordinaryAssociation * ordinary.length / (ordinary.length + 80);
      }
      // Co-occurrence must add evidence beyond the two marginal frequencies.
      if (association <= 0.2) continue;
      // Nearly predictable pairs add less evidence than a distinct context,
      // including series and attributes which occur together by definition.
      const predictability = pair.count / Math.min(byTag.get(a).count, byTag.get(b).count);
      const extraEvidence = Math.max(0.2, Math.min(1, (1 - predictability) * 2));
      const weight = extraEvidence * Math.sqrt(weights.get(a) * weights.get(b)) * Math.min(2, association) *
        pair.support / (pair.support + 4) * 0.55;
      const query = pair.tags.map(tag => byTag.get(tag).query).join(' ');
      if (query.length <= 200) result.push({ ...pair, query, weight });
    }
    return result.sort((a, b) => b.weight - a.weight || b.count - a.count || a.query.localeCompare(b.query)).slice(0, 256);
  }

  function rankRecommendations(liked, candidates, rating = 'general', limit = 96,
    preferences = {}, varietySeed = 0, context = {}) {
    const savedKeys = new Set((liked || []).flatMap(item => item.memberKeys || [item.key]));
    const existingKeys = new Set((context.existingWorks || []).flatMap(item => item.memberKeys || [item.key]));
    const disabledTags = Object.entries(preferences)
      .filter(([, mode]) => mode === 'disabled').map(([tag]) => tag);
    const disabledNormalized = new Set(disabledTags.map(normalizeTag));
    const disabledCandidateKeys = new Set((candidates || [])
      .filter(item => isWorkHidden(item, { excludedTags: disabledTags }) ||
        recommendationRawTags(item).some(tag => disabledNormalized.has(normalizeTag(tag))))
      .flatMap(item => item.memberKeys || [item.key]));
    const excludedKeys = new Set(groupWorks([...(liked || []), ...(candidates || [])])
      .filter(group => group.memberKeys.some(key => savedKeys.has(key)))
      .flatMap(group => group.memberKeys));
    const nameTags = new Set(recommendationTagGroups(liked, 1).names.map(({ tag }) => tag));
    const weights = recommendationWeights(liked, preferences, context.background);
    const combinations = recommendationCombinations(liked, preferences, context.background);
    const recentKeys = new Set(context.recentKeys || []);
    const seen = new Set();
    const groupedCandidates = groupWorks(candidates || []);
    const boosts = curationBoosts(groupedCandidates, context.curation,
      { ...context, liked, tagPreferences: preferences, tagWeights: weights });
    const scored = groupedCandidates.map((item, index) => {
      if (!item?.key || excludedKeys.has(item.key) || seen.has(item.key) ||
          item.memberKeys.some(key => existingKeys.has(key)) ||
          item.memberKeys.some(key => disabledCandidateKeys.has(key)) ||
          !matchesRating(item, rating)) return null;
      seen.add(item.key);
      const tags = recommendationCandidateTags(item, preferences);
      const contributions = tags.map(tag => weights.get(tag) || 0).filter(Boolean).sort((a,b) => b-a);
      // Long tag lists must not beat a few strong matches by summing noise.
      const singleScore = contributions.reduce((sum, value, index) => sum + value * (index < 6 ? 1 : 0.1), 0);
      const tagSet = new Set(tags);
      const pairedTags = new Set();
      let pairScore = 0, pairMatches = 0;
      for (const pair of combinations) {
        if (!pair.tags.every(tag => tagSet.has(tag)) || pair.tags.some(tag => pairedTags.has(tag))) continue;
        pairScore += pair.weight * (pairMatches ? 0.35 : 1);
        pair.tags.forEach(tag => pairedTags.add(tag));
        if (++pairMatches === 3) break;
      }
      // Pairs refine relevance without overwhelming explicit priorities or
      // letting a long list of correlated attributes multiply the score.
      const score = singleScore + Math.min(singleScore * 0.05, pairScore);
      const priorityScore = tags.reduce((sum, tag) =>
        sum + (preferences[tag] === 'priority' ? weights.get(tag) || 0 : 0), 0);
      const characters = tags.filter(tag => nameTags.has(tag) &&
        preferences[tag] !== 'priority');
      const seenBefore = item.memberKeys.some(key => recentKeys.has(key));
      return score ? { item, index, score, priorityScore, characters, author: recommendationAuthor(item),
        variedScore: score * (boosts.get(item.key) || 1) * (seenBefore ? 0.2 : 1) * (varietySeed ? 0.6 +
          recommendationVariety(item.key, varietySeed) * 0.8 : 1),
        variety: varietySeed ? recommendationVariety(item.key, varietySeed) : 0 } : null;
    }).filter(Boolean).sort((a, b) =>
      Number(b.priorityScore > 0) - Number(a.priorityScore > 0) ||
      b.variedScore - a.variedScore || b.variety - a.variety || a.index - b.index)
    const displayedCharacters = new Map();
    const displayedAuthors = new Map();
    for (const item of context.existingWorks || []) {
      for (const tag of recommendationCandidateTags(item, preferences).filter(tag => nameTags.has(tag)))
        displayedCharacters.set(tag, (displayedCharacters.get(tag) || 0) + 1);
      const author = recommendationAuthor(item);
      if (author) displayedAuthors.set(author, (displayedAuthors.get(author) || 0) + 1);
    }
    const diversified = [];
    while (scored.length && diversified.length < limit) {
      let best = 0;
      let bestPriority = -1;
      let bestScore = -1;
      for (let index = 0; index < Math.min(scored.length, 256); index++) {
        const entry = scored[index];
        const repetitions = Math.max(0, ...entry.characters.map(tag =>
          displayedCharacters.get(tag) || 0));
        const authorRepetitions = entry.author ? displayedAuthors.get(entry.author) || 0 : 0;
        const adjusted = entry.variedScore / (1 + repetitions * 1.8) / (1 + authorRepetitions * 0.65);
        const priority = Number(entry.priorityScore > 0);
        if (priority > bestPriority || priority === bestPriority && adjusted > bestScore) {
          best = index;
          bestPriority = priority;
          bestScore = adjusted;
        }
      }
      const [selected] = scored.splice(best, 1);
      diversified.push(selected.item);
      for (const tag of selected.characters)
        displayedCharacters.set(tag, (displayedCharacters.get(tag) || 0) + 1);
      if (selected.author) displayedAuthors.set(selected.author, (displayedAuthors.get(selected.author) || 0) + 1);
    }
    return diversified;
  }

  function mergeRecommendations(liked, existing, groups, rating = 'general',
    preferences = {}, varietySeed = 0, context = {}) {
    // A repeated record can carry a newly learned file hash, alias or gallery
    // page. Enrich the existing slots before suppressing repeats in ranking.
    const merged = mergeGroupedWorks(existing, (groups || []).flatMap(group => group.items || []));
    const existingKeys = new Set((existing || []).flatMap(memberKeysOf));
    const retained = merged.filter(item => memberKeysOf(item).some(key => existingKeys.has(key)));
    const ranked = rankRecommendations(liked, merged,
      rating, Number.MAX_SAFE_INTEGER, preferences, varietySeed, { ...context, existingWorks: retained });
    const preferred = [], discovery = [];
    for (const item of ranked)
      (recommendationCandidateTags(item, preferences).some(tag => preferences[tag] === 'priority')
        ? preferred : discovery).push(item);
    const fresh = [];
    // Match the user's choices regardless of which query found the artwork,
    // while leaving room for other learned interests. Existing cards stay put.
    while (preferred.length || discovery.length) {
      for (let index = 0; index < 3 && preferred.length; index++) fresh.push(preferred.shift());
      if (discovery.length) fresh.push(discovery.shift());
    }
    return [...retained, ...fresh];
  }

  function normalizeCurationPreferences(value) {
    return { enabled: value?.enabled === true, popularity: value?.popularity !== false,
      personal: value?.personal !== false, freshness: value?.freshness !== false,
      resolution: value?.resolution !== false };
  }

  const curationTasteProfiles = new WeakMap();
  function curationTasteWeights(liked) {
    const cached = curationTasteProfiles.get(liked);
    if (cached) return cached;
    const tags = new Map(), seen = new Set();
    for (const item of liked) {
      const identities = [item.key, ...(item.memberKeys || []),
        ...(item.contentHash ? [`hash:${item.contentHash}`] : [])].filter(Boolean);
      if (identities.some(key => seen.has(key))) continue;
      identities.forEach(key => seen.add(key));
      const author = recommendationAuthor(item) || item.key;
      // Saved works already carry their grouped identities. A bounded curation
      // factor needs tag counts, not the full query/character/combination profile
      // or another visual grouping pass over the personal library.
      for (const tag of recommendationWorkTags(item)) {
        if (isBroadRecommendationTag(tag)) continue;
        if (!tags.has(tag)) tags.set(tag, new Map());
        const authors = tags.get(tag);
        authors.set(author, (authors.get(author) || 0) + 1);
      }
    }
    const weights = new Map();
    for (const [tag, authors] of tags) {
      const support = [...authors.values()].reduce((sum, count) => sum + Math.sqrt(count), 0);
      weights.set(tag, Math.max(.25, Math.log2(support + 1) - .75) * support / (support + 1));
    }
    curationTasteProfiles.set(liked, weights);
    return weights;
  }

  function curationBoosts(items, value, context = {}) {
    const preferences = normalizeCurationPreferences(value);
    const boosts = new Map((items || []).map(item => [item.key, 1]));
    if (!preferences.enabled) return boosts;
    const weights = { popularity: .4, personal: .3, freshness: .15, resolution: .15 };
    const total = Object.entries(weights).reduce((sum, [key, weight]) =>
      sum + (preferences[key] ? weight : 0), 0);
    if (!total) return boosts;
    const clamp = value => Math.max(-1, Math.min(1, value));
    const members = item => [...new Map((item.groupMembers?.length ? item.groupMembers : [item])
      .filter(member => member?.key).map(member => [member.key, member])).values()];
    const votes = new Map();
    const ratingKey = rating => ordinaryRatings.includes(rating) ? 'g' :
      ['q', 'questionable'].includes(rating) ? 'q' : ['e', 'explicit'].includes(rating) ? 'e' : 'u';
    const evidence = new Map();
    if (preferences.popularity) for (const item of items || []) {
      const perSource = new Map();
      for (const member of members(item)) {
        if (!supportedSources.includes(member.source) || !Number.isFinite(member.popularityCount)) continue;
        const key = `${member.source}:${ratingKey(member.rating)}`;
        // Variants/reposts contribute one observation per source and artwork.
        perSource.set(key, Math.max(perSource.get(key) ?? -Infinity, member.popularityCount));
      }
      evidence.set(item.key, perSource);
      for (const [source, score] of perSource) {
        if (!votes.has(source)) votes.set(source, new Map());
        votes.get(source).set(item.key, score);
      }
    }
    const relative = new Map();
    for (const [source, sample] of votes) {
      const sorted = [...sample.values()].sort((a, b) => a - b);
      const scores = new Map();
      for (let index = 0; index < sorted.length;) {
        let end = index + 1;
        while (end < sorted.length && sorted[end] === sorted[index]) end++;
        // Midranks keep ties neutral and singleton sources cannot dominate.
        const percentile = sorted.length > 1 ? (index + end - 1) / 2 / (sorted.length - 1) : .5;
        scores.set(sorted[index], (percentile * 2 - 1) * Math.min(1, (sorted.length - 1) / 7));
        index = end;
      }
      relative.set(source, scores);
    }
    const liked = context.liked || [];
    const personalWeights = preferences.personal && liked.length
      ? context.tagWeights || curationTasteWeights(liked) : null;
    const personalConfidence = Math.min(1, liked.length / 8);
    const now = Number.isFinite(context.now) ? context.now : Date.now();
    for (const item of items || []) {
      let sum = 0;
      if (preferences.popularity) {
        const values = [...(evidence.get(item.key) || [])].map(([source, score]) =>
          relative.get(source)?.get(score) || 0).filter(score => score !== 0);
        // Neutral mirrors do not dilute a rating; more mirrors never add points.
        if (values.length) sum += weights.popularity * values.reduce((a, b) => a + b, 0) / values.length;
      }
      if (personalWeights) {
        const matches = recommendationCandidateTags(item, context.tagPreferences || {})
          .map(tag => context.tagPreferences?.[tag] === 'disabled' ? 0 :
            context.tagPreferences?.[tag] === 'priority' ? Math.max(2.5, personalWeights.get(tag) || 0) :
            personalWeights.get(tag) || 0).filter(weight => weight > 0)
          .sort((a, b) => b - a).slice(0, 6);
        const score = matches.reduce((sum, weight) => sum + weight, 0);
        sum += weights.personal * score / (score + 4) * personalConfidence;
      }
      const leaves = members(item);
      if (preferences.freshness) {
        // Reposting an old work to another source must not reset its age.
        const dates = leaves.map(member => Date.parse(member.published)).filter(date =>
          Number.isFinite(date) && date > 0 && date <= now + 3600000);
        if (dates.length) {
          const days = Math.max(0, (now - Math.min(...dates)) / 86400000);
          sum += weights.freshness * clamp(1 - Math.log1p(days) / Math.log(91));
        }
      }
      if (preferences.resolution && !artworkTags(item).some(tag =>
          ['pixel art', 'pixel perfect', 'sketch', 'lineart', 'line art', 'oekaki'].includes(normalizeTag(tag)))) {
        const sizes = leaves.filter(member => Number.isFinite(member.width) && Number.isFinite(member.height) &&
          member.width > 0 && member.height > 0 && member.width <= 100000 && member.height <= 100000)
          .map(member => Math.min(member.width, member.height));
        if (sizes.length) sum += weights.resolution * clamp(Math.log2(Math.max(...sizes) / 900) / 2);
      }
      boosts.set(item.key, 1 + .45 * sum / total);
    }
    return boosts;
  }

  function rankCuratedWorks(items, preferences, context = {}) {
    if (!normalizeCurationPreferences(preferences).enabled) return items;
    const boosts = curationBoosts(items, preferences, context);
    return (items || []).map((item, index) => ({ item, index, score: boosts.get(item.key) || 1 }))
      .sort((a, b) => b.score - a.score || a.index - b.index).map(entry => entry.item);
  }

  function mergeCuratedWorks(existing, incoming, preferences, context = {}) {
    const grouped = mergeGroupedWorks(existing, incoming);
    return stableFeedItems(existing || [], rankCuratedWorks(grouped, preferences, context));
  }

  function followKey(ref) {
    return [ref?.source || '', '',
      ref?.artistId || ref?.artist || ''].map(value => String(value).toLowerCase()).join(':');
  }

  function participantRole(tag, role = '') {
    const qualifier = String(tag || '').toLowerCase().replaceAll('_', ' ').match(/\(([^()]+)\)$/)?.[1];
    const roles = { 'voice actor': 'voice_actor', 'voice actress': 'voice_actor',
      'sound editor': 'sound', 'sound designer': 'sound', 'sound effects': 'sound', sfx: 'sound',
      composer: 'music', musician: 'music', singer: 'music', vocalist: 'music',
      writer: 'writer', scriptwriter: 'writer', colorist: 'colorist', colourist: 'colorist',
      editor: 'editor', 'video editor': 'editor', translator: 'translator', animator: 'animator' };
    return roles[qualifier] || (['artist', 'animator', 'voice_actor', 'sound', 'music',
      'writer', 'colorist', 'editor', 'translator'].includes(role) ? role : 'artist');
  }

  function participantRoleLabel(role) {
    return { artist: 'Художник', animator: 'Анимация', voice_actor: 'Озвучка', sound: 'Звук',
      music: 'Музыка', writer: 'Сценарий', colorist: 'Колорист', editor: 'Монтаж',
      translator: 'Перевод' }[role] || 'Участник';
  }

  function workParticipants(item) {
    if (!supportedSources.includes(item?.source)) return [];
    const tag = item.creatorTag || (item.source === 'danbooru' ? item.artistId : '') || '';
    const raw = item.participants?.length ? item.participants : tag ? [{ tag,
      name: item.creatorName || (item.source === 'danbooru' && item.artistId === tag ? item.artist : '') }] : [];
    const seen = new Set();
    return raw.filter(person => typeof person?.tag === 'string' && person.tag.trim() &&
      person.tag.length <= 100 && !seen.has(person.tag.toLowerCase()) && seen.add(person.tag.toLowerCase()))
      .map(person => ({ tag: person.tag, name: person.name && !/^Неизвестн/i.test(person.name)
        ? person.name : person.tag.replaceAll('_', ' '), role: participantRole(person.tag, person.role) }))
      .sort((a, b) => (a.role === 'artist' ? 0 : a.role === 'animator' ? 1 : 2) -
        (b.role === 'artist' ? 0 : b.role === 'animator' ? 1 : 2));
  }

  function mergeParticipants(items) {
    return workParticipants({ source: 'danbooru', participants: items.flatMap(workParticipants) });
  }

  function creatorProfileRef(item, tag = '') {
    const attribution = workAttribution(item);
    const creator = tag ? attribution.participants.find(person => person.tag === tag) : attribution.creator;
    if (!creator) return null;
    return { source: 'artist', artist: creator.follow.artistId, service: '',
      ...(creator.participantRole !== 'artist' ? { participantRole: creator.participantRole } : {}) };
  }

  function workAttribution(item, priority = 'creator') {
    const choices = derived(attributionCache, item, attributionFields, () => ({}));
    return choices[priority] ||= buildAttribution(item, priority);
  }
  function buildAttribution(item, priority = 'creator') {
    const source = item?.source || '';
    const booruUploader = source === 'gelbooru' || source === 'rule34' || source === 'sankaku';
    const participants = workParticipants(item).map(person => ({ ...person,
      role: ['artist', 'animator'].includes(person.role) ? 'creator' : 'contributor',
      participantRole: person.role, roleLabel: participantRoleLabel(person.role),
      action: 'creator-profile', follow: { source: 'danbooru', artistId: person.tag, name: person.name,
        ...(person.role !== 'artist' ? { participantRole: person.role } : {}) } }));
    const uploaderId = item?.uploaderId || (booruUploader ? item?.artistId : '') || '';
    const rawUploaderName = item?.uploaderName || (booruUploader ? item?.artist : '') || '';
    const uploaderName = !/^Неизвестн/i.test(rawUploaderName) &&
      !/^#?\d+$/.test(rawUploaderName.trim()) ? rawUploaderName : '';
    const originalUrl = /^https?:\/\/[^\s]+$/i.test(item?.originalUrl || '') &&
      !/\.(?:jpe?g|png|gif|webp|avif|bmp|mp4|webm)(?:$|[?#])/i.test(item.originalUrl)
      ? item.originalUrl : '';
    const creator = participants.find(person => person.role === 'creator') || null;
    const uploader = uploaderName ? { role: 'uploader',
      name: uploaderName,
      action: booruUploader ? 'uploader-profile' : 'uploader-external' } : null;
    const original = originalUrl ? { role: 'original',
      name: (() => { try { return new URL(originalUrl).hostname.replace(/^www\./, ''); }
        catch { return 'Исходная ссылка'; } })(), action: 'original', url: originalUrl } : null;
    const selected = priority === 'uploader' ? uploader || creator || original :
      priority === 'original' ? original || creator || uploader : creator || participants[0];
    const primary = selected
      ? { role: selected.role, name: selected.name, action: selected.action,
          ...(selected.roleLabel ? { roleLabel: selected.roleLabel } : {}) }
      : { role: 'unknown', name: 'Автор не указан', action: '' };
    return { primary, creator, participants, uploader, original };
  }

  function orderRecommendationOtherTags(tags, preferences = {}) {
    const modeFor = ({ tag }) => preferences[tag] || 'normal';
    return ['priority', 'disabled', 'normal']
      .flatMap(mode => (tags || []).filter(entry => modeFor(entry) === mode));
  }

  function followFeedRequests(follow, rating = 'general', hasGelbooruKey = false,
      hasRule34Key = false, page = 0, includeSankaku = false) {
    const profile = new URLSearchParams({ source: follow.source,
      artist: follow.artistId, rating, page: String(page) });
    const requests = [{ source: follow.source, path: `/api/profile?${profile}` }];
    if (follow.source === 'danbooru' && hasGelbooruKey) {
      const tag = String(follow.gelbooruTag || follow.artistId).trim().replace(/\s+/g, '_');
      const search = new URLSearchParams({ q: tag, page: String(page), sources: 'gelbooru',
        rating, sort: 'recent', kind: 'illustrations' });
      requests.push({ source: 'gelbooru', path: `/api/search?${search}` });
    }
    if (follow.source === 'danbooru' && hasRule34Key) {
      const search = new URLSearchParams({ q: follow.artistId, page: String(page),
        sources: 'rule34', rating, sort: 'recent', kind: 'illustrations' });
      requests.push({ source: 'rule34', path: `/api/search?${search}` });
    }
    if (follow.source === 'danbooru' && includeSankaku) {
      const search = new URLSearchParams({ q: follow.artistId, page: String(page),
        sources: 'sankaku', rating, sort: 'recent', kind: 'illustrations' });
      requests.push({ source: 'sankaku', path: `/api/search?${search}` });
    }
    return requests;
  }

  function buildFollowFeed(groups, rating = 'general', limit = 120) {
    const byKey = new Map();
    for (const { follow, items } of groups || []) {
      const lastSeen = Date.parse(follow.seenAt?.[rating] || follow.followedAt || '') || 0;
      const seenKeys = new Set(follow.seenKeys?.[rating] || []);
      for (const item of items || []) {
        if (!item?.key || !matchesRating(item, rating)) continue;
        const published = Date.parse(item.published || '') || 0;
        const entry = { item, published,
          isNew: published > lastSeen && !seenKeys.has(item.key) };
        if (!byKey.has(item.key)) byKey.set(item.key, entry);
        else if (entry.isNew) byKey.get(item.key).isNew = true;
      }
    }
    const ordered = [...byKey.values()].sort((a, b) =>
      Number(b.isNew) - Number(a.isNew) || b.published - a.published)
      .slice(0, limit);
    return { items: ordered.map(entry => entry.item),
      newKeys: new Set(ordered.filter(entry => entry.isNew).map(entry => entry.item.key)) };
  }

  function groupFollowFeed(groups, rating) {
    const feed = buildFollowFeed(groups, rating, Number.MAX_SAFE_INTEGER);
    return { items: groupWorks(feed.items), newKeys: feed.newKeys };
  }

  function stableFeedItems(previous, incoming, newKeys = new Set()) {
    if (!previous?.length) return [...incoming];
    const positions = new Map();
    previous.forEach((item, index) => {
      for (const key of [item.key, ...(item.memberKeys || [])])
        if (!positions.has(key)) positions.set(key, index);
    });
    const placed = incoming.map((item, index) => {
      const keys = [item.key, ...(item.memberKeys || [])];
      const position = Math.min(...keys.map(key => positions.get(key) ?? Infinity));
      return { item, index, position, isNew: keys.some(key => newKeys.has(key)) };
    });
    placed.sort((a, b) => Number(b.isNew) - Number(a.isNew) ||
      (Number.isFinite(a.position) && Number.isFinite(b.position)
        ? a.position - b.position :
        Number.isFinite(a.position) ? -1 : Number.isFinite(b.position) ? 1 :
          a.index - b.index));
    return placed.map(entry => entry.item);
  }

  const api = { normalizeSearch, favoriteTagFromQuery, completeTag, advanceSearchSources,
    rememberSearchPageStats, searchResultCounts,
    workHistoryTokens, hideViewedWorks, sameWork,
    removeNavigationEntry, groupWorks, mergeGroupedWorks, groupingRevision, invalidateGrouping, refineGrouping,
    needsGroupRepair, repairLegacyGroup, replaceRepairedGroups,
    workAttribution, creatorProfileRef, participantRole, participantRoleLabel, workParticipants,
    artworkTags, artworkTagKind,
    normalizeExcludedTags, hiddenAuthorKey, isAuthorHidden, isWorkHidden, filterWorks,
    sourceProvenance, workSources, mergeWorkMetadata, mergeDetailPages, artworkMedia, videoMimeType, previewMedia,
    mediaCacheKey, signedMediaExpired, renewWorkMedia, needsVisualFingerprint, perceptualImageHash,
    supportedSources, filterCatalogItems, catalogSort, cleanClientState, navigationSection,
    pickRelatedAnchor, relatedQueries, rankRelated, recommendationTags, recommendationTagGroups,
    isBroadRecommendationTag, orderRecommendationOtherTags,
    recommendationQueryGroups, recommendationCombinations, rankRecommendations, mergeRecommendations,
    normalizeCurationPreferences, curationBoosts, rankCuratedWorks, mergeCuratedWorks,
    followKey, followFeedRequests, buildFollowFeed, groupFollowFeed, stableFeedItems };
  root.CatalogLogic = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

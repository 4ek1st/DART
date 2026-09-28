(function (root) {
  const supportedSources = Object.freeze(['danbooru', 'gelbooru', 'rule34', 'sankaku']);

  function filterCatalogItems(items) {
    if (!Array.isArray(items)) return [];
    const filtered = items.filter(item => supportedSources.includes(item?.source));
    return filtered.length === items.length ? items : filtered;
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
    'toes', 'collarbone', 'dark skin'
  ]);

  function isBroadRecommendationTag(tag) {
    const normalized = normalizeTag(tag);
    return broadRecommendationTags.has(normalized) ||
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
    return '';
  }

  function itemIdentities(item) {
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
      ...itemImageRecords(item).filter(record => /^[a-f0-9]{32}$/i.test(record.hash || ''))
        .map(record => `hash:${record.hash.toLowerCase()}`)].filter(Boolean))];
  }

  function workHistoryTokens(item) {
    const keys = [item?.key, ...(item?.memberKeys || [])]
      .filter(Boolean).map(key => `key:${key}`);
    return [...new Set([...keys, ...itemIdentities(item || {})])];
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
      return { ...record, hash: String(record.hash || mediaFileHash(url) || hash).toLowerCase() };
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
      return url.href;
    } catch { return value; }
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
    if (first.publication && second.publication && first.publication !== second.publication)
      return false;
    const characters = first.characters || [];
    const otherCharacters = second.characters || [];
    if (characters.length && otherCharacters.length &&
        !characters.some(tag => otherCharacters.includes(tag))) return false;
    if (first.creator && first.creator === second.creator &&
        validVisualHash(first.perceptualHash) && validVisualHash(second.perceptualHash))
      return first.tags.length >= 12 && second.tags.length >= 12 &&
        first.aspectRatio > 0 && second.aspectRatio > 0 &&
        Math.abs(Math.log(first.aspectRatio / second.aspectRatio)) <= .05 &&
        visualDistance(first.perceptualHash, second.perceptualHash) <= 12 && distance <= 12;
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

  const groupedCache = new WeakMap();
  function invalidateGrouping(items) { if (Array.isArray(items)) groupedCache.delete(items); }
  function groupWorks(items) {
    if (Array.isArray(items) && groupedCache.has(items)) return groupedCache.get(items);
    const works = (items || []).filter(item => item?.key);
    const roots = works.map((_, index) => index);
    const find = index => {
      while (roots[index] !== index) {
        roots[index] = roots[roots[index]];
        index = roots[index];
      }
      return index;
    };
    const linked = new Map();
    works.forEach((item, index) => {
      for (const identity of itemIdentities(item)) {
        if (linked.has(identity)) roots[find(index)] = find(linked.get(identity));
        else linked.set(identity, index);
      }
    });
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
        ? 'adult' : ['g', 'general', 'safe'].includes(item.rating) ? 'general' : '';
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
        roots[find(candidate.index)] = find(match.index);
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
            roots[find(index)] = find(previous.index);
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
      return { ...preferred, images, imageRecords, allTags: [...allTags], groupCount: count,
        characterTags, copyrightTags, title: titleFromCharacters(preferred.title, characterTags),
        participants, creatorTag: creator?.follow.artistId || '',
        creatorName: creator?.name || (participants.length ? '' : preferred.creatorName || ''),
        originalUrl: preferred.originalUrl || original,
        memberKeys: [...keys], identityKeys: [...identities], visualSamples,
        rating: explicit ? 'e' : questionable ? 'q' : preferred.rating };
    });
    if (Array.isArray(items)) groupedCache.set(items, result);
    return result;
  }

  function titleFromCharacters(title, characters) {
    const names = characters.filter(tag => normalizeFilterTag(tag) !== 'original character');
    const generatedTitle = characters.map(tag => tag.replaceAll('_', ' ')).join(', ');
    return names.length && (/^Работа #\d+$/.test(title || '') ||
      names.length !== characters.length && title === generatedTitle)
      ? names.map(tag => tag.replaceAll('_', ' ')).join(', ') : title;
  }

  function mergeWorkMetadata(previous, incoming) {
    if (!previous || previous.key !== incoming?.key || previous.source !== incoming.source)
      return incoming;
    const merged = { ...previous, ...incoming };
    merged.memberKeys = [...new Set([previous.key, ...(previous.memberKeys || []),
      ...(incoming.memberKeys || [])].filter(Boolean))];
    merged.visualHash = incoming.visualHash || previous.visualHash || '';
    merged.visualPHash = incoming.visualPHash || previous.visualPHash || '';
    merged.visualAspectRatio = incoming.visualAspectRatio || previous.visualAspectRatio || 0;
    merged.visualSamples = [...new Map([...itemVisualSamples(previous), ...itemVisualSamples(incoming)]
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
    return { ...detail, ...media, groupCount: Math.max(1, media.images.length),
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
    const artistTags = [...workParticipants(item).map(person => person.tag), item?.followedArtistTag,
      ...(item?.tags || []), ...(item?.allTags || [])];
    if (artistTags.some(artistId => hidden.has(hiddenAuthorKey({ source: 'artist', artistId })))) return true;
    const artistId = item?.uploaderId || (item?.source !== 'danbooru' ? item?.artistId : '');
    return !!artistId && hidden.has(hiddenAuthorKey({ source: item.source, artistId }));
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

  function isWorkHidden(item, preferences = {}) {
    if (isAuthorHidden(item, preferences)) return true;
    const aiMode = preferences.aiMode || 'all';
    const blocked = preferences.excludedTagSet ||
      new Set(normalizeExcludedTags(preferences.excludedTags));
    if (aiMode === 'all' && !blocked.size) return false;
    const tags = [...new Set([...(item?.tags || []), ...(item?.allTags || [])]
      .map(normalizeFilterTag).filter(Boolean))];
    return tags.some(tag => blocked.has(tag) ||
      aiMode !== 'all' && matchesMarker(tag, generatedTags) ||
      aiMode === 'generated-and-assisted' && matchesMarker(tag, assistedTags));
  }

  function filterWorks(items, preferences) {
    if (!items?.length) return items || [];
    if ((!preferences?.aiMode || preferences.aiMode === 'all') &&
        !preferences?.excludedTags?.length && !preferences?.hiddenAuthors?.length) return items;
    const compiled = { ...preferences,
      excludedTagSet: new Set(normalizeExcludedTags(preferences?.excludedTags)),
      hiddenAuthorSet: new Set((preferences?.hiddenAuthors || []).map(hiddenAuthorKey).filter(Boolean)) };
    if (compiled.aiMode === 'all' && !compiled.excludedTagSet.size && !compiled.hiddenAuthorSet.size) return items;
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

  function normalizeTag(tag) {
    return String(tag || '').normalize('NFKC').toLowerCase()
      .replace(/[_:]+/g, ' ').replace(/\s+/g, ' ').trim();
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
    return ordered.map(tag => tag.split('\u0000').map(part => {
      const original = raw.find(value => normalizeTag(value) === part);
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

  function rankRelated(item, candidates, limit = 24) {
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
  function recommendationProfile(liked) {
    const cached = recommendationProfiles.get(liked);
    if (cached) return cached.profile;
    const profile = new Map();
    const names = new Set();
    for (const item of liked || []) {
      const subject = normalizeTag(item.relatedQuery);
      const title = normalizeTag(item.title);
      const tags = meaningfulTags(item.tags);
      if (item.source === 'danbooru' && tags.includes(title)) names.add(title);
      for (const tag of tags) {
        const entry = profile.get(tag) || { tag, count: 0, weight: 0, subjectCount: 0 };
        entry.count++;
        entry.weight += 1 + (tag === subject ? 4 : 0) + (tag === title ? 3 : 0);
        if (tag === subject) entry.subjectCount++;
        profile.set(tag, entry);
      }
    }
    const ordered = [...profile.values()].sort((a, b) =>
      Number(b.subjectCount >= 2) - Number(a.subjectCount >= 2) ||
      b.weight - a.weight || b.count - a.count);
    if (Array.isArray(liked)) recommendationProfiles.set(liked, { profile: ordered, names });
    return ordered;
  }

  function recommendationTags(liked, limit = 4) {
    return recommendationProfile(liked).slice(0, limit)
      .map(({ tag, count }) => ({ tag, count }));
  }

  function recommendationTagGroups(liked, minCount = 2) {
    const profile = recommendationProfile(liked);
    const names = recommendationProfiles.get(liked)?.names || new Set();
    const groups = { names: [], other: [] };
    for (const { tag, count } of profile) {
      if (count < minCount) continue;
      (names.has(tag) ? groups.names : groups.other).push({ tag, count });
    }
    groups.other.sort((a, b) =>
      Number(isBroadRecommendationTag(a.tag)) - Number(isBroadRecommendationTag(b.tag)) ||
      b.count - a.count);
    return groups;
  }

  function recommendationQueryGroups(liked, preferences = {}) {
    let groups = recommendationTagGroups(liked);
    const usable = ({ tag }) => preferences[tag] !== 'disabled' &&
      (!isBroadRecommendationTag(tag) || preferences[tag] === 'priority');
    if (![...groups.names, ...groups.other].some(usable))
      groups = recommendationTagGroups(liked, 1);
    const active = entries => entries.filter(usable);
    const priority = [...active(groups.names), ...active(groups.other)]
      .filter(({ tag }) => preferences[tag] === 'priority')
      .sort((a, b) => b.count - a.count);
    const minimumNameCount = Math.max(3,
      Math.ceil(Math.log2((liked || []).length + 1)) - 1);
    const names = active(groups.names).filter(({ tag, count }) =>
      preferences[tag] !== 'priority' && count >= minimumNameCount);
    const other = active(groups.other).filter(({ tag }) => preferences[tag] !== 'priority')
      .sort((a, b) => b.count - a.count);
    if (!priority.length && !names.length && !other.length)
      names.push(...active(groups.names).filter(({ tag }) =>
        preferences[tag] !== 'priority').slice(0, 1));
    return { priority, names, other };
  }

  function matchesRating(item, rating) {
    if (rating === 'all') return true;
    return rating === 'explicit'
      ? ['q', 'questionable', 'e', 'explicit'].includes(item.rating)
      : ['g', 'general'].includes(item.rating);
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

  function rankRecommendations(liked, candidates, rating = 'general', limit = 96,
    preferences = {}, varietySeed = 0) {
    const savedKeys = new Set((liked || []).map(item => item.key));
    const disabledTags = new Set(Object.entries(preferences)
      .filter(([, mode]) => mode === 'disabled').map(([tag]) => normalizeTag(tag)));
    const disabledCandidateKeys = new Set((candidates || [])
      .filter(item => (item.tags || []).some(tag =>
        disabledTags.has(normalizeTag(tag))))
      .flatMap(item => item.memberKeys || [item.key]));
    const excludedKeys = new Set(groupWorks([...(liked || []), ...(candidates || [])])
      .filter(group => group.memberKeys.some(key => savedKeys.has(key)))
      .flatMap(group => group.memberKeys));
    const profile = recommendationProfile(liked);
    const nameTags = new Set(recommendationTagGroups(liked, 1).names.map(({ tag }) => tag));
    const minimumNameCount = Math.max(3,
      Math.ceil(Math.log2((liked || []).length + 1)) - 1);
    const weights = new Map(profile.filter(({ tag }) =>
      preferences[tag] !== 'disabled' &&
      (!isBroadRecommendationTag(tag) || preferences[tag] === 'priority'))
      .map(({ tag, count }) => [tag,
        Math.max(0.25, Math.log2(count + 1) - 0.75) *
          (nameTags.has(tag) ? count < minimumNameCount ? 0.35 : 0.9 : 1.45)]));
    const seen = new Set();
    const scored = groupWorks(candidates || []).map((item, index) => {
      if (!item?.key || excludedKeys.has(item.key) || seen.has(item.key) ||
          item.memberKeys.some(key => disabledCandidateKeys.has(key)) ||
          !matchesRating(item, rating)) return null;
      seen.add(item.key);
      const tags = meaningfulTags(item.tags);
      const score = tags.reduce((sum, tag) => sum + (weights.get(tag) || 0), 0);
      const priorityScore = tags.reduce((sum, tag) =>
        sum + (preferences[tag] === 'priority' ? weights.get(tag) || 0 : 0), 0);
      const characters = tags.filter(tag => nameTags.has(tag) &&
        preferences[tag] !== 'priority');
      return score ? { item, index, score, priorityScore, characters,
        variedScore: varietySeed ? score * (0.85 +
          recommendationVariety(item.key, varietySeed) * 0.3) : score,
        variety: varietySeed ? recommendationVariety(item.key, varietySeed) : 0 } : null;
    }).filter(Boolean).sort((a, b) =>
      b.priorityScore - a.priorityScore ||
      b.variedScore - a.variedScore || b.variety - a.variety || a.index - b.index)
    const displayedCharacters = new Map();
    const diversified = [];
    while (scored.length && diversified.length < limit) {
      let best = 0;
      let bestPriority = -1;
      let bestScore = -1;
      for (let index = 0; index < Math.min(scored.length, 64); index++) {
        const entry = scored[index];
        const repetitions = Math.max(0, ...entry.characters.map(tag =>
          displayedCharacters.get(tag) || 0));
        const adjusted = entry.variedScore / (1 + repetitions * 1.8);
        if (entry.priorityScore > bestPriority ||
            entry.priorityScore === bestPriority && adjusted > bestScore) {
          best = index;
          bestPriority = entry.priorityScore;
          bestScore = adjusted;
        }
      }
      const [selected] = scored.splice(best, 1);
      diversified.push(selected.item);
      for (const tag of selected.characters)
        displayedCharacters.set(tag, (displayedCharacters.get(tag) || 0) + 1);
    }
    return diversified;
  }

  function mergeRecommendations(liked, existing, groups, rating = 'general',
    preferences = {}, varietySeed = 0) {
    const existingKeys = new Set((existing || []).flatMap(item =>
      item.memberKeys || [item.key]));
    const kinds = new Map();
    for (const group of groups || [])
      for (const item of group.items || []) kinds.set(item.key, group.kind);
    const ranked = rankRecommendations(liked,
      [...(existing || []), ...(groups || []).flatMap(group => group.items || [])],
      rating, Number.MAX_SAFE_INTEGER, preferences, varietySeed);
    const buckets = { priority: [], other: [], names: [] };
    for (const item of ranked) {
      const keys = item.memberKeys || [item.key];
      if (keys.some(key => existingKeys.has(key))) continue;
      const kindsForItem = keys.map(key => kinds.get(key));
      const kind = kindsForItem.includes('priority') ? 'priority' :
        kindsForItem.includes('other') ? 'other' : 'names';
      buckets[kind].push(item);
    }
    const fresh = [];
    while (buckets.priority.length || buckets.other.length || buckets.names.length) {
      if (buckets.priority.length) fresh.push(buckets.priority.shift());
      for (let index = 0; index < 3; index++)
        if (buckets.other.length) fresh.push(buckets.other.shift());
      if (buckets.names.length) fresh.push(buckets.names.shift());
    }
    return [...(existing || []), ...fresh];
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
      }
    }
    const ordered = [...byKey.values()].sort((a, b) => b.published - a.published)
      .slice(0, limit);
    return { items: ordered.map(entry => entry.item),
      newKeys: new Set(ordered.filter(entry => entry.isNew).map(entry => entry.item.key)) };
  }

  const api = { normalizeSearch, favoriteTagFromQuery, completeTag, advanceSearchSources,
    rememberSearchPageStats, searchResultCounts,
    workHistoryTokens, hideViewedWorks,
    removeNavigationEntry, groupWorks, invalidateGrouping,
    workAttribution, creatorProfileRef, participantRole, participantRoleLabel, workParticipants,
    artworkTags, artworkTagKind,
    normalizeExcludedTags, hiddenAuthorKey, isAuthorHidden, isWorkHidden, filterWorks,
    sourceProvenance, workSources, mergeWorkMetadata, mergeDetailPages, artworkMedia, videoMimeType,
    mediaCacheKey, needsVisualFingerprint, perceptualImageHash,
    supportedSources, filterCatalogItems, cleanClientState,
    pickRelatedAnchor, relatedQueries, rankRelated, recommendationTags, recommendationTagGroups,
    isBroadRecommendationTag, orderRecommendationOtherTags,
    recommendationQueryGroups, rankRecommendations, mergeRecommendations,
    followKey, followFeedRequests, buildFollowFeed };
  root.CatalogLogic = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

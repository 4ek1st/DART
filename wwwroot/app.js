const icons = {
  back: '<path d="m15 18-6-6 6-6"/>',
  forward: '<path d="m9 18 6-6-6-6"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10Z"/><path d="M9 21v-7h6v7"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  file: '<path d="M6 3h8l4 4v14H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v5h5M8 13h8M8 17h6"/>',
  heart: '<path d="M20.8 8.2c0 4.5-8.8 10.5-8.8 10.5S3.2 12.7 3.2 8.2a4.8 4.8 0 0 1 8.8-2.5 4.8 4.8 0 0 1 8.8 2.5Z"/>',
  spark: '<path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2ZM19 17l.6 1.4L21 19l-1.4.6L19 21l-.6-1.4L17 19l1.4-.6L19 17Z"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2H3ZM16 5a3 3 0 0 1 0 6m2 9h3v-2a6 6 0 0 0-4-5.7"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  settings: '<path d="M12 3.4 14 4l1.2 1.5 2.2-.1 1.7 1.7-.1 2.2 1.6 1.2.6 2-.6 2-1.6 1.2.1 2.2-1.7 1.7-2.2-.1L14 21l-2 .6-2-.6-1.2-1.5-2.2.1-1.7-1.7.1-2.2L3.4 14l-.6-2 .6-2L5 8.8l-.1-2.2 1.7-1.7 2.2.1L10 4z"/><circle cx="12" cy="12" r="3"/>',
  external: '<path d="M13 4h7v7M20 4l-9 9"/><path d="M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5"/>'
};
icons.pin = '<path d="m8 3 8 0-1 6 3 4H6l3-4-1-6ZM12 13v8"/>';
icons.list = '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>';
icons.bookmark = '<path d="M6 3h12v18l-6-4-6 4V3Z"/>';
icons.hide = '<path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.8 5.2A10 10 0 0 1 12 5c6 0 10 7 10 7a18 18 0 0 1-3 3.8M6.2 6.2A20 20 0 0 0 2 12s4 7 10 7a11 11 0 0 0 5-1.3"/>';
icons.more = '<circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/>';
icons.close = '<path d="m6 6 12 12M18 6 6 18"/>';
icons.collection = '<rect x="3" y="5" width="15" height="16" rx="2"/><path d="M7 2h12a2 2 0 0 1 2 2v13M7 10h7M7 14h7"/>';
icons.plus = '<path d="M12 5v14M5 12h14"/>';
icons.tag = '<path d="M3 3h8l10 10-8 8L3 11V3Z"/><circle cx="7.5" cy="7.5" r="1"/>';
icons.image = '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5-7 7-3-3-3 3"/>';
icons.curation = '<path d="M3 6h4m6 0h8M3 12h10m6 0h2M3 18h2m6 0h10"/><circle cx="10" cy="6" r="3"/><circle cx="16" cy="12" r="3"/><circle cx="8" cy="18" r="3"/>';
icons.plug = '<path d="M9 3v5m6-5v5M7 8h10v4a5 5 0 0 1-10 0V8Zm5 9v4"/>';
icons.panels = '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 9v12"/>';
icons.palette = '<path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1.4-3.4 1.5 1.5 0 0 1 1.1-2.6H18a3 3 0 0 0 3-3 9 9 0 0 0-9-9Z"/><circle cx="7.5" cy="11" r=".6"/><circle cx="10" cy="7.5" r=".6"/><circle cx="14.5" cy="7.5" r=".6"/><circle cx="17" cy="11" r=".6"/>';
icons.shield = '<path d="m12 3 8 3v6c0 4.6-5.2 7.8-8 9-2.8-1.2-8-4.4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>';
icons.language = '<path d="M3 5h12M9 3v2m3 0c-1 5-4 8-8 10M6 9c2 3 4 5 8 6m0 6 4-10h1l4 10m-7-3h5"/>';
icons.download = '<path d="M12 3v12m-5-5 5 5 5-5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>';
icons.copy = '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>';
const svg = name => `<svg viewBox="0 0 24 24" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">${icons[name]}</svg>`;
const names = { danbooru: 'Danbooru', gelbooru: 'Gelbooru', rule34: 'Rule34', sankaku: 'Sankaku' };
let favoriteTags = [];
const favoriteTagPending = new Set();
const defaultSources = [...CatalogLogic.supportedSources];
const main = document.getElementById('main');
const tabsNode = document.getElementById('tabs');
const searchInput = document.getElementById('search-input');
const popover = document.getElementById('search-popover');
const toastNode = document.getElementById('toast');
const recommendationTagMenu = document.createElement('div');
recommendationTagMenu.className = 'recommendation-tag-menu';
recommendationTagMenu.setAttribute('role', 'menu');
recommendationTagMenu.hidden = true;
document.body.append(recommendationTagMenu);
const tabListPanel = document.createElement('section');
tabListPanel.id = 'tab-list-panel';
tabListPanel.className = 'tab-list-panel';
tabListPanel.setAttribute('role', 'dialog');
tabListPanel.setAttribute('aria-label', 'Открытые вкладки');
tabListPanel.hidden = true;
tabListPanel.innerHTML = '<div class="tab-list-head"><strong>Открытые вкладки</strong><button class="tab-close" type="button" data-tab-list-dismiss aria-label="Закрыть список вкладок">×</button></div><input id="tab-list-search" type="search" autocomplete="off" placeholder="Найти вкладку…" aria-label="Найти вкладку"><div class="tab-list-items"></div><div class="tab-list-footer"><button type="button" data-tab-list-close-lists title="Закрыть все поиски и профили, кроме закреплённых">Закрыть поиски и профили</button><button type="button" data-tab-list-clear title="Закрыть все вкладки, включая закреплённые">Очистить всё</button></div>';
document.body.append(tabListPanel);
const tabContextMenu = document.createElement('div');
tabContextMenu.className = 'tab-context-menu';
tabContextMenu.setAttribute('role', 'menu');
tabContextMenu.hidden = true;
document.body.append(tabContextMenu);
const quickPreview = document.createElement('dialog');
quickPreview.id = 'quick-preview';
quickPreview.className = 'quick-preview';
quickPreview.setAttribute('aria-label', 'Быстрый просмотр изображения');
quickPreview.tabIndex = -1;
document.body.append(quickPreview);
let quickPreviewWork = null;
let quickPreviewPointer = null;
let quickPreviewReturnFocus = null, quickPreviewSpaceHeld = false;
let quickPreviewRenderPending = false;
let quickPreviewGeneration = 0;
let quickPreviewMediaController;
let quickPreviewView = { scale: 1, x: 0, y: 0 };
let quickPreviewDrag = null;
let quickPreviewZoomTimer = null;
let quickPreviewGallery = null;
let quickPreviewGalleryWheel = globalThis.DartPreviewGallery?.wheelGesture();
const tabs = [];
const itemIndex = new Map();
let nextId = 1;
let activeId = null;
let navigation = [];
let navPosition = -1;
let tabPreferences = { artworkTabs: 'preview' };
let viewerPreferences = DartViewerPreferences.normalize();
try { viewerPreferences = DartViewerPreferences.normalize(JSON.parse(localStorage.getItem('dart-viewer-preferences') || 'null')); }
catch { /* Keep both adult ratings and silent video for an existing profile. */ }

function selectedRating(tab) {
  if (tab?.kind === 'favorites' && tab.favoriteType !== 'artwork') return 'all';
  return DartViewerPreferences.rating(tab?.rating || 'general', viewerPreferences);
}

function saveViewerPreferences() {
  try { localStorage.setItem('dart-viewer-preferences', JSON.stringify(viewerPreferences)); }
  catch { /* The profile-backed session writer also persists this choice. */ }
  saveSession();
}

function stopEmptyRatingFeed(tab) {
  if (selectedRating(tab) !== 'none') return false;
  tab.items = []; tab.errors = {}; tab.newKeys = new Set();
  tab.loading = false; tab.hasMore = false; tab.loadError = false;
  tab.followLoadingMore = false; tab.followStreams = []; tab.pausedSources = {};
  tab.recommendationPaused = false;
  if (activeId === tab.id) render();
  return true;
}

function emptyNsfwRatingsMessage() {
  return '<div class="empty" role="status">No NSFW ratings selected. Right-click NSFW to enable Q or NSFW.</div>';
}

function refreshNsfwTabs() {
  const feeds = new Set(tabs);
  for (const route of artworkRoutes) {
    feeds.add(route.source); feeds.add(route.backup);
    if (route.source.rating === 'explicit') {
      route.engine.cancel(); route.warmController?.abort(); route.navigationController?.abort();
    }
  }
  for (const tab of feeds) {
    if (!tab) continue;
    if (tab.rating !== 'explicit' || !['home', 'search', 'recommendations', 'follows', 'profile'].includes(tab.kind)) continue;
    abortTab(tab);
    tab.requestVersion = (tab.requestVersion || 0) + 1;
    tab.recommendationVersion = (tab.recommendationVersion || 0) + 1;
    tab.followVersion = (tab.followVersion || 0) + 1;
    tab.started = false; tab.loading = false; tab.items = []; tab.scrollTop = 0; tab.errors = {};
    tab.followErrors = []; tab.followSourceErrors = {}; tab.followSourceNotices = {};
    tab.retainedFeedWorks = new Map(); tab.virtualState = {};
    tab.artworkLists?.clear();
    for (const key of ['followComputed', 'followPublication', 'followStableRating', 'profileGridItems',
      'profileGridRating', 'curationViews', 'expiredFeedWorks', 'expiredFeedTokens', 'resumePrefetchAt']) delete tab[key];
  }
  startTab(currentTab());
  render();
}
try {
  if (JSON.parse(localStorage.getItem('artcatalog-tab-preferences') || '{}').artworkTabs === 'new')
    tabPreferences.artworkTabs = 'new';
} catch { /* Use preview mode for a fresh profile. */ }
let likes = [];
let likedKeys = new Set();
let bookmarks = [];
let savedKeys = new Set();
let follows = [];
let followedKeys = new Set();
let settings = { userId: '', hasApiKey: false, rule34UserId: '', hasRule34ApiKey: false };
let contentPreferences = { language: globalThis.DartI18n?.language || 'en', aiMode: 'all', hideFurry: false, excludedTags: [], attributionPriority: 'creator',
  hideViewedAndSaved: false, hideFollowedArtists: false, hiddenAuthors: [], curation: CatalogLogic.normalizeCurationPreferences() };
let contentPreferencesSaving = false;
let contentPreferencesRevision = 0;
let privacyStatus = { requested: false, active: false, available: false, error: null };
let privacyLoading = true;
let privacySaving = false;
let privacyRevision = 0;
let sankakuSigningIn = false;
let sankakuLoginError = '';
const sourceKeyHint = source =>
  source === 'gelbooru' && !settings.hasApiKey ||
    source === 'rule34' && !settings.hasRule34ApiKey ? ' · нужен ключ' : '';
let recent = [];
let viewedTokens = new Set();
const viewedPending = new Set();
let toastTimer;
const savedWorkPending = new Set();
let tagSuggestionTimer;
let tagSuggestionController;
let tagSuggestionTerm = '';
let tagSuggestions = [];
let renderedTabsMarkup = '';
let recommendationTagPreferences = {};
let recommendationPreferenceSaveQueue = Promise.resolve();
let recommendationVisitCount = 0;
let recommendationExposure = [];
let recommendationExposureGroups = [];
let recommendationExposureSaveTimer;
let recommendationExposureDirty = false;
const visualHashCache = new Map();
const fingerprintCache = DartFingerprintCache.create({ cacheKey: CatalogLogic.mediaCacheKey });
const visualFingerprintValues = fingerprintCache.images;
const videoFingerprintValues = fingerprintCache.videos;
const clientStateWriter = DartClientState.createWriter({
  storage: localStorage,
  send: async body => {
    const response = await fetch('/api/client-state', { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body, signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  },
  onError: () => toast('Не удалось сохранить состояние. Повторим автоматически.')
});

try { recent = CatalogLogic.filterCatalogItems(JSON.parse(localStorage.getItem('artcatalog-recent') || '[]')); }
catch { recent = []; }

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[ch]);

function normalizeRecommendationTag(value) {
  return String(value || '').normalize('NFKC').toLowerCase()
    .replace(/[_:]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function cleanRecommendationTagPreferences(value) {
  const result = Object.create(null);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
  for (const [rawTag, mode] of Object.entries(value).slice(0, 1000)) {
    const tag = normalizeRecommendationTag(rawTag);
    if (tag.length > 0 && tag.length <= 100 &&
        (mode === 'priority' || mode === 'disabled')) result[tag] = mode;
  }
  return result;
}

try { recommendationTagPreferences = cleanRecommendationTagPreferences(
  JSON.parse(localStorage.getItem('artcatalog-recommendation-tag-preferences') || '{}')); }
catch { recommendationTagPreferences = Object.create(null); }

try { recommendationVisitCount = Math.max(0, Number.parseInt(
  localStorage.getItem('artcatalog-recommendation-visit-count') || '0', 10) || 0); }
catch { recommendationVisitCount = 0; }

function cleanRecommendationExposure(value) {
  return [...new Set((Array.isArray(value) ? value : []).filter(key =>
    typeof key === 'string' && /^(danbooru|gelbooru|rule34|sankaku):[A-Za-z0-9]{1,64}$/.test(key)))].slice(-512);
}
try { recommendationExposure = cleanRecommendationExposure(JSON.parse(
  localStorage.getItem('dart-recommendation-exposure') || '[]')); } catch { /* Empty history is valid. */ }
try {
  const savedGroups = JSON.parse(localStorage.getItem('dart-recommendation-exposure-groups') || 'null');
  recommendationExposureGroups = DartRecommendationExposure.cleanGroups(
    Array.isArray(savedGroups) ? savedGroups : recommendationExposure);
} catch { recommendationExposureGroups = DartRecommendationExposure.cleanGroups(recommendationExposure); }

async function request(path, options = {}) {
  if ((!options.method || options.method === 'GET') && /^\/api\/(search|profile)\?/.test(path)) {
    const [route, query] = path.split('?'), params = new URLSearchParams(query);
    if (params.get('rating') === 'explicit') {
      params.set('rating', DartViewerPreferences.rating('explicit', viewerPreferences));
      path = `${route}?${params}`;
    }
  }
  const changesSources = options.method === 'POST' && /^\/api\/(settings|sankaku\/)/.test(path);
  if (changesSources) clearCatalogResponses();
  const catalog = (!options.method || options.method === 'GET') &&
    /^\/api\/(search|profile|detail)\?/.test(path);
  if (!catalog) {
    try {
      const result = await requestJson(path, options);
      if (changesSources) clearCatalogResponses();
      return result;
    } finally {
      if (/^\/api\/tags(?:\?|$)/.test(path)) globalThis.DartSourceStatus?.schedule();
    }
  }
  request.catalogCache ||= DartResourceCache.create({
    load: (url, signal, scheduling) => requestJson(url, { ...scheduling, signal }),
    ttl: 45000, maxEntries: 60, maxBytes: 8 * 1024 * 1024, timeout: 90000,
    concurrency: 6, foregroundReserve: 1, backgroundConcurrency: 2,
    group: catalogRequestSources, groupConcurrency: 2,
    size: value => JSON.stringify(value).length * 2,
    keep: value => value && !Object.keys(value.errors || {}).length &&
      !Object.keys(value.notices || {}).length,
    key: catalogRequestKey
  });
  if (options.cache === 'reload') request.catalogCache.invalidate(path);
  let result;
  try {
    result = options.cache === 'reload' ? await requestJson(path, options) :
      structuredClone(await request.catalogCache.get(path, options.signal, { priority: options.priority }));
  } finally { globalThis.DartSourceStatus?.schedule(); }
  if (!options.signal?.aborted && (path.startsWith('/api/search?') || path.startsWith('/api/profile?')))
    // Reuse evidence already decoded by visible cards. A catalog response must
    // never wait for every offscreen image before publishing its first row.
    addCatalogVisualHashes(result.items || [], options.signal);
  return result;
}

function catalogRequestKey(path) {
  const [route, query] = path.split('?');
  const params = new URLSearchParams(query);
  if (route === '/api/search') {
    const sources = (params.get('sources') || '').split(',').filter(Boolean).sort();
    if (sources.length) params.set('sources', sources.join(','));
    const pages = (params.get('pages') || '').split(',').filter(Boolean).sort();
    if (pages.length && pages.every(value => value.split(':')[1] === (params.get('page') || '0')))
      params.delete('pages');
    else if (pages.length) params.set('pages', pages.join(','));
  }
  params.sort();
  return `${route}?${params}`;
}

function catalogRequestSources(path) {
  const [route, query] = String(path).split('?');
  if (!['/api/search', '/api/profile', '/api/detail'].includes(route)) return [];
  const params = new URLSearchParams(query);
  return [...new Set((params.get('sources') || params.get('source') || '').split(','))]
    .filter(source => CatalogLogic.supportedSources.includes(source));
}

function clearCatalogResponses() {
  request.catalogCache?.clear();
  tagPreviewController.instance?.clear();
  tagPreviewHistory.cache?.clear();
  tagPreviewHistory.retryAt = 0;
  if (typeof sankakuMediaRecovery !== 'undefined') sankakuMediaRecovery.posts.clear();
  if (typeof transferredMediaHydration !== 'undefined') transferredMediaHydration.reset();
}

async function requestJson(path, options = {}) {
  // Scheduling lanes use foreground/background, while Fetch only accepts
  // high/low/auto. Reloads and uncached requests still use the same transport.
  const { priority, onPriorityChange, ...transportOptions } = options;
  const lane = priority || (options.method && !/^(GET|HEAD)$/i.test(options.method) ? 'foreground' : undefined);
  return catalogTransport().run(async signal => {
    const response = await fetch(path, { ...transportOptions, signal });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw Object.assign(new Error(body.error || `HTTP ${response.status}`),
        { authRequired: !!body.authRequired, status: response.status, retryAt: body.retryAt });
    }
    const result = await response.json();
    if (Array.isArray(result) && /^\/api\/(likes|bookmarks)$/.test(path))
      Object.defineProperty(result, 'savedRevision', {
        value: response.headers?.get('X-DART-Saved-Revision') || '' });
    if (Array.isArray(result?.items)) result.items = CatalogLogic.filterCatalogItems(result.items);
    return result;
  }, options.signal, { priority: lane, onPriorityChange, group: catalogRequestSources(path) });
}

function readMediaBlob(url, signal, options = {}) {
  readMediaBlob.cache ||= DartResourceCache.create({
    key: CatalogLogic.mediaCacheKey, ttl: 5 * 60 * 1000,
    maxEntries: 256, maxBytes: 16 * 1024 * 1024, size: blob => blob.size,
    concurrency: 4, timeout: 25000, foregroundReserve: 1, backgroundConcurrency: 2,
    load: (url, signal, scheduling) => catalogTransport().run(async transportSignal => {
      const response = await fetch(`/api/image?url=${encodeURIComponent(url)}`, { signal: transportSignal });
      if (!response.ok) throw new Error('Image unavailable');
      return response.blob();
    }, signal, scheduling)
  });
  return readMediaBlob.cache.get(url, signal, options);
}

function catalogTransport() {
  // JSON and image bodies share one origin with native video elements. Keep
  // their combined occupancy below the browser's six HTTP/1 connections.
  return catalogTransport.queue ||= DartResourceCache.createTransport();
}

const visualHashJobs = [];
let activeVisualHashJobs = 0;
function runVisualHashJob(job, signal) {
  return new Promise(resolve => {
    if (signal?.aborted) { resolve(''); return; }
    const queued = { job, resolve, signal };
    visualHashJobs.push(queued);
    const cancelled = () => {
      const index = visualHashJobs.indexOf(queued);
      if (index >= 0) { visualHashJobs.splice(index, 1); queued.resolve(''); }
    };
    queued.resolve = value => { signal?.removeEventListener('abort', cancelled); resolve(value); };
    signal?.addEventListener('abort', cancelled, { once: true });
    const drain = () => {
      while (activeVisualHashJobs < 4 && visualHashJobs.length) {
        const entry = visualHashJobs.shift();
        if (entry.signal?.aborted) { entry.resolve(''); continue; }
        activeVisualHashJobs++;
        Promise.resolve().then(entry.job).catch(() => '').then(entry.resolve).finally(() => {
          activeVisualHashJobs--; drain();
        });
      }
    };
    drain();
  });
}

function catalogBitmapFingerprint(bitmap) {
  const canvas = document.createElement('canvas');
  canvas.width = 9;
  canvas.height = 8;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(bitmap, 0, 0, 9, 8);
  const pixels = context.getImageData(0, 0, 9, 8).data;
  const lightness = index => 0.299 * pixels[index] +
    0.587 * pixels[index + 1] + 0.114 * pixels[index + 2];
  let hash = '';
  for (let row = 0; row < 8; row++)
    for (let col = 0; col < 8; col += 4) {
      let nibble = 0;
      for (let bit = 0; bit < 4; bit++) {
        const left = (row * 9 + col + bit) * 4;
        nibble = nibble * 2 + Number(lightness(left + 4) > lightness(left));
      }
      hash += nibble.toString(16);
    }
  canvas.width = canvas.height = 32;
  context.drawImage(bitmap, 0, 0, 32, 32);
  const rgba = context.getImageData(0, 0, 32, 32).data;
  return { hash, perceptualHash: CatalogLogic.perceptualImageHash(rgba),
    layout: globalThis.DartVisualLayout?.fingerprint(rgba) || '',
    aspectRatio: (bitmap.naturalWidth || bitmap.width) / (bitmap.naturalHeight || bitmap.height) };
}

async function catalogThumbnailFingerprint(url, signal) {
  const key = CatalogLogic.mediaCacheKey(url);
  if (!visualHashCache.has(key)) {
    const pending = runVisualHashJob(async () => {
      const blob = typeof imageLoader !== 'undefined' && imageLoader.cached(url)?.blob ||
        await readMediaBlob(url, signal ? AbortSignal.any([signal, AbortSignal.timeout(5000)]) : AbortSignal.timeout(5000), { priority: 'background' });
      if (signal?.aborted) return '';
      const bitmap = await createImageBitmap(blob);
      try {
        if (typeof imageLoader !== 'undefined') imageLoader.rememberBlob(url, blob);
        return catalogBitmapFingerprint(bitmap);
      }
      finally { bitmap.close(); }
    }, signal).then(hash => {
      if (!hash) visualHashCache.delete(key);
      else {
        visualFingerprintValues.set(key, hash);
        while (visualFingerprintValues.size > 2000) visualFingerprintValues.delete(visualFingerprintValues.keys().next().value);
      }
      return hash;
    });
    visualHashCache.set(key, pending);
    while (visualHashCache.size > 2000) visualHashCache.delete(visualHashCache.keys().next().value);
  }
  return visualHashCache.get(key);
}

let cardFingerprintTimer;
async function rememberCardFingerprint(img) {
  const card = img.closest?.('.card[data-work-key]');
  const item = card && itemIndex.get(card.dataset.workKey);
  if (!item || !img.naturalWidth || !CatalogLogic.needsVisualFingerprint(item) ||
      item.visualPHash && (item.visualLayout || !globalThis.DartVisualLayout ||
        visualFingerprintValues.get(CatalogLogic.mediaCacheKey(item.thumbnail))?.layout === '') || img.dataset.fingerprintPending) return;
  img.dataset.fingerprintPending = 'true';
  // Always decode through the same ImageBitmap path: DOM image downscaling
  // can produce different hashes even from identical cached bytes.
  const fingerprint = await catalogThumbnailFingerprint(item.thumbnail);
  delete img.dataset.fingerprintPending;
  if (!fingerprint) return;
  const update = { visualHash: fingerprint.hash, visualPHash: fingerprint.perceptualHash,
    visualAspectRatio: fingerprint.aspectRatio,
    ...(fingerprint.layout ? { visualLayout: fingerprint.layout } : {}) };
  publishCardEvidence(item, update, img);
}

function publishCardEvidence(item, update, img) {
  Object.assign(item, update);
  // Old saved works gain evidence from thumbnails that are already visible;
  // opening Liked must not download the whole saved collection up front.
  // Following rebuilds from provider records and a worker-result cache. Keep
  // the evidence in those backing records too, so the next arriving page
  // cannot split already recognized versions back into separate cards.
  const lists = new Set([likes, bookmarks, recent, ...tabs.flatMap(tab => [
    tab.items, tab.related, tab.creatorWorks, tab.followComputed?.feed?.items,
    ...(tab.followGroups || []).map(group => group.items)
  ])]);
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    const enriched = [];
    for (const candidate of list) if (candidate.key === item.key) {
      Object.assign(candidate, update); enriched.push(candidate);
    }
    if (enriched.length) CatalogLogic.refineGrouping(list, enriched);
  }
  if (!img.isConnected) return;
  clearTimeout(cardFingerprintTimer);
  const tab = currentTab();
  cardFingerprintTimer = setTimeout(() => {
    if (currentTab() !== tab) return;
    const bounds = main.getBoundingClientRect();
    const anchor = [...main.querySelectorAll('.card[data-work-key]')]
      .find(node => node.getBoundingClientRect().bottom > bounds.top);
    const key = anchor?.dataset.workKey, top = anchor?.getBoundingClientRect().top;
    render();
    const next = [...main.querySelectorAll('.card[data-work-key]')].find(node =>
      node.dataset.workKey === key || itemIndex.get(node.dataset.workKey)?.memberKeys?.includes(key));
    if (next && top !== undefined) main.scrollTop += next.getBoundingClientRect().top - top;
    if (tab.kind === 'follows') saveFollowPreview(tab, tab.followVersion);
  }, 120);
}

function addCatalogVisualHashes(items, signal) {
  if (signal?.aborted) return;
  for (const item of items) {
      const key = CatalogLogic.mediaCacheKey(item.thumbnail);
      if (key && /^[a-f0-9]{16}$/i.test(item.visualHash || '') &&
          /^[a-f0-9]{16}$/i.test(item.visualPHash || '') && item.visualAspectRatio > 0 &&
          Number.isFinite(item.visualAspectRatio) && (item.visualLayout || !globalThis.DartVisualLayout) && !visualFingerprintValues.has(key)) {
        visualFingerprintValues.set(key, { hash: item.visualHash, perceptualHash: item.visualPHash,
          aspectRatio: item.visualAspectRatio, layout: item.visualLayout || '' });
        while (visualFingerprintValues.size > 2000) visualFingerprintValues.delete(visualFingerprintValues.keys().next().value);
      }
      const fingerprint = visualFingerprintValues.get(key);
      if (fingerprint) {
        item.visualHash = fingerprint.hash;
        item.visualPHash = fingerprint.perceptualHash;
        item.visualAspectRatio = fingerprint.aspectRatio;
        if (fingerprint.layout) item.visualLayout = fingerprint.layout;
      }
      if (typeof videoFingerprintValues !== 'undefined') {
        const videos = (item.images || []).filter(CatalogLogic.videoMimeType)
          .map(url => videoFingerprintValues.get(CatalogLogic.mediaCacheKey(url))).filter(Boolean);
        if (videos.length) item.videoSamples = [...new Map([...(item.videoSamples || []), ...videos]
          .map(sample => [CatalogLogic.mediaCacheKey(sample.url), sample])).values()].slice(-20);
      }
  }
}

function toast(message) {
  toastNode.textContent = globalThis.DartI18n?.translate(message) || message;
  toastNode.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastNode.classList.remove('visible'), 3000);
}

function findTab(id) { return tabs.find(tab => tab.id === id); }
function currentTab() { return findTab(activeId); }
const rememberedInputs = new WeakMap();
function rememberItem(item) {
  if (!item?.key) return item;
  const previous = itemIndex.get(item.key);
  if (previous === item) return item;
  const cached = rememberedInputs.get(item);
  const fields = Object.entries(item).flatMap(([key, value]) => Array.isArray(value)
    ? [key, value, value.length] : [key, value]);
  if (cached && cached.result === previous && fields.length === cached.fields.length &&
      fields.every((value, index) => value === cached.fields[index])) return previous;
  const remembered = CatalogLogic.mergeWorkMetadata(previous, item);
  itemIndex.set(item.key, remembered);
  rememberedInputs.set(item, { result: remembered, fields });
  return remembered;
}
function rememberItems(items) { items.forEach(rememberItem); }

function creatorActionData(item, participant) {
  const attribution = CatalogLogic.workAttribution(item);
  const creator = participant || attribution.creator || attribution.participants[0];
  if (!creator) return '';
  return `${authorContextData({ source: 'artist', artistId: creator.follow.artistId, name: creator.name })} data-creator-id="${escapeHtml(creator.follow.artistId)}" data-creator-name="${escapeHtml(creator.name)}" data-creator-role="${escapeHtml(creator.participantRole)}" data-creator-source="${escapeHtml(item.source)}" data-creator-rating="${escapeHtml(item.rating || '')}"`;
}

function authorContextData(author) {
  if (!CatalogLogic.hiddenAuthorKey(author)) return '';
  return `data-context-author-source="${escapeHtml(author.source)}" data-context-author-id="${escapeHtml(author.artistId)}" data-context-author-name="${escapeHtml(author.name || author.artistId)}"`;
}

function workAuthorContextData(item, primary) {
  const attribution = CatalogLogic.workAttribution(item);
  if (['creator', 'contributor'].includes(primary.role)) {
    const person = attribution.creator || attribution.participants[0];
    return authorContextData({ source: 'artist', artistId: person?.tag, name: person?.name });
  }
  if (primary.role === 'uploader') return authorContextData({ source: item.source,
    artistId: item.uploaderId || (item.source !== 'danbooru' ? item.artistId : ''), name: primary.name });
  if (primary.role === 'unknown' && item.followedArtistTag)
    return authorContextData({ source: 'artist', artistId: item.followedArtistTag,
      name: item.followedArtistName || item.followedArtistTag });
  return '';
}

function itemForControl(control) {
  const data = control.dataset;
  const item = itemIndex.get(data.key);
  if (!data.creatorId || !['creator-profile', 'attribution-primary'].includes(data.action)) return item;
  // The button must open the creator displayed when it was rendered, even after another tab loads.
  return { ...item, key: data.key, source: data.creatorSource,
    rating: item?.rating || data.creatorRating || '', creatorTag: data.creatorId,
    creatorName: data.creatorName, profileParticipantTag: data.creatorId,
    participants: [{ tag: data.creatorId, name: data.creatorName,
      role: data.creatorRole || CatalogLogic.participantRole(data.creatorId) },
      ...(item?.participants || []).filter(person => person.tag !== data.creatorId)] };
}

function captureClientState() {
  if (typeof flushRecommendationExposure === 'function') flushRecommendationExposure(false);
  if (currentTab() && main.dataset.tabId === String(activeId)) currentTab().scrollTop = main.scrollTop;
  const descriptors = tabs.map(tab => ({
    kind: tab.kind, title: tab.title, query: tab.query || '',
    searchQuery: tab.kind === 'detail' ? tab.searchQuery || '' : undefined,
    selectedSources: tab.selectedSources, rating: tab.rating || 'general',
    sort: CatalogLogic.catalogSort(tab), feed: tab.feed || 'illustrations',
    item: tab.kind === 'detail' ? tab.item : undefined,
    profileRef: tab.kind === 'profile' ? tab.profileRef : undefined,
    settingsSection: tab.kind === 'settings' ? tab.settingsSection || 'content' : undefined,
    favoriteType: tab.kind === 'favorites' ? tab.favoriteType || 'character' : undefined,
    favoriteOrigin: tab.kind === 'favorites' ? tab.favoriteOrigin || 'mine' : undefined,
    followOrder: tab.kind === 'follows' ? tab.followOrder === 'random' ? 'random' : 'date' : undefined,
    followRandomSeed: tab.kind === 'follows' ? Number.isInteger(tab.followRandomSeed) &&
      tab.followRandomSeed >= 0 && tab.followRandomSeed <= 0xffffffff ? tab.followRandomSeed : 0 : undefined,
    preview: !!tab.preview, pinned: !!tab.pinned, scrollTop: tab.scrollTop || 0
  }));
  const session = { tabs: descriptors, savedWorksVersion: 1, activeIndex: tabs.findIndex(tab => tab.id === activeId),
    tabPreferences: { ...tabPreferences }, viewerPreferences };
  const sessionBody = JSON.stringify(session);
  try {
    if (captureClientState.sessionBody !== sessionBody) {
      localStorage.setItem('artcatalog-session', sessionBody);
      captureClientState.sessionBody = sessionBody;
    }
  }
  catch { /* Browser storage may be unavailable. */ }
  const state = { session, themePreference: globalThis.DartTheme?.preference || 'system',
      favoriteActivityOutbox: typeof favoritesController === 'function' ? favoritesController.instance?.outboxSnapshot() || [] : [],
      recent, searchHistory: getSearchHistory(), recommendationExposure, recommendationExposureGroups,
      mediaDuplicatePairs: detailImageDeduper.duplicates.entries(),
      mediaVerifiedImages: [...detailImageDeduper.verified],
      fingerprintEvidence: typeof fingerprintCache !== 'undefined' ? fingerprintCache.snapshot() : undefined };
  return typeof DartClientState !== 'undefined' && DartClientState.snapshot
    ? DartClientState.snapshot(state, sessionBody) : state;
}

function saveSession() {
  if (!tabs.length) return Promise.resolve(true);
  return clientStateWriter.saveLater
    ? clientStateWriter.saveLater(captureClientState) : clientStateWriter.save(captureClientState());
}

function flushClientState() {
  return tabs.length ? clientStateWriter.save(captureClientState()) : Promise.resolve(true);
}

async function saveRecommendationTagPreference(tag, mode) {
  const pending = recommendationPreferenceSaveQueue.then(() =>
    request('/api/recommendation-tag-preferences', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag, mode })
    }));
  recommendationPreferenceSaveQueue = pending.catch(() => {});
  const response = await pending;
  recommendationTagPreferences = cleanRecommendationTagPreferences(response.preferences);
  try { localStorage.setItem('artcatalog-recommendation-tag-preferences',
    JSON.stringify(recommendationTagPreferences)); } catch { /* Storage may be unavailable. */ }
}

async function loadRecommendationTagPreferences() {
  try {
    const state = await request('/api/recommendation-tag-preferences');
    const server = cleanRecommendationTagPreferences(state.preferences);
    if (state.initialized) recommendationTagPreferences = server;
    else {
      recommendationTagPreferences = { ...server, ...recommendationTagPreferences };
      for (const [tag, mode] of Object.entries(recommendationTagPreferences))
        await saveRecommendationTagPreference(tag, mode);
    }
    localStorage.setItem('artcatalog-recommendation-tag-preferences',
      JSON.stringify(recommendationTagPreferences));
  } catch { /* Existing local choices remain available if the server is unavailable. */ }
}

async function loadClientState() {
  try {
    const saved = await request('/api/client-state');
    const pending = clientStateWriter.readPending();
    const state = CatalogLogic.cleanClientState(pending || saved);
    favoritesController().restoreOutbox(state.favoriteActivityOutbox);
    if (pending) void clientStateWriter.save(pending);
    if (Array.isArray(state.recommendationExposure)) {
      recommendationExposure = cleanRecommendationExposure(state.recommendationExposure);
      localStorage.setItem('dart-recommendation-exposure', JSON.stringify(recommendationExposure));
    }
    recommendationExposureGroups = DartRecommendationExposure.cleanGroups(
      Array.isArray(state.recommendationExposureGroups) ? state.recommendationExposureGroups :
        [...recommendationExposureGroups, ...recommendationExposure]);
    localStorage.setItem('dart-recommendation-exposure-groups', JSON.stringify(recommendationExposureGroups));
    detailImageDeduper.duplicates.restore(state.mediaDuplicatePairs);
    fingerprintCache.restore(state.fingerprintEvidence);
    for (const key of (Array.isArray(state.mediaVerifiedImages) ? state.mediaVerifiedImages : []).slice(-256))
      if (typeof key === 'string' && key.length <= 1000 && /^https?:\/\//i.test(key)) detailImageDeduper.verified.add(key);
    if (['system', 'light', 'dark', 'list'].includes(state.themePreference))
      globalThis.DartTheme?.setPreference(state.themePreference);
    if (state.session?.tabs?.length)
      localStorage.setItem('artcatalog-session', JSON.stringify(state.session));
    if (Array.isArray(state.recent)) {
      recent = CatalogLogic.filterCatalogItems(state.recent).slice(0, 40);
      localStorage.setItem('artcatalog-recent', JSON.stringify(recent));
    }
    if (Array.isArray(state.searchHistory))
      localStorage.setItem('artcatalog-search-history',
        JSON.stringify(state.searchHistory.slice(0, 12)));
  } catch { /* A fresh profile can start without saved client state. */ }
}

function startTab(tab) {
  if (tab?.kind === 'favorites') { tab.started = true; void favoritesController().load(tab); return; }
  if (!tab || tab.started) return;
  tab.started = true;
  if (tab.kind === 'home' || tab.kind === 'search') loadSearch(tab);
  if (tab.kind === 'bookmarks') loadBookmarks(tab);
  if (tab.kind === 'likes') loadLikes(tab);
  if (tab.kind === 'recommendations') loadRecommendations(tab);
  if (tab.kind === 'follows') loadFollowFeed(tab);
  if (tab.kind === 'settings') { loadSettings(); loadContentPreferences(); loadPrivacyStatus(); }
  if (tab.kind === 'detail') loadDetail(tab);
  if (tab.kind === 'profile') loadProfile(tab);
}

function restoreSession() {
  let session;
  try { session = CatalogLogic.cleanClientState({ session: JSON.parse(localStorage.getItem('artcatalog-session') || 'null') }).session; }
  catch { return false; }
  if (session?.viewerPreferences)
    viewerPreferences = DartViewerPreferences.normalize(session.viewerPreferences);
  if (!session || !Array.isArray(session.tabs) || !session.tabs.length) return false;
  if (session.tabPreferences)
    tabPreferences.artworkTabs = session.tabPreferences.artworkTabs === 'new' ? 'new' : 'preview';
  const allowed = new Set(['home', 'search', 'detail', 'profile', 'bookmarks', 'likes',
    'recommendations', 'follows', 'favorites', 'recent', 'settings']);
  let hasPreview = false, hasListPreview = false;
  for (const saved of session.tabs) {
    if (!allowed.has(saved.kind) || saved.kind === 'detail' && !saved.item?.key) continue;
    if (saved.kind === 'profile' && !saved.profileRef?.artist) continue;
    const selectedSources = Array.isArray(saved.selectedSources)
      ? saved.selectedSources.filter(source => names[source]) : [...defaultSources];
    tabs.push({ id: nextId++, kind: saved.kind,
      title: saved.kind === 'search' && !saved.query && saved.title === '18+ иллюстрации'
        ? 'NSFW иллюстрации' : String(saved.title || 'Вкладка').slice(0, 160),
      query: String(saved.query || '').slice(0, 200),
      searchQuery: String(saved.searchQuery || '').slice(0, 200),
      selectedSources,
      rating: ['general', 'explicit', 'all'].includes(saved.rating) ? saved.rating : 'general',
      sort: CatalogLogic.catalogSort(saved),
      feed: 'illustrations',
      item: saved.item?.key ? rememberItem(saved.item) : saved.item,
      profileRef: saved.profileRef,
      favoriteType: ['tag', 'artwork'].includes(saved.favoriteType) ? saved.favoriteType : 'character',
      favoriteOrigin: saved.favoriteOrigin === 'system' ? 'system' : 'mine',
      ...(saved.kind === 'follows' ? {
        followOrder: saved.followOrder === 'random' ? 'random' : 'date',
        followRandomSeed: Number.isInteger(saved.followRandomSeed) && saved.followRandomSeed >= 0 &&
          saved.followRandomSeed <= 0xffffffff ? saved.followRandomSeed : 0
      } : {}),
      settingsSection: ['content', 'curation', 'authors', 'sources', 'tabs', 'appearance', 'language', 'privacy', 'transfer', 'upscale'].includes(saved.settingsSection)
        ? saved.settingsSection : 'content',
      items: [], errors: {}, page: 0,
      loading: false, started: false,
      scrollTop: Math.max(0, Number(saved.scrollTop) || 0),
      pinned: !!saved.pinned,
      preview: !!saved.preview && !saved.pinned &&
        (saved.kind === 'detail' ? !hasPreview : (saved.kind === 'search' || saved.kind === 'profile') && !hasListPreview) });
    if (saved.kind === 'detail') hasPreview ||= tabs.at(-1).preview;
    else if (saved.kind === 'search' || saved.kind === 'profile') hasListPreview ||= tabs.at(-1).preview;
  }
  if (!tabs.length) return false;
  const selected = Math.max(0, Math.min(tabs.length - 1, Number(session.activeIndex) || 0));
  activeId = tabs[selected].id;
  navigation = [navigationEntry(currentTab())];
  navPosition = 0;
  render();
  startTab(currentTab());
  return true;
}

function matchingTab(kind, extra) {
  const sameSources = tab => [...(tab.selectedSources || defaultSources)].sort().join(',') ===
    [...(extra.selectedSources || defaultSources)].sort().join(',');
  return tabs.find(tab => {
    if (tab.kind !== kind) return false;
    if (['home', 'bookmarks', 'likes', 'follows', 'recommendations', 'favorites', 'recent', 'settings'].includes(kind)) return true;
    if (kind === 'search') return (tab.query || '') === (extra.query || '') &&
      tab.rating === (extra.rating || 'general') && tab.sort === CatalogLogic.catalogSort(extra) &&
      tab.feed === (extra.feed || 'illustrations') && sameSources(tab);
    if (kind === 'profile') return tab.profileRef?.source === extra.profileRef?.source &&
      tab.profileRef?.artist === extra.profileRef?.artist &&
      tab.rating === (extra.rating || 'general');
    return false;
  });
}

function createTab(kind, title, extra = {}, options = {}) {
  const existing = !options.forceNew && matchingTab(kind, extra);
  if (existing) { if (!options.background) activate(existing.id); return existing; }
  const replaced = options.replace && tabs.includes(options.replace) ? options.replace : null;
  const tab = { id: replaced ? replaced.id : nextId++, kind, title, items: [], errors: {}, page: 0,
    loading: false, scrollTop: 0, selectedSources: [...defaultSources],
    rating: 'general', sort: 'recent', feed: 'illustrations', ...extra };
  tab.sort = CatalogLogic.catalogSort(tab);
  delete tab.curationBaseSort;
  if (replaced) {
    abortTab(replaced);
    tabs[tabs.indexOf(replaced)] = tab;
    if (activeId === replaced.id) activeId = null;
    main.dataset.tabId = '';
    if (options.background) { render(); saveSession(); }
    else activate(tab.id);
    return tab;
  }
  tabs.push(tab);
  if (options.background) { render(); saveSession(); }
  else activate(tab.id);
  return tab;
}

function openSettings(section = 'content') {
  const existing = tabs.find(tab => tab.kind === 'settings');
  if (existing) {
    existing.settingsSection = section;
    if (existing.id === activeId) render();
    else activate(existing.id);
    if (section === 'privacy') loadPrivacyStatus();
  } else createTab('settings', 'Настройки', { settingsSection: section });
}

// Artworks and temporary search/profile tabs are replaced in place, so history
// keeps the exact view object that was shown rather than only the tab id.
function trackedView(tab) {
  return !!tab && (tab.kind === 'detail' || !!tab.preview && (tab.kind === 'search' || tab.kind === 'profile'));
}

function navigationEntry(tab) {
  return { id: tab.id, view: trackedView(tab) ? tab : null };
}

function recordDetailVisit(tab) {
  for (const key of [tab.item.key, ...(tab.item.memberKeys || [])])
    tab.artworkRoute?.visitedKeys?.add(key);
  recent = [tab.item, ...recent.filter(entry => entry.key !== tab.item.key)].slice(0, 40);
  localStorage.setItem('artcatalog-recent', JSON.stringify(recent));
  void recordViewedWorks([tab.item]);
  favoritesController().record(tab.item);
}

function abortTab(tab) {
  for (const key of ['search', 'profile', 'detail', 'creator', 'related', 'recommendation', 'follow'])
    tab[`${key}Controller`]?.abort();
  if (tab.detailLoading) { tab.started = false; tab.detailLoading = false; }
  if (tab.creatorLoading) { tab.creatorStarted = false; tab.creatorLoading = false; }
  if (tab.relatedLoading) { tab.relatedInterrupted = true; tab.relatedLoading = false; }
  tab.relatedVersion = (tab.relatedVersion || 0) + 1;
  if (tab.followRetryTimer) clearTimeout(tab.followRetryTimer);
  if (tab.rule34RecoveryTimer) clearTimeout(tab.rule34RecoveryTimer);
}

function activate(id, record = true, view = null, keepQuickPreview = false) {
  tagPreviewController.instance?.hide();
  if (!findTab(id)) return;
  if (activeId === id && (!view || view === currentTab())) return;
  if (!keepQuickPreview) closeQuickPreview();
  hideTabPanels();
  const previous = currentTab();
  previous?.artworkRoute?.engine.cancel();
  previous?.artworkRoute?.navigationController?.abort();
  previous?.artworkRoute?.warmController?.abort();
  if (previous) {
    previous.scrollTop = main.scrollTop;
    delete previous.expiredFeedWorks;
    delete previous.expiredFeedTokens;
  }
  if (view && view !== findTab(id)) {
    abortTab(findTab(id));
    tabs[tabs.findIndex(tab => tab.id === id)] = view;
    main.dataset.tabId = '';
  }
  activeId = id;
  if (currentTab()?.started) currentTab().resumePrefetchAt = currentTab().scrollTop || 0;
  if (record) {
    navigation = navigation.slice(0, navPosition + 1);
    navigation.push(navigationEntry(currentTab()));
    navPosition = navigation.length - 1;
  }
  render();
  main.scrollTop = currentTab()?.scrollTop || 0;
  const selected = currentTab();
  if (selected?.artworkRoute) {
    selected.artworkRoute.engine.select(selected.item);
    if (selected.artworkRoute.list !== 'related' || selected.artworkRoute.source !== selected)
      warmArtworkRoute(selected.artworkRoute);
  }
  if (selected?.kind === 'detail') recordDetailVisit(selected);
  const wasStarted = selected?.started;
  startTab(selected);
  if (selected?.kind === 'follows') {
    scheduleFollowRetry(selected);
    if (wasStarted && !selected.loading && selected.followGroups?.length)
      void markFollowItemsSeen(selected, selected.followGroups, selected.followVersion);
  }
  if (wasStarted && selected?.kind === 'detail') {
    if (!selected.creatorStarted) loadCreatorWorks(selected);
    if (selected.relatedInterrupted) {
      selected.relatedInterrupted = false;
      loadRelated(selected, true);
    }
  }
  saveSession();
}

function closeTab(id) {
  const index = tabs.findIndex(tab => tab.id === id);
  if (index < 0) return;
  const wasActive = activeId === id;
  if (wasActive) {
    tabs[index].artworkRoute?.engine.cancel();
    tabs[index].artworkRoute?.navigationController?.abort();
    tabs[index].artworkRoute?.warmController?.abort();
  }
  abortTab(tabs[index]);
  tabs.splice(index, 1);
  const removedBefore = navigation.slice(0, navPosition + 1).filter(entry => entry.id === id).length;
  navigation = navigation.filter(entry => entry.id !== id);
  navPosition = Math.max(-1, navPosition - removedBefore);
  if (wasActive) {
    const successor = tabs[Math.max(0, index - 1)] || tabs[0];
    if (!successor) {
      activeId = null; createTab('home', 'Главная'); pruneArtworkRoutes(); return;
    }
    if (!sameNavigationView(navigation[navPosition], successor)) {
      navigation = navigation.slice(0, navPosition + 1);
      navigation.push(navigationEntry(successor));
      navPosition = navigation.length - 1;
    }
    activate(successor.id, false);
    pruneArtworkRoutes();
    return;
  }
  render();
  startTab(currentTab());
  saveSession();
  pruneArtworkRoutes();
}

function sameNavigationView(entry, tab) {
  return !!tab && entry?.id === tab.id && (!trackedView(tab) || entry.view === tab);
}

function navigationTarget(direction) {
  const current = currentTab();
  for (let target = navPosition + direction; target >= 0 && target < navigation.length; target += direction)
    if (findTab(navigation[target].id) && !sameNavigationView(navigation[target], current)) return target;
  return -1;
}

function travel(direction) {
  const target = navigationTarget(direction);
  if (target < 0) return;
  navPosition = target;
  activate(navigation[target].id, false, navigation[target].view);
  renderChrome();
}

function pinTab(id, pinned = true) {
  const tab = findTab(id);
  if (!tab) return;
  tab.pinned = pinned;
  tab.preview = false;
  for (const entry of navigation.filter(entry => entry.id === id)) {
    if (entry.view) { entry.view.pinned = pinned; entry.view.preview = false; }
  }
  render(); saveSession();
}

function closeOtherTabs(id, mode) {
  const index = tabs.findIndex(tab => tab.id === id);
  if (index < 0) return;
  const closing = tabs.filter((tab, position) => tab.id !== id && !tab.pinned &&
    (mode === 'others' || position > index)).map(tab => tab.id);
  if (closing.includes(activeId)) activate(id);
  for (const closedId of closing) closeTab(closedId);
}

// A search or profile opened from inside an artwork behaves like the single
// temporary artwork tab: the next one replaces it, and Back returns to the
// previous page. Shift+click or the middle button keeps a permanent tab.
function openTemporaryTab(kind, title, extra = {}, options = {}) {
  const existing = matchingTab(kind, extra);
  if (existing) {
    if (options.separate && existing.preview) pinTab(existing.id);
    if (!options.background) activate(existing.id);
    return existing;
  }
  const temporary = !!options.temporary && !options.separate && tabPreferences.artworkTabs === 'preview';
  if (!temporary) return createTab(kind, title, extra, { background: !!options.background });
  const from = currentTab();
  if (from) from.scrollTop = main.scrollTop;
  const slot = tabs.find(tab => (tab.kind === 'search' || tab.kind === 'profile') && tab.preview && !tab.pinned);
  return createTab(kind, title, { ...extra, preview: true }, { replace: slot, background: !!options.background });
}

function closeSearchAndProfileTabs() {
  const doomed = new Set(tabs.filter(tab => (tab.kind === 'search' || tab.kind === 'profile') && !tab.pinned)
    .map(tab => tab.id));
  if (!doomed.size) return 0;
  const activeClosed = doomed.has(activeId);
  for (const tab of tabs) if (doomed.has(tab.id)) abortTab(tab);
  for (let index = tabs.length - 1; index >= 0; index--)
    if (doomed.has(tabs[index].id)) tabs.splice(index, 1);
  const removedBefore = navigation.slice(0, navPosition + 1).filter(entry => doomed.has(entry.id)).length;
  navigation = navigation.filter(entry => !doomed.has(entry.id));
  navPosition = Math.max(-1, navPosition - removedBefore);
  if (activeClosed) {
    activeId = null;
    const successor = tabs.find(tab => tab.kind === 'home') || tabs[0];
    if (successor) activate(successor.id);
    else createTab('home', 'Главная');
  } else { render(); saveSession(); }
  pruneArtworkRoutes();
  return doomed.size;
}

function clearTabs() {
  for (const tab of tabs) abortTab(tab);
  tabs.length = 0;
  navigation = [];
  navPosition = -1;
  activeId = null;
  createTab('home', 'Главная');
  pruneArtworkRoutes();
}

function changeTabsFromList(change, clearQuery = false) {
  const input = tabListPanel.querySelector('input');
  const query = clearQuery ? '' : input.value;
  change();
  // Creating a replacement home tab normally dismisses navigation panels.
  tabListPanel.hidden = false;
  document.getElementById('tab-list-button').setAttribute('aria-expanded', 'true');
  input.value = query;
  renderTabList();
  if (clearQuery || !tabListPanel.contains(document.activeElement)) input.focus();
}

function hideTabPanels() {
  tabListPanel.hidden = true;
  tabContextMenu.hidden = true;
  document.getElementById('tab-list-button').setAttribute('aria-expanded', 'false');
}

function renderTabList() {
  if (tabListPanel.hidden) return;
  const list = tabListPanel.querySelector('.tab-list-items');
  const query = tabListPanel.querySelector('input').value.trim().toLocaleLowerCase();
  const labels = { home: 'Главная', search: 'Поиск', detail: 'Работа', profile: 'Автор',
    bookmarks: 'Закладки', likes: 'Понравившиеся', follows: 'Подписки', recommendations: 'Рекомендации',
    recent: 'История', settings: 'Настройки' };
  const matching = tabs.filter(tab => `${tabHasCatalogTitle(tab) ? tab.title :
    globalThis.DartI18n?.translate(tab.title) || tab.title} ${tab.query || ''}`.toLocaleLowerCase().includes(query));
  const markup = matching.map(tab => {
    const thumbnail = tab.kind === 'detail' && tab.item.thumbnail;
    const subtitle = [tab.pinned ? 'Закреплена' : tab.preview ? 'Временный просмотр' : labels[tab.kind],
      tab.item ? names[tab.item.source] : ''].filter(Boolean).join(' · ');
    return `<div class="tab-list-row ${tab.id === activeId ? 'active' : ''}">
      <button type="button" class="tab-list-select" data-tab-select="${tab.id}" ${tabHasCatalogTitle(tab) ? `data-i18n-keep="${escapeHtml(JSON.stringify([tab.title]))}"` : ''} aria-label="Перейти: ${escapeHtml(tab.title)}">
        ${thumbnail ? `<img src="/api/image?url=${encodeURIComponent(thumbnail)}" loading="lazy" alt="">` : `<span class="tab-list-placeholder">${svg(tab.kind === 'settings' ? 'settings' : tab.kind === 'detail' ? 'grid' : 'file')}</span>`}
        <span class="tab-list-description"><strong${tabHasCatalogTitle(tab) ? ' data-no-i18n' : ''}>${escapeHtml(tab.title)}</strong><small>${escapeHtml(subtitle)}</small></span></button>
      <button class="tab-close" type="button" data-tab-list-close="${tab.id}" ${tabHasCatalogTitle(tab) ? `data-i18n-keep="${escapeHtml(JSON.stringify([tab.title]))}"` : ''} aria-label="Закрыть ${escapeHtml(tab.title)}">×</button></div>`;
  }).join('') || '<p class="tab-list-empty">Вкладки не найдены</p>';
  if (list.innerHTML === markup) return;
  const scrollTop = list.scrollTop;
  const controls = [...list.querySelectorAll('[data-tab-list-close], [data-tab-select]')];
  const focused = document.activeElement;
  const position = controls.indexOf(focused);
  const action = position >= 0 && (focused.hasAttribute('data-tab-list-close')
    ? 'data-tab-list-close' : 'data-tab-select');
  const id = action && focused.getAttribute(action);
  const sameAction = action ? [...list.querySelectorAll(`[${action}]`)] : [];
  const actionPosition = sameAction.indexOf(focused);
  list.innerHTML = markup;
  list.scrollTop = scrollTop;
  if (action) {
    const remaining = [...list.querySelectorAll(`[${action}]`)];
    (list.querySelector(`[${action}="${id}"]`) ||
      remaining[Math.min(actionPosition, remaining.length - 1)] ||
      tabListPanel.querySelector('input')).focus({ preventScroll: true });
  }
}

function toggleTabList() {
  const opening = tabListPanel.hidden;
  hideTabPanels();
  if (!opening) return;
  tabListPanel.hidden = false;
  document.getElementById('tab-list-button').setAttribute('aria-expanded', 'true');
  tabListPanel.querySelector('input').value = '';
  renderTabList();
  tabListPanel.querySelector('input').focus();
}

function showTabContextMenu(id, x, y) {
  const tab = findTab(id);
  if (!tab) return;
  hideTabPanels();
  tabContextMenu.innerHTML = `<button type="button" role="menuitem" data-tab-menu="pin" data-tab-id="${id}">${tab.pinned ? 'Открепить вкладку' : 'Закрепить вкладку'}</button>
    <button type="button" role="menuitem" data-tab-menu="others" data-tab-id="${id}">Закрыть остальные</button>
    <button type="button" role="menuitem" data-tab-menu="right" data-tab-id="${id}">Закрыть справа</button>
    <button type="button" role="menuitem" data-tab-menu="close" data-tab-id="${id}">Закрыть вкладку</button>`;
  tabContextMenu.hidden = false;
  tabContextMenu.style.left = `${Math.max(8, Math.min(x, innerWidth - tabContextMenu.offsetWidth - 8))}px`;
  tabContextMenu.style.top = `${Math.max(8, Math.min(y, innerHeight - tabContextMenu.offsetHeight - 8))}px`;
  tabContextMenu.querySelector('button').focus();
}

function openSearch(query, options = {}) {
  const { temporary, separate, background, ...tabOptions } = options;
  options = tabOptions;
  query = CatalogLogic.normalizeSearch(query);
  if (query) {
    const history = getSearchHistory().filter(entry => entry !== query);
    history.unshift(query);
    localStorage.setItem('artcatalog-search-history', JSON.stringify(history.slice(0, 12)));
  }
  hidePopover();
  const feed = 'illustrations';
  const title = query || (
    options.rating === 'explicit' ? 'NSFW иллюстрации' : 'Иллюстрации');
  const extra = { query, rating: options.rating || 'all', ...options, feed };
  const tab = temporary || separate || background
    ? openTemporaryTab('search', title, extra, { temporary, separate, background })
    : createTab('search', title, extra);
  if (!background) {
    delete tab.searchDraft;
    searchInput.value = query;
  }
  return tab;
}

function getSearchHistory() {
  try { return JSON.parse(localStorage.getItem('artcatalog-search-history') || '[]'); }
  catch { return []; }
}

function removeSearchHistory(query) {
  const history = getSearchHistory();
  const next = history.filter(entry => entry !== query);
  if (next.length === history.length) return false;
  try { localStorage.setItem('artcatalog-search-history', JSON.stringify(next)); }
  catch { toast('Could not remove this search. Try again.'); return false; }
  saveSession();
  return true;
}

function scheduleRule34Recovery(tab) {
  if (tab.rule34RecoveryTimer) clearTimeout(tab.rule34RecoveryTimer);
  tab.rule34RecoveryTimer = null;
  if (findTab(tab.id) !== tab || activeId !== tab.id) return;
  let retryAt;
  if (['home', 'search', 'profile'].includes(tab.kind)) {
    const times = Object.keys(tab.pausedSources || {}).map(source =>
      tab.sourceRetryAt?.[source] ?? (source === 'rule34' ? tab.rule34RetryAt : 0))
      .filter(value => Number.isFinite(value) && value > 0);
    if (times.length) retryAt = Math.min(...times);
  } else if (tab.kind === 'recommendations') {
    const times = Object.values(tab.recommendationPools || {}).flat()
      .flatMap(group => group.streams).filter(stream => stream.sources.length && stream.error)
      .map(stream => stream.retryAt).filter(value => Number.isFinite(value) && value > 0);
    if (times.length) retryAt = Math.min(...times);
  } else if (tab.kind === 'detail') {
    const times = Object.keys(tab.relatedPaused || {}).map(source => tab.relatedRetryAt?.[source])
      .filter(value => Number.isFinite(value) && value > 0);
    if (times.length) retryAt = Math.min(...times);
  }
  if (!Number.isFinite(retryAt) || retryAt <= 0) return;
  tab.rule34RecoveryTimer = setTimeout(() => {
    tab.rule34RecoveryTimer = null;
    if (findTab(tab.id) !== tab || activeId !== tab.id) return;
    if (retryAt > Date.now()) { scheduleRule34Recovery(tab); return; }
    if (tab.kind === 'recommendations') {
      tab.loadError = false;
      tab.recommendationPaused = false;
      tab.emptyRecommendationRounds = 0;
      return loadRecommendations(tab, true);
    }
    if (tab.kind === 'detail') {
      const due = Object.keys(tab.relatedPaused || {}).filter(source =>
        Number.isFinite(tab.relatedRetryAt?.[source]) && tab.relatedRetryAt[source] <= Date.now());
      if (due.length) return retryRelatedSearch(tab, due);
      scheduleRule34Recovery(tab); return;
    }
    const due = Object.keys(tab.pausedSources || {}).filter(source => {
      const deadline = tab.sourceRetryAt?.[source] ?? (source === 'rule34' ? tab.rule34RetryAt : 0);
      return Number.isFinite(deadline) && deadline > 0 && deadline <= Date.now();
    });
    if (due.length) return loadSearch(tab, true, true, due);
    scheduleRule34Recovery(tab);
  }, Math.max(500, Math.min(60000, retryAt - Date.now())));
}

function curationContext() {
  const cached = curationContext.snapshot;
  if (cached?.likes === likes && cached.preferences === contentPreferences &&
      cached.tagPreferences === recommendationTagPreferences) return cached.value;
  const value = { liked: CatalogLogic.filterWorks(likes, contentPreferences),
    tagPreferences: recommendationTagPreferences, curation: contentPreferences.curation };
  curationContext.snapshot = { likes, preferences: contentPreferences,
    tagPreferences: recommendationTagPreferences, value };
  return value;
}

async function loadSearch(tab, append = false, retryFailed = false, retrySources = null) {
  const alive = () => findTab(tab.id) === tab || tab.artworkDetached && !tab.artworkDisposed;
  if (!alive() || append && (!retryFailed &&
      (tab.hasMore === false || tab.loadError))) return;
  if (!append) tab.searchController?.abort();
  if (!append || !tab.searchController || tab.searchController.signal.aborted) {
    tab.searchController = new AbortController();
    tab.requestVersion = (tab.requestVersion || 0) + 1;
  }
  const controller = tab.searchController, version = tab.requestVersion;
  const pages = DartProviderPages.scope(tab, 'search', version, controller.signal);
  if (stopEmptyRatingFeed(tab)) return;
  tab.loading = true;
  if (!append) {
    tab.artworkGeneration = (tab.artworkGeneration || 0) + 1;
    delete tab.resumePrefetchAt;
    tab.page = 0; tab.items = []; tab.errors = {}; tab.hasMore = true;
    delete tab.curationViews;
    tab.loadError = false;
    tab.virtualState = {};
    tab.retainedFeedWorks = new Map();
    delete tab.retainedFeedHeights;
    delete tab.expiredFeedWorks;
    delete tab.expiredFeedTokens;
    tab.searchPageStats = {};
    tab.sourcePages = Object.fromEntries(tab.selectedSources.map(source => [source, 0]));
    tab.pausedSources = {};
    tab.rule34RetryAt = 0;
    tab.sourceRetryAt = {};
    tab.sourceServerRetryAt = {};
  }
  const sources = (retryFailed ? Object.keys(tab.pausedSources || {})
    .filter(source => (!retrySources || retrySources.includes(source)) &&
      !(tab.sourceServerRetryAt?.[source] > Date.now())) :
    Object.keys(tab.sourcePages).filter(source => !tab.pausedSources[source]))
    .filter(source => !pages.has(source));
  if (!sources.length) {
    tab.loading = pages.pending.size > 0;
    if (typeof scheduleRule34Recovery === 'function') scheduleRule34Recovery(tab);
    await Promise.all([...pages.pending.values()].map(job => job.promise));
    return;
  }
  const requestedPages = Object.fromEntries(sources.map(source =>
    [source, tab.sourcePages[source]]));
  if (activeId === tab.id) render();
  const query = tab.query || '';
  let published = append;
  const receive = (response, batch) => {
    if (!alive() || version !== tab.requestVersion || controller.signal.aborted) return;
    const merged = published ? [...tab.items, ...(response.items || [])] : response.items || [];
    published = true;
    tab.items = [...new Map(merged.map(item => [item.key, item])).values()];
    const errors = { ...tab.errors };
    delete errors.network;
    for (const source of batch) {
      if (response.errors?.[source] || response.notices?.[source])
        errors[source] = response.errors?.[source] || response.notices[source];
      else delete errors[source];
      tab.sourceRetryAt ||= {};
      tab.sourceServerRetryAt ||= {};
      if (response.errors?.[source]) {
        const server = response.retryAt?.[source];
        if (Number.isFinite(server) && server > 0) tab.sourceServerRetryAt[source] = server;
        else delete tab.sourceServerRetryAt[source];
        tab.sourceRetryAt[source] = Number.isFinite(server) && server > 0 ? server :
          /HTTP 401|user id|api key|ключ API|авторизуйтесь/i.test(response.errors[source])
            ? Infinity : Date.now() + 15000;
      } else { delete tab.sourceRetryAt[source]; delete tab.sourceServerRetryAt[source]; }
    }
    tab.errors = errors;
    if (batch.includes('rule34')) tab.rule34RetryAt = response.retryAt?.rule34 || 0;
    const pages = Object.fromEntries(batch.map(source => [source, requestedPages[source]]));
    tab.searchPageStats = CatalogLogic.rememberSearchPageStats(tab.searchPageStats,
      response.sourceStats, pages, response.errors);
    const progress = CatalogLogic.advanceSearchSources(tab.sourcePages,
      tab.pausedSources, batch, response);
    tab.sourcePages = progress.pages;
    tab.pausedSources = progress.paused;
    tab.page = Math.max(tab.page, ...Object.values(pages));
    tab.hasMore = Object.keys(tab.sourcePages).some(source => !tab.pausedSources[source]);
    tab.loadError = false;
    rememberItems(response.items || []);
    if (activeId === tab.id) render();
    if (typeof scheduleRule34Recovery === 'function') scheduleRule34Recovery(tab);
  };
  const fetchBatch = async batch => {
    const page = Math.min(...batch.map(source => requestedPages[source]));
    const params = new URLSearchParams({ q: query, page: String(page),
      pages: batch.map(source => `${source}:${requestedPages[source]}`).join(','),
      sources: batch.join(','), rating: tab.rating || 'general',
      sort: tab.sort || 'recent', kind: tab.feed || 'illustrations' });
    try {
      receive(await request(`/api/search?${params}`, { signal: controller.signal }), batch);
    } catch (error) {
      if (error.name === 'AbortError' || version !== tab.requestVersion ||
          controller.signal.aborted) return;
      receive({ items: [],
        errors: Object.fromEntries(batch.map(source =>
          [source, error.message || 'Источник сейчас недоступен. Повторите запрос позже.'])),
        retryAt: Object.fromEntries(batch.map(source => [source, error.retryAt])) }, batch);
    }
  };
  try {
    await Promise.all(sources.map(source => pages.run(source, () => fetchBatch([source]))));
  } finally {
    if (version === tab.requestVersion) {
      tab.loading = pages.pending.size > 0;
      if (activeId === tab.id) render();
      if (typeof scheduleRule34Recovery === 'function') scheduleRule34Recovery(tab);
    }
  }
}

function setSavedWorks(collection, items, changed = items) {
  const state = refreshSavedWorks.states ||= {};
  state[collection] ||= { revision: 0 };
  state[collection].loaded = true;
  state[collection].revision++;
  const keys = new Set(items.flatMap(item => [item.key, ...(item.memberKeys || [])]));
  if (collection === 'likes') { likes = items; likedKeys = keys; }
  else { bookmarks = items; savedKeys = keys; }
  rememberItems(changed);
  for (const tab of tabs.filter(tab => tab.kind === collection)) tab.items = items;
  scheduleRelatedKnownRefresh();
}

async function refreshSavedWorks(collection, force = false) {
  const states = refreshSavedWorks.states ||= {};
  const state = states[collection] ||= { revision: 0 };
  if (state.loaded && !force) return true;
  if (state.pending) {
    const available = await state.pending;
    return available && force && state.syncedRevision !== state.revision
      ? refreshSavedWorks(collection, true) : available;
  }
  const revision = state.revision;
  state.pending = (async () => {
    try {
      const response = await request(`/api/${collection}`);
      const items = CatalogLogic.filterCatalogItems(response);
      if (revision === state.revision) {
        let grouped = null;
        if (items.length && typeof DartCatalogJobs !== 'undefined') {
          try { grouped = await DartCatalogJobs.run('groupWorks', [items], () => null,
            { cacheKey: collection, previousInput: collection === 'likes' ? likes : bookmarks }); }
          catch { /* Unavailable workers retain the ordinary shared grouping path. */ }
        }
        // A local like, bookmark or metadata update can finish while the worker
        // is busy. Its older snapshot must not seed caches or replace that state.
        if (revision !== state.revision) return true;
        if (Array.isArray(grouped) && typeof CatalogLogic.cacheGroupedWorks === 'function') {
          try { CatalogLogic.cacheGroupedWorks(items, grouped); }
          catch { /* Saved data remains usable even if an optional warm result is rejected. */ }
        }
        setSavedWorks(collection, items);
        state.serverRevision = response.savedRevision || '';
        state.syncedRevision = state.revision;
      }
      return true;
    } catch { toast(collection === 'likes' ? 'Не удалось прочитать лайки' : 'Закладки не удалось прочитать'); return false; }
    finally { state.pending = null; }
  })();
  return state.pending;
}

function refreshSavedDetail(detail) {
  // Compare only the matching work, never serialize the saved library. Detail
  // hydration creates fresh arrays/records even when their values are unchanged.
  const sameValues = (first, second) => {
    if (first === second) return true;
    if (!first || !second || typeof first !== 'object' || typeof second !== 'object' ||
        Array.isArray(first) !== Array.isArray(second)) return false;
    const fields = Object.keys(first);
    return fields.length === Object.keys(second).length && fields.every(field =>
      Object.prototype.hasOwnProperty.call(second, field) && sameValues(first[field], second[field]));
  };
  const keys = new Set([detail.key, ...(detail.memberKeys || [])]);
  for (const [collection, items] of [['likes', likes], ['bookmarks', bookmarks]]) {
    const changed = [];
    let merged = null;
    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      if (!keys.has(item.key) && !(item.memberKeys || []).some(key => keys.has(key))) continue;
      const next = CatalogLogic.mergeDetailPages(item, detail);
      // Hydrating another catalog member can reorder the same membership set.
      // Retain its established order as well as the selected media order.
      if (item.memberKeys?.length === next.memberKeys?.length) {
        const members = new Set(item.memberKeys);
        if (next.memberKeys.every(key => members.has(key))) next.memberKeys = item.memberKeys;
      }
      if (sameValues(item, next)) continue;
      merged ||= items.slice();
      merged[index] = next;
      changed.push(next);
    }
    if (merged) setSavedWorks(collection, merged, changed);
  }
}

async function refreshBookmarks() { return refreshSavedWorks('bookmarks'); }
async function refreshLikes() { return refreshSavedWorks('likes'); }

const groupRepairs = {
  queue: [], pending: new Map(), cooldown: new Map(), active: 0,
  enqueue(item, visible = () => true) {
    if (!CatalogLogic.needsGroupRepair(item) || this.pending.has(item.key) ||
        (this.cooldown.get(item.key) || 0) > Date.now()) return;
    const entry = { item: structuredClone(item), visible, controller: new AbortController() };
    this.pending.set(item.key, entry); this.queue.push(entry); this.drain();
  },
  drain() {
    while (this.active < 2 && this.queue.length) {
      const entry = this.queue.shift();
      if (!entry.visible() || entry.controller.signal.aborted) { this.pending.delete(entry.item.key); continue; }
      this.active++;
      void this.run(entry).catch(() => { this.cooldown.set(entry.item.key, Date.now() + 60000); }).finally(() => {
        this.pending.delete(entry.item.key); this.active--; this.drain();
      });
    }
  },
  async run({ item, controller }) {
    const keys = [...new Set([item.key, ...(item.memberKeys || [])])], posts = []; let index = 0;
    const worker = async () => {
      while (index < keys.length) {
        const key = keys[index++], [source, id] = key.split(':');
        posts.push(await request(`/api/detail?${new URLSearchParams({ source, id })}`, { signal: controller.signal }));
      }
    };
    await Promise.all([worker(), worker()]);
    const groups = CatalogLogic.repairLegacyGroup(item, posts);
    if (!groups) throw new Error('Grouping metadata incomplete');
    await request('/api/grouping/repair', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expected: item, groups }), signal: controller.signal });
    if (controller.signal.aborted) return;
    this.apply(item, groups);
  },
  apply(expected, groups) {
    const replace = items => CatalogLogic.replaceRepairedGroups(items, expected, groups);
    for (const group of groups) itemIndex.set(group.key, group);
    for (const [collection, items] of [['likes', likes], ['bookmarks', bookmarks]]) {
      const next = replace(items); if (next !== items) setSavedWorks(collection, next);
    }
    recent = replace(recent);
    localStorage.setItem('artcatalog-recent', JSON.stringify(recent));
    for (const tab of tabs) {
      for (const field of ['items', 'related', 'creatorWorks', 'creatorCandidates', 'profileGridItems'])
        if (tab[field]) tab[field] = replace(tab[field]);
      let followChanged = false;
      for (const group of tab.followGroups || []) {
        const next = replace(group.items); if (next !== group.items) { group.items = next; followChanged = true; }
      }
      if (followChanged) queueFollowUpdate(tab, tab.followVersion);
      if (tab.item && replace([tab.item])[0] !== tab.item)
        tab.item = groups.find(group => group.memberKeys.includes(tab.item.key)) || groups[0];
      tab.artworkRoute?.engine.replaceGroup?.(expected, groups);
    }
    if (quickPreviewWork && replace([quickPreviewWork])[0] !== quickPreviewWork)
      quickPreviewWork = groups.find(group => group.memberKeys.includes(quickPreviewWork.key)) || groups[0];
    quickPreviewRoute?.engine.replaceGroup?.(expected, groups);
    render(); syncSavedWorkButtons(); saveSession();
  },
  scan() {
    if (currentTab()?.kind === 'detail') this.enqueue(currentTab().item);
    const bounds = main.getBoundingClientRect();
    for (const card of main.querySelectorAll('article.card[data-work-key]')) {
      const visible = () => { if (!card.isConnected) return false; const r = card.getBoundingClientRect();
        return r.bottom > bounds.top && r.top < bounds.bottom; };
      if (visible()) this.enqueue(itemIndex.get(card.dataset.workKey), visible);
    }
  },
  stop() { for (const entry of this.pending.values()) entry.controller.abort(); this.queue = []; }
};

async function loadFavoriteTags() {
  try {
    if (!await favoritesController().loadTags(true)) throw new Error('Favorite tags unavailable');
    if (['home', 'search', 'favorites'].includes(currentTab()?.kind)) render();
  } catch { toast('Избранные теги не удалось прочитать'); }
}

async function toggleFavoriteTag(query, requestedFavorite) {
  const tag = CatalogLogic.favoriteTagFromQuery(query);
  if (!tag || favoriteTagPending.has(tag)) return;
  favoriteTagPending.add(tag);
  try {
    const favorite = requestedFavorite ?? !favoriteTags.includes(tag);
    const character = favoritesKnownWorks().some(item => (item.characterTags || []).some(value =>
      value.toLowerCase().replaceAll(' ', '_') === tag));
    if (!await favoritesController().toggle(tag, character ? 'character' : null, favorite)) return;
    toast(favorite ? `Тег #${tag} добавлен в избранное` : `Тег #${tag} удалён из избранного`);
  } catch { toast('Не удалось сохранить избранный тег'); }
  finally { favoriteTagPending.delete(tag); }
}

function artworkMoreButton(item) {
  return `<button type="button" class="detail-save-button artwork-more-button" data-action="artwork-more" data-artwork-key="${escapeHtml(item.key)}" data-key="${escapeHtml(item.key)}" aria-label="More artwork actions" title="More artwork actions" aria-haspopup="menu" aria-expanded="false">${svg('more')}</button>`;
}

async function copyTextValue(text) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const focused = document.activeElement, input = document.createElement('textarea');
    input.value = text; input.readOnly = true; input.style.cssText = 'position:fixed;left:-10000px'; document.body.append(input);
    try { input.focus(); input.select(); if (!document.execCommand('copy')) throw Error('Clipboard unavailable'); }
    finally { input.remove(); focused?.focus({preventScroll:true}); }
  }
}

async function resolveArtworkActionMedia(item, selected) {
  item = itemIndex.get(item.key) || item;
  if(selected&&!DartArtworkActions.validMedia(selected))throw Error('Selected media unavailable');
  let url = DartArtworkActions.media(item, selected);
  if (url && !CatalogLogic.signedMediaExpired(url) && (selected || item.images?.length)) return url;
  const identity=selected?CatalogLogic.mediaCacheKey(selected):null;
  const owner=identity&&item.imageRecords?.find(record=>CatalogLogic.mediaCacheKey(record.url)===identity)?.owner;
  let refs=CatalogLogic.workSources(item);
  if(owner){const owned=refs.find(ref=>ref.key===owner);if(!owned)throw Error('Selected media owner unavailable');refs=[owned];}
  else if(selected?.includes('sankakucomplex.com'))refs=refs.filter(ref=>ref.source==='sankaku');
  for(const ref of refs.slice(0,32)){
    const detail=await request(`/api/detail?${new URLSearchParams({source:ref.source,id:ref.id})}`,{cache:'reload',priority:'foreground'});
    if(!detail)continue;
    item=rememberItem(detail.source==='sankaku'?CatalogLogic.hydrateWorkMedia(item,detail):CatalogLogic.mergeDetailPages(item,detail));
    const candidates=[...(detail.images||[]),...(item.images||[]),detail.thumbnail];
    const renewed=candidates.find(value=>DartArtworkActions.validMedia(value)&&!CatalogLogic.signedMediaExpired(value)&&(!identity||CatalogLogic.mediaCacheKey(value)===identity));
    if(renewed)return renewed;
    if(detail.requiresAuthentication){const error=Error(detail.accessMessage||'Sign in to the source to access this image.');error.status=401;throw error;}
  }
  throw Error('Selected media unavailable');
}

async function artworkPng(item, selected, element, resolve) {
  const converter=artworkPng.converter ||= DartArtworkImageCopy.create();
  const source=selected||element?.dataset?.imageUrl||element?.dataset?.videoUrl;
  const loaded=element?.matches?.('video')&&element.readyState>=2 || element?.matches?.('img')&&element.complete&&element.naturalWidth&&
    CatalogLogic.mediaCacheKey(element.dataset.imageUrl)===CatalogLogic.mediaCacheKey(source);
  if(loaded&&DartArtworkActions.validMedia(source))return converter.convert({element});
  return converter.convert({load:async()=>readMediaBlob(await resolve(),undefined,{priority:'foreground'})});
}

function artworkActionsController() {
  return artworkActionsController.instance ||= DartArtworkActions.create({request,tokens:CatalogLogic.workHistoryTokens,toast,
    favorite:item=>favoritesController().toggleArtwork(item),copyText:copyTextValue,copyTags:copyArtworkTags,
    resolveMedia:resolveArtworkActionMedia,png:artworkPng,
    copyImage:promise=>{
      promise.catch(()=>{});
      if (!navigator.clipboard?.write || !globalThis.ClipboardItem) throw Error('Image clipboard unavailable');
      return navigator.clipboard.write([new ClipboardItem({'image/png':promise})]);
    },
    download:(url,name)=>{
      const link=document.createElement('a');link.href=url;link.download=name;link.hidden=true;document.body.append(link);link.click();link.remove();
    },
    changed:()=>{
      for(const route of artworkRoutes) { route.readPreferences=null; route.readRaw=null; }
      favoritesController.instance?.invalidate();
      if (quickPreview.open && artworkActionsController().isHidden(quickPreviewWork)) closeQuickPreview();
      if(currentTab()) render();
    }
  });
}

function renderHiddenArtworksSettings() {
  const actions=artworkActionsController(),items=actions.items();
  const tab=currentTab(),limit=tab?.hiddenArtworkLimit||50;
  return `<details class="settings-card" data-hidden-artworks${tab?.hiddenArtworksOpen?' open':''}><summary>Hidden artworks <span>${items.length}</span></summary>
    <p>Hidden works and their known copies are excluded from discovery. Restore a work here.</p>
    ${actions.loadError?'<p role="alert">Hidden artworks could not be loaded.</p><button class="secondary-button" data-action="hidden-artworks-retry">Retry</button>':''}
    ${items.slice(0,limit).map(item=>{rememberItem(item);return `<div class="hidden-artwork-row"><span data-no-i18n>${escapeHtml(item.title||item.key)}</span><button class="secondary-button" data-action="artwork-restore" data-key="${escapeHtml(item.key)}">Show again</button></div>`;}).join('')}
    ${!items.length?'<p class="muted">No hidden artworks.</p>':''}
    ${items.length>limit?'<button class="secondary-button" data-action="hidden-artworks-more">Show more</button>':''}</details>`;
}

function favoritesKnownWorks() {
  const previous = favoritesKnownWorks.cache;
  if (previous?.likes === likes && previous.bookmarks === bookmarks && previous.recent === recent) return previous.items;
  const items = [...likes, ...bookmarks, ...recent];
  favoritesKnownWorks.cache = { likes, bookmarks, recent, items }; return items;
}

function favoritesController() {
  return favoritesController.instance ||= DartFavorites.create({ request, svg,
    getTags: () => favoriteTags, setTags: value => { favoriteTags = value; },
    getRecent: () => recent, getKnown: favoritesKnownWorks, getLiked: recommendationLikedWorks,
    analyze: (liked, preferences, options) => analyzeArtworkCollection(liked, preferences, [], options),
    getTagPreferences: () => recommendationTagPreferences, effectiveRating: selectedRating,
    getPreferences: () => contentPreferences, visibilityRevision:()=>artworkActionsController.instance?.revision || 0,
    emptyRating:emptyNsfwRatingsMessage,
    getActiveTab: currentTab, outboxChanged: () => { void saveSession(); },
    workTokens: item => CatalogLogic.workHistoryTokens(item),
    renderArtworks: items => renderFavoriteArtworkGrid(items),
    renderEntities: (cards, entity) => renderFavoriteEntityGrid(cards, entity),
    viewedExamples: favoriteViewedExamples,
    renderEntityCard: card => card.cover ? renderCard(card.cover,false,{label:card.tag.replaceAll('_',' '),query:card.tag}) : '',
    allowed: item => !CatalogLogic.isWorkHidden(item, contentPreferences) && !artworkActionsController().isHidden(item),
    changed: () => { reconcileFavoriteGroupRoutes(); if (['favorites','detail','search','home'].includes(currentTab()?.kind)) render(); },
    toast, save: saveSession, openSearch, openDetail,
    t: value => globalThis.DartI18n?.translate(value) || value
  });
}

function favoriteGroupsController() {
  return favoriteGroupsController.instance ||= DartFavoriteGroups.create({request,toast,
    committed:()=>reconcileFavoriteGroupRoutes(),
    changed:()=>{if(['favorites','detail'].includes(currentTab()?.kind))render();}});
}

function reconcileFavoriteGroupRoutes() {
  if(!favoriteGroupsController.instance||!favoritesController.instance)return;
  const all=favoritesController().artworks(),groups=favoriteGroupsController().layout(all);
  for(const route of artworkRoutes){
    const source=route.source;if(source.kind!=='favorites'||source.favoriteType!=='artwork')continue;
    const current=route.engine.items[route.engine.state.index];if(!current)continue;
    const allowed=item=>!artworkActionsController().isHidden(item)&&!CatalogLogic.isWorkHidden(item,contentPreferences)&&CatalogLogic.matchesRating(item,selectedRating(source));
    const pack=groups.find(row=>row.groupId&&row.items.some(item=>CatalogLogic.sameWork(item,current)));
    if(!pack&&!source.manualFavoriteGroup)continue;
    const items=(pack?pack.items:all).filter(allowed);
    if(pack?.groupId===source.manualFavoriteGroup&&items.length===source.items.length&&items.every((item,i)=>item.key===source.items[i].key)){
      source.items=items;route.readRaw=null;route.readPreferences=null;continue;
    }
    route.navigationController?.abort();route.warmController?.abort();route.warmFor=null;
    route.source={id:nextArtworkSourceId--,artworkDetached:true,kind:'favorites',favoriteType:'artwork',rating:source.rating,
      ...(pack?{manualFavoriteGroup:pack.groupId}:{}),items,started:true,artworkLists:new Map()};
    route.backup=route.source;route.signature=artworkSourceSignature(route.source);route.readRaw=null;route.readPreferences=null;
    route.readVersions=new Map();route.engine.reset(items,current);
  }
}

function renderFavoriteArtworkGrid(items) {
  const groups=favoriteGroupsController(),rows=groups.layout(items),tab=currentTab();
  if(tab)tab.favoriteGroupCards=new Map(rows.map(row=>[row.item.key,row]));
  return `<p class="settings-hint">Drag one artwork onto another to group them. Right-click for group actions.</p>
    ${groups.error?'<p class="error" role="alert">Groups could not be loaded. <button class="inline-retry" data-action="favorite-groups-retry">Try again</button></p>':''}
    ${groups.pending?'<p class="settings-hint" role="status">Saving group…</p>':''}
    ${renderGrid(rows.map(row=>row.item),'favorites-artworks',new Set(),true)}`;
}

function favoriteGroupFor(item, source=currentTab()) {
  const tab=source?.kind==='detail'?source.artworkRoute?.source:source;
  if(tab?.manualFavoriteGroup)return favoriteGroupsController().layout(favoritesController().artworks()).find(row=>row.groupId===tab.manualFavoriteGroup&&row.items.some(work=>CatalogLogic.sameWork(work,item)))||null;
  if(tab?.kind!=='favorites'||tab.favoriteType!=='artwork')return null;
  return favoriteGroupsController().layout(tab.items||[]).find(row=>row.groupId&&row.items.some(work=>CatalogLogic.sameWork(work,item)))||null;
}

function openFavoriteGroupPicker(item, trigger) {
  const source=currentTab()?.kind==='detail'?currentTab().artworkRoute?.source:currentTab();
  if(quickPreview.open)closeQuickPreview();
  const rating=selectedRating(source?.rating?source:{rating:ratingFilterFor(item)}), actions=artworkActionsController();
  const rows=favoriteGroupsController().layout(favoritesController().artworks().filter(work=>
    CatalogLogic.matchesRating(work,rating)&&!CatalogLogic.isWorkHidden(work,contentPreferences)&&!actions.isHidden(work)))
    .filter(row=>!row.items.some(work=>CatalogLogic.sameWork(work,item)));
  const dialog=document.createElement('dialog');dialog.className='favorite-group-picker';
  dialog.innerHTML=`<div class="section-head"><h2>Group with another Favorite</h2><button type="button" class="icon-button" data-group-close aria-label="Close">${svg('close')}</button></div>
    <p class="settings-hint">The chosen artwork becomes the group cover. All works keep their own likes and bookmarks.</p>
    <input type="search" aria-label="Find a favorite artwork" placeholder="Find a favorite artwork" autocomplete="off">
    <div class="favorite-group-options">${rows.map((row,index)=>`<button type="button" class="favorite-group-option" data-group-target="${index}">
      ${row.item.thumbnail?`<img src="/api/image?url=${encodeURIComponent(row.item.thumbnail)}" alt="" loading="lazy">`:''}<span data-no-i18n>${escapeHtml(row.item.title)}</span>${row.items.length>1?`<small>${row.items.length} works</small>`:''}</button>`).join('')||'<p class="empty">Save another artwork to Favorites first.</p>'}</div>
    <p class="settings-hint" data-group-empty hidden>No matching favorite artworks.</p><p data-group-status role="status" aria-live="polite"></p>`;
  document.body.append(dialog);
  dialog.addEventListener('close',()=>{dialog.remove();if(trigger?.isConnected)trigger.focus({preventScroll:true});},{once:true});
  dialog.addEventListener('click',async event=>{
    if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();return;}
    if(event.target.closest('[data-group-close]')){dialog.close();return;}
    const choice=event.target.closest('[data-group-target]');if(!choice||favoriteGroupsController().pending)return;
    const buttons=[...dialog.querySelectorAll('[data-group-target]')];buttons.forEach(button=>button.disabled=true);
    dialog.querySelector('[data-group-status]').textContent='Saving group…';
    const saved=await favoriteGroupsController().merge(item.key,rows[Number(choice.dataset.groupTarget)].item.key);
    if(saved)dialog.close();else{buttons.forEach(button=>button.disabled=false);dialog.querySelector('[data-group-status]').textContent='Could not save the group. Your Favorites were kept.';}
  });
  dialog.querySelector('input').addEventListener('input',event=>{const query=event.target.value.toLocaleLowerCase();
    for(const button of dialog.querySelectorAll('[data-group-target]'))button.hidden=!rows[Number(button.dataset.groupTarget)].item.title.toLocaleLowerCase().includes(query);
    dialog.querySelector('[data-group-empty]').hidden=!rows.length||!!dialog.querySelector('[data-group-target]:not([hidden])');});
  dialog.showModal();globalThis.DartI18n?.translateTree(dialog);dialog.querySelector('input').focus();
}

async function loadViewedTokens() {
  try { viewedTokens = new Set(await request('/api/viewed-identities')); }
  catch { toast('Историю просмотренных работ не удалось прочитать'); }
  scheduleRelatedKnownRefresh();
}

async function recordViewedWorks(items) {
  const incoming = [...new Set((items || []).flatMap(CatalogLogic.workHistoryTokens))]
    .filter(token => !viewedTokens.has(token) && !viewedPending.has(token));
  if (!incoming.length) return;
  for (const token of incoming) viewedPending.add(token);
  scheduleRelatedKnownRefresh();
  try {
    for (let index = 0; index < incoming.length; index += 60) {
      const batch = incoming.slice(index, index + 60);
      await request('/api/viewed-identities', { method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch) });
      for (const token of batch) viewedTokens.add(token);
    }
  } catch { toast('Историю просмотренных работ не удалось сохранить'); }
  finally {
    for (const token of incoming) viewedPending.delete(token);
    scheduleRelatedKnownRefresh();
  }
}

async function refreshFollows() {
  const revision = refreshFollows.revision = (refreshFollows.revision || 0) + 1;
  try {
    const items = CatalogLogic.filterCatalogItems(await request('/api/follows'));
    if (revision !== refreshFollows.revision) return true;
    follows = items;
    followedKeys = new Set(follows.map(CatalogLogic.followKey));
    return true;
  } catch {
    if (revision !== refreshFollows.revision) return true;
    toast('Подписки не удалось прочитать');
    return false;
  }
}

function createRecommendationPools(liked, sources, preferences, background = [], analysis = null) {
  const selected = analysis?.queryGroups || CatalogLogic.recommendationQueryGroups(liked, preferences, background);
  const selectedSources = sources.filter(source => CatalogLogic.supportedSources.includes(source));
  return Object.fromEntries(['priority', 'names', 'copyright', 'other', 'combinations'].map(kind => [kind,
    selected[kind].map(({ tag, query }) => ({ tag, query: query || tag.replaceAll(' ', '_'), kind, streams: [
      ...(selectedSources.length ? [{ nextPage: 0, sources: [...selectedSources] }] : [])
    ] })).filter(group => group.streams.length)]));
}

function recommendationLikedWorks() {
  const revision = CatalogLogic.groupingRevision?.(likes) || 0;
  const cached = recommendationLikedWorks.snapshot;
  if (cached?.likes === likes && cached.length === likes.length && cached.revision === revision &&
      cached.preferences === contentPreferences) return cached.items;
  const items = CatalogLogic.filterWorks(CatalogLogic.groupWorks(likes), contentPreferences);
  recommendationLikedWorks.snapshot = { likes, length: likes.length, revision, preferences: contentPreferences, items };
  return items;
}

function analyzeArtworkCollection(liked, preferences, background = [], options = {}) {
  if (typeof DartWorkAnalysis !== 'undefined') {
    analyzeArtworkCollection.service ||= DartWorkAnalysis.create({ logic: CatalogLogic,
      jobs: typeof DartCatalogJobs !== 'undefined' ? DartCatalogJobs : null });
    return analyzeArtworkCollection.service.analyze(liked, preferences, background, options);
  }
  return Promise.resolve({ tags: CatalogLogic.recommendationTags(liked, 6),
    tagGroups: CatalogLogic.recommendationTagGroups(liked, 2, preferences),
    queryGroups: CatalogLogic.recommendationQueryGroups(liked, preferences, background, options) });
}

function recommendationPoolsHaveMore(pools) {
  return Object.values(pools || {}).some(pool => pool.some(group =>
    group.streams.some(stream => stream.sources.length)));
}

function deferRecommendationSource(group, stream, source, message, serverRetryAt) {
  const failed = stream.sources.length === 1 ? stream :
    { nextPage: stream.nextPage, sources: [source] };
  failed.error = String(message || 'Источник сейчас недоступен.');
  failed.failures = (stream.failures || 0) + 1;
  const serverDeadline = Number.isFinite(serverRetryAt) && serverRetryAt > Date.now() ? serverRetryAt : 0;
  failed.serverRetryAt = serverDeadline;
  // Danbooru may challenge or restrict one query without rejecting the user's
  // credentials. Only an explicit server deadline makes that access pause global.
  const queryAccess = source === 'danbooru' && !serverDeadline && /HTTP 403\b/i.test(failed.error);
  failed.needsSettings = !queryAccess && !serverDeadline && /HTTP 40[13]|user id|api key|ключ API|авторизуйтесь|unauthorized/i.test(failed.error);
  failed.querySpecific = queryAccess || /HTTP (?:400|413|414|422)\b/i.test(failed.error);
  // Three paced retries are enough to recover a short outage. Keep the page
  // available for an explicit Retry after that, or after changing credentials.
  failed.retryAt = failed.needsSettings || !serverDeadline && failed.failures > 3 ? Infinity :
    Math.max(serverDeadline,
      Date.now() + Math.min(60000, 15000 * 2 ** (failed.failures - 1)));
  failed.sources = [source];
  if (failed !== stream) group.streams.push(failed);
  return failed;
}

function settleRecommendationSourceRetries(tab, failures, successful = new Set()) {
  for (const group of Object.values(tab.recommendationPools || {}).flat())
    for (const stream of [...group.streams]) {
      for (const source of [...stream.sources]) {
        const failed = failures.get(source);
        if (failed) {
          // A source outage applies to every tag query. Splitting untouched
          // streams keeps healthy peers available at their original page.
          const paused = stream.sources.length === 1 ? stream :
            { nextPage: stream.nextPage, sources: [source] };
          Object.assign(paused, { error: failed.error, failures: failed.failures,
            retryAt: failed.retryAt, serverRetryAt: failed.serverRetryAt, needsSettings: failed.needsSettings });
          if (paused !== stream) {
            stream.sources = stream.sources.filter(value => value !== source);
            group.streams.push(paused);
          }
        } else if (successful.has(source) && stream.error && !stream.querySpecific) {
          stream.retryAt = 0;
          stream.failures = 0;
          delete stream.serverRetryAt;
          delete stream.error;
          delete stream.needsSettings;
        }
      }
    }
}

function retryRecommendationSources(tab, sources = null, load = true) {
  if (sources && !tab.selectedSources?.some(source => sources.includes(source))) return;
  if (tab.loading) {
    if (load) return;
    // An old-credential response must not re-block a source after settings have
    // been saved. Keep the visit and pages; discard only that in-flight request.
    tab.recommendationController?.abort();
    tab.recommendationVersion = (tab.recommendationVersion || 0) + 1;
    tab.loading = false;
  }
  for (const group of Object.values(tab.recommendationPools || {}).flat())
    for (const stream of group.streams)
      if (stream.error && (!sources || stream.sources.some(source => sources.includes(source)))) {
        stream.failures = 0;
        stream.retryAt = Math.max(Date.now(), stream.serverRetryAt || 0);
        stream.needsSettings = false;
      }
  tab.loadError = false;
  tab.emptyRecommendationRounds = 0;
  tab.recommendationPaused = false;
  tab.hasMore = recommendationPoolsHaveMore(tab.recommendationPools);
  if (load && tab.recommendationAnalysisFailed) return loadRecommendations(tab, false);
  if (load) return loadRecommendations(tab, true);
  if (typeof scheduleRule34Recovery === 'function') scheduleRule34Recovery(tab);
}

async function loadRecommendationBackground(tab, signal) {
  const key = `${selectedRating(tab)}:${[...tab.selectedSources].sort().join(',')}`;
  if (tab.recommendationBackgroundKey === key && Date.now() - tab.recommendationBackgroundAt < 600000)
    return tab.recommendationBackground || [];
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 2500);
  try {
    const samples = await Promise.all(tab.selectedSources.map(async source => {
      const params = new URLSearchParams({ q: '', page: '0', sources: source,
        rating: tab.rating, sort: 'recent', kind: 'illustrations' });
      try {
        const response = await request(`/api/search?${params}`, { signal: controller.signal, priority: 'background' });
        return { available: !response.errors?.[source], items: response.items || [] };
      } catch { return { available: false, items: [] }; }
    }));
    if (signal.aborted) return [];
    if (!samples.some(sample => sample.available))
      return tab.recommendationBackgroundKey === key ? tab.recommendationBackground || [] : [];
    tab.recommendationBackground = [...new Map(samples.flatMap(sample => sample.items)
      .map(item => [item.key, item])).values()];
    tab.recommendationBackgroundKey = key;
    tab.recommendationBackgroundAt = Date.now();
    return tab.recommendationBackground;
  } catch { return tab.recommendationBackgroundKey === key ? tab.recommendationBackground || [] : []; }
  finally { clearTimeout(timeout); signal.removeEventListener('abort', abort); }
}

function rememberRecommendationExposure(tab, exposed = []) {
  const groups = exposed.map(item => Array.isArray(item) ? item : [item.key, ...(item.memberKeys || [])]);
  if (!groups.length) return;
  // Soft ranking history is separate from opened/viewed works. Never mark an
  // artwork as viewed merely because it was suggested.
  recommendationExposureGroups = DartRecommendationExposure.append(recommendationExposureGroups, groups);
  recommendationExposure = cleanRecommendationExposure(DartRecommendationExposure.keys(recommendationExposureGroups));
  recommendationExposureDirty = true;
  if (recommendationExposureSaveTimer === undefined)
    recommendationExposureSaveTimer = setTimeout(() => flushRecommendationExposure(), 750);
}

function flushRecommendationExposure(save = true) {
  if (typeof recommendationExposureDirty === 'undefined' || !recommendationExposureDirty) return;
  if (recommendationExposureSaveTimer !== undefined) clearTimeout(recommendationExposureSaveTimer);
  recommendationExposureSaveTimer = undefined;
  recommendationExposureDirty = false;
  try {
    localStorage.setItem('dart-recommendation-exposure', JSON.stringify(recommendationExposure));
    localStorage.setItem('dart-recommendation-exposure-groups', JSON.stringify(recommendationExposureGroups));
  } catch { /* Server session persistence remains available. */ }
  if (save) saveSession();
}

function recommendationRecentExposureKeys(tab) {
  if (typeof recommendationExposureGroups !== 'undefined' &&
      typeof DartRecommendationExposure !== 'undefined')
    return DartRecommendationExposure.keys(recommendationExposureGroups);
  return typeof recommendationExposure === 'undefined'
    ? [...(tab.recommendationExposure || [])] : [...recommendationExposure];
}

function nextRecommendationGroup(tab, kind, excluded = new Set(), eligible = () => true) {
  const pool = tab.recommendationPools?.[kind] || [];
  if (!pool.length) return null;
  const cursor = tab.recommendationCursors[kind] || 0;
  for (let offset = 0; offset < pool.length; offset++) {
    const index = (cursor + offset) % pool.length;
    const group = pool[index];
    if (excluded.has(group.tag) || !group.streams.some(stream => stream.sources.length &&
        (!stream.retryAt || stream.retryAt <= Date.now()) && stream.sources.some(source => eligible(group, stream, source)))) continue;
    tab.recommendationCursors[kind] = (index + 1) % pool.length;
    return group;
  }
  return null;
}

function selectRecommendationGroups(tab, eligible = () => true) {
  const chosen = [];
  const excluded = new Set();
  const add = kind => {
    const group = nextRecommendationGroup(tab, kind, excluded, eligible);
    if (group) { chosen.push(group); excluded.add(group.tag); }
    return !!group;
  };
  // A recovery timer must retry its due page rather than rotate through unrelated
  // queries while the failed page remains overdue and keeps waking the timer.
  const recovery = Object.values(tab.recommendationPools || {}).flat().find(group =>
    group.streams.some(stream => stream.sources.length && stream.error && stream.retryAt <= Date.now() &&
      stream.sources.some(source => eligible(group, stream, source))));
  if (recovery) { chosen.push(recovery); excluded.add(recovery.tag); }
  if (recovery) {
    if (!add('priority'))
      for (const kind of ['other', 'names', 'copyright', 'combinations']) if (add(kind)) break;
    return chosen;
  }
  if (add('priority')) {
    const second = ['combinations', 'other', 'names', 'copyright'][tab.recommendationRound++ % 4];
    if (!add(second)) for (const kind of ['other', 'names', 'copyright', 'combinations']) if (add(kind)) break;
  } else {
    add('other');
    const second = ['combinations', 'other', 'names', 'copyright'][tab.recommendationRound++ % 4];
    if (!add(second)) for (const kind of ['other', 'names', 'copyright', 'combinations']) if (add(kind)) break;
  }
  return chosen;
}

function prepareRecommendationProfile(tab, liked = recommendationLikedWorks(), newVisit = true, analysis = null) {
  const previousPools = tab.recommendationPools;
  if (newVisit) {
    recommendationVisitCount = (recommendationVisitCount + 1) % 1000000;
    try { localStorage.setItem('artcatalog-recommendation-visit-count',
      String(recommendationVisitCount)); } catch { /* Storage may be unavailable. */ }
    const previousSeed = tab.recommendationSeed || 0;
    tab.recommendationSeed = (Math.floor(Math.random() * 0xffffffff) ^
      recommendationVisitCount) >>> 0 || 1;
    if (tab.recommendationSeed === previousSeed)
      tab.recommendationSeed = (tab.recommendationSeed + 1) >>> 0 || 1;
    tab.recommendationRecentKeys = recommendationRecentExposureKeys(tab);
  }
  tab.recommendationTags = analysis?.tags || CatalogLogic.recommendationTags(liked, 6);
  tab.recommendationTagGroups = analysis?.tagGroups || CatalogLogic.recommendationTagGroups(liked, 2, recommendationTagPreferences);
  tab.emptyRecommendationRounds = 0;
  tab.recommendationPaused = false;
  tab.recommendationPools = createRecommendationPools(liked,
    tab.selectedSources, recommendationTagPreferences,
    tab.recommendationBackgroundKey === `${selectedRating(tab)}:${[...tab.selectedSources].sort().join(',')}`
      ? tab.recommendationBackground || [] : [], analysis);
  if (!newVisit) {
    const previous = new Map(Object.values(previousPools || {}).flat()
      .map(group => [`${group.kind}:${group.query}`, group]));
    for (const group of Object.values(tab.recommendationPools).flat()) {
      const old = previous.get(`${group.kind}:${group.query}`);
      if (old) group.streams = old.streams;
    }
    const failures = new Map();
    for (const group of Object.values(previousPools || {}).flat())
      for (const stream of group.streams)
        if (stream.error && !stream.querySpecific) for (const source of stream.sources)
          if (!failures.has(source) || failures.get(source).retryAt < stream.retryAt) failures.set(source, stream);
    settleRecommendationSourceRetries(tab, failures);
  }
  const start = kind => {
    const count = tab.recommendationPools[kind].length;
    return count ? recommendationVisitCount % count : 0;
  };
  tab.recommendationCursors = { priority: start('priority'), names: start('names'), copyright: start('copyright'),
    other: start('other'), combinations: start('combinations') };
  tab.recommendationRound = 0;
  tab.hasMore = recommendationPoolsHaveMore(tab.recommendationPools);
}

async function mergeRecommendationsAsync(...args) {
  if (typeof Worker !== 'function' || mergeRecommendationsAsync.state === false)
    return CatalogLogic.mergeRecommendations(...args);
  try {
    if (!mergeRecommendationsAsync.state) {
      const worker = new Worker('/catalog-worker.js');
      const state = { worker, jobs: new Map(), nextId: 0, nextProfileId: 0, profile: null };
      state.fail = () => {
        worker.terminate();
        mergeRecommendationsAsync.state = false;
        for (const job of state.jobs.values()) job.reject(new Error('Ranking worker unavailable'));
        state.jobs.clear();
      };
      worker.addEventListener('message', ({ data }) => {
        const job = state.jobs.get(data?.id);
        if (!job) return;
        if (data.error) { state.jobs.delete(data.id); job.reject(new Error(data.error)); return; }
        try {
          if (!Array.isArray(data.value) || data.reusedPrefix !== undefined && !Array.isArray(data.reusedPrefix))
            throw new Error('Invalid recommendation worker response');
          const positions = new Set();
          for (const reference of data.reusedPrefix || []) {
            if (!Array.isArray(reference) || reference.length !== 2)
              throw new Error('Invalid recommendation prefix reference');
            const [position, prefixIndex] = reference;
            if (!Number.isInteger(position) || position < 0 || position >= data.value.length ||
                !Number.isInteger(prefixIndex) || prefixIndex < 0 || prefixIndex >= job.prefix.length ||
                data.value[position] !== null || positions.has(position))
              throw new Error('Invalid recommendation prefix reference');
            positions.add(position);
          }
          for (const [position, prefixIndex] of data.reusedPrefix || [])
            data.value[position] = job.prefix[prefixIndex];
          if (data.value.some(item => !item || typeof item !== 'object' || typeof item.key !== 'string'))
            throw new Error('Invalid recommendation worker record');
          // Ranking already grouped these records in the worker. Preserve that
          // evidence on the UI thread, including filtered views of this batch.
          if (!CatalogLogic.cacheGroupedWorks(data.value, data.value))
            throw new Error('Invalid recommendation grouping');
          CatalogLogic.restoreGroupingEvidence?.(data.value, data.groupingEvidence,
            new Set((data.reusedPrefix || []).map(pair => pair[0])));
          state.jobs.delete(data.id);
          job.resolve(data.value);
        } catch { state.fail(); }
      });
      worker.addEventListener('error', event => { event.preventDefault(); state.fail(); });
      worker.addEventListener('messageerror', state.fail);
      mergeRecommendationsAsync.state = state;
    }
    const state = mergeRecommendationsAsync.state;
    const id = ++state.nextId;
    let timer;
    try {
      return await new Promise((resolve, reject) => {
        state.jobs.set(id, { resolve, reject, prefix: Array.isArray(args[1]) ? [...args[1]] : [] });
        timer = setTimeout(state.fail, 10000);
        try {
          const liked = args[0];
          if (!Array.isArray(liked)) { state.worker.postMessage({ id, args }); return; }
          const revision = CatalogLogic.groupingRevision?.(liked) || 0;
          const previous = state.profile;
          const reuse = previous?.items === liked && previous.length === liked.length && previous.revision === revision;
          const profileId = reuse ? previous.id : ++state.nextProfileId;
          state.worker.postMessage({ id, profileId, args: reuse ? [null, ...args.slice(1)] : args });
          state.profile = { id: profileId, items: liked, length: liked.length, revision };
        }
        catch { state.fail(); }
      });
    } finally { clearTimeout(timer); state.jobs.delete(id); }
  } catch {
    // Keep the same ranking if worker creation is unavailable in the host.
    return CatalogLogic.mergeRecommendations(...args);
  }
}

async function loadRecommendations(tab, append = false) {
  const alive = () => findTab(tab.id) === tab || tab.artworkDetached && !tab.artworkDisposed;
  if (!alive() || append && (!tab.hasMore || tab.loadError)) return;
  if (!append) tab.recommendationController?.abort();
  if (!append || !tab.recommendationController || tab.recommendationController.signal.aborted) {
    tab.recommendationController = new AbortController();
    tab.recommendationVersion = (tab.recommendationVersion || 0) + 1;
  }
  const controller = tab.recommendationController, version = tab.recommendationVersion;
  const pages = DartProviderPages.scope(tab, 'recommendations', version, controller.signal);
  const sourceFailures = pages.state.sourceFailures ||= new Map();
  const pageKey = (group, source, page) => JSON.stringify([group.query, source, page]);
  const eligible = (group, stream, source) => !(stream.serverRetryAt > Date.now()) &&
    !(sourceFailures.get(source)?.serverRetryAt > Date.now()) &&
    !pages.has(pageKey(group, source, stream.nextPage));
  if (stopEmptyRatingFeed(tab)) return;
  const visibleLikes = recommendationLikedWorks();
  let analysis = null;
  if ((!append || tab.recommendationProfileDirty) && typeof DartWorkAnalysis !== 'undefined') {
    const preferences = recommendationTagPreferences, preferenceKey = JSON.stringify(preferences);
    const inputVersion = CatalogLogic.recommendationInputVersion(visibleLikes);
    const selection = `${selectedRating(tab)}:${[...tab.selectedSources].sort().join(',')}`;
    tab.loading = true;
    if (activeId === tab.id) render();
    try {
      const background = tab.recommendationBackgroundKey === `${selectedRating(tab)}:${[...tab.selectedSources].sort().join(',')}`
        ? tab.recommendationBackground || [] : [];
      analysis = await analyzeArtworkCollection(visibleLikes, preferences, background);
    } catch {
      if (alive() && version === tab.recommendationVersion && !controller.signal.aborted) {
        tab.loading = false; tab.loadError = true; tab.recommendationAnalysisFailed = true;
        if (activeId === tab.id) render();
      }
      return;
    }
    if (!alive() || version !== tab.recommendationVersion || controller.signal.aborted) {
      if (alive() && version === tab.recommendationVersion) tab.loading = false;
      return;
    }
    if (visibleLikes !== recommendationLikedWorks() || inputVersion !== CatalogLogic.recommendationInputVersion(visibleLikes) ||
        preferenceKey !== JSON.stringify(recommendationTagPreferences) ||
        selection !== `${selectedRating(tab)}:${[...tab.selectedSources].sort().join(',')}`) {
      tab.loading = false;
      return loadRecommendations(tab, append);
    }
    delete tab.recommendationAnalysisFailed;
  }
  if (!append) {
    tab.artworkGeneration = (tab.artworkGeneration || 0) + 1;
    delete tab.resumePrefetchAt;
    tab.items = []; tab.errors = {}; tab.loadError = false;
    tab.retainedFeedWorks = new Map();
    delete tab.retainedFeedHeights;
    delete tab.expiredFeedWorks;
    delete tab.expiredFeedTokens;
    prepareRecommendationProfile(tab, visibleLikes, true, analysis);
  }
  if (tab.recommendationProfileDirty) {
    if (append) prepareRecommendationProfile(tab, visibleLikes, false, analysis);
    tab.recommendationProfileDirty = false;
  }
  const groups = selectRecommendationGroups(tab, eligible);
  tab.hasMore = recommendationPoolsHaveMore(tab.recommendationPools);
  if (!groups.length) {
    tab.loading = pages.pending.size > 0;
    tab.recommendationPaused = tab.hasMore;
    if (activeId === tab.id) render();
    if (typeof scheduleRule34Recovery === 'function') scheduleRule34Recovery(tab);
    await Promise.all([...pages.pending.values()].map(job => job.promise));
    return;
  }
  tab.loading = true;
  if (activeId === tab.id) render();
  try {
    const valid = () => alive() && version === tab.recommendationVersion && !controller.signal.aborted;
    const previousCount = tab.items.length;
    const successfulSources = new Set(), readyResults = [];
    const backgroundKey = `${selectedRating(tab)}:${[...tab.selectedSources].sort().join(',')}`;
    let background = tab.recommendationBackgroundKey === backgroundKey
      ? tab.recommendationBackground || [] : [];
    let backgroundStarted = false;
    tab.loadError = false;
    const jobs = groups.flatMap(group => group.streams.filter(stream =>
      stream.sources.length && (!stream.retryAt || stream.retryAt <= Date.now()))
      .flatMap(stream => stream.sources.filter(source => eligible(group, stream, source))
        .map(source => ({ group, source, page: stream.nextPage }))));

    // Only committed results split a combined stream. A cancelled worker leaves
    // the original source pages intact; each request has its own captured page.
    const sourceStream = ({ group, source, page }) => {
      const stream = group.streams.find(value => value.nextPage === page && value.sources.includes(source));
      if (!stream || stream.sources.length === 1) return stream;
      const child = { ...stream, sources: [source] };
      stream.sources = stream.sources.filter(value => value !== source);
      group.streams.push(child);
      return child;
    };
    const publishReady = async () => {
      if (!valid() || !readyResults.length) return;
      const results = readyResults.splice(0);
      const candidateGroups = results.map(({ group, response }) =>
        ({ kind: group.kind, items: response?.items || [] }));
      let ranked, rankingCuration, prefix, prefixLength, prefixRevision;
      do {
        prefix = tab.items; prefixLength = prefix.length;
        prefixRevision = CatalogLogic.groupingRevision?.(prefix) || 0;
        rankingCuration = contentPreferences.curation;
        ranked = candidateGroups.some(group => group.items.length)
          ? await mergeRecommendationsAsync(visibleLikes, prefix,
            candidateGroups, selectedRating(tab), recommendationTagPreferences, tab.recommendationSeed,
            { background, recentKeys: tab.recommendationRecentKeys, curation: rankingCuration }) : prefix;
        if (!valid()) return;
      } while (prefix !== tab.items || prefixLength !== tab.items.length ||
        prefixRevision !== (CatalogLogic.groupingRevision?.(tab.items) || 0) ||
        JSON.stringify(rankingCuration) !== JSON.stringify(contentPreferences.curation));
      // Progress must count the same eligible works that the grid can display.
      // Pending views, saved aliases and manual hides cannot keep an invisible
      // feed auto-loading; rendered cards retain their current visit slots.
      const items = filterFeedWorks(ranked, tab, true, 'recommendations', true);

      // Commit cards and just their settled source cursors together. Failures
      // dominate successes throughout this round, even across partial batches.
      for (const result of results) {
        const { group, source, page, response, error, requestOrder } = result;
        const stream = sourceStream(result);
        if (!stream) continue;
        const message = response?.errors?.[source] || (error &&
          `${error.message || 'Источник сейчас недоступен.'}${error.status ? ` HTTP ${error.status}` : ''}`);
        if (message) {
          tab.errors[source] = message;
          const paused = deferRecommendationSource(group, stream, source,
            message, response?.retryAt?.[source] ?? error?.retryAt);
          if (!paused.querySpecific) {
            const previous = sourceFailures.get(source);
            sourceFailures.set(source, { error: paused.error, failures: paused.failures,
              retryAt: Math.max(previous?.retryAt || 0, paused.retryAt),
              serverRetryAt: Math.max(previous?.serverRetryAt || 0, paused.serverRetryAt || 0),
              blockThrough: pages.state.requestOrder || 0, needsSettings: paused.needsSettings });
          }
        } else {
          const failure = sourceFailures.get(source);
          // A response which was already in flight when a peer query failed is
          // usable content, not evidence that the newer outage has recovered.
          if (failure && requestOrder > failure.blockThrough && !(failure.serverRetryAt > Date.now()))
            sourceFailures.delete(source);
          if (!sourceFailures.has(source)) successfulSources.add(source);
          if (!sourceFailures.has(source)) {
            if (response?.notices?.[source]) tab.errors[source] = response.notices[source];
            else delete tab.errors[source];
          }
          stream.nextPage = page + 1;
          stream.sources = stream.nextPage < 100 && response?.hasMoreSources?.includes(source) ? [source] : [];
          stream.retryAt = 0; stream.failures = 0;
          delete stream.serverRetryAt;
          delete stream.error; delete stream.needsSettings; delete stream.querySpecific;
        }
      }
      settleRecommendationSourceRetries(tab, sourceFailures, successfulSources);
      tab.items = items;
      tab.hasMore = recommendationPoolsHaveMore(tab.recommendationPools);
      rememberItems(items);
      if (activeId === tab.id) render();
      if (typeof scheduleRule34Recovery === 'function') scheduleRule34Recovery(tab);
      // Calibration is supplementary. Enqueue it after the first usable cards,
      // behind visible source work, and never hold a publication for it.
      if (!backgroundStarted && visibleLikes.length >= 24 && items.length) {
        backgroundStarted = true;
        void loadRecommendationBackground(tab, controller.signal).then(value => { background = value; }).catch(() => {});
      }
    };
    await Promise.all(jobs.map(job => pages.run(pageKey(job.group, job.source, job.page), async () => {
      const requestOrder = pages.state.requestOrder = (pages.state.requestOrder || 0) + 1;
      const params = new URLSearchParams({ q: job.group.query, page: String(job.page),
        sources: job.source, rating: tab.rating, sort: 'recent', kind: 'illustrations' });
      let result;
      try { result = { ...job, requestOrder, response: await request(`/api/search?${params}`, { signal: controller.signal }) }; }
      catch (error) { result = { ...job, requestOrder, error }; }
      if (!valid()) return;
      readyResults.push(result);
      // All concurrently progressing source pages share the generation's rank
      // publication queue. An older peer cannot overwrite a newer prefix.
      await pages.publish(async () => {
        try { await publishReady(); }
        catch (error) {
          // Invalidate queued publications before rejecting this one. Waiting
          // for Promise.all's outer catch leaves a window for a peer commit.
          if (valid()) { tab.loadError = true; controller.abort(); }
          throw error;
        }
      });
    })));
    if (!valid()) return;
    tab.emptyRecommendationRounds = tab.items.length === previousCount
      ? (tab.emptyRecommendationRounds || 0) + 1 : 0;
    tab.hasMore = recommendationPoolsHaveMore(tab.recommendationPools);
    const ready = Object.values(tab.recommendationPools || {}).flat().some(group =>
      group.streams.some(stream => stream.sources.length && (!stream.retryAt || stream.retryAt <= Date.now())));
    tab.recommendationPaused = tab.hasMore && (!ready || tab.emptyRecommendationRounds >= 4);
  } catch {
    if (alive() && version === tab.recommendationVersion && !controller.signal.aborted) {
      // A failed publication must stop its peers and leave uncommitted pages
      // available to Retry, while keeping any prefix already on screen.
      tab.loadError = true;
      controller.abort();
    }
  } finally {
    if (version === tab.recommendationVersion) {
      tab.loading = !controller.signal.aborted && pages.pending.size > 0;
      if (activeId === tab.id) render();
      if (typeof scheduleRule34Recovery === 'function') scheduleRule34Recovery(tab);
    }
  }
}

function decorateFollowItems(follow, source, items) {
  return follow.source === 'danbooru' && (source === 'gelbooru' || source === 'rule34' || source === 'sankaku')
    ? items.map(item => ({ ...item,
      followedArtistTag: follow.gelbooruTag || follow.artistId,
      followedArtistName: follow.name })) : items;
}

function waitFollowRequest(delay, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      reject(Object.assign(new Error('Cancelled'), { name: 'AbortError' }));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort);
      resolve();
    }, delay);
    if (signal?.aborted) abort();
    else signal?.addEventListener('abort', abort, { once: true });
  });
}

function followSourceNeedsSettings(message) {
  return /HTTP 401|user id|api key|ключ API|авторизуйтесь/i.test(message);
}

async function requestFollowSource(entry, signal) {
  if (entry.source !== 'rule34') {
    const providers = requestFollowSource.providers ||= {};
    const state = providers[entry.source] ||= { retryAt: 0, failures: 0, message: '' };
    if (signal.aborted) throw Object.assign(new Error('Cancelled'), { name: 'AbortError' });
    if (state.retryAt > Date.now())
      throw Object.assign(new Error(state.message), { retryAt: state.retryAt, cooledDown: true });
    const requestOrder = state.requestOrder = (state.requestOrder || 0) + 1;
    try {
      const response = await request(entry.path, { signal });
      if (response.errors?.[entry.source]) throw Object.assign(new Error(response.errors[entry.source]),
        { retryAt: response.retryAt?.[entry.source] });
      if (requestOrder > (state.blockThrough || 0)) {
        state.retryAt = 0; state.failures = 0; state.message = '';
      }
      return response;
    } catch (error) {
      if (error.name === 'AbortError' || signal.aborted) throw error;
      if (/HTTP (?:400|413|414|422)\b/i.test(error.message || '')) {
        error.retryAt = Infinity;
        throw error;
      }
      state.message = error.message || 'Источник сейчас недоступен.';
      state.failures++;
      state.blockThrough = state.requestOrder;
      state.retryAt = Math.max(state.retryAt, followSourceNeedsSettings(state.message) ? Infinity :
        error.retryAt || Date.now() + Math.min(60000, 10000 * 2 ** Math.min(state.failures - 1, 3)));
      error.retryAt = state.retryAt;
      throw error;
    }
  }
  const state = requestFollowSource.rule34 ||= {
    tail: Promise.resolve(), nextAt: 0, retryAt: 0, failures: 0, message: ''
  };
  const previous = state.tail;
  let release;
  state.tail = new Promise(resolve => { release = resolve; });
  await previous;
  let requestedAt = 0;
  try {
    if (signal.aborted) throw Object.assign(new Error('Cancelled'), { name: 'AbortError' });
    if (state.retryAt > Date.now())
      throw Object.assign(new Error(state.message), { retryAt: state.retryAt, cooledDown: true });
    if (state.nextAt > Date.now()) await waitFollowRequest(state.nextAt - Date.now(), signal);
    requestedAt = Date.now();
    const response = await request(entry.path, { signal });
    if (response.errors?.rule34) throw Object.assign(new Error(response.errors.rule34),
      { retryAt: response.retryAt?.rule34 });
    state.failures = 0;
    state.retryAt = 0;
    state.message = '';
    return response;
  } catch (error) {
    if (error.name === 'AbortError' || signal.aborted) throw error;
    if (!error.cooledDown) {
      state.message = error.message || 'Источник сейчас недоступен.';
      state.failures++;
      state.retryAt = followSourceNeedsSettings(state.message) ? Infinity :
        error.retryAt || Date.now() + Math.min(60000, 10000 * 2 ** Math.min(state.failures - 1, 3));
    }
    error.retryAt = state.retryAt;
    throw error;
  } finally {
    if (requestedAt) state.nextAt = requestedAt + 1000;
    release();
  }
}

function deferFollowStream(stream, error) {
  stream.error = error.message || String(error);
  stream.failures = (stream.failures || 0) + 1;
  stream.retryAt = error.retryAt ?? (followSourceNeedsSettings(stream.error) ? Infinity :
    Date.now() + Math.min(60000, 10000 * 2 ** Math.min(stream.failures - 1, 3)));
}

function followStreamRetryAt(stream) {
  if (stream.buffer.length) return 0;
  return Math.max(stream.retryAt || 0,
    stream.source === 'rule34' ? requestFollowSource.rule34?.retryAt || 0 :
      typeof requestFollowSource === 'function' ? requestFollowSource.providers?.[stream.source]?.retryAt || 0 : 0);
}

function scheduleFollowRetry(tab) {
  if (tab.followRetryTimer) clearTimeout(tab.followRetryTimer);
  tab.followRetryTimer = null;
  if (!findTab(tab.id) || activeId !== tab.id) return;
  const pending = (tab.followStreams || [])
    .filter(stream => stream.error || followStreamRetryAt(stream) > Date.now())
    .map(followStreamRetryAt).filter(Number.isFinite);
  if (!pending.length) return;
  tab.followRetryTimer = setTimeout(() => {
    tab.followRetryTimer = null;
    if (findTab(tab.id) && activeId === tab.id) {
      if (tab.followStreams.some(stream => followStreamRetryAt(stream) <= Date.now())) void loadMoreFollows(tab);
      else scheduleFollowRetry(tab);
    }
  }, Math.max(500, Math.min(60000, Math.min(...pending) - Date.now())));
}

async function updateFollowFeed(tab) {
  const version = tab.followVersion, rating = tab.rating;
  const selection = selectedRating(tab);
  const revision = tab.followUpdateRevision || 0;
  const fallback = () => {
    const feed = CatalogLogic.buildFollowFeed(tab.followGroups, rating, Number.MAX_SAFE_INTEGER, selection);
    return { items: CatalogLogic.groupWorks(feed.items), newKeys: feed.newKeys };
  };
  const cache = tab.followComputed;
  const cached = cache?.version === version && cache.rating === rating && cache.selection === selection && cache.revision === revision;
  let feed = cached
    ? cache.feed : typeof DartCatalogJobs !== 'undefined'
    ? await DartCatalogJobs.run('followFeed', [tab.followGroups, rating, selection], fallback) : fallback();
  if (version !== tab.followVersion || rating !== tab.rating || selection !== selectedRating(tab) || revision !== (tab.followUpdateRevision || 0)) return;
  const completed = tab.followComputed;
  const remembered = completed?.remembered || new WeakSet();
  let records = completed?.records;
  if (!cached) {
    const previous = completed?.rating === rating ? records : null;
    records = new Map();
    let items = feed.items.map(item => {
      // A worker returns fresh objects for the entire feed after one source
      // response. Retain unchanged works and their learned metadata so filters,
      // attribution, curation and the item index keep their warm identities.
      const signature = JSON.stringify(item), known = previous?.get(item.key);
      const canonical = known?.signature === signature ? known.item : item;
      records.set(item.key, { signature, item: canonical });
      return canonical;
    });
    if (completed?.feed.items.length === items.length &&
        items.every((item, index) => item === completed.feed.items[index])) items = completed.feed.items;
    feed = { ...feed, items };
  }
  tab.followComputed = { version, rating, selection, revision, feed, records, remembered };
  const filtered = CatalogLogic.filterWorks(feed.items, contentPreferences);
  if (contentPreferences.hideViewedAndSaved) learnKnownWorkAliases(filtered);
  let knownTokens;
  const visible = contentPreferences.hideViewedAndSaved ? filtered.filter(item =>
    isRetainedFeedWork(tab, item) || !CatalogLogic.workHistoryTokens(item)
      .some(token => (knownTokens ||= knownWorkTokens()).has(token))) : filtered;
  const visibleKeys = new Set(visible.flatMap(item => item.memberKeys || [item.key]));
  const newKeys = new Set([...feed.newKeys].filter(key => visibleKeys.has(key)));
  // A later catalog upload can join an already displayed work. Its upload
  // date must not turn that existing slot into a newly arrived artwork.
  if (newKeys.size && tab.retainedFeedWorks?.size) for (const item of visible) {
    if (!isRetainedFeedWork(tab, item)) continue;
    for (const key of item.memberKeys || [item.key])
      if (!tab.newKeys?.has(key)) newKeys.delete(key);
  }
  tab.items = orderFollowFeedItems(tab, visible, newKeys);
  tab.followStableRating = tab.rating;
  tab.newKeys = newKeys;
  tab.followSourceErrors = Object.fromEntries(tab.followStreams.filter(stream => stream.error)
    .map(stream => [stream.source, stream.error]));
  tab.hasMore = tab.followStreams.some(stream => followStreamRetryAt(stream) <= Date.now());
  const changed = visible.filter(item => !remembered.has(item));
  if (changed.length) {
    rememberItems(changed);
    changed.forEach(item => remembered.add(item));
  }
  if (typeof scheduleFollowRetry === 'function') scheduleFollowRetry(tab);
  return true;
}

function nextFollowRandomSeed(tab) {
  const previous = tab.followRandomSeed >>> 0;
  let seed = Math.floor(Math.random() * 0x100000000) >>> 0 || 1;
  if (seed === previous) seed = (seed + 1) >>> 0 || 1;
  tab.followRandomSeed = seed;
}

function orderFollowFeedItems(tab, items, newKeys = new Set()) {
  const mode = tab.followOrder === 'random' ? 'random' : 'date';
  const generation = `${tab.rating}:${mode}:${mode === 'random' ? tab.followRandomSeed >>> 0 : 0}`;
  const previous = tab.followPresentationKey === generation || !tab.followPresentationKey &&
    mode === 'date' && tab.followStableRating === tab.rating ? tab.items : [];
  tab.followPresentationKey = generation;
  return mode === 'random' ? CatalogLogic.randomFollowFeedItems(previous, items, tab.followRandomSeed) :
    CatalogLogic.stableFeedItems(previous, items, newKeys);
}

async function setFollowOrder(tab, value) {
  if (!['date', 'random'].includes(value)) return;
  const unchanged = (tab.followOrder || 'date') === value;
  const generation = `${tab.rating}:${value}:${value === 'random' ? tab.followRandomSeed >>> 0 : 0}`;
  if (unchanged && (value !== 'random' || tab.followPresentationKey === generation)) return;
  tab.followOrder = value;
  if (value === 'random' && (!unchanged || !Number.isInteger(tab.followRandomSeed) ||
      tab.followRandomSeed <= 0 || tab.followRandomSeed > 0xffffffff)) nextFollowRandomSeed(tab);
  tab.virtualState = {}; tab.artworkLists?.clear();
  tab.scrollTop = 0;
  if (activeId === tab.id) main.scrollTop = 0;
  let loaded = tab.items || [];
  if (value === 'date') {
    const cache = tab.followComputed;
    const canonical = cache?.version === tab.followVersion && cache.rating === tab.rating
      ? cache.feed.items : [];
    const positions = new Map();
    canonical.forEach((item, index) => {
      for (const key of [item.key, ...(item.memberKeys || [])]) positions.set(key, index);
    });
    loaded = loaded.map((item, index) => {
      const keys = [item.key, ...(item.memberKeys || [])];
      return { item, index, isNew: keys.some(key => tab.newKeys?.has(key)),
        position: Math.min(...keys.map(key => positions.get(key) ?? Infinity)),
        published: Date.parse(item.published || '') || 0 };
    }).sort((a, b) => Number(b.isNew) - Number(a.isNew) || a.position - b.position ||
      b.published - a.published || a.index - b.index).map(entry => entry.item);
  }
  // A mode change only reorders the already loaded cards. Waiting for grouping
  // lets fingerprint/provider revisions cancel the requested presentation while
  // leaving the selected mode above the old rows. Evidence can publish later;
  // orderFollowFeedItems keeps this mode's prefix when that worker completes.
  tab.items = orderFollowFeedItems(tab, loaded, tab.newKeys || new Set());
  if (activeId === tab.id) render();
  saveSession();
}

async function flushFollowUpdate(tab) {
  if (tab.followUpdateTimer) clearTimeout(tab.followUpdateTimer);
  tab.followUpdateTimer = null;
  tab.followUpdatePending = true;
  if (tab.followUpdateJob) return tab.followUpdateJob;
  const signature = () => JSON.stringify([
    tab.followVersion, tab.rating, tab.followOrder, tab.followRandomSeed, tab.followUpdateRevision || 0, contentPreferences,
    tab.loading, tab.followLoadingMore, tab.followLoadError, tab.seenError,
    tab.followErrors, tab.followSourceNotices,
    (tab.followStreams || []).map(stream => [stream.follow?.key, stream.source,
      stream.nextPage, stream.buffer.length, stream.error,
      String(followStreamRetryAt(stream)), followStreamRetryAt(stream) <= Date.now()])
  ]);
  tab.followUpdateJob = (async () => {
    while (tab.followUpdatePending) {
      tab.followUpdatePending = false;
      const previous = tab.followPublication, cache = tab.followComputed;
      // A final flush often repeats the regular workers' completed revision.
      // Retry readiness and display preferences can still change independently.
      if (cache?.version === tab.followVersion && cache.rating === tab.rating &&
          cache.revision === (tab.followUpdateRevision || 0) &&
          previous?.feed === cache.feed && previous.signature === signature()) continue;
      if (await updateFollowFeed(tab)) {
        tab.followPublication = { feed: tab.followComputed.feed, signature: signature() };
        tab.followPublished = true;
        if (activeId === tab.id) render();
      }
    }
  })();
  try { await tab.followUpdateJob; }
  finally { tab.followUpdateJob = null; }
}

function queueFollowUpdate(tab, version) {
  tab.followUpdateRevision = (tab.followUpdateRevision || 0) + 1;
  if (!tab.followCacheTimer) tab.followCacheTimer = setTimeout(() => {
    tab.followCacheTimer = null;
    saveFollowPreview(tab, version);
  }, 5000);
  if (!tab.followPublished) { flushFollowUpdate(tab); return; }
  if (tab.followUpdateTimer) return;
  tab.followUpdateTimer = setTimeout(() => {
    tab.followUpdateTimer = null;
    if (findTab(tab.id) && version === tab.followVersion && !tab.followController.signal.aborted)
      flushFollowUpdate(tab);
  }, 150);
}

function saveFollowPreview(tab, version) {
  if (!findTab(tab.id) || version !== tab.followVersion || !tab.followGroups?.length || selectedRating(tab) === 'none') return;
  const isNew = item => [item.key, ...(item.memberKeys || [])]
    .some(key => tab.newKeys?.has(key));
  const groups = tab.followGroups.map(({ follow, items }) => ({ key: follow.key,
    items: [...items].sort((a, b) => Number(isNew(b)) - Number(isNew(a)) ||
      (Date.parse(b.published || '') || 0) - (Date.parse(a.published || '') || 0))
      .slice(0, 12) })).filter(group => group.items.length);
  if (!groups.length) return;
  const body = JSON.stringify({ groups });
  const rating = selectedRating(tab);
  const writes = tab.followCacheWrites ||= new Map();
  const previous = writes.get(rating);
  if (previous?.body === body) return previous.promise;
  // Only the latest pending or successful body can suppress a write: an older
  // success must not skip a requested revert queued after a different body.
  const entry = { body };
  writes.set(rating, entry);
  entry.promise = tab.followCacheSaveTail = (tab.followCacheSaveTail || Promise.resolve()).catch(() => {})
    .then(() => request(`/api/follows/cache?rating=${rating}`, { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body })).catch(() => {
        if (writes.get(rating) === entry) writes.delete(rating);
      });
  return entry.promise;
}

async function markFollowItemsSeen(tab, groups, version) {
  if (activeId !== tab.id || !groups.length) return;
  const seen = tab.followSeenKeys ||= new Set();
  const token = (key, work) => `${tab.rating}:${key}:${work}`;
  const displayedKeys = new Set(tab.items.flatMap(item => item.memberKeys || [item.key]));
  const workKeys = new Map();
  for (const { follow, items } of groups) {
    if (!workKeys.has(follow.key)) workKeys.set(follow.key, new Set());
    for (const item of items)
      if (displayedKeys.has(item.key) && !seen.has(token(follow.key, item.key)))
        workKeys.get(follow.key).add(item.key);
  }
  const entries = [...workKeys].filter(([, keys]) => keys.size);
  for (let i = 0; i < entries.length; i += 100) {
    if (version !== tab.followVersion || activeId !== tab.id) return;
    const batch = entries.slice(i, i + 100);
    try {
      follows = await request('/api/follows/seen', { method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: batch.map(([key]) => key), rating: tab.rating,
          workKeys: Object.fromEntries(batch.map(([key, keys]) =>
            [key, [...keys].slice(0, 100)])) }) });
      followedKeys = new Set(follows.map(CatalogLogic.followKey));
      for (const [key, keys] of batch) for (const work of [...keys].slice(0, 100))
        seen.add(token(key, work));
    } catch { tab.seenError = true; }
  }
}

async function loadFollowFeed(tab, reshuffle = false) {
  const alive = () => findTab(tab.id) === tab || tab.artworkDetached && !tab.artworkDisposed;
  if (!alive()) return;
  tab.artworkGeneration = (tab.artworkGeneration || 0) + 1;
  if (tab.followOrder === 'random' && (reshuffle || !Number.isInteger(tab.followRandomSeed) ||
      tab.followRandomSeed <= 0 || tab.followRandomSeed > 0xffffffff)) {
    nextFollowRandomSeed(tab);
    if (!tab.artworkDetached) saveSession();
  }
  delete tab.resumePrefetchAt;
  tab.retainedFeedWorks = new Map();
  delete tab.retainedFeedHeights;
  delete tab.expiredFeedWorks;
  delete tab.expiredFeedTokens;
  tab.followController?.abort();
  if (tab.followUpdateTimer) clearTimeout(tab.followUpdateTimer);
  tab.followUpdateTimer = null;
  if (tab.followCacheTimer) clearTimeout(tab.followCacheTimer);
  tab.followCacheTimer = null;
  tab.followPublished = !!tab.items?.length;
  tab.followSeenKeys = new Set();
  if (tab.followRetryTimer) clearTimeout(tab.followRetryTimer);
  const controller = new AbortController();
  tab.followController = controller;
  const version = tab.followVersion = (tab.followVersion || 0) + 1;
  if (stopEmptyRatingFeed(tab)) return;
  const previousGroups = new Map((tab.followGroups || []).map(group => [group.follow.key, group]));
  tab.loading = true; tab.items ||= []; tab.newKeys ||= new Set();
  tab.followStreams = []; tab.hasMore = false;
  tab.followLoadingMore = false; tab.followLoadError = false;
  tab.followErrors = []; tab.followSourceErrors = {}; tab.followSourceNotices = {}; tab.seenError = false;
  if (requestFollowSource.rule34?.retryAt === Infinity)
    requestFollowSource.rule34.retryAt = 0;
  for (const state of Object.values(requestFollowSource.providers || {}))
    if (state.retryAt === Infinity) state.retryAt = 0;
  if (activeId === tab.id) render();
  try {
    const [available, cache] = await Promise.all([refreshFollows(),
      request(`/api/follows/cache?rating=${selectedRating(tab)}`).catch(() => null)]);
    if (!alive() || version !== tab.followVersion || controller.signal.aborted) return;
    if (!available) {
      tab.followErrors.push('Не удалось загрузить список подписок.');
      return;
    }
    const cacheAge = Date.now() - Date.parse(cache?.savedAt || '');
    const cached = cacheAge >= 0 && cacheAge < 48 * 60 * 60 * 1000 &&
      Array.isArray(cache?.groups) ? new Map(cache.groups.filter(group => group &&
        typeof group.key === 'string' && Array.isArray(group.items))
        .map(group => [group.key, CatalogLogic.filterCatalogItems(group.items)])) : new Map();
    tab.followGroups = follows.map(follow => ({ follow,
      items: [...(previousGroups.get(follow.key)?.items?.length
        ? previousGroups.get(follow.key).items : cached.get(follow.key) || [])] }));
    // Cached evidence must be available before fresh provider replies replace
    // their records; a signed URL renewal does not change the underlying image.
    for (const group of tab.followGroups) {
      const known = group.items.filter(item => item.visualHash && item.visualPHash);
      if (known.length) addCatalogVisualHashes(known, controller.signal);
    }
    const jobs = tab.followGroups.flatMap(group =>
      CatalogLogic.followFeedRequests(group.follow, tab.rating,
        settings.hasApiKey, settings.hasRule34ApiKey, 0, settings.sankakuAvailable).map(entry => ({ group, entry })));
    for (const group of tab.followGroups) {
      const allowed = new Set(jobs.filter(job => job.group === group).map(job => job.entry.source));
      group.items = group.items.filter(item => allowed.has(item.source));
    }
    if (tab.followGroups.some(group => group.items.length)) await flushFollowUpdate(tab);
    const sourceJobs = new Map();
    for (const job of jobs) {
      if (!sourceJobs.has(job.entry.source)) sourceJobs.set(job.entry.source, []);
      sourceJobs.get(job.entry.source).push(job);
    }
    const valid = () => alive() && version === tab.followVersion && !controller.signal.aborted;
    const pages = DartProviderPages.scope(tab, 'following', version, controller.signal);
    const worker = async queue => {
      while (queue.length && valid()) {
        const { group, entry } = queue.shift();
        const stream = { follow: group.follow, source: entry.source, group,
          buffer: [], nextPage: 0, emptyPages: 0 };
        await pages.run(`${group.follow.key}:${entry.source}`, async () => {
        try {
          const response = await requestFollowSource(entry, controller.signal);
          if (!valid()) return;
          Object.assign(tab.followSourceNotices, response.notices || {});
          if (response.errors?.[entry.source]) throw Object.assign(new Error(response.errors[entry.source]),
            { retryAt: response.retryAt?.[entry.source] });
          const items = decorateFollowItems(group.follow, entry.source, response.items || []);
          group.items = [...group.items.filter(item => item.source !== entry.source), ...items.slice(0, 24)];
          const hasMore = entry.path.startsWith('/api/profile?') ? response.hasMore :
            response.hasMoreSources?.includes(entry.source);
          stream.buffer = items.slice(24);
          stream.nextPage = hasMore ? 1 : null;
        } catch (error) {
          if (!valid() || error.name === 'AbortError') return;
          deferFollowStream(stream, error);
        }
        if (stream.error || stream.buffer.length || stream.nextPage !== null)
          tab.followStreams.push(stream);
        queueFollowUpdate(tab, version);
        }, { ...stream, buffer: [] });
      }
    };
    // Each provider progresses independently; one unavailable site cannot pin
    // every worker ahead of the remaining healthy authors. The common cache
    // and transport still enforce the existing total HTTP/foreground budget.
    await Promise.all([...sourceJobs].map(async ([source, queue]) => {
      await Promise.all(Array.from({ length: source === 'rule34' ? 1 : Math.min(2, queue.length) }, () => worker(queue)));
      if (valid()) { await flushFollowUpdate(tab); saveFollowPreview(tab, version); }
    }));
    if (!valid()) return;
    await flushFollowUpdate(tab);
    saveFollowPreview(tab, version);
    await markFollowItemsSeen(tab, tab.followGroups, version);
  } finally {
    if (version === tab.followVersion) {
      if (tab.followUpdateTimer) clearTimeout(tab.followUpdateTimer);
      tab.followUpdateTimer = null;
      if (tab.followCacheTimer) clearTimeout(tab.followCacheTimer);
      tab.followCacheTimer = null;
      tab.loading = false;
      if (!controller.signal.aborted) tab.lastLoadedAt = Date.now();
      if (alive() && activeId === tab.id) render();
      scheduleFollowRetry(tab);
    }
  }
}

async function loadMoreFollows(tab) {
  const alive = () => findTab(tab.id) === tab || tab.artworkDetached && !tab.artworkDisposed;
  if (!alive()) return;
  const version = tab.followVersion;
  const controller = tab.followController ||= new AbortController();
  const pages = DartProviderPages.scope(tab, 'following', version, controller.signal);
  const key = stream => `${stream.follow.key}:${stream.source}`;
  const ready = (tab.followStreams || []).filter(stream =>
    followStreamRetryAt(stream) <= Date.now() && !pages.has(key(stream)));
  const batch = [], selectedSources = new Set();
  for (const stream of ready) if (!selectedSources.has(stream.source) && batch.length < 3) {
    batch.push(stream); selectedSources.add(stream.source);
  }
  for (const stream of ready) if (batch.length < 3 && !batch.includes(stream)) batch.push(stream);
  if (!batch.length) {
    updateFollowFeed(tab);
    scheduleFollowRetry(tab);
    await Promise.all([...pages.pending.values()].map(job => job.promise));
    return;
  }
  tab.followLoadingMore = true;
  if (activeId === tab.id) render();
  tab.followStreams = tab.followStreams.filter(stream => !batch.includes(stream));
  try {
    const seenGroups = [], received = [];
    const valid = () => alive() && version === tab.followVersion && !controller.signal.aborted;
    const publish = async () => {
      if (!valid() || !received.length) return;
      const results = received.splice(0);
      tab.followLoadError = false;
      for (const { stream, items, error } of results) {
        if (error) deferFollowStream(stream, error);
        else if (items?.length) {
          stream.group.items.push(...items);
          seenGroups.push({ follow: stream.follow, items });
        }
        if (error || stream.buffer.length || stream.nextPage !== null) tab.followStreams.push(stream);
      }
      tab.followUpdateRevision = (tab.followUpdateRevision || 0) + 1;
      await updateFollowFeed(tab);
      if (!valid()) return;
      if (activeId === tab.id) render();
      saveFollowPreview(tab, version);
    };
    const fetchStream = async stream => {
      if (stream.buffer.length)
        return { stream, items: stream.buffer.splice(0, 24) };
      const page = stream.nextPage;
      const entry = CatalogLogic.followFeedRequests(stream.follow, tab.rating,
        settings.hasApiKey, settings.hasRule34ApiKey, page, settings.sankakuAvailable)
        .find(request => request.source === stream.source);
      if (!entry || page === null) return { stream, items: [] };
      try {
        const response = await requestFollowSource(entry, controller.signal);
        Object.assign(tab.followSourceNotices, response.notices || {});
        if (response.errors?.[stream.source]) throw Object.assign(new Error(response.errors[stream.source]),
          { retryAt: response.retryAt?.[stream.source] });
        const items = decorateFollowItems(stream.follow, stream.source, response.items || []);
        const existingKeys = new Set(stream.group.items.map(item => item.key));
        const repeated = items.length > 0 && items.every(item => existingKeys.has(item.key));
        const hasMore = entry.path.startsWith('/api/profile?') ? response.hasMore :
          response.hasMoreSources?.includes(stream.source);
        stream.emptyPages = items.length ? 0 : stream.emptyPages + 1;
        stream.nextPage = hasMore && page < 99 && !repeated &&
          stream.emptyPages < 3 ? page + 1 : null;
        stream.buffer = repeated ? [] : items.slice(24);
        delete stream.error;
        delete stream.retryAt;
        stream.failures = 0;
        return { stream, items: repeated ? [] : items.slice(0, 24) };
      } catch (error) { return { stream, error }; }
    };
    const jobs = batch.map(stream => pages.run(key(stream), async () => {
      const result = await fetchStream(stream);
      if (!valid()) return;
      received.push(result);
      await pages.publish(publish);
    }, { ...stream, buffer: [...stream.buffer] }));
    // Keep snapshots of every pending cursor, including a peer page started by
    // an earlier boundary. Detached viewers must never lose that provider.
    tab.followPagingStreams = [...pages.pending.values()].map(job => job.metadata);
    await Promise.all(jobs);
    if (!valid()) return;
    await markFollowItemsSeen(tab, seenGroups, version);
  } finally {
    if (version === tab.followVersion) {
      tab.followLoadingMore = pages.pending.size > 0;
      if (pages.pending.size) tab.followPagingStreams = [...pages.pending.values()].map(job => job.metadata);
      else delete tab.followPagingStreams;
      if (activeId === tab.id) render();
      scheduleFollowRetry(tab);
    }
  }
}

async function loadBookmarks(tab) {
  tab.items = bookmarks;
  tab.loading = !refreshSavedWorks.states?.bookmarks?.loaded;
  if (tab.loading) {
    render();
    if (!await refreshBookmarks()) tab.started = false;
  }
  tab.items = bookmarks;
  tab.loading = false;
  if (activeId === tab.id) render();
}

async function loadLikes(tab) {
  tab.items = likes;
  tab.loading = !refreshSavedWorks.states?.likes?.loaded;
  if (tab.loading) {
    render();
    if (!await refreshLikes()) tab.started = false;
  }
  tab.items = likes;
  tab.loading = false;
  if (activeId === tab.id) render();
}

async function loadSettings() {
  try { settings = await request('/api/settings'); }
  catch { toast('Настройки не удалось прочитать'); }
  if (currentTab()?.kind === 'settings') render();
}

async function loadPrivacyStatus() {
  if (privacySaving) return;
  const revision = ++privacyRevision;
  try {
    const status = await request('/api/privacy');
    if (revision === privacyRevision && !privacySaving) privacyStatus = status;
  }
  catch { toast('Could not read privacy settings'); }
  finally {
    privacyLoading = false;
    if (currentTab()?.kind === 'settings') render();
  }
}

const privacyErrors = {
  'unsupported-windows': 'Screen capture protection requires Windows 10 version 2004 or later.',
  'composition-unavailable': 'Windows desktop composition is unavailable.',
  'apply-failed': 'Windows could not change capture protection for this window.',
  'verify-failed': 'Windows did not confirm capture protection for this window.',
  'window-unavailable': 'Open the DART desktop window to change this setting.',
  'save-failed': 'Could not save capture protection. Check the current status.'
};

async function savePrivacyStatus(enabled) {
  if (privacySaving) return;
  privacySaving = true;
  ++privacyRevision;
  render();
  try {
    const response = await fetch('/api/privacy', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hideFromScreenCapture: enabled })
    });
    privacyStatus = await response.json();
    if (!response.ok) toast(privacyErrors[privacyStatus.error] || 'Could not change capture protection');
  } catch { toast('Could not change capture protection'); }
  finally { privacySaving = false; render(); }
}

async function loadContentPreferences() {
  if (contentPreferencesSaving) return;
  const revision = ++contentPreferencesRevision;
  try {
    const saved = await request('/api/content-preferences');
    if (revision !== contentPreferencesRevision) return;
    contentPreferences = {
      language: ['en', 'ru', 'de'].includes(saved.language) ? saved.language : 'en',
      aiMode: ['all', 'generated', 'generated-and-assisted'].includes(saved.aiMode)
        ? saved.aiMode : 'all',
      hideFurry: saved.hideFurry === true,
      excludedTags: CatalogLogic.normalizeExcludedTags(saved.excludedTags),
      hiddenAuthors: (Array.isArray(saved.hiddenAuthors) ? saved.hiddenAuthors : [])
        .filter(author => CatalogLogic.hiddenAuthorKey(author)),
      attributionPriority: ['creator', 'original', 'uploader'].includes(saved.attributionPriority)
        ? saved.attributionPriority : 'creator',
      hideViewedAndSaved: saved.hideViewedAndSaved === true,
      hideFollowedArtists: saved.hideFollowedArtists === true,
      curation: CatalogLogic.normalizeCurationPreferences(saved.curation)
    };
    globalThis.DartI18n?.setLanguage(contentPreferences.language);
  } catch { toast('Фильтры содержимого не удалось прочитать'); }
  if (currentTab()?.kind === 'settings') render();
}

function applyContentPreferences(saved) {
  const before = contentPreferences;
  contentPreferences = { ...saved, hideFurry: saved.hideFurry === true,
    hideFollowedArtists: saved.hideFollowedArtists === true, hiddenAuthors: saved.hiddenAuthors || [],
    curation: CatalogLogic.normalizeCurationPreferences(saved.curation ?? before.curation) };
  globalThis.DartI18n?.setLanguage(contentPreferences.language);
  const curationChanged = JSON.stringify(CatalogLogic.normalizeCurationPreferences(before.curation)) !==
    JSON.stringify(contentPreferences.curation);
  if (curationChanged) {
    const context = curationContext();
    for (const tab of tabs) {
      delete tab.curationViews;
      delete tab.profileGridItems;
      delete tab.profileGridRating;
      tab.virtualState = {};
      tab.artworkLists?.clear();
      if (tab.kind === 'recommendations' && tab.items.length) {
        const items = tab.items, version = tab.recommendationVersion;
        const revision = tab.curationRankRevision = (tab.curationRankRevision || 0) + 1;
        // A large recommendation profile is already ranked in a worker during
        // loading. Keep explicit preference changes off the UI thread too.
        void mergeRecommendationsAsync(context.liked, [], [{ items }], selectedRating(tab),
          recommendationTagPreferences, tab.recommendationSeed, context).then(ranked => {
          if (tab.items !== items || tab.recommendationVersion !== version ||
              tab.curationRankRevision !== revision || !tabs.includes(tab)) return;
          tab.items = ranked;
          tab.virtualState = {};
          if (currentTab() === tab) render();
        }).catch(() => { /* Keep the existing feed; the next batch uses the new factors. */ });
      } else if (tab.kind === 'detail' && tab.related?.length) {
        tab.related = CatalogLogic.rankRelated(tab.item, tab.related, Infinity, context);
        if (tab.virtualState) delete tab.virtualState.related;
      }
    }
    saveSession();
  }
  const contentChanged = ['aiMode', 'hideFurry', 'excludedTags', 'hideViewedAndSaved', 'hiddenAuthors']
    .some(key => JSON.stringify(before[key]) !== JSON.stringify(contentPreferences[key]));
  const followedChanged = (before.hideFollowedArtists === true) !== contentPreferences.hideFollowedArtists;
  if (!contentChanged && !followedChanged) return;
  for (const tab of tabs) {
    if (!contentChanged && !isFollowedArtistFeed(tab, tab.kind === 'detail' ? 'related' : '')) continue;
    tab.retainedFeedWorks = new Map();
    delete tab.retainedFeedHeights;
    delete tab.expiredFeedWorks;
    delete tab.expiredFeedTokens;
    tab.artworkLists?.clear();
    delete tab.curationViews;
    tab.virtualState = {};
    tab.profileBanner = '';
    if (tab.kind === 'follows' && tab.followGroups && tab.followStreams) updateFollowFeed(tab);
    if (tab.kind !== 'recommendations') continue;
    tab.recommendationController?.abort();
    tab.recommendationVersion = (tab.recommendationVersion || 0) + 1;
    // The cancelled generation's finally cannot clear flags after its version
    // changes. Reset them here so filters never strand the active feed loading.
    if (tab.rule34RecoveryTimer) clearTimeout(tab.rule34RecoveryTimer);
    tab.rule34RecoveryTimer = null;
    tab.loading = false; tab.loadError = false; tab.hasMore = false;
    tab.recommendationPaused = false; tab.errors = {};
    tab.started = false;
    tab.items = [];
    tab.recommendationTags = [];
    tab.recommendationTagGroups = { names: [], other: [] };
  }
  const selected = currentTab();
  if (selected?.kind === 'recommendations') startTab(selected);
}

async function saveCurationPreferences(patch) {
  if (contentPreferencesSaving) return;
  contentPreferencesSaving = true;
  ++contentPreferencesRevision;
  const focus = main.querySelector?.('input:focus')?.name;
  main.querySelectorAll('.settings-panel input, .settings-panel select')
    .forEach(input => { input.disabled = true; });
  try {
    const saved = await request('/api/curation-preferences', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch)
    });
    applyContentPreferences(saved);
    toast('Настройки сохранены');
  } catch { toast('Could not save curation settings'); }
  finally {
    contentPreferencesSaving = false;
    render();
    if (focus) main.querySelector(`input[name="${focus}"]`)?.focus();
  }
}

async function setAuthorHidden(author, hidden) {
  if (contentPreferencesSaving || !CatalogLogic.hiddenAuthorKey(author)) return;
  contentPreferencesSaving = true;
  ++contentPreferencesRevision;
  try {
    applyContentPreferences(await request('/api/hidden-authors', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author, hidden })
    }));
    toast(hidden ? 'Author hidden' : 'Author visible again');
  } catch { toast('Failed to change hidden authors'); }
  finally { contentPreferencesSaving = false; render(); }
}

async function saveContentPreferences(next) {
  if (contentPreferencesSaving) return;
  contentPreferencesSaving = true;
  ++contentPreferencesRevision;
  const focus = main.querySelector?.('input:focus, select:focus')?.name;
  main.querySelectorAll('.settings-panel input, .settings-panel select')
    .forEach(input => { input.disabled = true; });
  try {
    const saved = await request('/api/content-preferences', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: next.language || globalThis.DartI18n?.language || 'en', aiMode: next.aiMode,
        hideFurry: next.hideFurry === true,
        excludedTags: CatalogLogic.normalizeExcludedTags(next.excludedTags),
        attributionPriority: next.attributionPriority,
        hideViewedAndSaved: next.hideViewedAndSaved,
        hideFollowedArtists: next.hideFollowedArtists === true })
    });
    applyContentPreferences(saved);
    toast('Настройки сохранены');
  } catch { toast('Не удалось сохранить фильтры'); }
  finally {
    contentPreferencesSaving = false;
    render();
    if (focus) main.querySelector(`[name="${focus}"]`)?.focus();
  }
}

async function loadDetail(tab) {
  tab.detailController?.abort();
  const controller = new AbortController();
  tab.detailController = controller;
  tab.detailLoading = true;
  tab.detailError = false;
  tab.detailAccessMessage = '';
  const item = tab.item;
  const relatedKey = value => typeof CatalogLogic.relatedQueries === 'function'
    ? JSON.stringify([ratingFilterFor(value), CatalogLogic.relatedQueries(value)]) : '';
  const creatorKey = value => typeof CatalogLogic.creatorProfileRef === 'function'
    ? JSON.stringify([ratingFilterFor(value), CatalogLogic.creatorProfileRef(value)]) : '';
  const cachedRelated = typeof CatalogLogic.relatedQueries === 'function' && CatalogLogic.relatedQueries(item).length
    ? relatedKey(item) : '';
  const cachedCreator = typeof CatalogLogic.creatorProfileRef === 'function' && CatalogLogic.creatorProfileRef(item)
    ? creatorKey(item) : '';
  // Cached tags and artist identity are already enough for supplementary rows.
  // Their healthy providers must not wait for the detail provider to time out.
  if (cachedRelated) void loadRelated(tab);
  if (cachedCreator) void loadCreatorWorks(tab);
  const params = new URLSearchParams({ source: item.source, id: item.id,
 });
  try {
    const detail = await request(`/api/detail?${params}`, { signal: controller.signal, priority: 'foreground' });
    if (controller.signal.aborted || findTab(tab.id) !== tab) return;
    if (detail) {
      tab.item = rememberItem(CatalogLogic.mergeDetailPages(tab.item, detail));
      favoritesController().metadata(tab.item);
      void recordViewedWorks([tab.item]);
      tab.artworkRoute?.engine.update(tab.item);
      tab.title = tab.item.title;
      recent = recent.map(entry => entry.key === tab.item.key
        ? CatalogLogic.mergeDetailPages(entry, detail) : entry);
      localStorage.setItem('artcatalog-recent', JSON.stringify(recent));
      refreshSavedDetail(detail);
      saveSession();
    }
  } catch (error) {
    if (controller.signal.aborted || findTab(tab.id) !== tab || error.name === 'AbortError') return;
    if (item.source === 'sankaku' && error.status === 401) tab.detailAccessMessage = error.message;
    else tab.detailError = true;
  }
  if (controller.signal.aborted || findTab(tab.id) !== tab) return;
  tab.detailLoading = false;
  if (activeId === tab.id) render();
  if (findTab(tab.id)) {
    if (!cachedCreator || cachedCreator !== creatorKey(tab.item)) {
      if (cachedCreator) {
        tab.creatorController?.abort();
        tab.creatorStarted = false; tab.creatorLoading = false;
      }
      loadCreatorWorks(tab);
    }
    if (!cachedRelated || cachedRelated !== relatedKey(tab.item)) loadRelated(tab);
    warmArtworkRoute(tab.artworkRoute);
  }
}

async function loadCreatorWorks(tab, retryFailed = false) {
  if (findTab(tab.id) !== tab || tab.creatorLoading || tab.creatorStarted && !retryFailed) return;
  tab.creatorStarted = true;
  const item = tab.item;
  const ref = CatalogLogic.creatorProfileRef(item);
  if (!ref) { tab.creatorWorks = []; if (findTab(tab.id) === tab && activeId === tab.id) render(); return; }
  const unified = ref.source === 'artist';
  if (!retryFailed) {
    tab.creatorCandidates = [];
    tab.creatorWorks = [];
    tab.creatorPages = Object.fromEntries((unified
      ? CatalogLogic.supportedSources : [ref.source]).map(source => [source, 0]));
    tab.creatorPaused = {};
    tab.creatorErrors = {};
  }
  const controller = new AbortController();
  tab.creatorController = controller;
  tab.creatorLoading = true;
  delete tab.creatorErrors.network;
  const rating = ratingFilterFor(item);
  const sources = Object.keys(tab.creatorPages).filter(source => retryFailed
    ? tab.creatorPaused[source] : !tab.creatorPaused[source]);
  if (findTab(tab.id) === tab && activeId === tab.id) render();
  try {
    await Promise.all(sources.map(async source => {
      for (let batch = 0; batch < 6; batch++) {
        if (findTab(tab.id) !== tab || controller.signal.aborted) return;
        const page = tab.creatorPages[source];
        const params = unified
          ? new URLSearchParams({ q: ref.artist, page: String(page),
            pages: `${source}:${page}`, sources: source, rating,
            sort: 'recent', kind: 'illustrations' })
          : new URLSearchParams({ source: ref.source, artist: ref.artist,
            rating, page: String(page) });
        try {
          const response = await request(`/${unified ? 'api/search' : 'api/profile'}?${params}`,
            { signal: controller.signal });
          if (findTab(tab.id) !== tab || controller.signal.aborted) return;
          tab.creatorCandidates = [...new Map([...tab.creatorCandidates, ...(response.items || [])]
            .map(entry => [entry.key, entry])).values()];
          tab.creatorWorks = selectCreatorWorks(tab.item, tab.creatorCandidates, tab);
          if (response.errors?.[source] || response.notices?.[source]) tab.creatorErrors[source] = response.errors?.[source] || response.notices[source];
          else delete tab.creatorErrors[source];
          const progress = CatalogLogic.advanceSearchSources(tab.creatorPages,
            tab.creatorPaused, [source], unified ? response : {
              hasMoreSources: response.hasMore ? [source] : [], errors: {} });
          tab.creatorPages = progress.pages;
          tab.creatorPaused = progress.paused;
          rememberItems(tab.creatorWorks);
        } catch (error) {
          if (findTab(tab.id) !== tab || controller.signal.aborted || error.name === 'AbortError') return;
          tab.creatorErrors[source] = 'Не удалось загрузить источник. Повторите запрос.';
          tab.creatorPaused[source] = true;
        }
        if (findTab(tab.id) === tab && activeId === tab.id) render();
        if (tab.creatorWorks.length >= 12 || tab.creatorPaused[source] ||
            !Object.hasOwn(tab.creatorPages, source)) break;
      }
    }));
  }
  finally {
    if (tab.creatorController === controller) {
      tab.creatorLoading = false;
      if (findTab(tab.id) === tab && activeId === tab.id) render();
    }
  }
}

function selectCreatorWorks(item, candidates, tab = null) {
  const currentKeys = new Set([item.key, ...(item.memberKeys || [])]);
  const works = CatalogLogic.filterWorks(CatalogLogic.groupWorks([item, ...(candidates || [])]),
    contentPreferences).filter(entry =>
      !entry.memberKeys.some(key => currentKeys.has(key)));
  const buckets = new Map();
  for (const work of works) {
    if (!buckets.has(work.source)) buckets.set(work.source, []);
    buckets.get(work.source).push(work);
  }
  const selected = [];
  for (let index = 0; [...buckets.values()].some(bucket => bucket.length > index); index++) {
    for (const bucket of buckets.values())
      if (bucket[index]) selected.push(bucket[index]);
    if (selected.length >= 12 && !contentPreferences.curation?.enabled) break;
  }
  return (contentPreferences.curation?.enabled ? curateFeedWorks(selected, tab, 'creator') : selected).slice(0, 12);
}

async function loadRelated(tab, append = false) {
  const alive = () => findTab(tab.id) === tab || tab.artworkDetached && !tab.artworkDisposed;
  if (!alive() || append && (!tab.relatedHasMore || tab.relatedError)) return;
  if (!append) tab.relatedController?.abort();
  const item = tab.item;
  if (!append) {
    tab.relatedStarted = true;
    tab.relatedSearches = CatalogLogic.relatedQueries(item).map(query => ({ query,
      pages: Object.fromEntries(defaultSources.map(source => [source, 0])), fingerprints: {} }));
    tab.relatedQuery = tab.relatedSearches[0]?.query || '';
    tab.related = [];
    tab.retainedFeedWorks = new Map();
    delete tab.retainedFeedHeights;
    delete tab.expiredFeedWorks;
    delete tab.expiredFeedTokens;
    tab.relatedCursor = 0;
    tab.relatedPaused = {};
    tab.relatedErrors = {};
    tab.relatedRetryAt = {};
    tab.relatedServerRetryAt = {};
    tab.relatedRetryPending = false;
    tab.relatedHasMore = tab.relatedSearches.length > 0;
    tab.relatedLoadedOnce = false;
    tab.relatedError = false;
    if (tab.virtualState) delete tab.virtualState.related;
  }
  if (!tab.relatedQuery) {
    tab.relatedHasMore = false;
    if (alive() && activeId === tab.id) render();
    return;
  }
  if (!append || !tab.relatedController || tab.relatedController.signal.aborted) {
    tab.relatedController = new AbortController();
    tab.relatedVersion = (tab.relatedVersion || 0) + 1;
  }
  const controller = tab.relatedController, version = tab.relatedVersion;
  const pages = DartProviderPages.scope(tab, 'related', version, controller.signal);
  const sourceFailures = pages.state.sourceFailures ||= new Map();
  const pageKey = (group, source) => JSON.stringify([group.query, source]);
  const eligible = (group, source) => !(tab.relatedServerRetryAt?.[source] > Date.now()) &&
    !(sourceFailures.get(source)?.serverRetryAt > Date.now()) && !pages.has(pageKey(group, source));
  tab.relatedLoading = true;
  const rating = ratingFilterFor(item);
  const before = filterFeedWorks(tab.related, tab, false, 'related').length;
  if (alive() && activeId === tab.id) render();
  try {
    // Limit work per scroll event, not the total number of related results.
    for (let batch = 0; batch < 3; batch++) {
      const group = nextRelatedSearch(tab, eligible);
      if (!group) {
        await Promise.all([...pages.pending.values()].map(job => job.promise));
        if (!alive() || controller.signal.aborted || version !== tab.relatedVersion) return;
        break;
      }
      const sources = Object.keys(group.pages).filter(source => !tab.relatedPaused[source] && eligible(group, source));
      const requested = Object.fromEntries(sources.map(source => [source, group.pages[source]]));
      const receive = (source, response, requestOrder) => {
        if (!alive() || controller.signal.aborted || version !== tab.relatedVersion) return;
        const progress = CatalogLogic.advanceSearchSources(group.pages, tab.relatedPaused, [source], response);
        tab.relatedRetryAt ||= {}; tab.relatedServerRetryAt ||= {};
        if (response.errors?.[source]) {
          tab.relatedErrors[source] = response.errors[source];
          const server = response.retryAt?.[source];
          if (Number.isFinite(server) && server > 0) tab.relatedServerRetryAt[source] = server;
          else delete tab.relatedServerRetryAt[source];
          tab.relatedRetryAt[source] = Number.isFinite(server) && server > 0 ? server :
            /HTTP 401|user id|api key|ключ API|авторизуйтесь/i.test(response.errors[source]) ? Infinity : Date.now() + 15000;
          const previous = sourceFailures.get(source);
          sourceFailures.set(source, { error: tab.relatedErrors[source],
            retryAt: Math.max(previous?.retryAt || 0, tab.relatedRetryAt[source]),
            serverRetryAt: Math.max(previous?.serverRetryAt || 0, tab.relatedServerRetryAt[source] || 0),
            blockThrough: pages.state.requestOrder || 0 });
        }
        else {
          const failure = sourceFailures.get(source);
          if (failure && requestOrder > failure.blockThrough && !(failure.serverRetryAt > Date.now()))
            sourceFailures.delete(source);
          if (!sourceFailures.has(source)) {
            delete tab.relatedErrors[source];
            delete tab.relatedRetryAt[source]; delete tab.relatedServerRetryAt[source];
          }
          const fingerprint = (response.items || []).filter(entry => entry.source === source)
            .map(entry => entry.key).sort().join('|');
          // Some sources ignore pagination at their limit. Do not fetch the same page forever.
          if (fingerprint && fingerprint === group.fingerprints[source]) delete progress.pages[source];
          group.fingerprints[source] = fingerprint;
        }
        const failure = sourceFailures.get(source);
        if (failure) {
          progress.paused[source] = true;
          tab.relatedErrors[source] = failure.error;
          tab.relatedRetryAt[source] = failure.retryAt;
          if (failure.serverRetryAt) tab.relatedServerRetryAt[source] = failure.serverRetryAt;
        }
        group.pages = progress.pages;
        tab.relatedPaused = progress.paused;
        tab.related = mergeRelatedWorks(tab.item, tab.related, response.items || []);
        tab.relatedHasMore = relatedSearchHasMore(tab);
        tab.relatedLoadedOnce = true;
        rememberItems(tab.related);
        if (alive() && activeId === tab.id) render();
        if (typeof scheduleRule34Recovery === 'function') scheduleRule34Recovery(tab);
      };
      await Promise.all(sources.map(source => pages.run(pageKey(group, source), async () => {
        const requestOrder = pages.state.requestOrder = (pages.state.requestOrder || 0) + 1;
        const page = requested[source];
        const params = new URLSearchParams({ q: group.query, page: String(page), pages: `${source}:${page}`,
          sources: source, rating, sort: 'recent', kind: 'illustrations' });
        try {
          const response = await request(`/api/search?${params}`, { signal: controller.signal });
          await pages.publish(() => receive(source, response, requestOrder));
        }
        catch (error) {
          if (error.name === 'AbortError' || controller.signal.aborted) return;
          await pages.publish(() => receive(source, { items: [], errors: { [source]: error.message || 'Источник сейчас недоступен.' },
            retryAt: { [source]: error.retryAt }, hasMoreSources: [] }, requestOrder));
        }
      })));
      if (!alive() || controller.signal.aborted || version !== tab.relatedVersion) return;
      if (filterFeedWorks(tab.related, tab, false, 'related').length - before >= 24) break;
    }
    tab.relatedHasMore = relatedSearchHasMore(tab);
    tab.relatedError = false;
  } catch (error) {
    if (error.name !== 'AbortError' && version === tab.relatedVersion)
      tab.relatedError = true;
  }
  finally {
    if (version === tab.relatedVersion) {
      tab.relatedLoading = pages.pending.size > 0;
      if (alive() && activeId === tab.id) render();
      if (alive() && tab.relatedRetryPending) retryRelatedSearch(tab);
      else if (alive() && typeof scheduleRule34Recovery === 'function') scheduleRule34Recovery(tab);
    }
  }
}

function relatedSearchHasMore(tab) {
  return (tab.relatedSearches || []).some(group =>
    Object.keys(group.pages).some(source => !tab.relatedPaused[source]));
}

function retryRelatedSearch(tab, sources = null) {
  if (tab.relatedLoading && !sources) { tab.relatedRetryPending = true; return; }
  tab.relatedRetryPending = false;
  tab.relatedError = false;
  let ready = false;
  for (const source of Object.keys(tab.relatedPaused || {})) {
    if (sources && !sources.includes(source) || tab.relatedServerRetryAt?.[source] > Date.now()) continue;
    delete tab.relatedPaused[source]; delete tab.relatedErrors[source];
    delete tab.relatedRetryAt?.[source]; delete tab.relatedServerRetryAt?.[source];
    ready = true;
  }
  if (!ready && Object.keys(tab.relatedPaused || {}).length) {
    if (typeof scheduleRule34Recovery === 'function') scheduleRule34Recovery(tab);
    return;
  }
  tab.relatedHasMore = relatedSearchHasMore(tab);
  loadRelated(tab, true);
}

function nextRelatedSearch(tab, eligible = () => true) {
  const groups = tab.relatedSearches || [];
  for (let offset = 0; offset < groups.length; offset++) {
    const index = (tab.relatedCursor + offset) % groups.length;
    const group = groups[index];
    if (!Object.keys(group.pages).some(source => !tab.relatedPaused[source] && eligible(group, source))) continue;
    tab.relatedCursor = (index + 1) % groups.length;
    return group;
  }
  return null;
}

function mergeRelatedWorks(item, existing, incoming) {
  const positions = new Map();
  existing.forEach((entry, index) => {
    for (const key of [entry.key, ...(entry.memberKeys || [])]) positions.set(key, index);
  });
  const ranked = CatalogLogic.rankRelated(item, [...existing, ...incoming], Infinity, curationContext());
  const position = entry => Math.min(...[entry.key, ...(entry.memberKeys || [])]
    .map(key => positions.get(key) ?? Infinity));
  // Appending must preserve the visible cards and the scroll position.
  return ranked.sort((a, b) => position(a) - position(b));
}

async function loadProfile(tab, append = false) {
  const alive = () => findTab(tab.id) === tab || tab.artworkDetached && !tab.artworkDisposed;
  if (!append) { tab.profileBanner = ''; delete tab.resumePrefetchAt; }
  if (tab.profileRef?.source === 'artist') {
    tab.query = tab.profileRef.artist;
    tab.feed = 'illustrations';
    tab.sort = 'recent';
    tab.selectedSources = [...CatalogLogic.supportedSources];
    tab.profile = { name: tab.title, role: CatalogLogic.participantRoleLabel(
      tab.profileRef.participantRole || CatalogLogic.participantRole(tab.profileRef.artist)) };
    await loadSearch(tab, append);
    return;
  }
  if (!alive() || append && (tab.loading || tab.hasMore === false || tab.loadError)) return;
  if (!append) tab.profileController?.abort();
  const controller = new AbortController();
  tab.profileController = controller;
  const version = tab.profileVersion = (tab.profileVersion || 0) + 1;
  tab.loading = true;
  if (!append) {
    tab.items = []; tab.page = 0; tab.profileError = false;
    delete tab.curationViews;
    tab.hasMore = true; tab.loadError = false;
    tab.virtualState = {};
  }
  if (activeId === tab.id) render();
  const ref = tab.profileRef;
  const page = append ? tab.page + 1 : 0;
  const params = new URLSearchParams({ source: ref.source, artist: ref.artist,
    rating: tab.rating || 'general', page: String(page) });
  try {
    const profile = await request(`/api/profile?${params}`, { signal: controller.signal });
    if (!alive() || version !== tab.profileVersion) return;
    if (append && tab.profile) profile.name = tab.profile.name;
    tab.profile = profile;
    tab.errors = profile.notices || {};
    tab.title = profile.name;
    const merged = append ? [...tab.items, ...profile.items] : profile.items;
    tab.items = [...new Map(merged.map(item => [item.key, item])).values()];
    tab.page = page;
    tab.hasMore = !!profile.hasMore && page < 100;
    tab.profileError = false;
    tab.loadError = false;
    rememberItems(profile.items);
    saveSession();
  } catch (error) {
    if (error.name !== 'AbortError' && version === tab.profileVersion) {
      tab.profileError = !append;
      if (tab.profileRef?.source === 'sankaku' && error.status === 401) tab.errors = { sankaku: error.message };
      tab.loadError = append;
      if (!append) tab.hasMore = false;
    }
  }
  finally {
    if (version === tab.profileVersion) {
      tab.loading = false;
      if (activeId === tab.id) render();
    }
  }
}

function openCreator(item, tabOptions = {}) {
  const attribution = CatalogLogic.workAttribution(item);
  const creator = item.profileParticipantTag
    ? attribution.participants.find(person => person.tag === item.profileParticipantTag)
    : attribution.creator || attribution.participants[0];
  if (!creator) { toast('Автор этой работы пока не определён'); return; }
  openTemporaryTab('profile', creator.name, { profileRef: CatalogLogic.creatorProfileRef(item, creator.tag),
    rating: ratingFilterFor(item) }, tabOptions);
}

function openUploader(item, tabOptions = {}) {
  const uploader = CatalogLogic.workAttribution(item).uploader;
  const id = item.uploaderId || (['gelbooru', 'rule34', 'sankaku'].includes(item.source) ? item.artistId : '');
  if (!uploader || !id) { toast('Загрузчик этой работы не указан'); return; }
  if (item.source === 'danbooru') {
    window.open(`https://danbooru.donmai.us/users/${encodeURIComponent(id)}`, '_blank', 'noopener');
    return;
  }
  openTemporaryTab('profile', uploader.name, { profileRef: { source: item.source,
    artist: id, service: '' }, rating: ratingFilterFor(item) }, tabOptions);
}

function openPreferredAttribution(item, reveal = false, tabOptions = {}) {
  const primary = CatalogLogic.workAttribution(item, contentPreferences.attributionPriority).primary;
  if (primary.role === 'creator' || primary.role === 'contributor') openCreator(item, tabOptions);
  else if (primary.role === 'uploader') openUploader(item, tabOptions);
  else if (primary.role === 'original' && item.originalUrl)
    window.open(item.originalUrl, '_blank', 'noopener');
  else toast('Автор пока не определён. Проверьте исходную ссылку и теги работы.');
}

const artworkRoutes = new Set();
let nextArtworkSourceId = -1, quickPreviewRoute = null;

function artworkSourceSignature(source) {
  return JSON.stringify([source.kind, source.query, source.rating, source.sort,
    source.selectedSources, source.profileRef, source.favoriteType, source.favoriteOrigin,
    source.kind === 'follows' ? source.followOrder || 'date' : undefined,
    source.kind === 'follows' && source.followOrder === 'random' ? source.followRandomSeed : undefined]);
}

function copyArtworkSource(source) {
  // Preview writes hold nested promises. Follow publications are disposable
  // caches; a detached viewer rebuilds them from its copied groups and cursors.
  const plain = Object.fromEntries(Object.entries(source).filter(([key, value]) =>
    !/Controller$|Timer$|^artwork|^virtual|^gridTops|^resumePrefetchAt/.test(key) &&
    !['followCacheWrites', 'followComputed', 'followPublication'].includes(key) &&
    typeof value !== 'function' && typeof value?.then !== 'function'));
  if (source.kind === 'follows') plain.items = artworkFollowItems(source);
  const copy = structuredClone(plain);
  if (copy.followPagingStreams) {
    copy.followStreams = [...new Map([...copy.followPagingStreams, ...(copy.followStreams || [])]
      .map(stream => [`${stream.follow.key}:${stream.source}`, stream])).values()];
    delete copy.followPagingStreams;
  }
  return { ...copy, id: nextArtworkSourceId--, artworkDetached: true,
    started: source.kind === 'follows' && source.loading ? false : source.started,
    artworkDisposed: false, loading: false, followLoadingMore: false,
    relatedLoading: false, creatorLoading: false };
}

function artworkFollowItems(source) {
  if (source.followOrder === 'random') return source.items || [];
  const cached = source.followComputed;
  return cached && cached.rating === source.rating && cached.version === source.followVersion
    ? cached.feed.items : source.items || [];
}

function artworkRouteSource(route) {
  if (!route.source.artworkDetached) {
    const sameGeneration = artworkSourceSignature(route.source) === route.signature;
    if (findTab(route.source.id) !== route.source || !sameGeneration) {
      if (sameGeneration) route.backup = copyArtworkSource(route.source);
      route.source = route.backup;
    }
  }
  return route.source;
}

function artworkSourceItems(route) {
  const source = artworkRouteSource(route);
  const raw = route.list === 'related' ? source.related || [] :
    source.kind === 'recent' ? recent : source.kind === 'follows'
      ? artworkFollowItems(source) : source.items || [];
  const publication = source.items;
  const publicationRevision = CatalogLogic.groupingRevision(publication);
  // Following publishes a separate visible array containing the canonical
  // records. Thumbnail enrichment invalidates that array, so refresh the full
  // evidence cache when it has learned something since this route last read it.
  if (source.kind === 'follows' && raw !== publication && publicationRevision &&
      (route.readPublication !== publication || route.readPublicationRevision !== publicationRevision))
    CatalogLogic.invalidateGrouping(raw);
  const groupingRevision = CatalogLogic.groupingRevision(raw);
  if (route.readRaw === raw && route.readRawLength === raw.length && route.readPreferences === contentPreferences &&
      route.readGroupingRevision === groupingRevision)
    return route.readItems;
  // Thumbnail fingerprints and renewed aliases enrich records in place. The
  // viewer must consume that evidence even when no source page was appended.
  const regroup = route.readGroupingRevision !== groupingRevision;
  const fullRead = route.readPreferences !== contentPreferences || regroup;
  // These discovery feeds use curateFeedWorks' whole-pool quality factors.
  // Saved lists, Following and already ranked recommendations keep their own
  // order, so one enriched saved detail must not regroup the entire library.
  const wholeFeedCuration = contentPreferences.curation?.enabled &&
    ['home', 'search', 'profile'].includes(source.kind);
  const changed = fullRead || wholeFeedCuration
    ? raw : raw.filter(item => route.readVersions.get(item.key) !== item);
  const added = changed.some(item => !route.readVersions.has(item.key));
  route.readRaw = raw; route.readRawLength = raw.length; route.readPreferences = contentPreferences;
  route.readGroupingRevision = groupingRevision;
  route.readPublication = publication; route.readPublicationRevision = publicationRevision;
  route.readVersions = new Map(raw.map(item => [item.key, item]));
  if (added && !source.artworkDetached && !source.loading && !source.followLoadingMore && !source.relatedLoading)
    route.backup = copyArtworkSource(source);
  const bufferedKeys = new Set((route.engine?.items || []).flatMap(item => [item.key, ...(item.memberKeys || [])]));
  // A repeated listing may become known only after its detail/hash is learned.
  // Preserve its metadata for buffered slots so grouping can remove the stale
  // duplicate; known works that have never entered this route stay filtered.
  const supported = CatalogLogic.filterCatalogItems(changed);
  const updates = supported.filter(item =>
    [item.key, ...(item.memberKeys || [])].some(key => bufferedKeys.has(key)));
  const visible = filterFeedWorks(changed, source, source.kind === 'follows' && !regroup, route.list);
  const visibleKeys = new Set(visible.flatMap(item => [item.key, ...(item.memberKeys || [])]));
  const owners = new Map();
  for (const item of supported) for (const key of new Set([item.key, ...(item.memberKeys || [])]))
    owners.set(key, (owners.get(key) || 0) + 1);
  // These records already supplied the visible grouping's complete metadata.
  // Keep filtered buffered updates, and conservatively merge overlapping raw
  // records whose same key could describe a different, hidden response.
  const missingUpdates = updates.filter(item => [item.key, ...(item.memberKeys || [])]
    .some(key => !visibleKeys.has(key) || owners.get(key) !== 1));
  const works = (missingUpdates.length ? CatalogLogic.mergeGroupedWorks(visible, missingUpdates) : visible)
    .filter(item => !isExpiredFeedWork(source, item));
  route.readItems = source.kind === 'profile'
    ? CatalogLogic.stableFeedItems(source.profileGridItems || [], works) : works;
  return route.readItems;
}

function artworkRouteMedia(route, item, selectedUrl = '') {
  const media = CatalogLogic.artworkMedia(item);
  if (!route?.presentation) return { ...media, thumbnail: item.thumbnail || '',
    preview: selectedUrl || CatalogLogic.previewMedia(item), selectedOwned: true };
  if (!route.presentationOrder) {
    route.presentationOrder = new WeakMap(); route.presentationNext = 0;
    for (const entry of route.presentation.values()) if (!route.presentationOrder.has(entry))
      route.presentationOrder.set(entry, route.presentationNext++);
  }
  const keys = [item.key, ...(item.memberKeys || [])];
  const original = keys.map(key => route.presentation.get(key)).filter(Boolean)
    .reduce((first, entry) => !first || route.presentationOrder.get(entry) < route.presentationOrder.get(first)
      ? entry : first, null) || item;
  if (!route.presentationOrder.has(original)) route.presentationOrder.set(original, route.presentationNext++);
  for (const key of keys) if (!route.presentation.has(key)) route.presentation.set(key, original);
  route.presentationRecords ||= new WeakMap();
  let displayed = route.presentationRecords.get(original);
  if (!displayed) {
    displayed = { ...CatalogLogic.artworkMedia(original), thumbnail: original.thumbnail || '',
      preview: CatalogLogic.previewMedia(original) };
    route.presentationRecords.set(original, displayed);
  }
  const identities = new WeakMap();
  const identity = record => {
    let value = identities.get(record);
    if (!value) {
      value = { key: CatalogLogic.mediaCacheKey(record.url),
        hash: /^[a-f0-9]{32}$/i.test(record.hash || '') ? record.hash.toLowerCase() : '' };
      identities.set(record, value);
    }
    return value;
  };
  const matches = (first, second) => {
    if (!first || !second) return false;
    const a = identity(first), b = identity(second);
    return a.hash && a.hash === b.hash || a.key === b.key && !(a.hash && b.hash && a.hash !== b.hash);
  };
  // Only URLs owned by the current work can be selected. Keep the old display
  // order by exact file identity, including renewed signatures and mirrors.
  const known = new Map((item.imageRecords || []).map(record => [record.url, record]));
  const canonical = new Map(media.imageRecords.map(record => [CatalogLogic.mediaCacheKey(record.url), record]));
  const owned = (item.images || []).map(url => ({ ...(
    known.get(url) || canonical.get(CatalogLogic.mediaCacheKey(url)) ||
    CatalogLogic.artworkMedia({ images: [url], contentHash: item.images.length === 1 ? item.contentHash : '' }).imageRecords[0]), url }));
  const current = record => {
    const candidates = owned.filter(candidate => matches(record, candidate));
    return candidates.find(candidate => !CatalogLogic.signedMediaExpired(candidate.url)) || candidates[0];
  };
  const ordered = [];
  for (const record of [...displayed.imageRecords, ...media.imageRecords]) {
    const fresh = current(record);
    if (fresh && !ordered.some(previous => matches(previous, fresh))) ordered.push(fresh);
  }
  const describe = url => displayed.imageRecords.find(record => record.url === url) ||
    owned.find(record => record.url === url) || CatalogLogic.artworkMedia({ images: [url] }).imageRecords[0];
  const retained = current(describe(displayed.preview));
  const requested = selectedUrl && current(describe(selectedUrl));
  const fallback = ordered.find(record => CatalogLogic.videoMimeType(record.url)) || ordered[0];
  const selected = requested || retained || fallback;
  let thumbnail = '';
  const thumbs = [item.thumbnail, ...(item.groupMembers || []).map(member => member.thumbnail)].filter(Boolean);
  if (selected && retained && matches(selected, retained)) {
    thumbnail = thumbs.find(url => CatalogLogic.mediaCacheKey(url) === CatalogLogic.mediaCacheKey(displayed.thumbnail) &&
      !CatalogLogic.signedMediaExpired(url)) || '';
  }
  if (!thumbnail && selected) {
    const first = media.imageRecords.find(record => record.url === CatalogLogic.previewMedia(item));
    if (matches(selected, first)) thumbnail = item.thumbnail || '';
  }
  thumbnail ||= selected?.url || item.thumbnail || '';
  return { images: ordered.map(record => record.url), imageRecords: ordered, thumbnail,
    preview: selected?.url || thumbnail, selectedOwned: !selectedUrl || !!requested };
}

function artworkSourceHasMore(route) {
  const source = artworkRouteSource(route);
  if (['likes', 'bookmarks', 'recent', 'favorites'].includes(source.kind)) return false;
  if (route.list === 'related') return !source.relatedStarted || source.relatedLoading ||
    source.relatedHasMore || source.relatedError || Object.keys(source.relatedPaused || {}).length > 0;
  if (source.kind === 'follows') return !source.started || source.loading || source.followLoadingMore ||
    !!source.followStreams?.length;
  return !source.started || source.loading || source.hasMore || source.loadError ||
    Object.keys(source.pausedSources || {}).length > 0;
}

async function loadArtworkSource(route) {
  const source = artworkRouteSource(route);
  const deadline = Date.now() + 95000;
  const before = artworkSourceItems(route);
  const previous = new Set(before.flatMap(item => [item.key, ...(item.memberKeys || [])]));
  const progress = () => typeof DartProviderPages === 'undefined' ? 0 : DartProviderPages.progress(source);
  const beforeProgress = progress();
  const advanced = () => artworkSourceItems(route).some(item =>
    ![item.key, ...(item.memberKeys || [])].some(key => previous.has(key)));
  if (route.disposed) throw new Error('Artwork source unavailable');
  const loading = (async () => {
  if (route.list === 'related') {
    if (source.relatedStarted && (source.relatedError || Object.keys(source.relatedPaused || {}).length)) {
      source.relatedError = false;
      for (const provider of Object.keys(source.relatedPaused || {}))
        if (!(source.relatedServerRetryAt?.[provider] > Date.now()) &&
            Number.isFinite(source.relatedRetryAt?.[provider] || 0) &&
            !(source.relatedRetryAt?.[provider] > Date.now())) delete source.relatedPaused[provider];
      source.relatedHasMore = relatedSearchHasMore(source);
    }
    await loadRelated(source, !!source.relatedStarted);
    if (source.relatedError || !source.relatedHasMore && Object.keys(source.relatedPaused || {}).length)
      throw new Error('Related source unavailable');
  } else if (source.kind === 'follows') {
    if (!source.started) await loadFollowFeed(source);
    else await loadMoreFollows(source);
    if (source.followStreams?.length && !source.hasMore) throw new Error('Following source paused');
  } else if (source.kind === 'recommendations') {
    source.loadError = false;
    await loadRecommendations(source, !!source.started);
    if (source.loadError || !source.hasMore && Object.keys(source.errors || {}).length)
      throw new Error('Recommendation source unavailable');
  } else if (source.kind === 'profile') {
    source.loadError = false;
    await loadProfile(source, !!source.started);
    if (source.loadError || source.profileError) throw new Error('Profile source unavailable');
  } else {
    const retry = !source.hasMore && Object.keys(source.pausedSources || {}).length > 0;
    const due = retry ? Object.keys(source.pausedSources).filter(provider => {
      const retryAt = source.sourceRetryAt?.[provider] ?? (provider === 'rule34' ? source.rule34RetryAt || 0 : 0);
      return Number.isFinite(retryAt) && retryAt <= Date.now();
    }) : null;
    source.loadError = false;
    await loadSearch(source, !!source.started, retry, due);
    if (source.loadError || !source.hasMore && Object.keys(source.errors || {}).length)
      throw new Error('Catalog source unavailable');
  }
  source.started = true;
  if (!source.artworkDetached) route.backup = copyArtworkSource(source);
  })();
  let settled = false, failure;
  const completion = loading.then(() => { settled = true; }, error => { failure = error; settled = true; });
  // A page belongs to multiple providers. Release a waiting Next/prefetch as
  // soon as genuinely new eligible rows are available, retaining the original
  // source request for the grid and later healthy publications.
  while (!settled && !route.disposed && Date.now() < deadline) {
    // A settled duplicate-only/hidden-only page still advances its cursor. Let
    // navigation spend its bounded next-page budget without waiting on a peer.
    if (advanced() || progress() !== beforeProgress) return;
    let timer;
    await Promise.race([completion, new Promise(resolve => { timer = setTimeout(resolve, 60); })]);
    if (typeof clearTimeout === 'function') clearTimeout(timer);
  }
  if (route.disposed || !settled) throw new Error('Artwork source unavailable');
  if (failure) throw failure;
}

function createArtworkRoute(from, item, origin = null) {
  if (!from) return null;
  const returnSource = from;
  const returnGrid = origin?.closest?.('[data-grid-key]')?.dataset.gridKey ||
    (origin?.closest?.('.author-strip') ? 'creator' : from.kind === 'detail' ? 'related' :
      from.kind === 'favorites' && from.favoriteType === 'artwork' ? 'favorites-artworks' : from.kind);
  const pack=favoriteGroupFor(item,from);
  if(pack&&(origin?.closest?.('[data-favorite-group]')||from.kind==='favorites'&&from.favoriteType==='artwork')&&!from.manualFavoriteGroup)
    from={id:nextArtworkSourceId--,artworkDetached:true,kind:'favorites',favoriteType:'artwork',
      manualFavoriteGroup:pack.groupId,items:[...pack.items],rating:from.rating,started:true,artworkLists:new Map()};
  const related = from.kind === 'detail';
  const creator = related && !!origin?.closest?.('.author-strip');
  const list = related ? creator ? 'creator' : 'related' : from.kind;
  // Each viewer owns its position, including works opened in background tabs.
  const homeRendered = from.artworkLists?.has('home') || from.artworkLists?.has('home-rest');
  const snapshot = from.kind === 'home' ? homeRendered
    ? [...(from.artworkLists.get('home') || []), ...(from.artworkLists.get('home-rest') || [])]
    : filterFeedWorks(from.items || [], from) :
    creator ? from.artworkLists?.get('creator') || selectCreatorWorks(from.item, from.creatorCandidates || from.creatorWorks || [], from) :
    related ? from.artworkLists?.get('related') || filterFeedWorks(from.related || [], from, false, 'related') :
    from.artworkLists?.get(origin?.closest?.('[data-grid-key]')?.dataset.gridKey || from.kind) ||
    filterFeedWorks(from.kind === 'recent' ? recent : from.items || [], from, from.kind === 'follows');
  let source = from;
  if (creator) source = { id: nextArtworkSourceId--, artworkDetached: true, kind: 'profile',
    profileRef: CatalogLogic.creatorProfileRef(from.item), title: from.title,
    rating: ratingFilterFor(from.item), items: [], errors: {}, hasMore: true,
    selectedSources: [...defaultSources], page: 0, loading: false };
  const pageable = !['likes', 'bookmarks', 'recent', 'favorites'].includes(source.kind);
  const raw = list === 'related' ? source.related || [] : source.kind === 'recent' ? recent :
    source.kind === 'follows' ? artworkFollowItems(source) : source.items || [];
  const route = { source, signature: artworkSourceSignature(source),
    returnOrigin: { source: returnSource, signature: artworkSourceSignature(returnSource),
      generation: returnSource.artworkGeneration || 0, detailKey: returnSource.kind === 'detail' ? returnSource.item?.key : '',
      preferences: contentPreferences, gridKey: returnGrid, groupId: pack?.groupId || '' },
    backup: source.artworkDetached ? source : pageable ? copyArtworkSource(source) : {
      id: nextArtworkSourceId--, kind: source.kind, artworkDetached: true, started: true, items: [] },
    list: creator ? 'profile' : list, warmed: new Map(), disposed: false,
    visitedKeys: new Set([item.key, ...(item.memberKeys || [])]),
    readRaw: raw, readRawLength: raw.length, readPreferences: contentPreferences,
    readGroupingRevision: CatalogLogic.groupingRevision(raw),
    readPublication: source.items, readPublicationRevision: CatalogLogic.groupingRevision(source.items),
    readVersions: new Map(raw.map(item => [item.key, item])), readItems: [] };
  const selected = snapshot.some(entry => CatalogLogic.sameWork(entry, item));
  const initial = selected ? snapshot : related ? [item, ...snapshot] : [...snapshot, item];
  // Retain the actual displayed slot references; parse media lazily only for
  // visited/warmed works rather than cloning every gallery in a large feed.
  route.presentation = new Map(); route.presentationOrder = new WeakMap(); route.presentationNext = 0;
  for (const entry of initial) {
    if (!route.presentationOrder.has(entry)) route.presentationOrder.set(entry, route.presentationNext++);
    for (const key of [entry.key, ...(entry.memberKeys || [])])
      if (!route.presentation.has(key)) route.presentation.set(key, entry);
  }
  // Retained cards belong to this feed visit even after Space creates a new
  // viewer route. Only their actual keys keep a slot when history/follows change.
  route.isAllowed = entry => !artworkActionsController().isHidden(entry) && !CatalogLogic.isWorkHidden(entry, contentPreferences) &&
    (route.source.rating !== 'explicit' || !['home', 'search', 'profile', 'recommendations', 'follows', 'favorites'].includes(route.source.kind) ||
     CatalogLogic.matchesRating(entry, selectedRating(route.source))) &&
    (!contentPreferences.hideFollowedArtists || !isFollowedArtistHidden(entry, route.source, route.list) ||
     isRetainedFeedWork(route.source, entry) ||
     [entry.key, ...(entry.memberKeys || [])].some(key => route.visitedKeys.has(key))) &&
    (!contentPreferences.hideViewedAndSaved || !isHideableFeed(route.source, route.list) ||
     isRetainedFeedWork(route.source, entry) ||
     [entry.key, ...(entry.memberKeys || [])].some(key => route.visitedKeys.has(key)) ||
     !CatalogLogic.workHistoryTokens(entry).some(knownWorkTokens().has));
  route.engine = DartArtworkNavigation.create({ items: initial, current: item,
    read: () => artworkSourceItems(route), more: () => !route.disposed && artworkSourceHasMore(route),
    load: () => loadArtworkSource(route),
    same: CatalogLogic.sameWork,
    merge: CatalogLogic.mergeGroupedWorks,
    allowed: route.isAllowed });
  artworkRoutes.add(route);
  return route;
}

function pruneArtworkRoutes(retainedRoute = null) {
  const held = new Set([retainedRoute, quickPreviewRoute, ...tabs.map(tab => tab.artworkRoute),
    ...navigation.map(entry => entry.view?.artworkRoute)]);
  for (const route of artworkRoutes) {
    if (held.has(route)) continue;
    route.disposed = true; route.warmController?.abort(); route.navigationController?.abort();
    if (route.source.artworkDetached) { route.source.artworkDisposed = true; abortTab(route.source); }
    artworkRoutes.delete(route);
  }
}

function warmArtworkRoute(route) {
  if (!route || route.disposed) return;
  const current = route.engine.items[route.engine.state.index]?.key;
  if (route.warmFor === current && route.warming && !route.warmController?.signal.aborted) return;
  route.warmController?.abort();
  const controller = route.warmController = new AbortController();
  route.warmFor = current;
  const warming = new Map();
  const mediaWarming = new Map();
  const warmMedia = item => {
    const shown = route.presentation ? artworkRouteMedia(route, item) : { thumbnail: item.thumbnail };
    const full = galleryImages(item, route).find(media => !CatalogLogic.videoMimeType(media));
    return Promise.allSettled([...new Set([shown.thumbnail, full].filter(Boolean))].map(url => {
      if (CatalogLogic.signedMediaExpired(url) && !imageLoader.cached(url)) return;
      const key = CatalogLogic.mediaCacheKey(url);
      if (!mediaWarming.has(key)) mediaWarming.set(key, (async () => {
        const release = imageLoader.pin(url);
        try {
          const entry = imageLoader.cached(url) || imageLoader.rememberBlob(url,
            await readMediaBlob(url, controller.signal, { priority: 'background' }));
          if (!controller.signal.aborted) await imageLoader.decode(entry);
        } finally { release(); }
      })());
      return mediaWarming.get(key);
    }));
  };
  const neighbors = () => route.engine.neighbors().map(item => {
    if (warming.has(item.key)) return warming.get(item.key);
    const job = (async () => {
      let ready = route.warmed.get(item.key);
      // Feed media is usable before provider metadata arrives. Keep the detail
      // request parallel so a slow API does not block the next visible pixels.
      const known = warmMedia(ready || item);
      if (!ready) {
        let detail;
        try {
          detail = await request(`/api/detail?source=${encodeURIComponent(item.source)}&id=${encodeURIComponent(item.id)}`,
            { signal: controller.signal, priority: 'background' });
        } catch { await known; return; }
        if (controller.signal.aborted) return;
        ready = rememberItem(CatalogLogic.mergeDetailPages(item, detail) || item);
        route.engine.update(ready);
        route.warmed.set(item.key, ready);
        while (route.warmed.size > 4) route.warmed.delete(route.warmed.keys().next().value);
      }
      await Promise.allSettled([known, warmMedia(ready)]);
    })();
    warming.set(item.key, job);
    return job;
  });
  route.warming = (async () => {
    // Existing neighbors must not wait behind a slow provider's next page.
    const immediate = Promise.allSettled(neighbors());
    await route.engine.prefetch();
    if (controller.signal.aborted || route.disposed) return;
    await Promise.allSettled([immediate, ...neighbors()]);
  })().catch(() => {}).finally(() => {
    if (route.warmController === controller) route.warming = null;
  });
}

async function prepareArtworkMedia(item, signal, selectedMedia, route = null) {
  selectedMedia ??= galleryImages(item, route)[0];
  // Playback owns video loading. A missing poster must not delay the selected
  // movie behind the image preparation timeout, including mixed galleries.
  if (CatalogLogic.videoMimeType(selectedMedia)) return;
  const full = selectedMedia || '';
  const thumbnail = route?.presentation ? artworkRouteMedia(route, item, selectedMedia).thumbnail : item.thumbnail;
  const url = full && imageLoader.cached(full) ? full : thumbnail || full;
  if (!url) return;
  // Keep the current viewer while preparing pixels, with a bounded fallback
  // for offline/expired media. A newer arrow cancels this consumer immediately.
  const bounded = AbortSignal.any([signal, AbortSignal.timeout(4500)]);
  const release = imageLoader.pin?.(url) || (() => {});
  let cancelled;
  const cancellation = new Promise(resolve => {
    cancelled = () => { release(); resolve(); };
    bounded.addEventListener('abort', cancelled, { once: true });
    if (bounded.aborted) cancelled();
  });
  try {
    await Promise.race([cancellation, (async () => {
      if (bounded.aborted) return;
      const entry = imageLoader.cached(url) || imageLoader.rememberBlob(url,
        await readMediaBlob(url, bounded, { priority: 'foreground' }));
      if (!bounded.aborted) await imageLoader.decode(entry);
    })()]);
  } catch { /* The normal viewer retains its retry/error behavior. */ }
  finally { bounded.removeEventListener('abort', cancelled); }
  return release;
}

async function moveArtwork(direction) {
  const tab = currentTab(), preview = quickPreview.open;
  if (preview && typeof quickPreviewGallery !== 'undefined') quickPreviewGallery?.cancel();
  const route = preview ? quickPreviewRoute : tab?.artworkRoute;
  if (!route || route.disposed) return;
  const generation = quickPreviewGeneration;
  const ticket = route.navigationTicket = (route.navigationTicket || 0) + 1;
  route.navigationController?.abort();
  const controller = route.navigationController = new AbortController();
  const cancelled = () => controller.signal.aborted || ticket !== route.navigationTicket || route.disposed ||
    (preview ? !quickPreview.open || quickPreviewRoute !== route || quickPreviewGeneration !== generation
      : currentTab() !== tab);
  const restoreDisplayed = () => {
    if (cancelled()) return;
    const displayed = preview ? quickPreviewWork : currentTab()?.item;
    if (displayed) route.engine.select?.(displayed);
  };
  for (let round = 0; round < 8; round++) {
    const next = await route.engine.move(direction);
    if (cancelled()) return;
    if (!next) {
      restoreDisplayed();
      if (route.engine.state.error) toast('Could not load the next artwork. Try again later.');
      return;
    }
    let item = route.warmed.get(next.key) || next;
    const current = preview ? quickPreviewWork : tab?.item;
    if (current && CatalogLogic.sameWork(current, item)) return;
    const shown = route.presentation ? artworkRouteMedia(route, item) : null;
    const release = await prepareArtworkMedia(item, controller.signal,
      preview ? shown?.preview || CatalogLogic.previewMedia(item) : undefined, route);
    try {
      if (cancelled()) return;
      // Detail warming and source evidence can change while pixels decode.
      // Re-read the canonical group and eligibility before showing anything.
      route.engine.sync?.();
      item = route.engine.items?.find(entry => CatalogLogic.sameWork(entry, next)) ||
        route.warmed.get(next.key) || item;
      if (route.isAllowed && !route.isAllowed(item) || current && CatalogLogic.sameWork(current, item)) continue;
      const replacement = tab?.kind === 'detail' ? { id: tab.id, kind: 'detail', title: item.title, item,
        rating: ratingFilterFor(item), searchQuery: tab.searchQuery, artworkRoute: route,
        preview: tab.preview, pinned: tab.pinned, items: [], errors: {}, page: 0,
        scrollTop: 0, loading: false, selectedSources: [...defaultSources] } : null;
      if (preview) {
        const presentation = route.presentation ? artworkRouteMedia(route, item) : null;
        const url = presentation?.preview || CatalogLogic.previewMedia(item);
        if (!url) {
          closeQuickPreview(route);
          if (replacement) activate(tab.id, true, replacement);
          else openDetail(item, { artworkRoute: route });
          return;
        }
        if (replacement && tab.artworkRoute === route) activate(tab.id, true, replacement, true);
        openQuickPreview({ item, url, route, image: { currentSrc: imageLoader.cached(url)?.blobUrl ||
          imageLoader.cached(presentation?.thumbnail || item.thumbnail)?.blobUrl || '' } },
          quickPreview.classList.contains('fullscreen') ? 'fullscreen' : 'window');
      } else {
        // Arrow browsing always stays in the current viewer, including pinned tabs.
        activate(tab.id, true, replacement);
        if (typeof main !== 'undefined' && !globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
          main.querySelector('.detail-image img[src]')?.animate?.([{ opacity: .65 }, { opacity: 1 }],
            { duration: 140, easing: 'ease-out' });
      }
      return;
    } finally { release?.(); }
  }
  restoreDisplayed();
}

function openDetail(item, options = {}) {
  item = rememberItem(item);
  const from = currentTab();
  retainFeedWork(from, item);
  const artworkRoute = options.artworkRoute || createArtworkRoute(from, item, options.origin);
  const searchQuery = from?.kind === 'search' ? from.query :
    from?.kind === 'detail' ? from.relatedQuery || from.searchQuery || '' : '';
  const keys = new Set([item.key, ...(item.memberKeys || [])]);
  const existing = tabs.find(tab => tab.kind === 'detail' &&
    [tab.item.key, ...(tab.item.memberKeys || [])].some(key => keys.has(key)));
  if (existing) {
    const grouped = CatalogLogic.groupWorks([existing.item, item])[0];
    existing.item = rememberItem(CatalogLogic.mergeDetailPages(grouped, existing.item));
    if (artworkRoute) existing.artworkRoute = artworkRoute;
    saveSession();
    if (options.separate && existing.preview) pinTab(existing.id);
    if (!options.background) activate(existing.id);
    return existing;
  }
  const rating = ratingFilterFor(item);
  const previewMode = !options.separate && tabPreferences.artworkTabs === 'preview';
  const preview = previewMode && tabs.find(tab => tab.kind === 'detail' && tab.preview && !tab.pinned);
  if (!preview) return createTab('detail', item.title, { item, rating, searchQuery, artworkRoute,
    preview: previewMode }, { background: !!options.background });
  if (from) from.scrollTop = main.scrollTop;
  abortTab(preview);
  const replacement = { id: preview.id, kind: 'detail', title: item.title,
    item, rating, searchQuery, artworkRoute, preview: true, items: [], errors: {}, page: 0,
    loading: false, scrollTop: 0, selectedSources: [...defaultSources],
    sort: 'recent', feed: 'illustrations' };
  tabs[tabs.indexOf(preview)] = replacement;
  if (activeId === preview.id) activeId = null;
  main.dataset.tabId = '';
  activate(replacement.id);
  return replacement;
}

function isSavedWork(item, collection) {
  const intentions = savedWorkPending.intentions;
  if (intentions?.size) for (const key of pendingSavedWorkKeys(item, collection))
    if (intentions.has(key)) return intentions.get(key);
  const keys = collection === 'likes' ? likedKeys : savedKeys;
  if ([item.key, ...(item.memberKeys || [])].some(key => keys.has(key))) return true;
  const index = savedWorkIdentityIndex(collection);
  return CatalogLogic.workHistoryTokens(item).some(token => index.has(token));
}

function pendingSavedWorkKeys(item, collection) {
  return CatalogLogic.workHistoryTokens(item).map(token => `${collection}:${token}`);
}

function savedWorkIdentityIndex(collection) {
  const items = collection === 'likes' ? likes : bookmarks;
  const caches = savedWorkIdentityIndex.collections ||= {};
  if (caches[collection]?.items === items) return caches[collection].index;
  const index = new Map();
  for (const item of items) for (const token of CatalogLogic.workHistoryTokens(item)) {
    if (!index.has(token)) index.set(token, []);
    index.get(token).push(item);
  }
  caches[collection] = { items, index };
  return index;
}

function isSavedWorkPending(item, collection) {
  return pendingSavedWorkKeys(item, collection).some(key => savedWorkPending.has(key));
}

function savedWorkAliases(item, collection) {
  const index = savedWorkIdentityIndex(collection);
  const tokens = CatalogLogic.workHistoryTokens(item), visited = new Set(), aliases = new Set();
  for (let offset = 0; offset < tokens.length; offset++) {
    const token = tokens[offset];
    if (visited.has(token)) continue;
    visited.add(token);
    for (const saved of index.get(token) || []) {
      if (aliases.has(saved)) continue;
      aliases.add(saved);
      tokens.push(...CatalogLogic.workHistoryTokens(saved));
    }
  }
  return [...aliases];
}

function savedWorkButton(item, collection, detail = false) {
  const like = collection === 'likes';
  const saved = isSavedWork(item, collection);
  const label = like ? saved ? 'Unlike' : 'Like' : saved ? 'Remove bookmark' : 'Add bookmark';
  const shortcut = like ? 'F' : 'B';
  return `<button type="button" class="${detail ? 'detail-save-button ' : ''}${like ? 'heart-button' : 'bookmark-button'}${saved ? ' saved' : ''}" data-action="${like ? 'like' : 'bookmark'}" data-key="${escapeHtml(item.key)}" title="${label}${detail ? ` (${shortcut})` : ''}" aria-label="${label}"${detail ? ` aria-keyshortcuts="${shortcut}"` : ''} aria-pressed="${saved}"${isSavedWorkPending(item, collection) ? ' disabled' : ''}>${svg(like ? 'heart' : 'bookmark')}</button>`;
}

function quickPreviewShortcutAllowed(event, focused) {
  if (event.code !== 'Space' && event.key !== ' ') return false;
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey ||
      focused?.isContentEditable) return false;
  return !focused?.closest?.('input, textarea, select, [contenteditable], video, [role="slider"]');
}

function quickPreviewArtworkAt(target, tab, index) {
  const opener = target?.closest?.('button.card-art[data-action="open"]');
  const cardImage = opener?.querySelector?.('img[data-image-url]');
  const cardItem = opener && index.get(opener.dataset.key);
  if (cardImage && cardItem) {
    const grid = opener.closest?.('[data-grid-key]')?.dataset.gridKey ||
      (opener.closest?.('.author-strip') ? 'creator' : tab?.kind);
    const displayed = tab?.artworkLists?.get(grid)?.find(item => CatalogLogic.sameWork(item, cardItem)) || cardItem;
    const url = opener.dataset.videoPreview || CatalogLogic.previewMedia(displayed) || cardImage.dataset.imageUrl;
    return url ? { item: cardItem, image: cardImage, url } : null;
  }
  if (tab?.kind !== 'detail') return null;
  if (target?.matches?.('video[data-video-url]'))
    return { item: tab.item, image: target, url: target.dataset.videoUrl };
  if (!target?.matches?.('.detail-image img[data-image-url]')) return null;
  const url = target.dataset.imageUrl;
  return url ? { item: tab.item, image: target, url } : null;
}

function quickPreviewFitSize(width, height, viewportWidth, viewportHeight, fullscreen) {
  const w = width > 0 ? width : 640, h = height > 0 ? height : 480;
  const maxWidth = fullscreen ? viewportWidth : Math.min(1600, viewportWidth * .9, viewportWidth - 32);
  const maxHeight = fullscreen ? viewportHeight : Math.min(viewportHeight * .88, viewportHeight - 32);
  const scale = Math.min(Math.max(1, maxWidth) / w, Math.max(1, maxHeight) / h);
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

function quickPreviewBoundScale(value) {
  const scale = Math.max(1, Math.min(6, value));
  return scale < 1.01 ? 1 : scale;
}

function quickPreviewClampPan(view, width, height) {
  const scale = quickPreviewBoundScale(view.scale);
  const limitX = Math.max(0, width * (scale - 1) / 2);
  const limitY = Math.max(0, height * (scale - 1) / 2);
  return {
    scale,
    x: scale === 1 ? 0 : Math.max(-limitX, Math.min(limitX, view.x)),
    y: scale === 1 ? 0 : Math.max(-limitY, Math.min(limitY, view.y))
  };
}

function quickPreviewZoomAt(view, nextScale, pointX, pointY, width, height) {
  const scale = quickPreviewBoundScale(nextScale);
  const ratio = scale / view.scale;
  return quickPreviewClampPan({ scale,
    x: pointX - (pointX - view.x) * ratio,
    y: pointY - (pointY - view.y) * ratio }, width, height);
}

function paintQuickPreview(instant = false) {
  const stage = quickPreview.querySelector('.quick-preview-stage');
  const image = stage?.querySelector('.quick-preview-image');
  if (!image) return;
  const video = image.tagName === 'VIDEO';
  const fullscreen = quickPreview.classList.contains('fullscreen');
  const gallery = quickPreview.querySelector('.quick-preview-gallery');
  const size = quickPreviewFitSize(image.videoWidth || image.naturalWidth || Number(image.dataset.previewWidth),
    image.videoHeight || image.naturalHeight || Number(image.dataset.previewHeight), innerWidth, innerHeight, fullscreen);
  stage.style.width = fullscreen ? '100%' : `${size.width}px`;
  stage.style.height = fullscreen ? '100%' : `${size.height}px`;
  if (gallery && globalThis.DartPreviewGallery) {
    const geometry = `${innerWidth}:${innerHeight}:${size.width}:${size.height}`;
    if (gallery.dataset.geometry !== geometry) {
      const layout = DartPreviewGallery.layout(size.width, size.height, innerWidth, innerHeight);
      gallery.style.width = `${size.width}px`; gallery.style.height = `${size.height}px`;
      gallery.style.setProperty('--preview-peek-height', `${layout.peekHeight}px`);
      gallery.style.setProperty('--preview-panel-left', `${layout.panelLeft}px`);
      gallery.classList.toggle('no-peek-space', layout.peekHeight < 8);
      gallery.dataset.geometry = geometry;
    }
  }
  if (video) { quickPreviewView = { scale: 1, x: 0, y: 0 }; return; }
  quickPreviewView = quickPreviewClampPan(quickPreviewView, image.clientWidth, image.clientHeight);
  stage.classList.toggle('zoomed', quickPreviewView.scale > 1.01);
  stage.classList.toggle('panning', !!quickPreviewDrag);
  image.style.transitionDuration = instant || quickPreviewDrag ? '0s' : '';
  image.style.transform = `translate3d(${quickPreviewView.x}px, ${quickPreviewView.y}px, 0) scale(${quickPreviewView.scale})`;
  globalThis.DartUpscale?.syncPreview(image);
  quickPreview.querySelector('.quick-preview-zoom').textContent = `${Math.round(quickPreviewView.scale * 100)}%`;
  quickPreview.querySelector('[data-preview-action="zoom-out"]').disabled = quickPreviewView.scale <= 1;
  quickPreview.querySelector('[data-preview-action="zoom-in"]').disabled = quickPreviewView.scale >= 6;
  quickPreview.querySelector('[data-preview-action="fit"]').disabled = quickPreviewView.scale <= 1;
}

function showQuickPreviewZoom() {
  const label = quickPreview.querySelector('.quick-preview-zoom');
  if (!label) return;
  clearTimeout(quickPreviewZoomTimer);
  label.classList.add('visible');
  quickPreviewZoomTimer = setTimeout(() => {
    label.classList.remove('visible');
    quickPreviewZoomTimer = null;
  }, 1100);
}

function zoomQuickPreview(nextScale, clientX, clientY) {
  const stage = quickPreview.querySelector('.quick-preview-stage');
  if (!stage || stage.querySelector('video')) return;
  const bounds = stage.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;
  const pointX = Math.max(-bounds.width / 2,
    Math.min(bounds.width / 2, clientX - bounds.left - bounds.width / 2));
  const pointY = Math.max(-bounds.height / 2,
    Math.min(bounds.height / 2, clientY - bounds.top - bounds.height / 2));
  const previousScale = quickPreviewView.scale;
  const image = stage.querySelector('.quick-preview-image');
  quickPreviewView = quickPreviewZoomAt(quickPreviewView, nextScale,
    pointX, pointY, image?.clientWidth || bounds.width, image?.clientHeight || bounds.height);
  paintQuickPreview();
  if (Math.abs(quickPreviewView.scale - previousScale) > 0.0001) showQuickPreviewZoom();
}

function zoomQuickPreviewFromCenter(nextScale) {
  const bounds = quickPreview.querySelector('.quick-preview-stage')?.getBoundingClientRect();
  if (bounds) zoomQuickPreview(nextScale,
    bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
}

function stopQuickPreviewMedia(preserveGallery = false) {
  if (!preserveGallery && typeof quickPreviewGallery !== 'undefined') {
    quickPreviewGallery?.dispose(); quickPreviewGallery = null;
  }
  quickPreviewMediaController?.abort(); quickPreviewMediaController = null;
  for (const video of quickPreview.querySelectorAll('video')) {
    video.pause(); video.removeAttribute('src'); video.load();
  }
}

function quickPreviewGalleryMarkup() {
  return `<div class="quick-preview-gallery" aria-label="Artwork pages">
    <button type="button" class="quick-preview-gallery-peek quick-preview-gallery-peek-previous" data-preview-action="gallery-previous" title="Previous image" aria-label="Previous image" hidden>
      <img class="quick-preview-gallery-previous-image" alt="" hidden>
    </button>
    <div class="quick-preview-gallery-position">
      <button type="button" data-preview-action="gallery-previous" title="Previous image" aria-label="Previous image">↑</button>
      <span class="quick-preview-gallery-count" role="status" aria-live="polite" data-no-i18n></span>
      <button type="button" data-preview-action="gallery-next" title="Next image" aria-label="Next image">↓</button>
      <span class="quick-preview-gallery-loading" hidden>Loading…</span>
    </div>
    <div class="quick-preview-gallery-error" role="status" hidden><span>Could not load this image.</span> <button type="button" data-preview-action="gallery-retry">Retry</button></div>
    <button type="button" class="quick-preview-gallery-peek quick-preview-gallery-peek-next" data-preview-action="gallery-next" title="Next image" aria-label="Next image">
      <img class="quick-preview-gallery-peek-image" alt="" hidden>
    </button>
  </div>`;
}

function renderQuickPreviewGallery() {
  if (typeof quickPreviewGallery === 'undefined' || !quickPreviewGallery) return;
  const footer = quickPreview.querySelector('.quick-preview-gallery');
  if (!footer) return;
  const state = quickPreviewGallery.state;
  footer.dataset.galleryIndex = String(state.index);
  footer.dataset.galleryWanted = String(state.wanted);
  footer.setAttribute('aria-busy', String(state.busy));
  footer.querySelector('.quick-preview-gallery-count').textContent = `${state.index + 1} / ${state.length}`;
  for (const button of footer.querySelectorAll('[data-preview-action="gallery-previous"]')) button.disabled = state.wanted <= 0;
  for (const button of footer.querySelectorAll('[data-preview-action="gallery-next"]')) button.disabled = state.wanted >= state.length - 1;
  footer.querySelector('.quick-preview-gallery-loading').hidden = !state.busy;
  footer.querySelector('.quick-preview-gallery-error').hidden = !state.error;
  for (const [direction, selector] of [[-1, 'previous'], [1, 'next']]) {
    const index = state.index + direction, peek = footer.querySelector(`.quick-preview-gallery-peek-${selector}`);
    peek.hidden = index < 0 || index >= state.length;
    const video = !!CatalogLogic.videoMimeType(quickPreviewGallery.pages[index]);
    peek.classList.toggle('video', video);
    const label = direction < 0 ? video ? 'Previous video' : 'Previous image' : video ? 'Next video' : 'Next image';
    peek.title = label; peek.setAttribute('aria-label', label);
  }
  globalThis.DartI18n?.translateTree(footer);
  paintQuickPreview(true);
}

async function prepareQuickPreviewGalleryPage(url, signal, priority = 'foreground') {
  if (CatalogLogic.videoMimeType(url)) return { url };
  const bounded = AbortSignal.any([signal, AbortSignal.timeout(8000)]);
  const release = imageLoader.pin(url);
  const check = () => { if (bounded.aborted) throw new DOMException('Preview cancelled', 'AbortError'); };
  try {
    let requested = url, renewed = false;
    const renew = async () => {
      renewed = true;
      const media = quickPreview.querySelector('.quick-preview-image');
      const replacement = await sankakuMediaRecovery.recover([media], requested, bounded);
      check();
      if (!replacement) return false;
      requested = replacement; return true;
    };
    let entry = imageLoader.cached(requested);
    if (!entry) {
      if (CatalogLogic.signedMediaExpired(requested)) await renew();
      check();
      let blob;
      try { blob = await readMediaBlob(requested, bounded, { priority }); }
      catch (error) {
        if (bounded.aborted || renewed || !await renew()) throw error;
        blob = await readMediaBlob(requested, bounded, { priority });
      }
      check(); entry = imageLoader.rememberBlob(requested, blob);
    }
    await imageLoader.decode(entry); check();
    return { url: requested, entry };
  } finally { release(); }
}

function createQuickPreviewGallery(item, route, selected, mode) {
  if (!globalThis.DartPreviewGallery) return null;
  const urls = galleryImages(item, route);
  if (urls.length < 2) return null;
  const gallery = DartPreviewGallery.create({ urls, selected, key: CatalogLogic.mediaCacheKey,
    prepare: prepareQuickPreviewGalleryPage, changed: renderQuickPreviewGallery,
    show: (ready, index, previous) => {
      if (quickPreviewGallery !== gallery || !quickPreview.open || quickPreviewRoute !== route) return;
      openQuickPreview({ item: quickPreviewWork, image: ready.entry?.image, url: ready.url, route,
        galleryPage: { gallery, index, previous } }, mode);
    } });
  return gallery;
}

function warmQuickPreviewGallery() {
  if (!quickPreviewGallery || !quickPreviewMediaController) return;
  const gallery = quickPreviewGallery, signal = quickPreviewMediaController.signal;
  // At most two adjacent images share the existing cache and background lanes.
  // The previous image is normally already decoded; inactive movies stay unloaded.
  for (const [direction, selector] of [[-1, 'previous-image'], [1, 'peek-image']]) {
    const url = gallery.pages[gallery.state.index + direction];
    if (!url || CatalogLogic.videoMimeType(url)) continue;
    const release = imageLoader.pin(url);
    signal.addEventListener('abort', release, { once: true });
    void prepareQuickPreviewGalleryPage(url, signal, 'background').then(ready => {
      if (signal.aborted || gallery !== quickPreviewGallery) return;
      const image = quickPreview.querySelector(`.quick-preview-gallery-${selector}`);
      if (image) { image.src = ready.entry.blobUrl; image.hidden = false; }
    }).catch(() => { /* Selecting this page retains its explicit retry path. */ });
  }
}

function moveQuickPreviewGallery(direction) {
  if (!quickPreview.open || !quickPreviewGallery) return;
  quickPreviewRoute?.navigationController?.abort();
  quickPreviewDrag = null;
  void quickPreviewGallery.move(direction);
}

function openQuickPreview({ item, image, url, route, galleryPage = null }, mode = 'window') {
  tagPreviewController.instance?.hide();
  if (!item || !url || quickPreview.open && (!route || route !== quickPreviewRoute)) return;
  if (!quickPreview.open && typeof cancelQuickPreviewReturn === 'function') cancelQuickPreviewReturn();
  if (!quickPreview.open) quickPreviewReturnFocus = image?.closest?.(
    'button.card-art[data-action="open"], .detail-image > img[data-image-url], .detail-video > video[data-video-url]') || null;
  const selectedRoute = route || (currentTab()?.kind === 'detail' &&
    CatalogLogic.sameWork(currentTab().item, item) ? currentTab().artworkRoute :
    createArtworkRoute(currentTab(), item, image));
  const presentation = selectedRoute?.presentation ? artworkRouteMedia(selectedRoute, item, url) : null;
  url = presentation?.preview || url;
  const thumbnail = presentation?.thumbnail || item.thumbnail || '';
  stopQuickPreviewMedia(!!galleryPage); globalThis.DartVideoPreview?.stop(); pauseDetailVideos();
  const controller = quickPreviewMediaController = new AbortController();
  const video = !!CatalogLogic.videoMimeType(url);
  const releases = [...new Set([thumbnail, ...(!video ? [url] : [])].filter(Boolean))]
    .map(mediaUrl => imageLoader.pin(mediaUrl));
  controller.signal.addEventListener('abort', () => releases.forEach(release => release()), { once: true });
  quickPreviewRoute = selectedRoute;
  clearTimeout(quickPreviewZoomTimer);
  quickPreviewZoomTimer = null;
  quickPreview.classList.toggle('fullscreen', mode === 'fullscreen');
  quickPreview.setAttribute('aria-label', video ? mode === 'fullscreen' ? 'Fullscreen video preview' : 'Quick video preview'
    : mode === 'fullscreen' ? 'Полноэкранный просмотр изображения' : 'Быстрый просмотр изображения');
  item = quickPreviewWork = rememberItem(item);
  if (globalThis.DartPreviewGallery) {
    quickPreviewGallery = galleryPage?.gallery || createQuickPreviewGallery(item, selectedRoute, url, mode);
    if (!galleryPage) quickPreviewGalleryWheel = DartPreviewGallery.wheelGesture();
  }
  quickPreview.classList.toggle('has-gallery', typeof quickPreviewGallery !== 'undefined' && !!quickPreviewGallery);
  retainFeedWork(currentTab(), item);
  const preview = (presentation && !presentation.selectedOwned ? '' :
    (image?.tagName === 'VIDEO' ? image.poster : image?.currentSrc || image?.getAttribute?.('src')) ||
    imageLoader.cached(image?.dataset?.imageUrl)?.blobUrl) || imageLoader.cached(thumbnail)?.blobUrl || '';
  const full = imageLoader.cached(url)?.blobUrl || '';
  quickPreviewView = { scale: 1, x: 0, y: 0 };
  quickPreviewDrag = null;
  quickPreview.innerHTML = `<div class="quick-preview-stage${video ? ' quick-preview-video-stage' : ''}" data-work-key="${escapeHtml(item.key)}">
    ${video ? `<video class="quick-preview-image quick-preview-video" data-video-url="${escapeHtml(url)}" data-video-identity="${escapeHtml(item.key + "|" + CatalogLogic.mediaCacheKey(url))}" data-preview-width="${image?.naturalWidth || 640}" data-preview-height="${image?.naturalHeight || 480}" controls autoplay${viewerPreferences.videoSound ? "" : " muted"} loop playsinline preload="metadata"${preview ? ` poster="${escapeHtml(preview)}"` : ''} aria-label="${escapeHtml(item.title)}"></video><div class="quick-preview-error" role="status" hidden><span>Video could not be played.</span><button type="button" data-preview-action="retry">Retry</button></div>` : `<img class="quick-preview-image" alt="${escapeHtml(item.title || 'Изображение')}"${preview || full ? ` src="${escapeHtml(preview || full)}"` : ''} draggable="false">
    <div class="quick-preview-tools" role="group" aria-label="Image zoom">
      <button type="button" data-preview-action="zoom-out" title="Zoom out" aria-label="Zoom out" disabled>−</button>
      <button type="button" data-preview-action="zoom-in" title="Zoom in" aria-label="Zoom in">+</button>
      <button type="button" data-preview-action="fit" title="Fit image" aria-label="Fit image" disabled>↺</button>
    </div>
    <span class="quick-preview-zoom" aria-live="off">100%</span>`}
    <button type="button" class="quick-preview-close" data-preview-action="close" title="Close preview" aria-label="Close preview">×</button>
    <div class="quick-preview-actions">${savedWorkButton(item, 'likes', true)}${savedWorkButton(item, 'bookmarks', true)}${artworkMoreButton(item)}</div>
  </div>${typeof quickPreviewGallery !== 'undefined' && quickPreviewGallery ? quickPreviewGalleryMarkup() : ''}`;
  if (!quickPreview.open) quickPreview.showModal();
  globalThis.DartI18n?.translateTree(quickPreview);
  quickPreview.focus({ preventScroll: true });
  if (typeof quickPreviewGallery !== 'undefined' && quickPreviewGallery) renderQuickPreviewGallery();
  if (!video) {
    const image = quickPreview.querySelector('.quick-preview-image');
    image.dataset.imageUrl = url;
    image.dataset.previewUrl = thumbnail;
    imageLoader.adopt(quickPreview);
  }
  const media = quickPreview.querySelector('.quick-preview-image');
  if (video) DartViewerPreferences.configureVideo(media, viewerPreferences);
  media.addEventListener(video ? 'loadedmetadata' : 'load', () => paintQuickPreview(true), { signal: controller.signal });
  paintQuickPreview(true);
  globalThis.DartUpscale?.applyVisible();
  if (!galleryPage) {
    recordDetailVisit({ item, artworkRoute: quickPreviewRoute });
    if (quickPreviewRoute) { quickPreviewRoute.engine.select(item); warmArtworkRoute(quickPreviewRoute); }
  }
  if (typeof quickPreviewGallery !== 'undefined' && quickPreviewGallery) warmQuickPreviewGallery();
  if (galleryPage && !globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
    media.animate?.([{ opacity: .85 }, { opacity: 1 }], { duration: 120, easing: 'ease-out' });
  const generation = ++quickPreviewGeneration;
  if (video) {
    let attemptedRecovery = false;
    const startVideo = async () => {
      let nextUrl = url;
      if (CatalogLogic.signedMediaExpired(url)) nextUrl = await sankakuMediaRecovery.recover([media], url, controller.signal) || url;
      if (controller.signal.aborted) return;
      media.src = `/api/video?url=${encodeURIComponent(nextUrl)}`;
      media.load(); void media.play().catch(() => {});
    };
    media.addEventListener('error', async () => {
      if (controller.signal.aborted) return;
      if (!attemptedRecovery) {
        attemptedRecovery = true;
        const renewed = await sankakuMediaRecovery.recover([media], url, controller.signal);
        if (controller.signal.aborted) return;
        if (renewed && renewed !== url) { media.src = `/api/video?url=${encodeURIComponent(renewed)}`; media.load(); void media.play().catch(() => {}); return; }
      }
      quickPreview.querySelector('.quick-preview-error').hidden = false;
    }, { signal: controller.signal });
    media.addEventListener('playing', () => { quickPreview.querySelector('.quick-preview-error').hidden = true; }, { signal: controller.signal });
    void startVideo();
  } else {
    // The modal shares warming/visible downloads and owns only its reader.
    // Closing or switching releases that reader, while the existing poster
    // stays visible until the full image has decoded.
    void (async () => {
      try {
        let requestedUrl = url, renewed = false;
        const renew = async () => {
          renewed = true;
          const image = quickPreview.querySelector('.quick-preview-image');
          const replacement = await sankakuMediaRecovery.recover([image], requestedUrl, controller.signal);
          if (!replacement || controller.signal.aborted) return false;
          requestedUrl = replacement;
          image.dataset.imageUrl = replacement;
          return true;
        };
        let entry = imageLoader.cached(requestedUrl);
        if (!entry) {
          if (CatalogLogic.signedMediaExpired(requestedUrl)) await renew();
          if (controller.signal.aborted) return;
          let blob;
          try { blob = await readMediaBlob(requestedUrl, controller.signal, { priority: 'foreground' }); }
          catch (error) {
            if (error.name === 'AbortError' || renewed || !await renew()) throw error;
            blob = await readMediaBlob(requestedUrl, controller.signal, { priority: 'foreground' });
          }
          if (controller.signal.aborted) return;
          entry = imageLoader.rememberBlob(requestedUrl, blob);
        }
        if (controller.signal.aborted) return;
        await imageLoader.decode(entry);
        if (controller.signal.aborted || !quickPreview.open || generation !== quickPreviewGeneration) return;
        const image = quickPreview.querySelector('.quick-preview-image');
        imageLoader.reveal(image, entry.blobUrl);
        imageLoader.adopt(quickPreview);
        paintQuickPreview(true);
        globalThis.DartUpscale?.applyVisible();
      } catch { /* Keep the available preview when full media is unavailable. */ }
    })();
  }
}

function closeQuickPreview(retainedRoute = null) {
  if (quickPreview.contains(recommendationTagMenu)) closeRecommendationTagMenu();
  if (!quickPreview.open) return;
  const returnTarget = retainedRoute ? null : captureQuickPreviewReturn(quickPreviewRoute, quickPreviewWork);
  ++quickPreviewGeneration;
  stopQuickPreviewMedia();
  clearTimeout(quickPreviewZoomTimer);
  quickPreviewZoomTimer = null;
  quickPreviewDrag = null;
  quickPreview.close();
  if (quickPreviewRenderPending) render();
  globalThis.DartUpscale?.applyVisible();
  quickPreview.replaceChildren();
  quickPreviewWork = null;
  quickPreviewRoute?.navigationController?.abort();
  const underlying = currentTab();
  if (underlying?.kind === 'detail' && underlying.artworkRoute === quickPreviewRoute)
    quickPreviewRoute.engine.select(underlying.item);
  else quickPreviewRoute?.engine.cancel();
  quickPreviewRoute?.warmController?.abort();
  quickPreviewRoute = null;
  pruneArtworkRoutes(retainedRoute);
  // Hover can open a modal while Home/Back still has keyboard focus. Restore
  // the artwork that opened it instead of letting the next Space click that UI.
  const returnFocus = quickPreviewReturnFocus;
  quickPreviewReturnFocus = null;
  if (revealQuickPreviewReturn(returnTarget)) return;
  if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  else globalThis.document?.getElementById('main')?.focus({ preventScroll: true });
}

function captureQuickPreviewReturn(route, item) {
  const origin = route?.returnOrigin;
  if (!origin || !item?.key || typeof main === 'undefined') return null;
  return { ...origin, keys: new Set([item.key, ...(item.memberKeys || [])]) };
}

function cancelQuickPreviewReturn() {
  const state = revealQuickPreviewReturn;
  if (state.frame !== undefined) globalThis.cancelAnimationFrame?.(state.frame);
  state.frame = undefined;
  if (state.highlight) {
    clearTimeout(state.highlight.timer);
    state.highlight.node?.classList.remove('artwork-return-highlight');
    state.highlight.animation?.cancel();
    if (typeof main !== 'undefined') main.querySelectorAll?.('.artwork-return-highlight')
      .forEach(node => node.classList.remove('artwork-return-highlight'));
  }
  state.highlight = null;
}

function quickPreviewReturnValid(target) {
  const source = target?.source;
  return !!source && !quickPreview.open && currentTab() === source &&
    main.dataset?.tabId === String(source.id) && target.preferences === contentPreferences &&
    target.signature === artworkSourceSignature(source) &&
    target.generation === (source.artworkGeneration || 0) &&
    target.detailKey === (source.kind === 'detail' ? source.item?.key : '');
}

function quickPreviewReturnHighlighted(item, tab) {
  const active = revealQuickPreviewReturn.highlight;
  return !!active && active.source === tab && active.until > Date.now() &&
    active.generation === (tab.artworkGeneration || 0) &&
    active.signature === artworkSourceSignature(tab) &&
    [item.key, ...(item.memberKeys || [])].some(key => active.keys.has(key));
}

function revealQuickPreviewReturn(target, retry = false) {
  if (!retry) cancelQuickPreviewReturn();
  if (!target || !quickPreviewReturnValid(target)) return false;
  const tab = target.source;
  const matches = item => [item?.key, ...(item?.memberKeys || [])].some(key => target.keys.has(key));
  const grids = tab.kind === 'home' ? ['home', 'home-rest'] : [target.gridKey];
  for (const key of grids) {
    const publication = tab.artworkLists?.get(key);
    const list = publication || [];
    let index = list.findIndex(matches);
    let represented = index >= 0 ? list[index] : null;
    // A manual Favorite stack has one card but may contain several different
    // works. Return to that existing stack only while it still owns this work.
    if (!represented && target.groupId && key === 'favorites-artworks') {
      for (const [cardKey, pack] of tab.favoriteGroupCards || [])
        if (pack.groupId === target.groupId && pack.items.some(matches)) {
          index = list.findIndex(item => item.key === cardKey); represented = list[index]; break;
        }
    }
    if (publication && !represented) continue;
    const keys = represented ? new Set([represented.key, ...(represented.memberKeys || [])]) : target.keys;
    const getWrapper = () => key === 'creator' ? main.querySelector?.('.author-strip') :
      [...main.querySelectorAll('[data-grid-key]')].find(node => node.dataset.gridKey === key);
    const wrapper = getWrapper();
    if (!wrapper && !(tab.kind === 'favorites' && tab.favoriteType !== 'artwork')) continue;
    const findCard = () => [...(getWrapper() || main).querySelectorAll('.card[data-work-key]')].find(node =>
      [node.dataset.workKey, ...workMemberKeys(node)].some(value => keys.has(value)));
    let card = findCard();
    const state = tab.virtualState?.[key];
    if (!card && represented && state && wrapper?.classList.contains('virtual-grid')) {
      const row = Math.floor((state.itemIndexes?.get(represented.key) ?? index) / Math.max(1, state.cols));
      const overscan = state.overscan ?? 4;
      state.startRow = Math.max(0, row - overscan);
      state.endRow = Math.min(state.totalRows, state.startRow + (state.visibleRows || 1) + overscan * 2);
      const top = Math.max(0, (tab.gridTops?.[key] || 0) + row * state.pitch -
        Math.max(0, (main.clientHeight - state.pitch) / 2));
      if (main.scrollTo) main.scrollTo({ top, behavior: 'instant' }); else main.scrollTop = top;
      tab.scrollTop = main.scrollTop;
      render(); card = findCard();
      if (!card && !retry && typeof requestAnimationFrame === 'function') {
        globalThis.document?.getElementById('main')?.focus({ preventScroll: true });
        revealQuickPreviewReturn.frame = requestAnimationFrame(() => {
          revealQuickPreviewReturn.frame = undefined;
          if (quickPreviewReturnValid(target)) revealQuickPreviewReturn(target, true);
        });
        return true;
      }
    }
    if (!card || !card.isConnected || !quickPreviewReturnValid(target)) continue;
    const bounds = main.getBoundingClientRect(), rect = card.getBoundingClientRect();
    const top = Math.max(0, main.scrollTop + rect.top - bounds.top -
      Math.max(0, (main.clientHeight - rect.height) / 2));
    if (main.scrollTo) main.scrollTo({ top, behavior: 'instant' }); else main.scrollTop = top;
    tab.scrollTop = main.scrollTop;
    const focus = card.querySelector('button.card-art[data-action="open"], button[data-action="open"]');
    if (focus) focus.focus({ preventScroll: true });
    else globalThis.document?.getElementById('main')?.focus({ preventScroll: true });
    const active = { ...target, keys, node: card, until: Date.now() + 1000 };
    revealQuickPreviewReturn.highlight = active;
    card.classList.add('artwork-return-highlight');
    if (!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
      active.animation = card.animate?.([{ outlineColor: '#329CFF' }, { outlineColor: '#329CFF', offset: .8 },
        { outlineColor: 'rgba(50,156,255,0)' }], { duration: 1000, easing: 'ease-out', fill: 'forwards' });
    active.timer = setTimeout(() => {
      if (revealQuickPreviewReturn.highlight === active) cancelQuickPreviewReturn();
    }, 1000);
    return true;
  }
  return false;
}

async function toggleSavedWork(item, collection, likeOnly = false) {
  if (isSavedWorkPending(item, collection)) return;
  if (likeOnly && isSavedWork(item, 'likes')) {
    syncSavedWorkButtons();
    toast('Добавлено в понравившиеся');
    return;
  }
  const aliases = savedWorkAliases(item, collection);
  const pendingKeys = new Set([item, ...aliases].flatMap(saved => pendingSavedWorkKeys(saved, collection)));
  if ([...pendingKeys].some(key => savedWorkPending.has(key))) return;
  const desired = likeOnly || !isSavedWork(item, collection);
  const intentions = savedWorkPending.intentions ||= new Map();
  for (const key of pendingKeys) { savedWorkPending.add(key); intentions.set(key, desired); }
  syncSavedWorkButtons();
  const sourceTab = currentTab();
  const clickedVisibleFeedCard = visibleFeedCard(sourceTab, item);
  const clickedVisibleFeedHeight = clickedVisibleFeedCard?.getBoundingClientRect().height || 0;
  let enrich = false;
  try {
    // The native library mutates by post keys. Include already-saved aliases
    // confirmed by the same file/group evidence used to render this control.
    item = { ...item, memberKeys: [...new Set([item.key, ...(item.memberKeys || []),
      ...aliases.flatMap(saved => [saved.key, ...(saved.memberKeys || [])])])] };
    const response = await request(`/api/${collection}`, {
      method: likeOnly ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item)
    });
    for (const key of pendingKeys) intentions.set(key, response.saved);
    const keys = new Set([item.key, ...(item.memberKeys || [])]);
    // Native writes remain concurrent. Serialize only publication of their
    // confirmed deltas so one collection never queues quadratic full analyses.
    const publications = toggleSavedWork.publications ||= {};
    const preceding = publications[collection];
    let release;
    const publication = publications[collection] = new Promise(resolve => { release = resolve; });
    if (preceding) await preceding;
    const metadataFields = value => Object.entries(value || {}).flatMap(([key, value]) => Array.isArray(value)
      ? [key, value, value.length] : [key, value]);
    try {
      for (let attempt = 0;; attempt++) {
        const previous = collection === 'likes' ? likes : bookmarks;
        const revision = refreshSavedWorks.states?.[collection]?.revision;
        const grouping = CatalogLogic.groupingRevision?.(previous) || 0;
        const canonical = itemIndex.get(item.key);
        const canonicalRevision = canonical && CatalogLogic.recommendationInputVersion?.([canonical]);
        const canonicalFields = metadataFields(canonical);
        const saved = previous.find(entry => entry.key === item.key && entry.source === item.source);
        let current = saved ? CatalogLogic.mergeWorkMetadata(item, saved) : item;
        if (canonical?.key === item.key && canonical.source === item.source)
          current = CatalogLogic.mergeWorkMetadata(current, canonical);
        current = { ...current, memberKeys: [...new Set([item.key, ...keys, ...(current.memberKeys || [])])] };
        const confirmedKeys = response.saved ? new Set(current.memberKeys) : keys;
        const remaining = previous.filter(entry =>
          ![entry.key, ...(entry.memberKeys || [])].some(key => confirmedKeys.has(key)));
        const next = response.saved ? [current, ...remaining] : remaining;
        let grouped = null;
        // Continuous enrichment must not starve an acknowledged save. After
        // three superseded analyses, publish a fresh delta synchronously without
        // seeding a stale cache; the ordinary shared grouping path remains valid.
        if (attempt < 3 && next.length && typeof DartCatalogJobs !== 'undefined') {
          try { grouped = await DartCatalogJobs.run('groupWorks', [next], () => null,
            { cacheKey: collection, previousInput: previous }); }
          catch { /* Keep ordinary mutations available on hosts without the optional worker. */ }
        }
        // A different saved action or metadata refresh may finish during analysis.
        // Reapply this confirmed delta to the newest snapshot instead of dropping
        // that change or publishing grouping made from obsolete metadata.
        const latestFields = metadataFields(itemIndex.get(item.key));
        if (previous !== (collection === 'likes' ? likes : bookmarks) ||
            revision !== refreshSavedWorks.states?.[collection]?.revision ||
            grouping !== (CatalogLogic.groupingRevision?.(previous) || 0) || canonical !== itemIndex.get(item.key) ||
            canonicalRevision !== (canonical && CatalogLogic.recommendationInputVersion?.([canonical])) ||
            canonicalFields.length !== latestFields.length || canonicalFields.some((value, index) => value !== latestFields[index])) continue;
        if (Array.isArray(grouped) && typeof CatalogLogic.cacheGroupedWorks === 'function') {
          try { CatalogLogic.cacheGroupedWorks(next, grouped); }
          catch { /* A rejected optional warm result cannot erase a confirmed save. */ }
        }
        setSavedWorks(collection, next, response.saved ? [current] : []);
        item = current;
        break;
      }
      if (response.saved) {
        if (clickedVisibleFeedCard) retainFeedWork(sourceTab, item, clickedVisibleFeedHeight);
        void recordViewedWorks([item]);
      }
      syncSavedWorkButtons();
      // A native acknowledgement is valid only for the snapshot this window
      // already knows. Other-window changes and older servers still reconcile.
      const state = refreshSavedWorks.states?.[collection];
      const matchesSnapshot = response.previousRevision && response.revision && state?.serverRevision === response.previousRevision;
      if (response.previousRevision && response.revision)
        for (const known of Object.values(refreshSavedWorks.states || {}))
          if (known.serverRevision === response.previousRevision) known.serverRevision = response.revision;
      if (!matchesSnapshot) await refreshSavedWorks(collection, true);
      syncSavedWorkButtons();
    } finally {
      release();
      if (publications[collection] === publication) delete publications[collection];
    }
    invalidateSavedRecommendations(collection);
    const tab = currentTab();
    if (tab?.kind === collection) render();
    enrich = response.saved && item.source === 'sankaku';
    toast(collection === 'likes' ? response.saved ? 'Добавлено в понравившиеся' : 'Лайк удалён'
      : response.saved ? 'Добавлено в закладки' : 'Удалено из закладок');
  } catch { toast(collection === 'likes' ? 'Не удалось изменить лайк' : 'Не удалось изменить закладки'); }
  finally {
    for (const key of pendingKeys) { savedWorkPending.delete(key); intentions.delete(key); }
    syncSavedWorkButtons();
  }
  if (enrich) void enrichSavedWork(item, collection);
}

function invalidateSavedRecommendations(collection) {
  if (collection !== 'likes') return;
  for (const tab of tabs.filter(entry => entry.kind === 'recommendations')) {
    tab.recommendationController?.abort();
    tab.recommendationVersion = (tab.recommendationVersion || 0) + 1;
    tab.loading = false;
    tab.loadError = false;
    tab.recommendationProfileDirty = true;
    // Keep the visit; the next page uses the updated library without a rebuild.
    if (tab.id === activeId) {
      const tail = main.querySelector?.('[data-recommendation-tail]');
      if (tail) {
        tail.innerHTML = renderRecommendationTail(tab);
        globalThis.DartI18n?.translateTree(tail);
        if (typeof autoFeed !== 'undefined') autoFeed.mount();
      }
    }
  }
}

async function enrichSavedWork(item, collection) {
  try {
    // Persist the click first. A slow or restricted provider must not hold the
    // heart disabled; the native detail endpoint refreshes only still-saved works.
    const detail = await request(`/api/detail?source=sankaku&id=${encodeURIComponent(item.id)}`,
      { priority: 'background', cache: 'reload' });
    const merged = rememberItem(CatalogLogic.mergeDetailPages(itemIndex.get(item.key) || item, detail));
    refreshSavedDetail(merged);
    invalidateSavedRecommendations(collection);
    syncSavedWorkButtons();
  } catch { /* The confirmed like and its existing metadata remain available. */ }
}

function syncSavedWorkButtons() {
  [...main.querySelectorAll('[data-action="bookmark"][data-key], [data-action="like"][data-key]'),
    ...quickPreview.querySelectorAll('[data-action="bookmark"][data-key], [data-action="like"][data-key]')].forEach(button => {
    const collection = button.dataset.action === 'like' ? 'likes' : 'bookmarks';
    const saved = isSavedWork(itemIndex.get(button.dataset.key) || { key: button.dataset.key }, collection);
    const label = collection === 'likes' ? saved ? 'Unlike' : 'Like' : saved ? 'Remove bookmark' : 'Add bookmark';
    button.classList.toggle('saved', saved);
    button.setAttribute('aria-pressed', String(saved));
    button.setAttribute('aria-label', label);
    button.title = label + (button.classList.contains('detail-save-button')
      ? ` (${collection === 'likes' ? 'F' : 'B'})` : '');
    button.disabled = isSavedWorkPending(itemIndex.get(button.dataset.key) || { key: button.dataset.key }, collection);
    globalThis.DartI18n?.translateTree(button);
  });
}

async function toggleFollow(ref) {
  const key = CatalogLogic.followKey(ref);
  const pending = toggleFollow.pending ||= new Set();
  if (pending.has(key)) return;
  pending.add(key);
  syncFollowButtons();
  try {
    const result = await request('/api/follows', { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ref) });
    await refreshFollows();
    for (const tab of tabs.filter(entry => entry.kind === 'follows')) {
      tab.followController?.abort();
      tab.started = false;
    }
    if (currentTab()?.kind === 'follows') startTab(currentTab());
    else render();
    toast(result.following ? 'Вы подписались на автора' : 'Подписка отменена');
  } catch { toast('Не удалось изменить подписку'); }
  finally { pending.delete(key); syncFollowButtons(); }
}

function syncFollowButtons() {
  for (const button of [...main.querySelectorAll('[data-action="follow"], [data-action="unfollow"]'),
    ...quickPreview.querySelectorAll('[data-action="follow"], [data-action="unfollow"]')]) {
    const key = button.dataset.followKey || CatalogLogic.followKey({
      source: button.dataset.followSource, artistId: button.dataset.followArtist });
    button.disabled = toggleFollow.pending.has(key);
  }
}

function normalizeFollowTag(value) {
  return String(value || '').trim().replace(/\s+/g, '_');
}

function tabHasCatalogTitle(tab) {
  return tab.kind === 'profile' || tab.kind === 'search' && !!tab.query ||
    tab.kind === 'detail' && !/^(Работа|Artwork|Werk) #/.test(tab.title);
}

function tabStripLayout(width, count, scrollLeft, activeIndex, revealActive, gap = 5) {
  const capacity = Math.max(1, Math.floor((width + gap) / (125 + gap)));
  if (count <= capacity) return { overflow: false, first: 0 };
  // Fit a whole number of tabs into the viewport, including the last page.
  // This keeps the left edge at a tab boundary even when the window shrinks.
  const tabWidth = (width - gap * (capacity - 1)) / capacity;
  let first = Math.round(scrollLeft / (tabWidth + gap));
  if (revealActive && activeIndex >= 0)
    first = Math.max(activeIndex - capacity + 1, Math.min(first, activeIndex));
  first = Math.max(0, Math.min(first, count - capacity));
  return { overflow: true, first, tabWidth, scrollLeft: first * (tabWidth + gap) };
}

function alignTabStrip(revealActive = false) {
  if (!tabsNode.clientWidth || !tabsNode.children.length) return;
  const nodes = [...tabsNode.querySelectorAll('.tab')];
  const gap = parseFloat(getComputedStyle(tabsNode).columnGap) || 0;
  const layout = tabStripLayout(tabsNode.clientWidth, nodes.length, tabsNode.scrollLeft,
    nodes.findIndex(node => node.classList.contains('active')), revealActive, gap);
  tabsNode.classList.toggle('tabs-overflowing', layout.overflow);
  if (layout.overflow) tabsNode.style.setProperty('--overflow-tab-width', `${layout.tabWidth}px`);
  else tabsNode.style.removeProperty('--overflow-tab-width');
  tabsNode.scrollLeft = layout.scrollLeft || 0;
}

function renderChrome() {
  const markup = tabs.map(tab => `<div class="tab ${tab.id === activeId ? 'active' : ''} ${tab.preview ? 'preview' : ''} ${tab.pinned ? 'pinned' : ''}" data-kind="${tab.kind}" role="tab" aria-selected="${tab.id === activeId}" tabindex="${tab.id === activeId ? 0 : -1}" data-tab="${tab.id}" ${tabHasCatalogTitle(tab) ? `data-i18n-keep="${escapeHtml(JSON.stringify([tab.title]))}"` : ''} title="${escapeHtml(tab.title)}${tab.preview ? ' · Временный просмотр. Двойной клик — закрепить' : ''}">
    <span class="tab-mark"></span><span class="tab-title"${tabHasCatalogTitle(tab) ? ' data-no-i18n' : ''}>${escapeHtml(tab.title)}</span>
    ${tab.preview || tab.pinned ? `<button class="tab-pin ${tab.pinned ? 'active' : ''}" type="button" data-pin="${tab.id}" title="${tab.pinned ? 'Открепить' : 'Закрепить'} вкладку" aria-label="${tab.pinned ? 'Открепить' : 'Закрепить'} вкладку">${svg('pin')}</button>` : ''}
    <button class="tab-close" type="button" data-close="${tab.id}" title="Закрыть вкладку" aria-label="Закрыть вкладку">×</button></div>`).join('');
  if (markup !== renderedTabsMarkup) {
    const activeNode = tabsNode.querySelector('.tab.active');
    const previousActive = activeNode?.dataset.tab;
    const activeBounds = activeNode?.getBoundingClientRect();
    const stripBounds = tabsNode.getBoundingClientRect();
    const activeWasVisible = activeBounds && activeBounds.left >= stripBounds.left - 1 &&
      activeBounds.right <= stripBounds.right + 1;
    tabsNode.innerHTML = markup;
    renderedTabsMarkup = markup;
    alignTabStrip(previousActive !== String(activeId) || activeWasVisible);
  }
  const listButton = document.getElementById('tab-list-button');
  listButton.innerHTML = `${svg('list')}<span>${tabs.length}</span>`;
  listButton.setAttribute('aria-label', `Все вкладки: ${tabs.length}`);
  renderTabList();
  document.getElementById('back-button').disabled = navigationTarget(-1) < 0;
  document.getElementById('forward-button').disabled = navigationTarget(1) < 0;
  document.querySelectorAll('.side-link').forEach(button => {
    const current = currentTab();
    const nav = button.dataset.nav;
    button.classList.toggle('active', nav === CatalogLogic.navigationSection(current));
  });
  const tab = currentTab();
  const query = tab?.kind === 'detail' ? '' : tab?.query || '';
  const value = tab?.searchDraft?.query === query ? tab.searchDraft.value : query;
  // A pagination, media or collection publication must not replace an unsent
  // query or reset its caret. Drafts belong to the tab, not its loaded results.
  if (searchInput.value !== value) searchInput.value = value;
}

function pauseDetailVideos() {
  globalThis.DartVideoPreview?.stop();
  main.querySelectorAll('video[data-video-url]').forEach(video => video.pause());
}

function render() {
  tagPreviewController.instance?.reconcile();
  // Feed publications keep advancing behind the modal. Paint their newest
  // snapshot once it closes instead of interrupting image zoom and panning.
  if (quickPreview.open) { quickPreviewRenderPending = true; return; }
  quickPreviewRenderPending = false;
  const tab = currentTab();
  const sameTab = tab && main.dataset.tabId === String(tab.id);
  const scrollTop = sameTab
    ? main.scrollTop : tab?.scrollTop || 0;
  const anchor = sameTab && scrollTop > 40 &&
    ['follows', 'profile'].includes(tab.kind) ? captureGridAnchor() : null;
  if (sameTab) {
    tab.gridTops ||= {};
    const mainTop = main.getBoundingClientRect().top;
    main.querySelectorAll('[data-grid-key]').forEach(node => {
      tab.gridTops[node.dataset.gridKey] = scrollTop +
        node.getBoundingClientRect().top - mainTop;
    });
  }
  renderChrome();
  if (!tab) { pauseDetailVideos(); main.innerHTML = ''; return; }
  let markup = '';
  if (tab.kind === 'home') markup = renderHome(tab);
  else if (tab.kind === 'search') markup = renderSearch(tab);
  else if (tab.kind === 'detail') markup = renderDetail(tab);
  else if (tab.kind === 'profile') markup = renderProfile(tab);
  else if (tab.kind === 'bookmarks') markup = renderList('Закладки', 'Сохранённые работы доступны без повторного поиска.', tab);
  else if (tab.kind === 'favorites') markup = favoritesController().render(tab);
  else if (tab.kind === 'likes') markup = renderList('Понравившиеся', 'Лайки помогают подбирать рекомендации по вашему вкусу.', tab);
  else if (tab.kind === 'recommendations') markup = renderRecommendations(tab);
  else if (tab.kind === 'follows') markup = renderFollows(tab);
  else if (tab.kind === 'recent') markup = renderList('Недавно открытое', 'История просмотра хранится на этом компьютере.', { items: recent, loading: false });
  else if (tab.kind === 'settings') markup = renderSettings();
  if (sameTab) {
    const next = document.createElement('template');
    next.innerHTML = markup;
    globalThis.DartI18n?.translateTree(next.content);
    reconcileChildren(main, next.content);
    imageLoader.adopt(main);
    imageLoader.refresh(main);
  } else {
    pauseDetailVideos();
    main.innerHTML = markup;
    globalThis.DartI18n?.translateTree(main);
    imageLoader.adopt(main);
    imageLoader.mount(main);
  }
  main.dataset.tabId = String(tab.id);
  for (const button of main.querySelectorAll(nsfwFilterSelector)) {
    button.setAttribute('aria-haspopup', 'menu');
    button.setAttribute('title', globalThis.DartI18n?.translate('Right-click to choose Q and NSFW') || 'Right-click to choose Q and NSFW');
  }
  for (const video of main.querySelectorAll('video[data-video-url]'))
    DartViewerPreferences.configureVideo(video, viewerPreferences);
  main.scrollTop = scrollTop;
  restoreGridAnchor(anchor);
  globalThis.DartVideoPreview?.refresh();
  measureVirtualGrids(tab);
  if (typeof recommendationExposureTracker !== 'undefined') recommendationExposureTracker.refresh();
  if (tab.kind === 'profile') scheduleProfileBanner(tab);
  autoFeed.mount();
  if (typeof scheduleRule34Recovery === 'function') scheduleRule34Recovery(tab);
  if (typeof groupRepairs !== 'undefined') groupRepairs.scan();
  if (typeof transferredMediaHydration !== 'undefined') transferredMediaHydration.scan();
  globalThis.DartUpscale?.mounted();
}

function workMemberKeys(node) {
  if (!node?.matches?.('article.card[data-work-key]')) return [];
  try {
    const keys = JSON.parse(node.dataset.workMembers || '[]');
    if (Array.isArray(keys) && keys.length) return keys;
  } catch { /* A card still has its own key. */ }
  return [node.dataset.workKey];
}

function sharesWorkMember(first, second) {
  const keys = new Set(workMemberKeys(first));
  return keys.size > 0 && workMemberKeys(second).some(key => keys.has(key));
}

function captureGridAnchor() {
  const bounds = main.getBoundingClientRect();
  const card = [...main.querySelectorAll('.grid > article.card[data-work-key]')]
    .find(node => {
      const rect = node.getBoundingClientRect();
      return rect.bottom > bounds.top + 20 && rect.top < bounds.bottom;
    });
  return card ? { key: card.dataset.workKey, members: workMemberKeys(card),
    top: card.getBoundingClientRect().top } : null;
}

function restoreGridAnchor(anchor) {
  if (!anchor) return;
  const cards = [...main.querySelectorAll('.grid > article.card[data-work-key]')];
  const card = cards.find(node => node.dataset.workKey === anchor.key) ||
    cards.find(node => workMemberKeys(node).some(key => anchor.members.includes(key)));
  if (card) main.scrollTop += card.getBoundingClientRect().top - anchor.top;
}

function renderNodeKey(node) {
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  if (node.tagName === 'IMG' && node.classList.contains('video-preview-frame')) return 'IMG:video-preview-frame';
  const value = node.getAttribute('data-work-key') ||
    node.getAttribute('data-grid-key') || node.getAttribute('data-render-key') || node.id;
  return value ? `${node.tagName}:${value}` : '';
}

function canReconcileNode(current, next) {
  if (current.nodeType !== next.nodeType) return false;
  if (current.nodeType !== Node.ELEMENT_NODE) return true;
  if (current.tagName !== next.tagName) return false;
  if (current.tagName === 'IMG') {
    const currentPreview = current.classList?.contains('video-preview-frame');
    const nextPreview = next.classList?.contains('video-preview-frame');
    if (currentPreview || nextPreview) return !!currentPreview && !!nextPreview;
    if (CatalogLogic.mediaCacheKey(current.dataset.imageUrl) ===
        CatalogLogic.mediaCacheKey(next.dataset.imageUrl)) return true;
    return sharesWorkMember(current.closest?.('article[data-work-key]'),
      next.closest?.('article[data-work-key]'));
  }
  if (current.tagName === 'VIDEO')
    return current.dataset.videoUrl === next.dataset.videoUrl;
  return true;
}

function reconcileChildren(parent, desired) {
  const keyed = new Map();
  const members = new Map();
  for (const child of parent.childNodes) {
    const key = renderNodeKey(child);
    if (key) keyed.set(key, child);
    for (const member of workMemberKeys(child))
      if (!members.has(member)) members.set(member, child);
  }
  const used = new Set();
  let cursor = parent.firstChild;
  for (const next of [...desired.childNodes]) {
    const key = renderNodeKey(next);
    let match = key ? keyed.get(key) :
      cursor && !renderNodeKey(cursor) && canReconcileNode(cursor, next) ? cursor : null;
    if ((!match || used.has(match)) && key)
      match = workMemberKeys(next).map(member => members.get(member))
        .find(candidate => candidate && !used.has(candidate)) || null;
    if (used.has(match)) match = null;
    if (!match || !canReconcileNode(match, next)) {
      parent.insertBefore(next, cursor);
      continue;
    }
    used.add(match);
    if (match !== cursor) parent.insertBefore(match, cursor);
    reconcileNode(match, next);
    cursor = match.nextSibling;
  }
  while (cursor) {
    const remaining = cursor.nextSibling;
    cursor.remove();
    cursor = remaining;
  }
}

function reconcileNode(current, next) {
  if (current.nodeType !== Node.ELEMENT_NODE) {
    if (current.nodeValue !== next.nodeValue) current.nodeValue = next.nodeValue;
    return;
  }
  // Compare both requested and actual card markup. Direct save/loading/media
  // updates must still take the normal path, including a failed-save rollback.
  const cardMarkup = next.matches?.('article.card[data-work-key]') ? next.outerHTML : '';
  const cards = cardMarkup && (reconcileNode.cards ||= new WeakMap());
  const previousCard = cards && cards.get(current);
  if (previousCard && previousCard.desired === cardMarkup && previousCard.actual === current.outerHTML) return;
  // The hover controller owns this overlay. Keep its decoded frame across
  // background feed updates; the normal thumbnail remains imageLoader's node.
  if (current.classList?.contains('video-preview-frame') && next.classList?.contains('video-preview-frame')) return;
  const image = current.tagName === 'IMG' && current.dataset.imageUrl;
  const keepSrc = image && current.hasAttribute('src');
  const failedImageUrl = current.classList.contains('failed') ?
    current.querySelector('img[data-image-url]')?.dataset.imageUrl : '';
  for (const attribute of [...current.attributes]) {
    if (keepSrc && attribute.name === 'src') continue;
    if (!next.hasAttribute(attribute.name)) current.removeAttribute(attribute.name);
  }
  for (const attribute of next.attributes) {
    if (keepSrc && attribute.name === 'src') continue;
    if (current.getAttribute(attribute.name) !== attribute.value)
      current.setAttribute(attribute.name, attribute.value);
  }
  if (failedImageUrl && failedImageUrl ===
      next.querySelector('img[data-image-url]')?.dataset.imageUrl)
    current.classList.add('failed');
  if (current.tagName === 'VIDEO') return;
  if (current.tagName === 'INPUT' && current !== document.activeElement) {
    if (current.type === 'checkbox' || current.type === 'radio') current.checked = next.checked;
    else if (current.value !== next.value) current.value = next.value;
  }
  reconcileChildren(current, next);
  if (cards) cards.set(current, { desired: cardMarkup, actual: current.outerHTML });
}

function renderHome(tab) {
  const grouped = filterFeedWorks(tab.items, tab);
  const first = grouped.slice(0, 7);
  const rest = grouped.slice(7);
  tab.artworkLists ||= new Map();
  tab.artworkLists.set('home', first); tab.artworkLists.set('home-rest', rest);
  const headline = tab.rating === 'explicit' ? `${tab.sort === 'popular' ? 'Популярные' : 'Новые'} NSFW иллюстрации` :
    tab.rating === 'all' ? 'Все изображения' :
    `${tab.sort === 'popular' ? 'Популярные' : 'Новые'} иллюстрации`;
  return `<div class="content">
    <div class="favorite-tags">${favoriteTags.length ? favoriteTags.map((tag, i) => `<button class="tag-chip chip-${i % 6}" data-action="query" data-query="${escapeHtml(tag)}">${escapeHtml(tag.replaceAll('_', ' '))}<small>#${escapeHtml(tag)}</small></button>`).join('') : '<span class="favorite-tags-empty">Right-click a tag and save it to Favorites.</span>'}</div>
    <div class="mode-tabs control-group">
      ${[['general', 'Обычные'], ['explicit', 'NSFW'], ['all', 'Все изображения']].map(([mode, label]) => `<button class="mode-tab ${mode === tab.rating && tab.feed === 'illustrations' || mode === tab.feed ? 'active' : ''}" data-action="mode" data-mode="${mode}">${label}</button>`).join('')}
    </div>
    <section class="section"><div class="section-head"><h2>${headline}</h2><div class="section-head-actions">${`<button class="text-button ${tab.sort === 'popular' ? 'selected' : ''}" data-action="sort" data-sort="${tab.sort === 'popular' ? 'recent' : 'popular'}">${tab.sort === 'popular' ? 'Сначала новые' : 'Популярные'}</button>`}<button class="text-button" data-action="all">Показать все</button></div></div>
      ${renderErrors(tab.errors)}${selectedRating(tab) === "none" ? emptyNsfwRatingsMessage() : tab.loading && !tab.items.length ? skeletons(7) : !first.length && hasResultError(tab.errors) ? '<div class="empty">Результаты не получены. Повторите поиск.</div>' : !first.length && tab.items.length ? emptyFeedMessage(tab) : renderGrid(first, '', new Set(), true)}
    </section>
    ${rest.length ? `<section class="section"><div class="section-head"><h2>Ещё из каталога</h2></div>${renderGrid(rest, 'home-rest', new Set(), true)}</section>` : ''}
    ${renderFeedTail(tab)}
  </div>`;
}

function renderSearch(tab) {
  const blockedQuery = queryBlockedByFilters(tab.query);
  const favoriteTag = CatalogLogic.favoriteTagFromQuery(tab.query);
  const isFavorite = favoriteTag && favoriteTags.includes(favoriteTag);
  const title = tab.rating === 'explicit' ? 'NSFW иллюстрации' :
    tab.rating === 'all' ? 'Все изображения' : 'Иллюстрации';
  return `<div class="content">
    <div class="search-heading"><h1>${title}${tab.query ? ` · <span data-no-i18n>${escapeHtml(tab.query)}</span>` : ''}</h1>${favoriteTag ? `<button class="icon-button" data-action="content-more" data-context-tag="${escapeHtml(favoriteTag)}" aria-label="Tag actions" title="Tag actions" aria-haspopup="menu">${svg('more')}</button>` : ''}</div>
    <p class="section-sub">Ищите по тегам, выбирайте источники и рейтинг.</p>
    <div class="search-tools">
      <div class="source-filters control-group">${[['general', 'Обычные'], ['explicit', 'NSFW'], ['all', 'Все изображения']].map(([rating, label]) => `<button class="filter-button ${rating === tab.rating ? 'active' : ''} ${rating === 'explicit' ? 'adult-filter' : ''}" data-action="category" data-category="${rating}">${label}</button>`).join('')}</div>
       ${`<div class="source-filters control-group">${Object.entries(names).map(([source, name]) => `<button class="filter-button ${tab.selectedSources.includes(source) ? 'active' : ''}" data-action="filter" data-source="${source}" aria-pressed="${tab.selectedSources.includes(source)}">${name}${sourceKeyHint(source)}</button>`).join('')}</div>`}
      ${`<div class="sort-row"><div class="control-group"><button class="sort-button ${tab.sort === 'recent' ? 'active' : ''}" data-action="sort" data-sort="recent">Новые</button><button class="sort-button ${tab.sort === 'popular' ? 'active' : ''}" data-action="sort" data-sort="popular">Популярные</button></div><span>${tab.sort === 'popular' ? 'Danbooru, Gelbooru и Rule34 — по оценкам за всё время. Sankaku — официальный порядок популярности сайта.' : 'Последние публикации всех выбранных источников.'}</span></div>`}
    </div>
    ${renderErrors(tab.errors)}
    ${!blockedQuery && (tab.items.length || Object.keys(tab.searchPageStats || {}).length) ? renderSearchSummary(tab) : ''}
    ${selectedRating(tab) === "none" ? emptyNsfwRatingsMessage() : blockedQuery ? '<div class="empty">Запрос содержит тег, скрытый фильтрами содержимого. <button class="inline-retry" data-action="content-settings">Изменить фильтры</button></div>' : tab.loading && !tab.items.length ? skeletons(12) : !tab.items.length && hasResultError(tab.errors) ? '<div class="empty">Результаты не получены. Повторите поиск.</div>' : renderGrid(tab.items, 'search')}
    ${renderFeedTail(tab)}
  </div>`;
}

function renderSearchSummary(tab) {
  const counts = CatalogLogic.searchResultCounts(tab.items, {});
  let supported = filterHiddenFeedWorks(CatalogLogic.filterCatalogItems(tab.items));
  if (tab.rating === 'explicit')
    supported = DartViewerPreferences.filterItems(supported, selectedRating(tab),
      CatalogLogic.matchesRating, CatalogLogic.groupingRevision(supported));
  let eligible = CatalogLogic.filterWorks(CatalogLogic.groupWorks(supported), contentPreferences);
  if (contentPreferences.hideFollowedArtists) eligible = filterFollowedFeedWorks(eligible, tab);
  // Manual hiding and the effective Q/E selection are feed filters. Count only
  // the remaining eligible works as viewed/saved exclusions, including retained
  // cards in the shown count. Counting must not rank or reposition this feed.
  counts.shown = filterFeedWorks(tab.items, tab, false, 'search', true)
    .filter(item => !isExpiredFeedWork(tab, item)).length;
  counts.hiddenContent = Math.max(0, counts.works - eligible.length);
  counts.hiddenKnown = contentPreferences.hideViewedAndSaved
    ? Math.max(0, eligible.length - counts.shown) : 0;
  const received = Math.max(counts.records, Object.values(tab.searchPageStats || {})
    .reduce((total, stats) => total + (Number(stats.received) || 0), 0));
  const parts = [`Показано работ: ${counts.shown}`, `Загружено записей: ${received}`];
  if (received !== counts.records) parts.push(`Доступно записей: ${counts.records}`);
  if (counts.grouped) parts.push(`Объединено: ${counts.grouped}`);
  if (counts.hiddenContent) parts.push(`Скрыто фильтрами: ${counts.hiddenContent}`);
  if (counts.hiddenKnown) parts.push(`Просмотренные и сохранённые: ${counts.hiddenKnown}`);
  const sourceCounts = {};
  for (const stats of Object.values(tab.searchPageStats || {})) {
    const totals = sourceCounts[stats.source] ||= { unavailable: 0, ratingFiltered: 0, tagFiltered: 0 };
    for (const key of Object.keys(totals)) totals[key] += Number(stats[key]) || 0;
  }
  const sourceNotes = Object.entries(sourceCounts).flatMap(([source, counts]) => {
    const label = names[source] || source;
    const notes = [];
    if (counts.unavailable) notes.push(`${label}: записей без доступного файла в API — ${counts.unavailable}`);
    if (counts.ratingFiltered) notes.push(`${label}: записей другого рейтинга — ${counts.ratingFiltered}`);
    if (counts.tagFiltered) notes.push(`${label}: записей без нужных тегов — ${counts.tagFiltered}`);
    return notes;
  });
  return `<div class="search-result-summary" role="status"><span>${escapeHtml(parts.join(' · '))}</span>${sourceNotes.length ? `<span class="muted">${escapeHtml(sourceNotes.join(' · '))}</span>` : ''}</div>`;
}

function renderRecommendationTagChips(tags, kind = '') {
  return tags.map(({ tag, count, query }) => {
    const mode = recommendationTagPreferences[tag] || 'normal';
    const common = mode === 'normal' && CatalogLogic.isBroadRecommendationTag(tag);
    const hint = mode === 'priority' ? 'Показывать чаще' :
      mode === 'disabled' ? 'Выключен для рекомендаций' :
        common ? 'Общий тег: включите жёлтый приоритет, чтобы он влиял на подбор' :
          'Правая кнопка — настроить рекомендации';
    const canonical = query || tag.replaceAll(' ', '_');
    return `<button class="filter-button recommendation-tag recommendation-tag-${mode}${kind ? ` recommendation-tag-${kind}` : ''}${common ? ' recommendation-tag-common' : ''}" data-action="query" data-recommendation-tag="${escapeHtml(tag)}" data-query="${escapeHtml(canonical)}" title="${hint}"><span data-no-i18n>#${escapeHtml(canonical.replaceAll('_', ' '))}</span> <small>×${count}</small></button>`;
  }).join('');
}

function closeRecommendationTagMenu(returnFocus = false) {
  if (recommendationTagMenu.hidden) return;
  recommendationTagMenu.hidden = true;
  recommendationTagMenu.trigger?.setAttribute('aria-expanded', 'false');
  if (returnFocus) {
    let trigger = recommendationTagMenu.trigger;
    const context = recommendationTagMenu.context;
    if (!trigger?.isConnected && context) {
      trigger = [...document.querySelectorAll(contentTagSelector + ', [data-context-author-id], [data-artwork-key], .card[data-work-key], ' + nsfwFilterSelector)]
        .find(element => {
          const candidate = contentContextTarget(element);
          return candidate?.kind === context.kind && (context.kind === 'artwork' ? candidate.item?.key === context.item?.key : context.kind === 'nsfw' || (context.kind === 'tag'
            ? candidate.tag === context.tag
            : CatalogLogic.hiddenAuthorKey(candidate.author) === CatalogLogic.hiddenAuthorKey(context.author)));
        });
    }
    trigger?.focus({ preventScroll: true });
  }
  recommendationTagMenu.trigger = null;
  recommendationTagMenu.context = null;
  if (recommendationTagMenu.parentElement !== document.body) document.body.append(recommendationTagMenu);
}

const contentTagSelector = '.tag-link[data-query], .tag-chip[data-query], [data-recommendation-tag], .tag-suggestion[data-tag], .favorite-tag-button[data-tag], .excluded-tag[data-tag], [data-context-tag]';
function tagPreviewScope(trigger) {
  const tab = currentTab(), actions = artworkActionsController();
  const context = contentContextTarget(trigger), tag = context?.tag;
  const opened = quickPreview.open ? quickPreviewWork : tab?.kind === 'detail' ? tab.item : null;
  const excluded = DartTagPreview.exclusionTokens(opened, CatalogLogic);
  const owner = context?.item || opened;
  const tagKind = owner && tag ? CatalogLogic.artworkTagKind(owner, tag) : '';
  const rating = selectedRating(tab);
  const sources = defaultSources.filter(source => (tab?.selectedSources || defaultSources).includes(source));
  const preferences = contentPreferences;
  const blocked = tag && CatalogLogic.isWorkHidden({ tags: [tag], allTags: [tag] }, preferences);
  return { tab, preferences, sources, tagKind, excluded: new Set(excluded), rating: blocked || !sources.length ? 'none' : rating,
    key: JSON.stringify([rating, sources.slice().sort(), preferences, actions.revision,
      preferences.hideFollowedArtists && isFollowedArtistFeed(tab), preferences.hideFollowedArtists ? follows : null,
      tagKind, excluded]) };
}

function tagPreviewAllowed(item, scope) {
  return !!item?.thumbnail && item.filteringComplete !== false &&
    !DartTagPreview.excludes(item, scope.excluded, CatalogLogic) &&
    !CatalogLogic.videoMimeType(item.thumbnail) &&
    (!CatalogLogic.signedMediaExpired(item.thumbnail) || !!imageLoader.cached(item.thumbnail)) &&
    CatalogLogic.workSources(item).some(record => scope.sources.includes(record.source)) &&
    CatalogLogic.matchesRating(item, scope.rating) && !CatalogLogic.isWorkHidden(item, scope.preferences) &&
    !artworkActionsController().isHidden(item) && !isFollowedArtistHidden(item, scope.tab);
}

async function tagPreviewHistory(signal) {
  if (signal.aborted) throw new DOMException('Preview cancelled', 'AbortError');
  if (Date.now() < (tagPreviewHistory.retryAt || 0)) return [];
  tagPreviewHistory.cache ||= DartResourceCache.create({
    load: async (_, signal) => (await request('/api/favorites?rating=all', { signal, priority: 'background' })).works || [],
    ttl: 60000, timeout: 2000, maxEntries: 1, maxBytes: 6 * 1024 * 1024,
    size: items => JSON.stringify(items).length * 2, concurrency: 1
  });
  try { return await tagPreviewHistory.cache.get('viewed', signal, { priority: 'background' }); }
  catch (error) {
    if (signal.aborted) throw error;
    tagPreviewHistory.retryAt = Date.now() + 15000;
    return [];
  }
}

async function tagPreviewViewed(tag, scope, signal) {
  const pool = DartTagPreview.createExamplePool({ tag, scope, logic: CatalogLogic, allowed: tagPreviewAllowed });
  const add = (item, needsProof) => {
    if (!DartTagPreview.matchesTag(item, tag) || !tagPreviewAllowed(item, scope) ||
        (needsProof && !tagPreviewWasViewed(item))) return false;
    return DartTagPreview.representativeCandidates(item, tag).some(example => pool.add(example));
  };
  await scanTagPreviewViews(tagPreviewCollections(), add, signal);
  if (!pool.items.length) {
    const history = await tagPreviewHistory(signal);
    await scanTagPreviewViews([[history, false]], add, signal);
  }
  return pool.items;
}

function tagPreviewCollections() {
  return [[recent, false], ...tabs.map(tab => [tab.favoriteSummary?.works || [], false]),
    [likes, true], [bookmarks, true], [itemIndex.values(), true]];
}

function tagPreviewWasViewed(item) {
  return DartTagPreview.exclusionTokens(item, CatalogLogic)
    .some(token => viewedTokens.has(token) || viewedPending.has(token));
}

async function scanTagPreviewViews(collections, visit, signal) {
  if (signal.aborted) throw new DOMException('Preview cancelled', 'AbortError');
  let deadline = performance.now() + 6;
  for (const [collection, needsProof] of collections) for (const item of collection) {
    if (visit(item, needsProof)) return;
    if (performance.now() >= deadline) {
      await new Promise(resolve => setTimeout(resolve, 0));
      if (signal.aborted) throw new DOMException('Preview cancelled', 'AbortError');
      deadline = performance.now() + 6;
    }
  }
}

async function favoriteViewedExamples(entries, tab, signal) {
  const scope = { tab, rating: 'all', preferences: contentPreferences,
    sources: defaultSources.filter(source => (tab.selectedSources || defaultSources).includes(source)) };
  const picker = DartTagPreview.createViewedExamplePicker(entries, {
    scope, allowed: tagPreviewAllowed, wasViewed: tagPreviewWasViewed
  });
  await scanTagPreviewViews(tagPreviewCollections(), picker.visit, signal);
  return picker.items;
}

async function loadTagPreviewImage(item, signal) {
  const url = item.thumbnail, release = imageLoader.pin(url);
  let cancel;
  const cancellation = new Promise((_, reject) => {
    cancel = () => { release(); reject(new DOMException('Preview cancelled', 'AbortError')); };
    signal.addEventListener('abort', cancel, { once: true });
    if (signal.aborted) cancel();
  });
  try {
    return await Promise.race([cancellation, (async () => {
      if (signal.aborted) throw new DOMException('Preview cancelled', 'AbortError');
      let entry = imageLoader.cached(url);
      if (!entry) {
        const blob = await readMediaBlob(url, signal, { priority: 'background' });
        if (signal.aborted) throw new DOMException('Preview cancelled', 'AbortError');
        entry = imageLoader.rememberBlob(url, blob);
      }
      await imageLoader.decode(entry);
      if (signal.aborted) throw new DOMException('Preview cancelled', 'AbortError');
      return { url: entry.blobUrl, release };
    })()]);
  } catch (error) { release(); throw error; }
  finally { signal.removeEventListener('abort', cancel); }
}

async function searchTagPreview(tag, scope, signal) {
  let failure;
  // Rank a bounded page of actual tag-owning thumbnails. A useful example
  // does not need to wait for all catalogs once this page has eligible choices.
  for (const source of scope.sources) {
    signal.throwIfAborted();
    const bounded = AbortSignal.any([signal, AbortSignal.timeout(scope.sources.length === 1 ? 7000 : 2000)]);
    const params = new URLSearchParams({ q: tag, page: '0', sources: source,
      rating: scope.rating, sort: 'recent', kind: 'illustrations' });
    try {
      const result = await request(`/api/search?${params}`, { signal: bounded, priority: 'background' });
      signal.throwIfAborted();
      const pool = DartTagPreview.createExamplePool({ tag, scope, logic: CatalogLogic, allowed: tagPreviewAllowed });
      for (const item of result.items || []) if (tagPreviewAllowed(item, scope)) {
        for (const example of DartTagPreview.representativeCandidates(item, tag)) if (pool.add(example)) break;
        if (pool.items.length >= 48) break;
      }
      if (pool.items.length) return pool.items;
      if (Object.keys(result.errors || {}).length) failure = new Error('Preview catalog unavailable');
    } catch (error) { signal.throwIfAborted(); failure = error; }
  }
  if (failure) throw failure;
  return [];
}

function tagPreviewController() {
  if (!globalThis.DartTagPreview) return null;
  return tagPreviewController.instance ||= DartTagPreview.create({
    document, selector: contentTagSelector,
    getTag: trigger => contentContextTarget(trigger)?.tag || '', getScope: tagPreviewScope,
    resolver: DartTagPreview.createResolver({ getViewed: tagPreviewViewed, allowed: tagPreviewAllowed,
      search: searchTagPreview, score: DartTagPreview.exampleScore }),
    loadImage: loadTagPreviewImage, translate: value => globalThis.DartI18n?.translate(value) || value
  });
}
const nsfwFilterSelector = '[data-action="category"][data-category="explicit"], [data-action="mode"][data-mode="explicit"], [data-action="recommendation-rating"][data-rating="explicit"], [data-action="follow-rating"][data-rating="explicit"], [data-action="profile-rating"][data-rating="explicit"], [data-action="favorites-rating"][data-value="explicit"]';
function contentContextTarget(target) {
  const nsfw=target.closest(nsfwFilterSelector); if(nsfw)return{trigger:nsfw,kind:'nsfw'};
  const author=target.closest('[data-context-author-id]');
  if(author){const identity={source:author.dataset.contextAuthorSource,artistId:author.dataset.contextAuthorId,name:author.dataset.contextAuthorName};
    if(CatalogLogic.hiddenAuthorKey(identity))return{trigger:author,kind:'author',author:identity};}
  const preview=target.closest('#quick-preview');
  const artwork=target.closest('[data-artwork-key], [data-artwork-tags-key], .card[data-work-key]');
  const key=artwork?.dataset.artworkKey||artwork?.dataset.artworkTagsKey||artwork?.dataset.workKey;
  const item=preview?quickPreviewWork:itemIndex.get(key)||
    (currentTab()?.kind==='detail'&&main.contains(target)?currentTab().item:null);
  const chip=target.closest(contentTagSelector);
  if(chip){const raw=chip.dataset.contextTag||chip.dataset.query||chip.dataset.tag;
    const tag=CatalogLogic.favoriteTagFromQuery(String(raw||'').trim().replace(/\s+/g,'_'));
    if(tag)return{trigger:chip,kind:'tag',tag,item,recommendationTag:chip.dataset.recommendationTag};}
  if(!item)return null;
  const detailMedia=preview?target.closest('img,video')||preview.querySelector('.quick-preview-image'):target.closest('.detail-image img, .detail-video video');
  return{trigger:target.closest('button')||artwork?.querySelector?.('[data-action="open"]')||artwork||preview||target,
    kind:'artwork',item,mediaUrl:detailMedia?.dataset.imageUrl||detailMedia?.dataset.videoUrl,mediaElement:detailMedia};
}

function openContentContextMenu(context, x, y) {
  closeRecommendationTagMenu();
  (quickPreview.open && quickPreview.contains(context.trigger) ? quickPreview : document.body).append(recommendationTagMenu);
  if (context.kind === 'artwork') {
    const item=context.item,hidden=artworkActionsController().isHidden(item);
    const upscaleUrl = context.mediaUrl || item.images?.[0] || '';
    const upscaleAllowed = globalThis.DartUpscale?.canUpscaleImage(item, upscaleUrl);
    const upscaleState = upscaleAllowed && DartUpscale.stateFor(item, upscaleUrl);
    const upscaleResult = upscaleAllowed && DartUpscale.resultFor(item, upscaleUrl);
    const upscaleBusy = ['preparing','uploading','queued','processing'].includes(upscaleState?.state);
    recommendationTagMenu.context={...context,hidden,upscaleUrl};recommendationTagMenu.trigger=context.trigger;context.trigger.setAttribute('aria-expanded','true');
    const row=(action,label,icon)=>`<button type="button" role="menuitem" data-context-action="artwork-${action}"${['group','ungroup'].includes(action)&&favoriteGroupsController().pending?' disabled':''}>${svg(icon)}<span>${label}</span></button>`;
    recommendationTagMenu.innerHTML=`<div class="recommendation-tag-menu-title" data-no-i18n>${escapeHtml(item.title)}</div>`+
      row('favorite',favoritesController().isArtworkFavorite(item)?'Remove favorite artwork':'Save favorite artwork','collection')+
      (favoritesController().isArtworkFavorite(item)?row('group','Group with another Favorite','collection'):'')+
      (favoriteGroupFor(item)?row('ungroup','Ungroup artworks','collection'):'')+
      row('hide',hidden?'Show again':'Don’t show this artwork again','hide')+'<div class="recommendation-tag-menu-separator" role="separator"></div>'+
      (upscaleAllowed ? row(upscaleBusy ? 'upscale-cancel' : 'upscale', upscaleBusy ? 'Cancel upscale' : DartUpscale.label(item,upscaleUrl) + ' · U', 'image') : '')+
      (upscaleResult ? row('upscale-restore', upscaleResult.visible ? 'Show original' : 'Show upscaled image', 'image') + row('upscale-download','Save upscaled PNG','download') : '')+
      row('download',upscaleResult?.visible?'Download original':'Download image','download')+row('copy-image',upscaleResult?.visible?'Copy original image':'Copy image','copy')+row('copy-link','Copy artwork link','external');
    positionContentContextMenu(context,x,y);return;
  }
  if (context.kind === 'nsfw') {
    recommendationTagMenu.context = context;
    recommendationTagMenu.trigger = context.trigger;
    context.trigger.setAttribute('aria-expanded', 'true');
    recommendationTagMenu.innerHTML = `<div class="recommendation-tag-menu-title">NSFW ratings</div>
      ${[['q', 'Q'], ['e', 'NSFW']].map(([code, label]) => `<button type="button" role="menuitemcheckbox" aria-checked="${viewerPreferences.nsfwRatings[code]}" data-nsfw-rating="${code}"><span class="rating-menu-check" aria-hidden="true">${viewerPreferences.nsfwRatings[code] ? '✓' : ''}</span><span data-no-i18n>${label}</span></button>`).join('')}`;
    positionContentContextMenu(context, x, y);
    return;
  }
  const tag = context.tag;
  const hidden = context.kind === 'tag'
    ? contentPreferences.excludedTags.includes(CatalogLogic.normalizeExcludedTags([tag])[0])
    : context.kind === 'author' && contentPreferences.hiddenAuthors.some(author => CatalogLogic.hiddenAuthorKey(author) === CatalogLogic.hiddenAuthorKey(context.author));
  const current = recommendationTagPreferences[context.recommendationTag] || 'normal';
  recommendationTagMenu.context = { ...context, hidden, favorite: tag && favoriteTags.includes(tag) };
  recommendationTagMenu.tag = context.recommendationTag;
  recommendationTagMenu.trigger = context.trigger;
  recommendationTagMenu.innerHTML = `<div class="recommendation-tag-menu-title"${context.kind === 'artwork-tags' ? '' : ' data-no-i18n'}>${escapeHtml(tag ? '#' + tag.replaceAll('_', ' ') : context.author?.name || 'Artwork tags')}</div>
    ${context.kind === 'tag' || context.kind === 'author' ? `<button type="button" role="menuitem" data-context-action="copy-value">${svg('copy')}<span>${context.kind === 'tag' ? 'Copy tag' : 'Copy author tag'}</span></button>` : ''}
    ${context.item ? `<button type="button" role="menuitem" data-context-action="copy" title="Copy all artwork tags">${svg('copy')}<span>Copy</span></button>` : ''}
    ${context.kind !== 'artwork-tags' ? `<button type="button" role="menuitem" data-context-action="hide"${contentPreferencesSaving ? ' disabled' : ''}>${svg('hide')}<span>${hidden ? 'Unhide' : 'Hide'}</span></button>` : ''}
    ${tag ? `<button type="button" role="menuitem" data-context-action="favorite"${favoriteTagPending.has(tag) ? ' disabled' : ''}>${svg('collection')}<span>${favoriteTags.includes(tag) ? 'Unfavorite' : 'Favorite'}</span></button>` : ''}
    ${context.recommendationTag ? `<div class="recommendation-tag-menu-separator" role="separator"></div>
    <button type="button" role="menuitemradio" aria-checked="${current === 'priority'}" data-tag-mode="priority"><span class="recommendation-menu-dot priority-dot"></span>Показывать чаще</button>
    <button type="button" role="menuitemradio" aria-checked="${current === 'disabled'}" data-tag-mode="disabled"><span class="recommendation-menu-dot disabled-dot"></span>Выключить тег</button>
    <button type="button" role="menuitemradio" aria-checked="${current === 'normal'}" data-tag-mode="normal">Обычный режим</button>` : ''}`;
  positionContentContextMenu(context, x, y);
}

function positionContentContextMenu(context, x, y) {
  recommendationTagMenu.sourceScrollTop=main.scrollTop;recommendationTagMenu.sourceScrollLeft=main.scrollLeft;
  globalThis.DartI18n?.translateTree(recommendationTagMenu);
  recommendationTagMenu.hidden = false;
  if (!x && !y) { const rect = context.trigger.getBoundingClientRect(); x = rect.left; y = rect.bottom; }
  const bounds = quickPreview.open && quickPreview.contains(recommendationTagMenu) ? quickPreview.getBoundingClientRect() : {left:0,top:0,right:window.innerWidth,bottom:window.innerHeight};
  const width = recommendationTagMenu.offsetWidth;
  const height = recommendationTagMenu.offsetHeight;
  recommendationTagMenu.style.left = `${Math.max(bounds.left+8, Math.min(x, bounds.right - width - 8))}px`;
  recommendationTagMenu.style.top = `${Math.max(bounds.top+8, Math.min(y, bounds.bottom - height - 8))}px`;
  recommendationTagMenu.querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
}

async function copyArtworkTags(item) {
  const text = CatalogLogic.artworkTagText(itemIndex.get(item?.key) || item);
  if (!text) { toast('No tags to copy.'); return; }
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Older/permission-restricted WebViews can still copy during this user action.
    const focused = document.activeElement;
    const input = document.createElement('textarea');
    input.value = text;
    input.readOnly = true;
    input.style.cssText = 'position:fixed;left:-10000px;top:0';
    document.body.append(input);
    try {
      input.focus({ preventScroll: true });
      input.select();
      if (!document.execCommand('copy')) throw new Error('Clipboard unavailable');
    } catch {
      toast('Could not copy tags. Please try again.');
      return;
    } finally {
      input.remove();
      focused?.focus({ preventScroll: true });
    }
  }
  toast('All artwork tags copied.');
}

function filteredRecommendationOtherTags(tab) {
  const term = String(tab.otherTagFilter || '').normalize('NFKC').toLowerCase()
    .replaceAll('_', ' ').replace(/\s+/g, ' ').trim();
  const tags = tab.recommendationTagGroups?.other || [];
  const ordered = CatalogLogic.orderRecommendationOtherTags(tags,
    recommendationTagPreferences);
  return term ? ordered.filter(({ tag }) => tag.includes(term)) : ordered;
}

function renderRecommendationOtherList(tab) {
  const tags = filteredRecommendationOtherTags(tab);
  return tags.length ? renderRecommendationTagChips(tags)
    : '<span class="recommendation-other-empty">Таких тегов нет</span>';
}

function renderRecommendationTail(tab) {
  const recovery = Object.values(tab.recommendationPools || {}).flat().flatMap(group => group.streams)
    .filter(stream => stream.sources.length && stream.error);
  const waitingForRetry = recovery.some(stream => Number.isFinite(stream.retryAt));
  const waitingForSettings = recovery.length && recovery.every(stream => stream.needsSettings);
  return tab.loading ? tab.items.length ? '<div class="feed-status">Подбираем ещё…</div>' : '' : tab.loadError ? '<div class="feed-status">Не удалось продолжить подбор. <button data-action="recommendation-more-retry">Повторить</button></div>' : tab.hasMore && tab.recommendationPaused && recovery.length ? `<div class="feed-status" role="status">${waitingForSettings ? 'Проверьте подключение источников в настройках.' : waitingForRetry ? 'Источники временно недоступны. Повторим автоматически.' : 'Автоматические повторы приостановлены.'} <button data-action="${waitingForSettings ? 'settings' : 'recommendation-more-retry'}">${waitingForSettings ? 'Настроить' : 'Повторить'}</button></div>` : tab.hasMore && tab.recommendationPaused ? '<div class="feed-status">Новых совпадений пока нет. <button data-action="recommendation-continue">Искать дальше</button></div>' : tab.hasMore ? `<div class="feed-sentinel" data-auto-load="recommendations" data-tab-id="${tab.id}" aria-hidden="true"></div>` : tab.items.length ? '<div class="feed-status">Все доступные рекомендации загружены</div>' : '';
}

function renderRecommendations(tab) {
  const tags = tab.recommendationTags || [];
  const visibleLikes = recommendationLikedWorks();
  const hasChoices = Object.keys(recommendationTagPreferences).length > 0;
  const groups = tab.recommendationTagGroups || { names: [], copyright: [], other: [] };
  const visibleNames = tab.showMoreRecommendationNames
    ? groups.names : groups.names.slice(0, 6);
  const hiddenNameCount = Math.max(0, groups.names.length - 6);
  const copyrights = groups.copyright || [];
  const visibleCopyrights = tab.showMoreRecommendationCopyright ? copyrights : copyrights.slice(0, 3);
  const hiddenCopyrightCount = Math.max(0, copyrights.length - 3);
  return `<div class="content"><h1>Рекомендации</h1>
    <p class="section-sub">Подборка по тегам изображений, которые вы отметили сердечком. Понравившиеся работы не повторяются.</p>
    ${!likes.length && !hasChoices ? '<div class="empty feature-empty">Поставьте лайк сердечком, и здесь появятся рекомендации.</div>' : !visibleLikes.length && !hasChoices ? '<div class="empty feature-empty">Все понравившиеся работы скрыты фильтрами. Измените настройки содержимого, чтобы получить рекомендации.</div>' : !tags.length && !hasChoices ? '<div class="empty feature-empty">У понравившихся работ пока нет подходящих тегов для подбора.</div>' : `
      <div class="recommendation-tags"><span>Ваши частые теги</span>${renderRecommendationTagChips(visibleNames, 'character')}${hiddenNameCount ? `<button class="filter-button" data-action="recommendation-tags-more" aria-expanded="${!!tab.showMoreRecommendationNames}">${tab.showMoreRecommendationNames ? 'Свернуть' : `Ещё +${hiddenNameCount}`}</button>` : ''}<button class="filter-button recommendation-other-toggle" data-action="recommendation-other" aria-expanded="${!!tab.otherTagsOpen}" aria-controls="recommendation-other-panel">Other</button></div>
      ${copyrights.length ? `<div class="recommendation-tags recommendation-copyright-tags"><span>Copyright</span>${renderRecommendationTagChips(visibleCopyrights, 'copyright')}${hiddenCopyrightCount ? `<button class="filter-button" data-action="recommendation-copyright-more" aria-expanded="${!!tab.showMoreRecommendationCopyright}">${tab.showMoreRecommendationCopyright ? 'Свернуть' : `Ещё +${hiddenCopyrightCount}`}</button>` : ''}</div>` : ''}
      ${tab.otherTagsOpen ? `<div class="recommendation-other-panel" id="recommendation-other-panel"><div class="recommendation-other-heading"><strong>Теги содержания</strong><span class="recommendation-other-count">${filteredRecommendationOtherTags(tab).length} из ${groups.other.length}</span></div><p class="recommendation-other-note">Частые необычные теги влияют на подбор. Приглушённые общие теги учитываются только с жёлтым приоритетом. Настройка — правой кнопкой мыши.</p><input class="recommendation-other-filter" type="search" data-recommendation-other-filter value="${escapeHtml(tab.otherTagFilter || '')}" placeholder="Найти тег, например group_sex" aria-label="Найти тег содержания"><div class="recommendation-other-list">${renderRecommendationOtherList(tab)}</div></div>` : ''}
      <div class="search-tools">
        <div class="source-filters control-group">${[['general', 'Обычные'], ['explicit', 'NSFW'], ['all', 'Все изображения']].map(([rating, label]) => `<button class="filter-button ${rating === tab.rating ? 'active' : ''} ${rating === 'explicit' ? 'adult-filter' : ''}" data-action="recommendation-rating" data-rating="${rating}">${label}</button>`).join('')}</div>
        <div class="source-filters control-group">${Object.entries(names).map(([source, name]) => `<button class="filter-button ${tab.selectedSources.includes(source) ? 'active' : ''}" data-action="recommendation-source" data-source="${source}" aria-pressed="${tab.selectedSources.includes(source)}">${name}${sourceKeyHint(source)}</button>`).join('')}</div>
      </div>
      <section class="section"><div class="section-head"><h2>Для вас</h2><button class="text-button" data-action="recommendation-refresh">Обновить</button></div>
        ${renderErrors(tab.errors, 'recommendation-more-retry')}
         ${selectedRating(tab) === "none" ? emptyNsfwRatingsMessage() : tab.loading && !tab.items.length ? skeletons(10) : tab.items.length ? renderGrid(tab.items, 'recommendations') : contentPreferences.hideViewedAndSaved ? '<div class="empty">Непросмотренных работ по этим тегам пока нет. Попробуйте другой тег или источник.</div>' : '<div class="empty">По выбранным тегам пока нет подходящих работ. Попробуйте другой рейтинг или источник.</div>'}
        <div data-recommendation-tail>${renderRecommendationTail(tab)}</div>
      </section>`}
  </div>`;
}

function followButton(ref, className = 'secondary-button') {
  if (!ref?.artistId) return '';
  const following = followedKeys.has(CatalogLogic.followKey(ref));
  const label = following ? 'Вы подписаны · Отписаться' :
    ['gelbooru', 'rule34', 'sankaku'].includes(ref.source) ? 'Подписаться на загрузчика' :
      ref.source === 'danbooru' ? 'Подписаться на художника' : 'Подписаться на автора';
  const role = ref.participantRole || CatalogLogic.participantRole(ref.artistId);
  const roleLabel = { voice_actor: 'Подписаться на актёра озвучки', sound: 'Подписаться на звукорежиссёра',
    music: 'Подписаться на музыканта', writer: 'Подписаться на сценариста',
    colorist: 'Подписаться на колориста', editor: 'Подписаться на монтажёра',
    translator: 'Подписаться на переводчика', animator: 'Подписаться на аниматора' }[role];
  const displayLabel = !following && ref.source === 'danbooru' && roleLabel ? roleLabel : label;
  const pending = typeof toggleFollow === 'function' && toggleFollow.pending?.has(CatalogLogic.followKey(ref));
  return `<button class="${className}" ${authorContextData({ ...ref, source: ref.source === 'danbooru' ? 'artist' : ref.source })} data-action="follow" data-follow-source="${escapeHtml(ref.source)}" data-follow-artist="${escapeHtml(ref.artistId)}" data-follow-service="${escapeHtml(ref.service || '')}" data-follow-name="${escapeHtml(ref.name || ref.artistId)}" aria-pressed="${following}"${pending ? ' disabled' : ''}>${displayLabel}</button>`;
}

function renderFollowArtist(follow, tab) {
  const gelbooruTag = follow.gelbooruTag || follow.artistId;
  const sourceLabel = follow.source === 'danbooru'
    ? `${CatalogLogic.participantRoleLabel(CatalogLogic.participantRole(follow.artistId))} · Danbooru · Gelbooru ${settings.hasApiKey ? `#${gelbooruTag}` : 'требует ключ'} · Rule34 ${settings.hasRule34ApiKey ? `#${follow.artistId}` : 'требует ключ'}`
    : `${names[follow.source] || follow.source}${['gelbooru', 'rule34', 'sankaku'].includes(follow.source) ? ' · загрузчик' : ''}`;
  const editing = tab.editingFollowKey === follow.key;
  return `<div class="followed-artist" ${authorContextData({ ...follow, source: follow.source === 'danbooru' ? 'artist' : follow.source })}><div><strong data-no-i18n>${escapeHtml(follow.name)}</strong><span>${escapeHtml(sourceLabel)}</span></div>
    ${editing ? `<form class="follow-tag-form" data-follow-key="${escapeHtml(follow.key)}">
      <label>Тег художника на Gelbooru<input name="gelbooruTag" maxlength="100" value="${escapeHtml(tab.editingFollowTag ?? gelbooruTag)}" placeholder="${escapeHtml(follow.artistId)}"></label>
      <small>Если имя тега отличается, укажите его здесь. Пустое поле вернёт тег Danbooru.</small>
      <div><button class="secondary-button" type="submit">Сохранить</button><button class="text-button" type="button" data-action="cancel-follow-tag">Отмена</button></div>
    </form>` : ''}
    <div class="followed-actions"><button class="text-button" data-action="follow-profile" data-follow-key="${escapeHtml(follow.key)}">${follow.source === 'danbooru' ? 'Работы художника' : 'Профиль'}</button>
      ${follow.source === 'danbooru' ? `<button class="text-button" data-action="edit-follow-tag" data-follow-key="${escapeHtml(follow.key)}">Тег Gelbooru</button>` : ''}
      <button class="text-button" data-action="unfollow" data-follow-key="${escapeHtml(follow.key)}"${typeof toggleFollow === 'function' && toggleFollow.pending?.has(CatalogLogic.followKey(follow)) ? ' disabled' : ''}>Отписаться</button></div></div>`;
}

function renderFollows(tab) {
  const manageOpen = !!tab.followManageOpen || !follows.length;
  const sourceStatus = Object.entries(tab.followSourceErrors || {}).map(([source, message]) =>
    `${names[source] || source}: ${message}${followSourceNeedsSettings(message) ? '' : ' Повторяем автоматически.'}`)
    .join('\n') || tab.followErrors?.[0] || '';
  const sourceIcon = sourceStatus ? `<span class="follow-source-status" tabindex="0" role="img" title="${escapeHtml(sourceStatus)}" aria-label="${escapeHtml(sourceStatus)}">ⓘ</span>` : '';
  return `<div class="content"><h1>Подписки</h1>
    <p class="section-sub">One artist-tag subscription shows works from connected catalogs. Restricted Sankaku works require sign-in. The feed refreshes on first opening or with Refresh; returning keeps your place. New works are marked.</p>
    ${follows.length ? `<button class="follow-manage-toggle" type="button" data-action="follow-manage-toggle" aria-expanded="${manageOpen}" aria-controls="follow-management">${manageOpen ? 'Скрыть список подписок' : `Управление подписками · ${follows.length}`}</button>` : ''}
    ${manageOpen ? `<div id="follow-management" class="follow-management"><form id="artist-follow-form" class="search-tools follow-add-form"><label>Добавить художника по тегу
      <input name="artistTag" maxlength="100" value="${escapeHtml(tab.artistTagDraft || '')}" placeholder="например, sample_artist" required></label>
      <button class="secondary-button" type="submit">Подписаться</button>
      <small>На Gelbooru и Rule34 поиск идёт по тегу художника. Подписка на загрузчика остаётся отдельной.</small></form>
      ${follows.length ? `<div class="followed-artists">${follows.map(follow => renderFollowArtist(follow, tab)).join('')}</div>` : ''}</div>` : ''}
    ${!settings.hasApiKey ? '<div class="source-notice">Для работ Gelbooru укажите API key в настройках.</div>' : ''}
    ${!follows.length ? '<div class="empty feature-empty">Добавьте тег художника или нажмите «Подписаться» на его работе.</div>' : `
      <div class="search-tools follow-filters"><div class="source-filters control-group">${[['general', 'Обычные'], ['explicit', 'NSFW'], ['all', 'Все изображения']].map(([rating, label]) => `<button class="filter-button ${rating === tab.rating ? 'active' : ''} ${rating === 'explicit' ? 'adult-filter' : ''}" data-action="follow-rating" data-rating="${rating}">${label}</button>`).join('')}</div>
        <div class="source-filters control-group follow-order" role="group" aria-label="Following order">${[['date', 'Date'], ['random', 'Random']].map(([order, label]) => `<button type="button" class="filter-button ${(tab.followOrder || 'date') === order ? 'active' : ''}" data-action="follow-order" data-order="${order}" aria-pressed="${(tab.followOrder || 'date') === order}">${label}</button>`).join('')}</div></div>
      <section class="section"><div class="section-head"><h2>Последние работы${tab.newKeys?.size ? ` · ${tab.newKeys.size} новых` : ''}</h2><div class="follow-feed-actions">${sourceIcon}<button class="text-button" data-action="follow-refresh">Обновить</button></div></div>
        ${tab.followSourceNotices?.sankaku || tab.followSourceErrors?.sankaku ? renderErrors({ sankaku: tab.followSourceErrors?.sankaku || tab.followSourceNotices.sankaku }, 'follow-refresh') : ''}
        ${tab.seenError ? '<div class="source-notice">Не удалось сохранить отметку просмотра. При следующем открытии метка «Новое» может повториться.</div>' : ''}
         ${selectedRating(tab) === "none" ? emptyNsfwRatingsMessage() : tab.loading && !tab.items.length ? skeletons(10) : tab.items.length ? renderGrid(tab.items, 'follows', tab.newKeys, true) : tab.followComputed?.feed.items.length ? emptyFeedMessage(tab, 'follows') : '<div class="empty">В этом рейтинге пока нет изображений от авторов, на которых вы подписаны.</div>'}
         ${tab.loading ? tab.items.length ? '<div class="feed-status">Обновляем остальных авторов…</div>' : '' :
           tab.followLoadingMore ? '<div class="feed-status">Загружаем ещё…</div>' :
             tab.hasMore ? `<div class="feed-sentinel" data-auto-load="follows" data-tab-id="${tab.id}" aria-hidden="true"></div>` :
               tab.items.length && !tab.followStreams?.length ? '<div class="feed-status">Все доступные работы загружены</div>' : ''}
      </section>`}
  </div>`;
}

function selectLoadedProfileImage(root, viewport, random = Math.random) {
  const bounds = viewport.getBoundingClientRect();
  const images = [...root.querySelectorAll('.grid .card img[data-image-url]')].filter(img => {
    if (!img.complete || !img.naturalWidth || !img.naturalHeight || !img.currentSrc ||
        img.closest('.card-art')?.classList.contains('failed')) return false;
    const rect = img.getBoundingClientRect();
    return rect.bottom > bounds.top && rect.top < bounds.bottom &&
      rect.right > bounds.left && rect.left < bounds.right;
  });
  return images.length ? images[Math.min(images.length - 1,
    Math.floor(random() * images.length))] : null;
}

function createProfileBannerThumbnail(image, banner) {
  const canvas = document.createElement('canvas');
  const bounds = banner.getBoundingClientRect();
  canvas.width = 320;
  canvas.height = Math.max(40, Math.min(120,
    Math.round(canvas.width * bounds.height / Math.max(1, bounds.width))));
  const context = canvas.getContext('2d');
  if (!context) return '';
  const scale = Math.max(canvas.width / image.naturalWidth,
    canvas.height / image.naturalHeight);
  const width = canvas.width / scale;
  const height = canvas.height / scale;
  context.drawImage(image, (image.naturalWidth - width) / 2,
    (image.naturalHeight - height) / 2, width, height,
    0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/webp', 0.42);
}

function scheduleProfileBanner(tab) {
  if (tab.profileBanner || tab.profileBannerPending || currentTab() !== tab ||
      !tab.items?.length) return;
  tab.profileBannerPending = true;
  setTimeout(() => {
    tab.profileBannerPending = false;
    if (currentTab() !== tab || tab.profileBanner) return;
    const page = main.querySelector('.profile-page');
    const banner = page?.querySelector('.profile-banner');
    if (!banner) return;
    const image = selectLoadedProfileImage(page, main);
    if (!image) return;
    try {
      tab.profileBanner = createProfileBannerThumbnail(image, banner);
      if (tab.profileBanner) render();
    } catch { /* A damaged preview keeps the original gradient. */ }
  }, 140);
}

function renderProfile(tab) {
  const profile = tab.profile;
  const ref = tab.profileRef;
  const name = profile?.name || tab.title;
  const artistProfile = ref.source === 'artist';
  const sourceLabel = artistProfile ? [...new Set((tab.items || [])
    .flatMap(CatalogLogic.workSources).map(record => names[record.source]))].join(' · ') :
    names[ref.source] || ref.source;
  return `<div class="content profile-page">
    <div class="profile-banner" ${authorContextData({ source: ['artist', 'danbooru'].includes(ref.source) ? 'artist' : ref.source, artistId: ref.artist, name })}>${tab.profileBanner ? `<img class="profile-banner-art" src="${escapeHtml(tab.profileBanner)}" alt="" aria-hidden="true">` : ''}<span class="profile-avatar">${escapeHtml((name || '?')[0].toUpperCase())}</span>
      <div><h1 data-no-i18n>${escapeHtml(name)}</h1><p class="section-sub">${escapeHtml(profile?.role || (['gelbooru', 'rule34', 'sankaku'].includes(ref.source) ? 'Загрузчик' : 'Художник'))}${sourceLabel ? ` · ${escapeHtml(sourceLabel)}` : ''}</p></div>
      <div class="profile-actions">${followButton({ source: artistProfile ? 'danbooru' : ref.source, artistId: ref.artist,
        service: ref.service, name })}${profile?.url ? `<button class="secondary-button" data-action="profile-external">Открыть на сайте ↗</button>` : ''}</div></div>
    <div class="source-filters control-group">${[['general', 'Обычные'], ['explicit', 'NSFW'], ['all', 'Все']].map(([rating, label]) => `<button class="filter-button ${tab.rating === rating ? 'active' : ''}" data-action="profile-rating" data-rating="${rating}">${label}</button>`).join('')}</div>
    <section class="section"><div class="section-head"><h2>Работы</h2></div>
      ${renderErrors(tab.errors)}
      ${tab.profileError ? '<div class="error-box">Не удалось загрузить профиль. <button class="inline-retry" data-action="profile-retry">Повторить</button></div>' : ''}
      ${tab.loading && !tab.items.length ? skeletons(8) : renderGrid(tab.items, 'profile')}
      ${renderFeedTail(tab, true)}
    </section></div>`;
}

function renderList(title, subtitle, tab) {
  const empty = tab.kind === 'likes' ? 'Поставьте лайк сердечком, чтобы сохранить работу здесь.'
    : tab.kind === 'bookmarks' ? 'Нажмите значок закладки на работе, чтобы вернуться к ней позже.' : 'Здесь пока нет работ.';
  return `<div class="content"><h1>${title}</h1><p class="section-sub">${subtitle}</p>
    <section class="section" style="margin-top:32px">${tab.loading ? skeletons(10) : tab.items?.length ? renderGrid(tab.items, tab.kind) : `<div class="empty">${empty}</div>`}</section></div>`;
}

function hasResultError(errors) {
  return Object.entries(errors || {}).some(([source, message]) =>
    !['gelbooru', 'rule34'].includes(source) || !/user id|api key/i.test(message));
}

function renderErrors(errors, retryAction = 'retry-search') {
  const entries = Object.entries(errors || {});
  if (!entries.length) return '';
  const sourceErrors = entries.filter(([source]) =>
    ['danbooru', 'gelbooru', 'rule34', 'sankaku'].includes(source));
  const otherErrors = entries.filter(entry => !sourceErrors.includes(entry));
  const notices = sourceErrors.map(([source, message]) => {
    const needsKey = ['gelbooru', 'rule34'].includes(source) && /user id|api key|ключ API/i.test(message);
    const needsLogin = source === 'sankaku' && /авторизуйтесь/i.test(message);
    const label = `${names[source] || source}${needsLogin ? ' · требуется вход' : needsKey ? ' · проверьте API' :
      /HTTP 429/i.test(message) ? ' · пауза' : ' недоступен'}`;
    return `<div class="source-notice source-warning"><span title="${escapeHtml(message)}">${escapeHtml(label)}</span><button data-action="${needsLogin ? 'sankaku-auth' : needsKey ? 'settings' : retryAction}">${needsLogin ? 'Авторизуйтесь' : needsKey ? 'Настроить' : 'Повторить'}</button></div>`;
  }).join('');
  return `${notices ? `<div class="source-notices" role="status">${notices}</div>` : ''}
    ${otherErrors.length ? `<div class="error-box">${otherErrors.map(([source, message]) => `<p><strong>${escapeHtml(names[source] || source)}:</strong> ${escapeHtml(message)}</p>`).join('')}<button class="inline-retry" data-action="${retryAction}">Повторить ${retryAction === 'creator-retry' ? 'загрузку' : 'поиск'}</button></div>` : ''}`;
}

function renderFeedTail(tab, profile = false) {
  if (tab.kind === 'search' && queryBlockedByFilters(tab.query)) return '';
  if (tab.loading) return tab.items.length ? '<div class="feed-status">Загружаем ещё…</div>' : '';
  if (tab.loadError) return `<div class="feed-status">Не удалось продолжить загрузку. <button data-action="${profile ? 'profile-more-retry' : 'more-retry'}">Повторить</button></div>`;
  const retry = !profile && Object.keys(tab.pausedSources || {}).length
    ? '<div class="feed-status">Часть источников временно недоступна. <button data-action="retry-search">Повторить источники</button></div>' : '';
  if (tab.hasMore) return retry + `<div class="feed-sentinel" data-auto-load="${profile ? 'profile' : 'search'}" data-tab-id="${tab.id}" aria-hidden="true"></div>`;
  return retry || (tab.items.length ? '<div class="feed-status">Все доступные результаты загружены</div>' : '');
}

function queryBlockedByFilters(query) {
  return !!query && CatalogLogic.isWorkHidden(
    { tags: CatalogLogic.normalizeSearch(query).split(/\s+/).filter(tag => !tag.startsWith('-')) },
    contentPreferences);
}

function renderRelatedTail(tab) {
  if (!tab.relatedStarted || !tab.relatedQuery) return '';
  const notices = Object.keys(tab.relatedErrors || {}).length
    ? renderErrors(tab.relatedErrors, 'related-retry') : '';
  if (tab.relatedLoading) return notices + (tab.related?.length ? '<div class="feed-status">Загружаем ещё похожие работы…</div>' : '');
  if (tab.relatedError) return notices + '<div class="feed-status">Не удалось продолжить подбор. <button data-action="related-retry">Повторить</button></div>';
  if (tab.relatedHasMore) return notices + `<div class="feed-sentinel" data-auto-load="related" data-tab-id="${tab.id}" aria-hidden="true"></div>`;
  if (notices) return notices + '<div class="feed-status">Подбор в доступных источниках завершён. Приостановленные источники можно повторить.</div>';
  return tab.related?.length ? '<div class="feed-status">Новые совпадения по тегам этой работы пока закончились.</div>' : '';
}

function knownWorkTokens() {
  // Viewed identities remain live: pending writes and same-size replacements
  // change independently of the saved-library metadata.
  const sources = [viewedTokens, viewedPending, knownLibraryWorkTokens()];
  if (knownWorkTokens.aliases?.library !== sources[2]) delete knownWorkTokens.aliases;
  function* values() {
    const yielded = new Set();
    for (const source of sources) for (const token of source) if (!yielded.has(token)) {
      yielded.add(token); yield token;
    }
    for (const token of knownWorkTokens.aliases?.tokens.keys() || [])
      if (!yielded.has(token) && knownAliasToken(token, sources)) { yielded.add(token); yield token; }
  }
  // Feed filters only need membership. Do not copy the entire history on
  // every render; materialize its union only for an explicit iteration/count.
  return { has: token => sources.some(source => source.has(token)) ||
      !!(knownWorkTokens.aliases?.tokens.size && knownAliasToken(token, sources)),
    get size() { let count = 0; for (const token of values()) count++; return count; },
    values, keys: values, [Symbol.iterator]: values };
}

function knownLibraryWorkTokens() {
  const collections = [recent, likes, bookmarks];
  const signature = collections.flatMap(items => [items, items.length, CatalogLogic.groupingRevision?.(items) || 0]);
  const previous = knownLibraryWorkTokens.snapshot;
  if (previous && signature.every((value, index) => value === previous.signature[index])) return previous.tokens;
  const libraries = knownLibraryWorkTokens.libraries ||= new WeakMap();
  const libraryTokens = items => {
    const revision = CatalogLogic.groupingRevision?.(items) || 0;
    let cached = libraries.get(items);
    if (!cached || cached.length !== items.length || cached.revision !== revision) {
      cached = { length: items.length, revision, tokens: new Set(items.flatMap(CatalogLogic.workHistoryTokens)) };
      libraries.set(items, cached);
    }
    return cached.tokens;
  };
  const sources = collections.map(libraryTokens);
  function* values() {
    const yielded = new Set();
    for (const source of sources) for (const token of source) if (!yielded.has(token)) {
      yielded.add(token); yield token;
    }
  }
  // Recent changes on every artwork visit. Keep the unchanged saved indexes
  // separate: a membership check must not copy the entire library again.
  const tokens = { has: token => sources.some(source => source.has(token)),
    get size() { let count = 0; for (const token of values()) count++; return count; },
    values, keys: values, [Symbol.iterator]: values };
  knownLibraryWorkTokens.snapshot = { signature, tokens };
  return tokens;
}

function removeKnownAlias(state, id) {
  const entry = state.records.get(id);
  if (!entry) return;
  state.records.delete(id);
  state.count -= entry.tokens.length + entry.anchors.length;
  for (const token of entry.tokens) {
    const entries = state.tokens.get(token);
    entries?.delete(id);
    if (!entries?.size) state.tokens.delete(token);
  }
}

function knownAliasToken(token, sources) {
  const state = knownWorkTokens.aliases;
  if (!state || state.library !== sources[2]) return false;
  for (const id of state.tokens.get(token) || []) {
    const entry = state.records.get(id), item = entry?.work.deref();
    if (!item || CatalogLogic.groupingEvidenceVersion?.(item) !== entry.version) {
      removeKnownAlias(state, id); continue;
    }
    // Every alias still needs a live, exact anchor. Clearing history, replacing
    // a same-size Set, or removing saved works must never leave sticky knowledge.
    if (entry.anchors.some(anchor => sources.some(source => source.has(anchor)))) return true;
  }
  return false;
}

function learnKnownWorkAliases(items) {
  if (typeof CatalogLogic.groupingEvidenceVersion !== 'function') return;
  const sources = [viewedTokens, viewedPending, knownLibraryWorkTokens()];
  let state = knownWorkTokens.aliases;
  if (!state || state.library !== sources[2]) knownWorkTokens.aliases = state = {
    library: sources[2], records: new Map(), tokens: new Map(), observed: new WeakMap(), count: 0
  };
  const exact = token => sources.some(source => source.has(token));
  for (const item of items || []) {
    const version = CatalogLogic.groupingEvidenceVersion(item);
    if (!version || item.groupingVersion !== 2 || !(item.memberKeys?.length > 1) ||
        item.memberKeys.length > 100) continue;
    let proof = state.observed.get(item);
    if (!proof || proof.version !== version) {
      const keys = new Set([item.key, ...item.memberKeys]);
      const members = item.groupMembers || [];
      const complete = members.length === keys.size && members.every(member =>
        keys.has(member.key) && !(member.groupMembers?.length) &&
        new Set([member.key, ...(member.memberKeys || [])]).size === 1) &&
        new Set(members.map(member => member.key)).size === keys.size;
      proof = { version, tokens: complete ? CatalogLogic.workHistoryTokens(item)
        .filter(token => !/^group:(danbooru|gelbooru|rule34|sankaku):parent:/.test(token)) : [],
        id: [...keys].sort().join('|') };
      state.observed.set(item, proof);
    }
    if (!proof.tokens.length || proof.tokens.length > 1024) continue;
    const old = state.records.get(proof.id);
    if (old?.version === version && old.work.deref() === item) continue;
    const anchors = proof.tokens.filter(exact), tokens = proof.tokens.filter(token => !exact(token));
    if (!anchors.length || !tokens.length) continue;
    removeKnownAlias(state, proof.id);
    const entry = { version, anchors, tokens,
      work: typeof WeakRef === 'function' ? new WeakRef(item) : { deref: () => item } };
    state.records.set(proof.id, entry);
    state.count += anchors.length + tokens.length;
    for (const token of tokens) {
      if (!state.tokens.has(token)) state.tokens.set(token, new Set());
      state.tokens.get(token).add(proof.id);
    }
    // Knowledge is bounded and comes only from the shared grouping owner's
    // confirmed component. Approximate hashes never become history tokens.
    while (state.records.size > 128 || state.count > 4096)
      removeKnownAlias(state, state.records.keys().next().value);
  }
}

function scheduleRelatedKnownRefresh() {
  const tab = currentTab();
  if (!contentPreferences.hideViewedAndSaved || tab?.kind !== 'detail' ||
      !tab.related?.length || main.dataset?.tabId !== String(tab.id)) return;
  if (scheduleRelatedKnownRefresh.pending === tab) return;
  scheduleRelatedKnownRefresh.pending = tab;
  requestAnimationFrame(() => {
    if (scheduleRelatedKnownRefresh.pending !== tab) return;
    delete scheduleRelatedKnownRefresh.pending;
    if (currentTab() === tab && contentPreferences.hideViewedAndSaved) render();
  });
}

function isHideableFeed(tab, gridKey = '') {
  return tab?.kind === 'home' || tab?.kind === 'recommendations' ||
    tab?.kind === 'search' || tab?.kind === 'follows' || tab?.kind === 'detail' && gridKey === 'related';
}

function isFollowedArtistFeed(tab, gridKey = '') {
  return tab?.kind === 'home' || tab?.kind === 'search' || tab?.kind === 'recommendations' ||
    tab?.kind === 'detail' && gridKey === 'related';
}

function followedArtistWork(item) {
  const list = typeof follows === 'undefined' ? [] : follows;
  let cached = followedArtistWork.cached;
  if (!cached || cached.list !== list)
    followedArtistWork.cached = cached = { list, matches: CatalogLogic.followedWorkMatcher(list) };
  return cached.matches(item);
}

function isFollowedArtistHidden(item, tab, gridKey = '') {
  return contentPreferences.hideFollowedArtists === true && isFollowedArtistFeed(tab, gridKey) &&
    followedArtistWork(item);
}

function filterFollowedFeedWorks(works, tab, gridKey = '') {
  if (!contentPreferences.hideFollowedArtists || !isFollowedArtistFeed(tab, gridKey)) return works;
  return works.filter(item => isRetainedFeedWork(tab, item) || !followedArtistWork(item));
}

function visibleFeedCard(tab, item) {
  if (!contentPreferences.hideViewedAndSaved || !tab ||
      main.dataset?.tabId !== String(tab.id)) return null;
  const card = [...main.querySelectorAll('.card[data-work-key]')]
    .find(node => node.dataset.workKey === item.key ||
      (item.memberKeys || []).includes(node.dataset.workKey));
  if (!card || card.classList.contains('feed-placeholder') || !isHideableFeed(tab,
      tab.kind === 'detail' && card.closest?.('[data-grid-key="related"]') ? 'related' : ''))
    return null;
  const bounds = main.getBoundingClientRect();
  const rect = card.getBoundingClientRect();
  return rect.bottom > bounds.top && rect.top < bounds.bottom ? card : null;
}

function retainFeedWork(tab, item, visibleHeight = 0) {
  if (!tab) return;
  const card = visibleFeedCard(tab, item);
  if (!visibleHeight && !card) return;
  rememberRenderedFeedWork(tab, item, tab.kind === 'detail' ? 'related' : '');
}

function rememberRenderedFeedWork(tab, item, gridKey = '') {
  if (!isHideableFeed(tab, gridKey)) return;
  tab.retainedFeedWorks ||= new Map();
  // Retain only keys that occupied a rendered slot in this result generation.
  // The result reset clears these small records; scrolling and navigation do not.
  for (const key of [item.key, ...(item.memberKeys || [])])
    if (key) tab.retainedFeedWorks.set(key, true);
}

function isRetainedFeedWork(tab, item) {
  if (!tab?.retainedFeedWorks?.size) return false;
  // Shared hashes hide incoming mirrors without granting them a second slot.
  return [item.key, ...(item.memberKeys || [])].some(key => tab.retainedFeedWorks.has(key));
}

function expiredFeedSlot(tab, item) {
  if (!tab?.expiredFeedWorks?.size) return null;
  const key = item.key;
  const direct = tab.expiredFeedWorks.get(key);
  if (direct) return direct;
  for (const token of [item.key, ...(item.memberKeys || [])].map(key => `key:${key}`)) {
    const owner = tab.expiredFeedTokens?.get(token);
    if (owner) return tab.expiredFeedWorks.get(owner) || null;
  }
  return null;
}

function isExpiredFeedWork(tab, item) { return !!expiredFeedSlot(tab, item); }

function expireRetainedFeedWorks(tab) {
  // A known card remains a real card until this result generation is replaced.
  return false;
}

function curateFeedWorks(works, tab, gridKey = '') {
  // Following already stages New/publication order and stable card positions.
  // Quality scores must not turn that shared grid/viewer feed into a ranking.
  if (tab?.kind === 'follows') return works;
  // A saved collection is ordered by the user's actions. Quality/popularity
  // ranking belongs to discovery feeds, including when opening their galleries.
  if (['likes', 'bookmarks', 'recent', 'favorites'].includes(tab?.kind)) return works;
  // These two lists already include a bounded curation boost in their relevance
  // scores. Applying another pure quality sort would erase that relevance.
  if (tab?.kind === 'recommendations' || tab?.kind === 'detail' && gridKey === 'related') return works;
  const key = gridKey || tab?.kind || 'works';
  if (!contentPreferences.curation?.enabled || !works.length) {
    tab?.curationViews?.delete(key);
    return works;
  }
  const signature = JSON.stringify([CatalogLogic.normalizeCurationPreferences(contentPreferences.curation),
    tab?.kind, tab?.query, tab?.rating, tab?.sort, tab?.selectedSources, tab?.profileRef, tab?.followVersion]);
  const newKeys = tab?.kind === 'follows' ? tab.newKeys || new Set() : new Set();
  const newSignature = tab?.kind === 'follows' ? [...newKeys].sort().join('|') : '';
  const cached = tab?.curationViews?.get(key);
  const reusable = cached?.signature === signature;
  if (reusable && cached.newSignature === newSignature && cached.base.length === works.length &&
      works.every((item, index) => item === cached.base[index])) return cached.items;
  let ranked = CatalogLogic.rankCuratedWorks(works, contentPreferences.curation, curationContext());
  if (newKeys.size) {
    const isNew = item => [item.key, ...(item.memberKeys || [])].some(key => newKeys.has(key));
    ranked = ranked.map(item => ({ item, isNew: isNew(item) }))
      .sort((a, b) => Number(b.isNew) - Number(a.isNew)).map(entry => entry.item);
  }
  const items = reusable ? CatalogLogic.stableFeedItems(cached.items, ranked, newKeys) : ranked;
  if (tab) {
    tab.curationViews ||= new Map();
    tab.curationViews.set(key, { signature, newSignature, base: works, items });
  }
  return items;
}

function filterFeedWorks(items, tab, alreadyGrouped = false, gridKey = '', keepOrder = false) {
  let supported = CatalogLogic.filterCatalogItems(items);
  if (!['likes','bookmarks','recent'].includes(tab?.kind)) supported = filterHiddenFeedWorks(supported);
  if (tab?.rating === 'explicit' && ['home', 'search', 'recommendations', 'follows', 'profile'].includes(tab.kind))
    supported = DartViewerPreferences.filterItems(supported, selectedRating(tab),
      CatalogLogic.matchesRating, CatalogLogic.groupingRevision(supported));
  let works = CatalogLogic.filterWorks(
    alreadyGrouped ? supported : CatalogLogic.groupWorks(supported), contentPreferences);
  if (contentPreferences.hideFollowedArtists) works = filterFollowedFeedWorks(works, tab, gridKey);
  const hideKnown = contentPreferences.hideViewedAndSaved && isHideableFeed(tab, gridKey);
  if (!hideKnown) return keepOrder ? works : curateFeedWorks(works, tab, gridKey);
  learnKnownWorkAliases(works);
  let knownTokens;
  const visible = works.filter(item => isRetainedFeedWork(tab, item) ||
    !CatalogLogic.workHistoryTokens(item).some(token => (knownTokens ||= knownWorkTokens()).has(token)));
  return keepOrder ? visible : curateFeedWorks(visible, tab, gridKey);
}

function filterHiddenFeedWorks(items) {
  const actions = artworkActionsController(), hidden = actions.items();
  if (!hidden.length) return items;
  const revision = CatalogLogic.groupingRevision(items);
  const views = filterHiddenFeedWorks.views ||= new WeakMap();
  const cached = views.get(items);
  if (cached?.hidden === hidden && cached.actions === actions &&
      cached.length === items.length && cached.revision === revision) return cached.items;
  const filtered = items.filter(item => !actions.isHidden(item));
  const visible = filtered.length === items.length ? items : filtered;
  // Grouping and rating views share the input array's identity. Keep an unchanged
  // hidden subset warm, but recheck after provider metadata learns another alias
  // or load/restore replaces the hidden list without a local action revision.
  views.set(items, { actions, hidden, length: items.length, revision, items: visible });
  return visible;
}

function emptyFeedMessage(tab, gridKey = '') {
  if (contentPreferences.hideFollowedArtists && isFollowedArtistFeed(tab, gridKey))
    return '<div class="empty">Works on this page are hidden by your feed preferences. <button class="inline-retry" data-action="content-settings">Изменить фильтры</button></div>';
  return contentPreferences.hideViewedAndSaved &&
    (tab?.kind === 'home' || tab?.kind === 'search' || tab?.kind === 'recommendations' || tab?.kind === 'follows' ||
     tab?.kind === 'detail' && gridKey === 'related')
    ? '<div class="empty">На этой странице нет новых для вас работ. Каталог продолжит загрузку при прокрутке. <button class="inline-retry" data-action="content-settings">Настроить скрытие</button></div>'
    : '<div class="empty">Работы на этой странице скрыты фильтрами содержимого. <button class="inline-retry" data-action="content-settings">Изменить фильтры</button></div>';
}

function renderGrid(items, key = '', newKeys = new Set(), alreadyGrouped = false) {
  const tab = currentTab();
  if (!items.length && tab?.rating === 'explicit' && selectedRating(tab) === 'none' &&
      ['home', 'search', 'profile', 'recommendations', 'follows'].includes(tab.kind)) return emptyNsfwRatingsMessage();
  if (!items.length) return '<div class="empty">Здесь пока нет изображений. Измените запрос или выберите другой источник.</div>';
  let works = filterFeedWorks(items, tab, alreadyGrouped, key, tab?.kind === 'home' && alreadyGrouped);
  if (tab?.kind === 'profile' && key === 'profile') {
    works = CatalogLogic.stableFeedItems(tab.profileGridRating === tab.rating
      ? tab.profileGridItems : [], works);
    tab.profileGridItems = works;
    tab.profileGridRating = tab.rating;
  }
  if (!works.length) return emptyFeedMessage(tab, key);
  if (tab) { tab.artworkLists ||= new Map(); tab.artworkLists.set(key || tab.kind, works); }
  return renderVirtualGrid(works, key, item => renderFeedCard(item, tab, newKeys, key));
}

// Artwork and Favorite entity grids share one measured window and scroll
// lifecycle. Only the card renderer differs; full source lists stay available
// to the viewer, including covers outside the mounted window.
function renderVirtualGrid(items, key, renderItem, { threshold = 160, overscan = 4, pitch = 260, gridClass = '' } = {}) {
  const tab = currentTab();
  const attribute = key ? ` data-grid-key="${escapeHtml(key)}"` : '';
  const grid = `grid${gridClass ? ` ${gridClass}` : ''}`;
  if (!key || items.length <= threshold || !tab)
    return `<div${attribute}><div class="${grid}" data-render-key="cards">${items.map(renderItem).join('')}</div></div>`;
  tab.virtualState ||= {};
  const state = tab.virtualState[key] ||= { cols: 7, pitch, startRow: 0, endRow: 0 };
  const cols = Math.max(1, state.cols);
  const totalRows = Math.ceil(items.length / cols);
  state.totalRows = totalRows;
  const scrollTop = main.dataset.tabId === String(tab.id) ? main.scrollTop : tab.scrollTop || 0;
  const gridTop = tab.gridTops?.[key] ?? 0;
  const row = Math.max(0, Math.min(totalRows - 1, Math.floor((scrollTop - gridTop) / state.pitch)));
  state.visibleRows = Math.max(1, Math.ceil((main.clientHeight || 1440) / state.pitch));
  state.overscan = overscan;
  if (state.startRow >= totalRows || state.startRow > 0 && row < state.startRow + 2 ||
      state.endRow < totalRows && row > state.endRow - state.visibleRows - 2) {
    state.startRow = Math.max(0, row - overscan);
  }
  state.endRow = Math.min(totalRows, state.startRow + state.visibleRows + overscan * 2);
  const visible = items.slice(state.startRow * cols, state.endRow * cols);
  const top = Math.round(state.startRow * state.pitch);
  const bottom = Math.round(Math.max(0, totalRows - state.endRow) * state.pitch);
  return `<div class="virtual-grid"${attribute}><div class="virtual-spacer" data-render-key="top" style="height:${top}px"></div><div class="${grid}" data-render-key="cards">${visible.map(renderItem).join('')}</div><div class="virtual-spacer" data-render-key="bottom" style="height:${bottom}px"></div></div>`;
}

function renderFavoriteEntityGrid(cards, entity) {
  const tab = currentTab();
  const key = 'favorites';
  const indexes = new Map();
  cards.forEach((card, index) => {
    if (card.cover && !indexes.has(card.cover.key)) indexes.set(card.cover.key, index);
  });
  if (tab) {
    tab.artworkLists ||= new Map();
    tab.artworkLists.set(key, tab.items);
  }
  const markup = renderVirtualGrid(cards, key, entity,
    { threshold: 80, overscan: 2, pitch: 340, gridClass: 'favorites-entity-grid' });
  if (tab?.virtualState?.[key]) tab.virtualState[key].itemIndexes = indexes;
  return markup;
}

function renderFeedCard(item, tab, newKeys, gridKey = '') {
  rememberRenderedFeedWork(tab, item, gridKey);
  const pack=gridKey==='favorites-artworks'?tab?.favoriteGroupCards?.get(item.key):null;
  return renderCard(item, (item.memberKeys || [item.key]).some(key => newKeys.has(key)),
    gridKey==='favorites-artworks'?{draggable:true,groupId:pack?.groupId,groupCount:pack?.items.length}:null);
}

function measureVirtualGrids(tab) {
  tab.gridTops ||= {};
  const mainTop = main.getBoundingClientRect().top;
  let refresh = false;
  main.querySelectorAll('[data-grid-key]').forEach(wrapper => {
    const key = wrapper.dataset.gridKey;
    tab.gridTops[key] = main.scrollTop + wrapper.getBoundingClientRect().top - mainTop;
    const state = tab.virtualState?.[key];
    if (!state || !wrapper.classList.contains('virtual-grid')) return;
    const cards = [...(wrapper.querySelector('.grid')?.children || [])];
    if (cards.length < 2) return;
    const firstTop = cards[0].getBoundingClientRect().top;
    let cols = 0;
    while (cols < cards.length && Math.abs(cards[cols].getBoundingClientRect().top - firstTop) < 2) cols++;
    if (cols > 0 && cols !== state.cols) { state.cols = cols; refresh = true; }
    if (cols < cards.length) {
      const pitch = cards[cols].getBoundingClientRect().top - firstTop;
      if (pitch > 0 && Math.abs(pitch - state.pitch) > 2) {
        state.pitch = pitch;
        refresh = true;
      }
    }
  });
  if (refresh && !tab.virtualMeasurePending) {
    tab.virtualMeasurePending = true;
    requestAnimationFrame(() => {
      tab.virtualMeasurePending = false;
      if (currentTab()?.id === tab.id) render();
    });
  }
}

function renderCard(item, isNew = false, presentation = null) {
  item = rememberItem(item);
  const media = galleryImages(item);
  const imageCount = media.length;
  const countConfirmed = imageCount < 2 || detailImageDeduper.isCountConfirmed(media);
  const previewVideo = media.find(url => CatalogLogic.videoMimeType(url));
  const taggedArtist = currentTab()?.kind === 'follows' && item.followedArtistTag;
  const attribution = CatalogLogic.workAttribution(item, contentPreferences.attributionPriority);
  const primary = attribution.primary;
  const artistLabel = taggedArtist && primary.role === 'unknown'
    ? `#${item.followedArtistName || item.followedArtistTag}` : primary.name;
  const roleLabel = taggedArtist && primary.role === 'unknown' ? 'Тег подписки' :
    primary.roleLabel || { creator: 'Автор', uploader: 'Загрузчик', original: 'Оригинал', unknown: 'Автор' }[primary.role];
  const provenance = CatalogLogic.sourceProvenance(item);
  const sourceName = names[item.source] || item.source;
  const sourceBadge = sourceName + (provenance.extra ? ` +${provenance.extra}` : '');
  const sourceDetails = Object.entries(provenance.counts)
    .map(([source, count]) => `${names[source] || source}: ${count}`).join(' · ');
  const sourceTitle = provenance.extra
    ? `Объединено ${provenance.total} записей · ${sourceDetails}` : sourceName;
  return `<article class="card${typeof quickPreviewReturnHighlighted === 'function' && quickPreviewReturnHighlighted(item, currentTab()) ? ' artwork-return-highlight' : ''}" data-work-key="${escapeHtml(item.key)}"${presentation?.draggable?' draggable="true" data-favorite-draggable="true"':''}${presentation?.groupId?` data-favorite-group="${escapeHtml(presentation.groupId)}"`:''} data-work-members="${escapeHtml(JSON.stringify([item.key, ...(item.memberKeys || [])]))}"><div class="card-art ${isNew ? 'new-item' : ''}">
    <button class="card-art" data-action="open" data-key="${escapeHtml(item.key)}"${previewVideo ? ` data-video-preview="${escapeHtml(previewVideo)}"` : ''} data-i18n-keep="${escapeHtml(JSON.stringify(/^(Работа|Artwork|Werk) #/.test(item.title) ? [] : [item.title]))}" aria-label="Открыть ${escapeHtml(item.title)} · ${escapeHtml(sourceTitle)}">
      ${item.thumbnail ? `<img data-image-url="${escapeHtml(item.thumbnail)}" alt="" decoding="async" draggable="false">` : `<span class="text-preview"${/^(Работа|Artwork|Werk) #/.test(item.title) ? '' : ' data-no-i18n'}>${escapeHtml(item.title.slice(0, 180))}</span>`}
      ${previewVideo ? '<img class="video-preview-frame" alt="" aria-hidden="true" decoding="async" hidden>' : ''}
      <span class="image-fail">Изображение недоступно</span>
      <span class="source-badge" title="${escapeHtml(sourceTitle)}">${escapeHtml(sourceBadge)}</span>
      ${isNew ? '<span class="new-badge">Новое</span>' : ''}
      ${isAdultRating(item.rating) ? `<span class="rating-badge" title="${ratingLabel(item.rating) === 'Q' ? 'Questionable — пограничный контент' : 'NSFW — откровенный контент'}">${ratingLabel(item.rating)}</span>` : ''}
      ${imageCount > 1 ? `<span class="image-count" data-count-confirmed="${countConfirmed}" title="${countConfirmed ? `Images: ${imageCount}` : 'Multiple images · Count verified when opened'}">▣${countConfirmed ? ` ${imageCount}` : ''}</span>` : ''}
      ${presentation?.groupId?`<span class="favorite-group-badge" title="Grouped artworks"><span aria-hidden="true">▤</span> ${presentation.groupCount}</span>`:''}
      ${previewVideo ? '<span class="video-badge" role="img" aria-label="Видео" title="Video · Hover for 5 preview frames">▶</span>' : ''}
    </button>
    ${savedWorkButton(item, 'likes')}
  </div><button class="card-title" ${presentation?.query ? `data-action="query" data-query="${escapeHtml(presentation.query)}" data-context-tag="${escapeHtml(presentation.query)}" data-no-i18n` : `data-action="open" data-key="${escapeHtml(item.key)}" data-i18n-keep="${escapeHtml(JSON.stringify(/^(Работа|Artwork|Werk) #/.test(item.title) ? [] : [item.title]))}"`} title="${escapeHtml(presentation?.label || item.title)}">${escapeHtml(presentation?.label || item.title)}</button>
  <button class="card-artist" data-action="${taggedArtist && primary.role === 'unknown' ? 'follow-tag-search' : 'attribution-primary'}" data-key="${escapeHtml(item.key)}" ${['creator', 'contributor'].includes(primary.role) ? creatorActionData(item) : workAuthorContextData(item, primary)} data-i18n-keep="${escapeHtml(JSON.stringify(primary.role === 'unknown' && !taggedArtist ? [] : [artistLabel]))}" title="${escapeHtml(roleLabel)}: ${escapeHtml(artistLabel)}"><span class="artist-avatar">${escapeHtml((taggedArtist && primary.role === 'unknown' ? artistLabel.slice(1) : artistLabel)[0].toUpperCase())}</span><span><small>${escapeHtml(roleLabel)}</small>${escapeHtml(artistLabel)}</span></button>${currentTab()?.sort === 'popular' && Number.isInteger(item.popularityCount) ? `<div class="card-popularity">Голоса: ${item.popularityCount}</div>` : ''}</article>`;
}

function skeletons(count) {
  return `<div class="grid loading-grid">${Array.from({ length: count }, () => '<div class="card"><div class="card-art"></div><div class="card-title"></div><div class="card-artist"></div></div>').join('')}</div>`;
}

function renderDetail(tab) {
  if (artworkActionsController().isHidden(tab.item)) return `<div class="content" data-artwork-key="${escapeHtml(tab.item.key)}"><h1 data-no-i18n>${escapeHtml(tab.item.title)}</h1><div class="empty">This artwork is hidden. <button class="inline-retry" data-action="artwork-restore" data-key="${escapeHtml(tab.item.key)}">Show again</button></div></div>`;
  let item = tab.item = rememberItem(tab.item);
  if (item.groupingVersion === 2 && item.groupMembers?.length) {
    const groups = CatalogLogic.groupWorks([item]);
    if (groups.length > 1) {
      groupRepairs.enqueue(item);
      item = tab.item = groups.find(group => group.memberKeys.includes(item.key)) || groups[0];
    }
  }
  tab.artworkRoute ||= createArtworkRoute(tab, item);
  tab.artworkRoute?.engine.sync();
  if (CatalogLogic.isWorkHidden(item, contentPreferences))
    return `<div class="content"><div class="empty feature-empty">Эта работа скрыта фильтрами содержимого. <button class="inline-retry" data-action="content-settings">Изменить фильтры</button></div></div>`;
  const images = galleryImages(item, tab.artworkRoute);
  const tags = CatalogLogic.artworkTags(item, tab.searchQuery);
  const visibleTags = tab.showAllTags ? tags : tags.slice(0, 40);
  const visibleCreatorWorks = selectCreatorWorks(item, tab.creatorCandidates || tab.creatorWorks || [], tab);
  const attribution = CatalogLogic.workAttribution(item, contentPreferences.attributionPriority);
  if (images.length && attribution.creator) {
    tab.artworkLists ||= new Map(); tab.artworkLists.set('creator', visibleCreatorWorks);
  }
  const primary = attribution.primary;
  const primaryRole = primary.roleLabel || { creator: 'Автор', uploader: 'Загрузчик', original: 'Исходная площадка',
    unknown: 'Автор' }[primary.role];
  const sourceLabel = [...new Set(CatalogLogic.workSources(item).map(record => names[record.source]))]
    .join(' · ') || names[item.source] || item.source;
  return `<div class="content"><div class="detail-layout">
    <div>${tab.detailAccessMessage || item.requiresAuthentication ? `<div class="source-notice source-warning"><span>${escapeHtml(tab.detailAccessMessage || (settings.hasSankakuSession ? 'Для этой работы Sankaku требуется дополнительный доступ аккаунта на сайте.' : item.accessMessage))}</span><button data-action="sankaku-auth">${settings.hasSankakuSession ? 'Аккаунт Sankaku' : 'Авторизуйтесь'}</button></div>` : ''}${images.length ? `<div class="artwork-stage">${images.map((url, index) => renderDetailImage(item, url, index, tab.artworkRoute)).join('')}</div>` : ''}
      <div class="detail-meta"><h1>${escapeHtml(item.title)}</h1>
        <div class="muted">${escapeHtml(sourceLabel)} · ${escapeHtml(formatDate(item.published))}${item.rating ? ` · <span${ratingLabel(item.rating) === 'Q' ? ' title="Questionable — пограничный контент"' : ''}>${escapeHtml(ratingLabel(item.rating))}</span>` : ''}</div>
        <div class="detail-actions">${savedWorkButton(item, 'bookmarks', true)}${savedWorkButton(item, 'likes', true)}
          <button class="secondary-button" data-action="external" data-key="${escapeHtml(item.key)}">Открыть на сайте ↗</button>${artworkMoreButton(item)}</div>
        ${tags.length ? renderArtworkTags(tab, tags, visibleTags) : ''}
      </div>
    </div>
    <aside class="creator-panel"><div class="creator-heading" ${workAuthorContextData(item, primary)}><span class="artist-avatar">${escapeHtml((primary.name || '?')[0].toUpperCase())}</span><div><div class="muted">${escapeHtml(primaryRole)}</div><div class="creator-name"${primary.role !== 'unknown' ? ' data-no-i18n' : ''}>${escapeHtml(primary.name)}</div></div></div>
      ${renderParticipantProfiles(item, attribution)}
      ${attribution.original ? `<div class="attribution-entry"><strong>Исходная ссылка</strong><button class="attribution-link" data-action="original" data-key="${escapeHtml(item.key)}" data-no-i18n title="${escapeHtml(attribution.original.url)}">${escapeHtml(attribution.original.name)} ↗</button></div>` : ''}
      <dl><dt>${sourceLabel.includes(' · ') ? 'Каталоги' : 'Каталог'}</dt><dd class="work-sources">${renderWorkSources(item)}</dd><dt>ID работы · ${escapeHtml(names[item.source] || item.source)}</dt><dd>${escapeHtml(item.id)}</dd></dl></aside>
  </div>
    ${tab.artworkRoute?.source.manualFavoriteGroup?`<section class="section"><div class="section-head"><h2>Grouped artworks</h2><button class="text-button" data-action="favorite-ungroup" data-group-id="${escapeHtml(tab.artworkRoute.source.manualFavoriteGroup)}">Ungroup artworks</button></div><div class="favorite-group-strip" data-favorite-group="${escapeHtml(tab.artworkRoute.source.manualFavoriteGroup)}">${tab.artworkRoute.source.items.filter(entry=>!artworkActionsController().isHidden(entry)&&!CatalogLogic.isWorkHidden(entry,contentPreferences)&&CatalogLogic.matchesRating(entry,selectedRating(tab.artworkRoute.source))).map(entry=>renderCard(entry)).join('')}</div></section>`:''}
    ${images.length && attribution.creator ? `<section class="section creator-works-section"><div class="section-head"><h2>Ещё работы автора</h2><button class="text-button" data-action="creator-profile" data-key="${escapeHtml(item.key)}" ${creatorActionData(item)}>Все работы автора</button></div>
      ${visibleCreatorWorks.length ? `<div class="author-strip">${visibleCreatorWorks.map(entry => renderCard(entry)).join('')}</div>` : tab.creatorLoading || !tab.creatorStarted ? skeletons(6) : `<p class="muted">${Object.keys(tab.creatorPages || {}).some(source => !tab.creatorPaused?.[source]) ? 'Больше работ можно посмотреть в профиле автора.' : 'Других работ в доступных источниках пока не найдено.'}</p>`}
      ${renderErrors(tab.creatorErrors, 'creator-retry')}</section>` : ''}
    ${images.length ? `<section class="section related-section"><div class="section-head"><h2>Похожие работы</h2></div>
      ${tab.relatedQuery ? '<p class="section-sub section-note">По персонажам и содержательным тегам работы. Подбор расширяется при прокрутке; показаны и другие авторы.</p>' : ''}
      ${tab.relatedLoading && !tab.related?.length || !tab.relatedStarted ? skeletons(10) : tab.related?.length ? renderGrid(tab.related, 'related') : tab.relatedError || !tab.relatedHasMore && Object.keys(tab.relatedErrors || {}).length ? '<p class="muted">Похожие работы сейчас недоступны.</p>' : tab.relatedHasMore ? '<p class="muted">Ищем похожие работы на следующих страницах…</p>' : '<p class="muted">Похожих работ по тегам не найдено.</p>'}
      ${renderRelatedTail(tab)}</section>` : ''}
  </div>`;
}

function renderWorkSources(item) {
  const records = CatalogLogic.workSources(item);
  const sources = [...new Set(records.map(record => record.source))];
  if (!sources.length) return '';
  return sources.map(source => {
    const posts = records.filter(record => record.source === source);
    return `<a href="${escapeHtml(posts[0].url)}" target="_blank" rel="noopener" title="${escapeHtml(`${names[source]} · #${posts[0].id}`)}">${escapeHtml(names[source])}</a>`;
  }).join('<span aria-hidden="true"> · </span>');
}

function renderParticipantProfiles(item, attribution) {
  if (!attribution.participants.length)
    return '<p class="settings-hint">Тег художника пока не подтверждён. Загрузчик не считается автором.</p>';
  return attribution.participants.map((person, index) => {
    const label = person.participantRole === 'artist' ? 'Профиль художника'
      : person.participantRole === 'animator' ? 'Профиль аниматора'
      : person.participantRole === 'voice_actor' ? 'Профиль актёра озвучки' : 'Профиль участника';
    const headingVisible = index > 0 || !['creator', 'contributor'].includes(attribution.primary.role);
    return `<div class="participant-profile" data-participant-tag="${escapeHtml(person.tag)}" ${authorContextData({ source: 'artist', artistId: person.tag, name: person.name })}>
      ${headingVisible ? `<div class="creator-heading"><span class="artist-avatar">${escapeHtml(person.name[0].toUpperCase())}</span><div><div class="muted">${escapeHtml(person.roleLabel)}</div><div class="creator-name" data-no-i18n>${escapeHtml(person.name)}</div></div></div>` : ''}
      <button class="${index === 0 ? 'primary-button' : 'secondary-button'} profile-button" data-action="creator-profile" data-key="${escapeHtml(item.key)}" ${creatorActionData(item, person)}>${label}</button>
      ${followButton(person.follow)}</div>`;
  }).join('');
}

function renderArtworkTags(tab, tags, visibleTags) {
  const selected = new Set(tab.selectedTags || []);
  return `${selected.size ? `<div class="tag-selection-toolbar" role="group" aria-label="Выбор тегов для поиска">
    <span class="tag-selection-status" role="status" aria-live="polite">Выбрано: ${selected.size}</span>
    <button data-action="detail-tags-reset"${selected.size ? '' : ' disabled'}>Сбросить</button>
  </div>` : ''}<div class="tag-list" data-artwork-tags-key="${escapeHtml(tab.item.key)}" tabindex="-1">${visibleTags.map(tag => {
    const kind = CatalogLogic.artworkTagKind(tab.item, tag);
    const picked = selected.has(tag);
    return `<button class="tag-link${kind ? ` tag-link-${kind}` : ''}${picked ? ' tag-link-selected' : ''}" data-action="query" data-query="${escapeHtml(tag)}" aria-pressed="${picked}" title="${picked ? 'Клик или Enter — искать выбранные теги. Ctrl + клик — снять выбор.' : 'Ctrl + клик — выбрать тег. Обычный клик — искать этот тег.'}">#${escapeHtml(tag.replaceAll('_', ' '))}</button>`;
  }).join('')}${tags.length > 40 ? `<button class="tag-link tag-more" data-action="detail-tags-more">${tab.showAllTags ? 'Свернуть теги' : `Ещё ${tags.length - 40} тегов`}</button>` : ''}</div>`;
}

function renderDetailImage(item, url, index, route = null) {
  const thumbnail = route?.presentation ? artworkRouteMedia(route, item, url).thumbnail : item.thumbnail;
  if (CatalogLogic.videoMimeType(url)) {
    const poster = thumbnail && !CatalogLogic.videoMimeType(thumbnail)
      ? `/api/image?url=${encodeURIComponent(thumbnail)}` : '';
    return `<div class="detail-video"><video data-video-url="${escapeHtml(url)}" data-video-identity="${escapeHtml(item.key + "|" + CatalogLogic.mediaCacheKey(url))}" src="/api/video?url=${encodeURIComponent(url)}"${poster ? ` poster="${escapeHtml(poster)}"` : ''} controls autoplay${viewerPreferences.videoSound ? "" : " muted"} loop playsinline preload="metadata" aria-label="${escapeHtml(item.title)}"></video><span class="video-fail" role="status">Видео не удалось воспроизвести. Попробуйте ещё раз или откройте запись на сайте.</span></div>`;
  }
  const previewUrl = index === 0 ? thumbnail : '';
  const preview = imageLoader.cached(url)?.blobUrl ||
    (previewUrl ? imageLoader.cached(previewUrl)?.blobUrl : '');
  const size = longDetailImageSize(url, previewUrl);
  return `<div class="detail-image${size ? ' long-image' : ''}"${size ? ` style="aspect-ratio: ${size.width} / ${size.height}"` : ''}><img data-action="zoom-image" data-image-url="${escapeHtml(url)}"${previewUrl ? ` data-preview-url="${escapeHtml(previewUrl)}"` : ''}${preview ? ` src="${escapeHtml(preview)}"` : ''} alt="${escapeHtml(item.title)}" role="button" tabindex="0" aria-label="Увеличить изображение: ${escapeHtml(item.title)}" decoding="async" draggable="false"><span class="image-fail">Изображение недоступно</span></div>`;
}

function longDetailImageSize(url, previewUrl) {
  const size = [imageLoader.cached(url), imageLoader.cached(previewUrl)]
    .find(entry => entry?.width > 0 && entry?.height > 0);
  return size && size.height >= size.width * 2.5 ? size : null;
}

function rememberImageDimensions(img) {
  if (!img.matches?.('img[data-image-url]') || !img.naturalWidth || !img.naturalHeight) return;
  for (const url of [img.dataset.imageUrl, img.dataset.previewUrl]) {
    const entry = imageLoader.cached(url);
    if (entry && entry.blobUrl === img.getAttribute('src')) {
      entry.width = img.naturalWidth;
      entry.height = img.naturalHeight;
    }
  }
  const frame = img.closest('.detail-image');
  if (!frame) return;
  const size = longDetailImageSize(img.dataset.imageUrl, img.dataset.previewUrl);
  frame.classList.toggle('long-image', !!size);
  if (size) frame.style.aspectRatio = `${size.width} / ${size.height}`;
  else frame.style.removeProperty('aspect-ratio');
  void detailImageDeduper.inspect(img);
}

const detailImageDeduper = {
  signatures: new Map(),
  duplicates: DartMediaDuplicates.createDuplicateIndex(),
  verified: new Set(),
  verifiedRevision: 0,
  verifiedResolved: null,
  saveTimer: null,
  saveEvidence() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => { this.saveTimer = null; saveSession(); }, 250);
  },
  isCountConfirmed(urls) {
    const revision = `${this.duplicates.revision}:${this.verifiedRevision}:${this.verified.size}`;
    if (this.verifiedResolved?.revision !== revision)
      this.verifiedResolved = { revision, keys: new Set([...this.verified].map(key => this.duplicates.resolve(key))) };
    return urls.every(url => CatalogLogic.videoMimeType(url) ||
      this.verifiedResolved.keys.has(this.duplicates.resolve(CatalogLogic.mediaCacheKey(url))));
  },
  unique(urls, comparePixels = false) {
    const revision = this.duplicates.revision;
    const images = DartMediaDuplicates.uniqueImages(urls, this.duplicates,
      CatalogLogic.mediaCacheKey, key => comparePixels ? this.signatures.get(key)?.value : null);
    if (this.duplicates.revision !== revision) {
      this.saveEvidence();
    }
    return images;
  },
  async inspect(img) {
    const stage = img.closest('.artwork-stage');
    if (!stage || stage.querySelectorAll('.detail-image').length < 2) return;
    const url = img.dataset.imageUrl;
    const entry = imageLoader.cached(url);
    if (!entry || entry.blobUrl !== img.getAttribute('src')) return;
    const key = CatalogLogic.mediaCacheKey(url);
    let record = this.signatures.get(key);
    if (!record || record.blobUrl !== entry.blobUrl) {
      record = { blobUrl: entry.blobUrl, value: null };
      this.signatures.set(key, record);
      record.pending = runVisualHashJob(async () => {
        const blob = await (await fetch(entry.blobUrl)).blob();
        record.value = await DartMediaDuplicates.fingerprint(blob);
      });
      while (this.signatures.size > 128) this.signatures.delete(this.signatures.keys().next().value);
    }
    await record.pending;
    if (record.value && !this.verified.has(key)) {
      this.verified.add(key); this.verifiedRevision++;
      while (this.verified.size > 256) this.verified.delete(this.verified.values().next().value);
      this.saveEvidence();
    }
    if (!img.isConnected || img.dataset.imageUrl !== url) return;
    const unique = new Set(this.unique([...stage.querySelectorAll('.detail-image img[data-image-url]')]
      .map(image => image.dataset.imageUrl), true));
    for (const image of stage.querySelectorAll('.detail-image img[data-image-url]')) {
      image.closest('.detail-image').hidden = !unique.has(image.dataset.imageUrl);
    }
    syncGalleryImageCounts();
  }
};

function galleryImages(item, route = null) {
  return item.images?.length ? detailImageDeduper.unique(route?.presentation
    ? artworkRouteMedia(route, item).images : CatalogLogic.artworkMedia(item).images)
    : item.thumbnail ? [item.thumbnail] : [];
}

function syncGalleryImageCounts() {
  for (const card of main.querySelectorAll('.card[data-work-key]')) {
    const item = itemIndex.get(card.dataset.workKey);
    if (!item) continue;
    const count = galleryImages(item).length;
    let badge = card.querySelector('.image-count');
    if (count <= 1) { badge?.remove(); continue; }
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'image-count';
      card.querySelector('button.card-art')?.append(badge);
    }
    const confirmed = detailImageDeduper.isCountConfirmed(galleryImages(item));
    badge.textContent = confirmed ? `▣ ${count}` : '▣';
    badge.dataset.countConfirmed = String(confirmed);
    badge.title = confirmed ? `Images: ${count}` : 'Multiple images · Count verified when opened';
  }
}

function ratingLabel(value) {
  if (['q', 'questionable'].includes(value)) return 'Q';
  if (isAdultRating(value)) return 'NSFW';
  if (['g', 'general', 's', 'sensitive', 'safe', 'sfw'].includes(value)) return 'SFW';
  if (value === 'unrated') return 'Рейтинг не указан';
  return value.toUpperCase();
}

function isAdultRating(value) {
  return ['q', 'questionable', 'e', 'explicit'].includes(value);
}

function ratingFilterFor(item) {
  return isAdultRating(item.rating) ? 'explicit' :
    ['g', 'general', 's', 'sensitive', 'safe', 'sfw'].includes(item.rating) ? 'general' : 'all';
}

function formatDate(value) {
  if (!value) return 'Дата не указана';
  const date = new Date(value);
  return isNaN(date.valueOf()) ? 'Дата не указана' : new Intl.DateTimeFormat(globalThis.DartI18n?.locale || 'en-US', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

function renderCurationSettings() {
  const preferences = CatalogLogic.normalizeCurationPreferences(contentPreferences.curation);
  const active = ['popularity', 'personal', 'freshness', 'resolution'].filter(key => preferences[key]).length;
  return `<div class="settings-card"><h2 class="settings-heading">${svg('curation')}<span>Curation</span></h2><p>Bring promising works higher using catalog metadata and your local likes.</p>
    <label class="settings-toggle"><input type="checkbox" name="curation-enabled" ${preferences.enabled ? 'checked' : ''} ${contentPreferencesSaving ? 'disabled' : ''} aria-describedby="curation-status"><span><strong>Enable curation</strong><small>Applies the selected factors across every artwork list.</small></span></label>
    <p id="curation-status" class="settings-hint" role="status">${!preferences.enabled ? 'Curation is off.' : active ? 'Curation is on. Selected factors are applied together.' : 'Select at least one factor. Base order is used while all factors are off.'}</p>
    </div><div class="settings-card"><fieldset class="curation-factors" ${!preferences.enabled || contentPreferencesSaving ? 'disabled' : ''}><legend>Ranking factors</legend>
    ${[
      ['popularity', 'Community ratings', 'Compares votes within the same catalog and rating. Missing votes are neutral; mirrored copies add no points.'],
      ['personal', 'Your preferences', 'Uses tags from your liked works. With no likes, this factor is neutral.'],
      ['freshness', 'Publication age', 'Gives recent uploads a chance. An older known copy keeps its original age.'],
      ['resolution', 'Original resolution', 'Uses original dimensions when available. Thumbnails, sketches, line art and pixel art are not penalized.']
    ].map(([key, title, hint]) => `<label class="settings-toggle"><input type="checkbox" name="curation-${key}" ${preferences[key] ? 'checked' : ''}><span><strong>${title}</strong><small>${hint}</small></span></label>`).join('')}
    </fieldset><p class="settings-hint">Ranks available results without extra image downloads. Works with missing data remain eligible.</p>
    <p class="settings-hint">Works in the catalog, search, recommendations, related works, artist profiles, Liked, Bookmarks and history.</p>
    <p class="settings-hint">Following keeps New first and its publication order. Curation does not reorder that feed.</p></div>`;
}

function profileTransferController() {
  return profileTransferController.instance ||= DartProfileTransfer.create({
    beforeTransfer: async () => {
      if (savedWorkPending.size || contentPreferencesSaving) return false;
      await recommendationPreferenceSaveQueue;
      return flushClientState();
    },
    changed: () => {
      if (currentTab()?.kind === 'settings' && currentTab().settingsSection === 'transfer') {
        const focused = document.activeElement?.id;
        render();
        if (['profile-transfer-consent', 'profile-transfer-settings', 'profile-transfer-confirm'].includes(focused))
          main.querySelector(`#${focused}`)?.focus({ preventScroll: true });
      }
    },
    afterImport: async () => {
      // An older in-flight library read must not publish its pre-import snapshot.
      for (const state of Object.values(refreshSavedWorks.states || {})) state.revision++;
      favoritesController.instance?.invalidateCollections();
      const refreshed = await Promise.all([refreshSavedWorks('likes', true), refreshSavedWorks('bookmarks', true),
        refreshFollows(), loadViewedTokens(), loadFavoriteTags(), favoritesController().loadArtworks(true),
        loadRecommendationTagPreferences(), loadContentPreferences()]);
      const state = await request('/api/client-state');
      if (Array.isArray(state.recent)) {
        recent = CatalogLogic.filterCatalogItems(state.recent).slice(0, 40);
        localStorage.setItem('artcatalog-recent', JSON.stringify(recent));
      }
      recommendationExposureGroups = DartRecommendationExposure.cleanGroups(state.recommendationExposureGroups);
      recommendationExposure = cleanRecommendationExposure(DartRecommendationExposure.keys(recommendationExposureGroups));
      localStorage.setItem('dart-recommendation-exposure-groups', JSON.stringify(recommendationExposureGroups));
      localStorage.setItem('dart-recommendation-exposure', JSON.stringify(recommendationExposure));
      if (refreshed.some(result => result === false)) throw new Error('Refresh failed');
    },
    download: (blob, name) => {
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = name; link.hidden = true; document.body.append(link);
      try { link.click(); } finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    }
  });
}

function profileTransferCounts(counts) {
  return `<dl class="profile-transfer-counts">${[
    ['likes', 'Liked'], ['bookmarks', 'Bookmarks'], ['follows', 'Following'], ['viewedIdentities', 'Viewed identities'],
    ['history', 'Recently opened'], ['favoriteTags', 'Favorite tags'], ['recommendationTags', 'Recommendation preferences']
  ].map(([key, label]) => `<div><dt>${label}</dt><dd>${Number(counts?.[key]) || 0}</dd></div>`).join('')}</dl>`;
}

function renderProfileTransferSettings() {
  const state = profileTransferController().state;
  return `<div class="settings-card"><h2 class="settings-heading">${svg('copy')}<span>Profile transfer</span></h2>
    <p>Move your likes, bookmarks, followed artists and viewed works between DART on Windows and Android. Import adds data and keeps your existing collections.</p>
    <p class="settings-hint">API keys, account sessions and device settings stay on this device. Keep the exported file private; it contains your artwork history and preferences.</p>
    <div class="profile-transfer-actions"><button type="button" class="primary-button" data-action="profile-export" ${state.busy ? 'disabled' : ''}>${state.busy === 'export' ? 'Exporting…' : 'Export profile'}</button>
      <button type="button" class="secondary-button" data-action="profile-select" ${state.busy ? 'disabled' : ''}>${state.busy === 'preview' ? 'Reading file…' : 'Choose profile file'}</button>
      <input id="profile-transfer-file" type="file" accept="application/json,.json" aria-label="Choose profile file" hidden></div>
    <p class="settings-hint">Use the same JSON file on either device. Maximum file size: 20 MB. A verified local backup is kept before changes are saved.</p>
    <p class="settings-hint">Recent lists keep their usual size. Viewed identities are merged separately so previously viewed works remain recognized.</p>
    ${state.pending ? `<section class="profile-transfer-preview" aria-labelledby="profile-transfer-preview-title"><h3 id="profile-transfer-preview-title">Confirm profile transfer</h3><p data-no-i18n>${escapeHtml(state.pending.name)}</p>${profileTransferCounts(state.pending.counts)}
      <label class="settings-toggle"><input id="profile-transfer-settings" type="checkbox" name="profileApplySettings" ${state.applySettings ? 'checked' : ''} ${state.busy ? 'disabled' : ''}><span><strong>Also apply imported content settings</strong><small>Includes filters and curation. Existing recommendation tag choices are kept unless this option is enabled.</small></span></label>
      <label class="settings-toggle"><input id="profile-transfer-consent" type="checkbox" name="profileTransferConsent" ${state.consent ? 'checked' : ''} ${state.busy ? 'disabled' : ''}><span><strong>I confirm importing this file into my profile</strong></span></label>
      <div class="profile-transfer-actions"><button id="profile-transfer-confirm" type="button" class="primary-button" data-action="profile-import" ${state.busy || !state.consent ? 'disabled' : ''}>${state.busy === 'import' ? 'Importing…' : 'Confirm transfer'}</button><button type="button" class="secondary-button" data-action="profile-cancel" ${state.busy && state.busy !== 'preview' ? 'disabled' : ''}>Cancel</button></div></section>` : ''}
    ${state.result ? `<section class="profile-transfer-result" role="status"><h3>Profile merged</h3><p>Added to this device:</p>${profileTransferCounts(state.result.added)}<p>${state.result.changed ? 'Existing items were kept. Matching copies were not added twice.' : 'Everything in this file was already present. No changes were needed.'}</p></section>` : ''}
    ${state.error ? `<p class="profile-transfer-error" role="alert">${escapeHtml(state.error)}</p>` : ''}
  </div>`;
}

function renderSettings() {
  const section = ['content', 'curation', 'authors', 'sources', 'tabs', 'appearance', 'language', 'privacy', 'transfer', 'upscale'].includes(currentTab()?.settingsSection)
    ? currentTab().settingsSection : 'content';
  const themePreference = globalThis.DartTheme?.preference || 'system';
  const hideGenerated = contentPreferences.aiMode !== 'all';
  const hideAssisted = contentPreferences.aiMode === 'generated-and-assisted';
  const excluded = contentPreferences.excludedTags || [];
  const hiddenAuthors = contentPreferences.hiddenAuthors || [];
  const sections = [
    ['content', 'image', 'Контент', 'AI, фурри и исключённые теги'],
    ['curation', 'curation', 'Curation', 'Ratings and personal taste'],
    ['authors', 'users', 'Авторы', 'Автор, источник и загрузчик'],
    ['sources', 'plug', 'Источники', 'Подключения и ключи'],
    ['tabs', 'panels', 'Вкладки', 'Просмотр и закрепление'],
    ['appearance', 'palette', 'Оформление', 'Цвет и тема'],
    ['upscale', 'image', 'Image upscaling', 'Local 2× and 4×'],
    ['privacy', 'shield', 'Privacy', 'Screen capture'],
    ['transfer', 'copy', 'Profile transfer', 'Windows and Android'],
    ['updates', 'download', 'Обновления', 'Версия и установка'],
    ['language', 'language', 'Язык', 'English · Русский · Deutsch']
  ];
  return `<div class="content settings-panel"><h1>Настройки</h1><p class="section-sub">Фильтры и подключения хранятся на этом компьютере.</p>
    <div class="settings-layout">
      <nav class="settings-sections" aria-label="Разделы настроек" role="tablist">
        ${sections.map(([key, icon, label, description]) => `<button type="button" id="${key === 'updates' ? 'settings-updates' : `settings-tab-${key}`}" ${key === 'updates' ? 'data-desktop-updates aria-haspopup="dialog" aria-controls="dart-update-dialog"' : `role="tab" aria-selected="${section === key}" aria-controls="settings-panel" data-action="settings-section" data-section="${key}"`} class="settings-section ${key === 'language' ? 'settings-language-section ' : ''}${section === key ? 'active' : ''}"><span class="settings-section-icon" aria-hidden="true">${svg(icon)}</span><span class="settings-section-copy"><strong>${label}</strong><small${key === 'language' ? ' data-no-i18n' : ''}>${description}</small></span></button>`).join('')}
      </nav>
      <div class="settings-view" id="settings-panel" role="tabpanel" aria-labelledby="settings-tab-${section}">
        ${section === 'curation' ? renderCurationSettings() : ''}
        ${section === 'transfer' ? renderProfileTransferSettings() : ''}
        ${section === 'upscale' ? globalThis.DartUpscale?.settingsMarkup() || '' : ''}
        ${section === 'privacy' ? `<div class="settings-card"><h2 class="settings-heading">${svg('shield')}<span>Screen capture protection</span></h2><p>Hide the DART window from supported screenshots and screen sharing apps while it stays visible on your display.</p>
          <label class="settings-toggle"><input type="checkbox" name="hideFromScreenCapture" ${privacyStatus.requested ? 'checked' : ''} ${privacyLoading || privacySaving || !privacyStatus.available && !privacyStatus.requested ? 'disabled' : ''}><span><strong>Hide DART from screen capture</strong><small>Applies to the entire DART window. The choice is saved for future launches.</small></span></label>
          <p class="privacy-status ${privacyStatus.error ? 'privacy-status-error' : privacyStatus.active ? 'privacy-status-active' : ''}" role="status">${privacyLoading ? 'Checking protection status…' : privacyStatus.error ? privacyErrors[privacyStatus.error] || 'Capture protection is unavailable.' : privacyStatus.active ? 'Protection is active.' : privacyStatus.available ? 'Protection is off.' : 'Open the DART desktop window to change this setting.'}</p>
          <p class="settings-hint">Windows 10 version 2004 or later is required. Some capture tools and external cameras can still record the display.</p></div>` : ''}
        ${section === 'appearance' ? `<div class="settings-card"><h2 class="settings-heading">${svg('palette')}<span>Тема оформления</span></h2><p>Системный режим автоматически выбирает светлую или тёмную тему по настройке Windows. Можно выбрать постоянную тему вручную.</p>
          <div class="theme-choices" role="group" aria-label="Тема оформления">
            ${[
              ['system', 'Системная', 'Следует цвету Windows'],
              ['light', 'Светлая', 'Светлый стандарт DART'],
              ['dark', 'Тёмная', 'Тёмный стандарт DART'],
              ['list', 'Лист', 'Графит, холодный голубой и полутоновые точки']
            ].map(([value, label, description]) => `<button type="button" class="theme-choice" data-action="theme-choice" data-theme-choice="${value}" aria-pressed="${themePreference === value}"><span class="theme-swatch theme-swatch-${value}" aria-hidden="true"></span><span class="theme-choice-copy"><strong>${label}</strong><small>${description}</small></span></button>`).join('')}
          </div><p class="settings-hint">Выбор применяется сразу и сохраняется на этом компьютере.</p></div>
        <div class="settings-card"><h2>Video playback</h2>
          <label class="settings-toggle"><input type="checkbox" name="videoSound" ${viewerPreferences.videoSound ? 'checked' : ''}><span><strong>Open videos with sound</strong><small>Applies to artwork pages, quick preview and fullscreen. Hover previews stay silent.</small></span></label>
        </div>` : ''}
        ${section === 'language' ? `<div class="settings-card"><h2 class="settings-heading">${svg('language')}<span>Язык интерфейса</span></h2><p>Выберите язык интерфейса. Названия работ, имена авторов и поисковые теги остаются на языке источника.</p>
          <label class="language-picker">Язык<select name="interfaceLanguage" aria-label="Язык интерфейса">
            <option value="en" ${contentPreferences.language === 'en' ? 'selected' : ''}>English</option>
            <option value="ru" ${contentPreferences.language === 'ru' ? 'selected' : ''}>Русский</option>
            <option value="de" ${contentPreferences.language === 'de' ? 'selected' : ''}>Deutsch</option>
          </select></label><p class="settings-hint">Выбор сохраняется в этом профиле и применяется сразу.</p><p class="settings-hint">Английский — язык по умолчанию.</p></div>` : ''}
        ${section === 'content' ? `${renderHiddenArtworksSettings()}
        <div class="settings-card"><h2 class="settings-heading">${svg('image')}<span>AI изображения</span></h2><p>Выберите, какие работы показывать в поиске, рекомендациях, профилях, похожих работах, понравившихся и закладках. Сохранённые работы остаются на месте.</p>
          <label class="settings-toggle"><input type="checkbox" name="hideGenerated" ${hideGenerated ? 'checked' : ''} ${contentPreferencesSaving ? 'disabled' : ''}><span><strong>Скрывать AI-generated</strong><small>Работы с метками AI генерации и известных генераторов.</small></span></label>
          <label class="settings-toggle settings-toggle-child"><input type="checkbox" name="hideAssisted" ${hideAssisted ? 'checked' : ''} ${!hideGenerated || contentPreferencesSaving ? 'disabled' : ''}><span><strong>Скрывать также AI-assisted</strong><small>Если выключено, работы с участием AI остаются видимыми.</small></span></label>
          <p class="settings-hint">Учитываются метки вроде #ai_generated, #ai-created, #ai_art, #stable_diffusion, #novelai и #ai-assisted. Работа без такой метки не определяется автоматически как AI.</p>
        </div>
        <div class="settings-card"><h2>Furry content</h2><p>Hide furry works across all catalogs and pages. Liked works and bookmarks are kept and become visible again when this filter is off.</p>
          <label class="settings-toggle"><input type="checkbox" name="hideFurry" aria-describedby="furry-filter-hint" ${contentPreferences.hideFurry ? 'checked' : ''} ${contentPreferencesSaving ? 'disabled' : ''}><span><strong>Hide furry content</strong><small>Includes #furry, #anthro, #anthropomorphic and related furry tags in every grouped copy.</small></span></label>
          <p class="settings-hint" id="furry-filter-hint">Animal ears or a tail alone do not count as furry. Works without explicit furry tags cannot be identified by this filter.</p>
          <p class="settings-hint">Excluded tags still apply independently when this switch is off.</p>
        </div>
        <div class="settings-card"><h2>Feed personalization</h2><p>Control which works appear in your feeds. Likes, bookmarks and history remain available in their own tabs.</p>
          <label class="settings-toggle"><input type="checkbox" name="hideViewedAndSaved" ${contentPreferences.hideViewedAndSaved ? 'checked' : ''} ${contentPreferencesSaving ? 'disabled' : ''}><span><strong>Скрывать просмотренные и сохранённые работы</strong><small>Учитываются также объединённые копии одной работы из разных источников. Изначально выключено.</small></span></label>
          <label class="settings-toggle"><input type="checkbox" name="showFollowedArtists" aria-describedby="followed-artists-hint" ${!contentPreferences.hideFollowedArtists ? 'checked' : ''} ${contentPreferencesSaving ? 'disabled' : ''}><span><strong>Show works by followed artists</strong><small id="followed-artists-hint">Turn off to hide their works from search, illustrations, recommendations and related works. Following and artist profiles are unaffected.</small></span></label>
        </div>
        <div class="settings-card"><h2>Исключённые теги</h2><p>Работы с указанными тегами не появятся в каталоге. Совпадение точное: #latex не скрывает #latex_gloves.</p>
          <form id="excluded-tags-form" class="excluded-tags-form"><input name="tags" type="text" maxlength="1000" autocomplete="off" placeholder="Например, 3d, ai_generated_background" aria-label="Добавить исключённые теги" ${contentPreferencesSaving ? 'disabled' : ''}><button class="primary-button" type="submit" ${contentPreferencesSaving ? 'disabled' : ''}>Добавить</button></form>
          ${excluded.length ? `<div class="excluded-tags-list">${excluded.map(tag => `<button type="button" class="excluded-tag" data-action="remove-excluded-tag" data-tag="${escapeHtml(tag)}" data-i18n-keep="${escapeHtml(JSON.stringify([tag]))}" aria-label="Убрать тег ${escapeHtml(tag)}"><span data-no-i18n>#${escapeHtml(tag.replaceAll(' ', '_'))}</span> <span aria-hidden="true">×</span></button>`).join('')}</div>` : '<p class="settings-hint">Список пуст. Можно ввести несколько тегов через запятую.</p>'}
          <p class="settings-hint">Фильтр проверяет все теги объединённой работы из Danbooru, Gelbooru, Rule34 и Sankaku.</p>
        </div>` : section === 'authors' ? `
        <div class="settings-card"><h2 class="settings-heading">${svg('users')}<span>Hidden authors</span></h2><p>Right-click an author and choose Hide to hide their works in every section. You can unhide them here.</p>
          ${hiddenAuthors.length ? `<ul class="hidden-authors-list">${hiddenAuthors.map(author => `<li ${authorContextData(author)}><span><strong data-no-i18n>${escapeHtml(author.name || author.artistId)}</strong><small>${author.source === 'artist' ? 'All catalogs' : `${escapeHtml(names[author.source] || author.source)} · <span>Uploader</span>`}</small></span><button type="button" class="secondary-button" data-action="unhide-author" data-author-key="${escapeHtml(CatalogLogic.hiddenAuthorKey(author))}"${contentPreferencesSaving ? ' disabled' : ''}>Unhide</button></li>`).join('')}</ul>` : '<p class="settings-hint">No hidden authors.</p>'}
        </div>
        <div class="settings-card"><h2>Кого показывать первым</h2><p>На карточке и в шапке работы можно первым показать художника, сайт оригинальной публикации или загрузчика. На странице работы все известные данные остаются видимыми отдельно.</p>
          ${[
            ['creator', 'Художник / автор', 'По тегу категории artist. Если художник неизвестен, так и будет написано.'],
            ['original', 'Исходная ссылка', 'Адрес, который площадка указала в поле source. Он может вести на саму работу, а не на профиль автора.'],
            ['uploader', 'Загрузчик / репостер', 'Аккаунт человека, загрузившего запись на Danbooru, Gelbooru или Rule34.']
          ].map(([value, label, hint]) => `<label class="settings-toggle"><input type="radio" name="attributionPriority" value="${value}" ${contentPreferences.attributionPriority === value ? 'checked' : ''} ${contentPreferencesSaving ? 'disabled' : ''}><span><strong>${label}</strong><small>${hint}</small></span></label>`).join('')}
          <p class="settings-hint">Подписка на художника использует подтверждённый тег. Для определения художника Rule34 нужны ключи Gelbooru и Rule34: список кандидатов берётся из категорий Gelbooru и проверяется на Rule34. Поле owner считается загрузчиком; по нему подписка на художника не создаётся.</p>
        </div>` : section === 'tabs' ? `
        <div class="settings-card"><h2 class="settings-heading">${svg('panels')}<span>Как открывать работы</span></h2>
          <label class="settings-toggle"><input type="radio" name="artworkTabs" value="preview" ${tabPreferences.artworkTabs === 'preview' ? 'checked' : ''}><span><strong>Одна временная вкладка просмотра</strong><small>Следующий арт, поиск по тегу или профиль художника из арта заменяют временную вкладку. «Назад» возвращает предыдущую страницу и место в выдаче. Shift+клик или средняя кнопка мыши оставляют вкладку.</small></span></label>
          <label class="settings-toggle"><input type="radio" name="artworkTabs" value="new" ${tabPreferences.artworkTabs === 'new' ? 'checked' : ''}><span><strong>Каждая работа в отдельной вкладке</strong><small>Открытые работы остаются в верхней строке до закрытия.</small></span></label>
        </div><div class="settings-card"><h2>Управление вкладками</h2><p>Ctrl + клик или средняя кнопка мыши открывает работу в отдельной фоновой вкладке. Ctrl + Shift + клик сразу переключает на неё.</p><p>Двойной клик по временной вкладке или значок закрепления оставляет её открытой. Закреплённые вкладки защищены от команд «Закрыть остальные» и «Закрыть справа».</p><p>Кнопка списка рядом с «+» показывает все вкладки с полными названиями и поиском. Меню по правому клику помогает закрывать несколько вкладок.</p></div>` : section === 'sources' ? `
        <div class="settings-card"><h2 class="settings-heading">${svg('plug')}<span>Источники</span></h2><p>Danbooru доступен без ключа. Gelbooru и Rule34 требуют ваши user ID и API key.</p>
          <div class="source-filters"><span class="filter-button active">Danbooru</span><span class="filter-button ${settings.hasApiKey ? 'active' : ''}">Gelbooru ${settings.hasApiKey ? 'подключён' : 'требует ключ'}</span><span class="filter-button ${settings.hasRule34ApiKey ? 'active' : ''}">Rule34 ${settings.hasRule34ApiKey ? 'подключён' : 'требует ключ'}</span><span class="filter-button ${settings.hasSankakuSession ? 'active' : ''}">Sankaku ${settings.hasSankakuSession ? 'вход выполнен' : 'гостевой доступ'}</span></div>
        </div>
        <form id="sankaku-login-form" class="settings-card"><h2>Sankaku</h2><p>Открытые работы доступны без входа. Для ограниченных работ и расширенного поиска авторизуйтесь. Доступные функции зависят от аккаунта Sankaku.</p>
          ${settings.hasSankakuSession ? `<p>Вход выполнен: <strong>${escapeHtml(settings.sankakuLogin)}</strong></p><button type="button" class="secondary-button" data-action="sankaku-logout" ${sankakuSigningIn ? 'disabled' : ''}>Выйти из Sankaku</button>` : `
          <label class="field">Логин или email<input name="login" autocomplete="username" required maxlength="200"></label>
          <label class="field">Пароль<input name="password" type="password" autocomplete="current-password" required maxlength="1000"></label>
          <button class="primary-button" type="submit" ${sankakuSigningIn ? 'disabled' : ''}>${sankakuSigningIn ? 'Входим…' : 'Войти в Sankaku'}</button>`}
          ${sankakuLoginError ? `<p role="alert">${escapeHtml(sankakuLoginError)}</p>` : ''}
          <p class="settings-hint">Пароль не сохраняется. Токен входа хранится с шифрованием Windows и восстанавливается после перезапуска. Вход с двухэтапной проверкой пока не поддерживается.</p>
          <a href="https://sankaku.app/" target="_blank" rel="noopener">Открыть Sankaku ↗</a>
        </form>
        <form id="settings-form" class="settings-card"><h2>Gelbooru API</h2><p>Ключ шифруется средствами Windows и сохраняется в профиле текущего пользователя. Пустое поле ключа сохраняет уже введённый ключ.</p>
          <label class="field">User ID<input name="userId" value="${escapeHtml(settings.userId)}" inputmode="numeric" autocomplete="off"><small>Указан в настройках вашего аккаунта Gelbooru.</small></label>
          <label class="field">API key<input name="apiKey" type="password" value="" autocomplete="off" placeholder="${settings.hasApiKey ? 'Ключ уже сохранён' : 'Введите API key'}"><small>Чтобы удалить ключ, очистите User ID и нажмите «Сохранить».</small></label>
          <h2 class="settings-subhead">Rule34 API</h2><p>Получите ключ в настройках аккаунта Rule34. Он хранится локально с шифрованием Windows.</p>
          <label class="field">User ID<input name="rule34UserId" value="${escapeHtml(settings.rule34UserId)}" inputmode="numeric" autocomplete="off"><small>Ваш числовой ID на Rule34.</small></label>
          <label class="field">API key<input name="rule34ApiKey" type="password" value="" autocomplete="off" placeholder="${settings.hasRule34ApiKey ? 'Ключ уже сохранён' : 'Введите API key'}"><small>Пустое поле сохраняет прежний ключ. Чтобы удалить его, очистите User ID и сохраните.</small></label>
          <button class="primary-button" type="submit">Сохранить</button>
        </form>` : ''}
      </div>
    </div>
  </div>`;
}

const sankakuMediaRecovery = {
  posts: new Map(), lanes: [Promise.resolve(), Promise.resolve()], lane: 0,
  post(id, signal) {
    if (!/^[A-Za-z0-9]{1,64}$/.test(id)) return Promise.resolve(null);
    const cached = this.posts.get(id);
    if (cached && cached.until > Date.now()) {
      if (cached.until === Infinity) cached.signals.add(signal);
      return cached.promise;
    }
    const lane = this.lane++ % this.lanes.length;
    const entry = { until: Infinity, signals: new Set([signal]) };
    // Shared, bounded requests use the existing authenticated detail endpoint.
    // It also renews stored media in Likes/Bookmarks without toggling either.
    entry.promise = this.lanes[lane].then(() => [...entry.signals].every(signal => signal.aborted) ? null : request(
      `/api/detail?source=sankaku&id=${encodeURIComponent(id)}&mediaOnly=true`,
      { signal: AbortSignal.timeout(20000), cache: 'reload' })).catch(() => null).then(detail => {
        const now = Date.now();let until = now + 60000;
        if (detail?.thumbnail && CatalogLogic.signedMediaExpired(detail.thumbnail)) detail = null;
        if (detail) for (const url of [detail.thumbnail, ...(detail.images || [])].filter(Boolean)) {
          if (CatalogLogic.mediaCacheKey(url) === url) continue;
          const params = new URL(url).searchParams, expiry = Number(params.get('e') || params.get('expires'));
          if (Number.isFinite(expiry) && expiry > 0) until = Math.min(until, Math.max(now + 1000, expiry * 1000 - 15000));
        }
        entry.until = [...entry.signals].every(signal => signal.aborted) ? 0 : until;
        entry.signals.clear();
        return detail;
      });
    this.lanes[lane] = entry.promise;
    this.posts.set(id, entry);
    if (this.posts.size > 256) for (const [key, value] of this.posts) {
      if (value.until < Date.now()) this.posts.delete(key);
    }
    return entry.promise;
  },
  apply(detail) {
    const lists = [likes, bookmarks, recent, ...tabs.flatMap(tab =>
      [tab.items, tab.related, tab.creatorWorks, tab.creatorCandidates])];
    const items = new Set([...itemIndex.values(), ...lists.filter(Array.isArray).flat(),
      ...tabs.map(tab => tab.item), quickPreviewWork].filter(Boolean));
    for (const item of items) {
      const updated = CatalogLogic.hydrateWorkMedia(item, detail);
      if (updated !== item) Object.assign(item, updated);
    }
    for (const list of lists) CatalogLogic.invalidateGrouping(list);
  },
  async recover(images, url, signal) {
    if (CatalogLogic.mediaCacheKey(url) === url || signal.aborted) return '';
    const img = [...images].find(image => image.isConnected);
    const card = img?.closest?.('[data-work-key]');
    const item = card ? itemIndex.get(card.dataset.workKey) : currentTab()?.item;
    if (!item) return '';
    const key = CatalogLogic.mediaCacheKey(url);
    const refs = CatalogLogic.workSources(item).filter(ref => ref.source === 'sankaku');
    for (const ref of refs) {
      if (signal.aborted) return '';
      const detail = await this.post(ref.id, signal);
      if (!detail || signal.aborted) continue;
      const renewed = [detail.thumbnail, ...(detail.images || [])].filter(Boolean)
        .find(candidate => CatalogLogic.mediaCacheKey(candidate) === key) ||
        (item.key === detail.key && CatalogLogic.mediaCacheKey(item.thumbnail) === key ? detail.thumbnail : '');
      this.apply(detail);
      if (renewed) return renewed;
    }
    return '';
  }
};

// Portable profiles omit short-lived signed URLs. Rehydrate only visible
// missing Sankaku thumbnails, through the existing bounded detail recovery.
const transferredMediaHydration = {
  active: new Map(), failedUntil: new Map(), attempts: new Map(), tabId: null, retryTimer: null,
  reset() {
    for (const controller of this.active.values()) controller.abort();
    this.active.clear();this.failedUntil.clear();this.attempts.clear();this.tabId = null;
    if (this.retryTimer !== null) { clearTimeout(this.retryTimer); this.retryTimer = null; }
  },
  scan() {
    if (this.retryTimer !== null) { clearTimeout(this.retryTimer); this.retryTimer = null; }
    const tab = currentTab();
    if (this.tabId !== tab?.id) {
      for (const controller of this.active.values()) controller.abort();
      this.active.clear(); this.attempts.clear(); this.tabId = tab?.id;
    }
    if (!tab || !['likes', 'bookmarks', 'recent', 'favorites'].includes(tab.kind)) return;
    const bounds = main.getBoundingClientRect();let retryAt = Infinity;
    for (const card of main.querySelectorAll('article.card[data-work-key]')) {
      if (this.active.size >= 2) break;
      const item = itemIndex.get(card.dataset.workKey);
      if (!item || item.thumbnail && !CatalogLogic.signedMediaExpired(item.thumbnail) || this.active.has(item.key) ||
          (this.attempts.get(item.key) || 0) >= 3) continue;
      const rect = card.getBoundingClientRect();
      if (rect.bottom < bounds.top - 200 || rect.top > bounds.bottom + 400) continue;
      const available = CatalogLogic.workSources(item).filter(ref => ref.source === 'sankaku');
      const offset = available.length ? ((this.attempts.get(item.key) || 0) * 2) % available.length : 0;
      const refs = [...available.slice(offset), ...available.slice(0, offset)].slice(0, 2);
      if (!refs.length || item.thumbnail && imageLoader.cached(item.thumbnail)) continue;
      const until = this.failedUntil.get(item.key) || 0;
      if (until > Date.now()) { retryAt = Math.min(retryAt, until); continue; }
      const controller = new AbortController(), id = tab.id;
      this.active.set(item.key, controller);this.attempts.set(item.key, (this.attempts.get(item.key) || 0) + 1);
      void (async () => {
        for (const ref of refs) {
          const detail = await sankakuMediaRecovery.post(ref.id, controller.signal);
          if (controller.signal.aborted) return false;
          if (!detail?.thumbnail || CatalogLogic.signedMediaExpired(detail.thumbnail)) continue;
          const hydrated = CatalogLogic.hydrateWorkMedia(item, detail);
          if (hydrated === item || !hydrated.thumbnail || CatalogLogic.signedMediaExpired(hydrated.thumbnail)) continue;
          Object.assign(item, hydrated);
          sankakuMediaRecovery.apply?.(detail);rememberItem(item);
          if (currentTab()?.id === id) render();
          return true;
        }
        return false;
      })().catch(() => false).then(loaded => {
        if (!loaded && !controller.signal.aborted) this.failedUntil.set(item.key, Date.now() + 60000);
        if (loaded) { this.failedUntil.delete(item.key); this.attempts.delete(item.key); }
        if (this.active.get(item.key) === controller) this.active.delete(item.key);
        if (this.failedUntil.size > 256) for (const [key, until] of this.failedUntil)
          if (until < Date.now()) this.failedUntil.delete(key);
        if (currentTab()?.id === id && !controller.signal.aborted) this.scan();
      });
    }
    if (retryAt < Infinity) {
      const id = tab.id;
      this.retryTimer = setTimeout(() => { this.retryTimer = null;if (currentTab()?.id === id) this.scan(); }, Math.max(1, retryAt - Date.now()));
    }
  }
};

async function rememberVideoFrames(entry, { card, key, url, signal }) {
  if (signal.aborted || entry.blobs?.length !== 5 || !(entry.duration > .2)) return;
  const item = itemIndex.get(card?.dataset?.key || key), mediaKey = CatalogLogic.mediaCacheKey(url);
  if (!item || !(item.images || []).some(value => CatalogLogic.mediaCacheKey(value) === mediaKey)) return;
  let sample = videoFingerprintValues.get(mediaKey);
  if (!sample) {
    sample = await runVisualHashJob(async () => {
      const frames = [];
      for (const blob of entry.blobs) {
        if (signal.aborted) return null;
        const bitmap = await createImageBitmap(blob);
        try {
          const evidence = catalogBitmapFingerprint(bitmap);
          frames.push({ hash: evidence.hash, perceptualHash: evidence.perceptualHash });
        } finally { bitmap.close(); }
      }
      return { url: mediaKey, duration: entry.duration, aspectRatio: entry.width / entry.height, frames };
    }, signal);
    if (!sample || signal.aborted) return;
    videoFingerprintValues.set(mediaKey, sample);
    while (videoFingerprintValues.size > 64) videoFingerprintValues.delete(videoFingerprintValues.keys().next().value);
  }
  if (signal.aborted || item.videoSamples?.some(saved => saved.url === mediaKey)) return;
  publishCardEvidence(item, { videoSamples: [...(item.videoSamples || []).filter(saved => saved.url !== mediaKey), sample].slice(-20) }, card);
}

globalThis.DartVideoPreview?.attach(main, {
  cacheKey: CatalogLogic.mediaCacheKey,
  isExpired: CatalogLogic.signedMediaExpired,
  onFrames: rememberVideoFrames,
  recoverUrl: (card, url, signal) => sankakuMediaRecovery.recover([card], url, signal)
});

const imageLoader = {
  queue: [], active: 0, controllers: new Set(), cache: new Map(), bytes: 0,
  current: new Set(), visible: new Set(), observed: new Map(), pinned: new Map(), activeJobs: new Map(), generation: 0,
  key(url) { return CatalogLogic.mediaCacheKey(url); },
  cached(url) { return this.cache.get(this.key(url)); },
  pin(url) {
    const key = this.key(url);
    this.pinned.set(key, (this.pinned.get(key) || 0) + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const count = this.pinned.get(key) - 1;
      if (count) this.pinned.set(key, count);
      else this.pinned.delete(key);
      this.evict();
    };
  },
  rememberBlob(url, blob) {
    const key = this.key(url);
    const existing = this.cache.get(key);
    if (existing) return existing;
    const entry = { blob, blobUrl: URL.createObjectURL(blob), size: blob.size };
    this.cache.set(key, entry);
    this.bytes += blob.size;
    this.evict();
    return entry;
  },
  async decode(entry) {
    if (!entry || typeof Image !== 'function') return entry;
    entry.decoded ||= (async () => {
      const image = new Image();
      image.src = entry.blobUrl;
      await image.decode();
      entry.width = image.naturalWidth;
      entry.height = image.naturalHeight;
      entry.image = image;
      return entry;
    })().catch(error => {
      entry.decoded = null;
      for (const [key, cached] of this.cache) {
        if (cached !== entry) continue;
        this.cache.delete(key);
        this.bytes -= entry.size;
        URL.revokeObjectURL(entry.blobUrl);
      }
      throw error;
    });
    return entry.decoded;
  },
  adopt(root) {
    // Reuse the decoded element itself. Assigning its blob URL to a fresh IMG
    // can still produce a blank first frame while the browser schedules load.
    for (const target of root.querySelectorAll('img[data-image-url]')) {
      if (target.naturalWidth) continue;
      const entries = [this.cached(target.dataset.imageUrl), this.cached(target.dataset.previewUrl)].filter(Boolean);
      const entry = entries.find(value => value.blobUrl === target.getAttribute('src')) ||
        (!target.hasAttribute('src') && entries[0]);
      const image = entry?.image;
      if (!image?.naturalWidth || image.isConnected) continue;
      for (const attribute of [...image.attributes])
        if (attribute.name !== 'src') image.removeAttribute(attribute.name);
      for (const attribute of [...target.attributes])
        if (attribute.name !== 'src') image.setAttribute(attribute.name, attribute.value);
      target.replaceWith(image);
      // Its load event fired during predecode; keep gallery dedup and long-image
      // sizing on the same path as an image loaded in the visible document.
      if (typeof rememberImageDimensions === 'function') rememberImageDimensions(image);
    }
  },
  reveal(img, blobUrl, animate = false) {
    const blank = !img.getAttribute('src');
    if (img.getAttribute('src') !== blobUrl) img.src = blobUrl;
    if (blank && animate && typeof img.animate === 'function' &&
        !globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
      img.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 140, easing: 'ease-out' });
    img.closest('.card-art, .detail-image')?.classList.remove('failed');
  },
  observer: new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        imageLoader.visible.add(entry.target);
        imageLoader.enqueue(entry.target, false);
      } else {
        imageLoader.visible.delete(entry.target);
      }
    }
    imageLoader.drain();
    imageLoader.updateCurrent(main);
    imageLoader.evict();
  }, { root: main, rootMargin: `${Math.max(450, main.clientHeight || 900)}px` }),
  updateCurrent(root) {
    this.current = new Set([...root.querySelectorAll('img[data-image-url][src]')]
      .flatMap(img => [img.dataset.imageUrl, img.dataset.previewUrl].filter(Boolean))
      .map(url => this.key(url)));
  },
  mount(root) {
    this.generation++;
    this.observer.disconnect();
    this.observed.clear();
    this.queue = [];
    this.activeJobs.clear();
    for (const controller of this.controllers) controller.abort();
    this.visible.clear();
    root.querySelectorAll('img[data-image-url]').forEach(img => {
      const url = img.dataset.imageUrl;
      if (!url) return;
      if (this.cached(url)) this.enqueue(img, false);
      this.observer.observe(img);
      this.observed.set(img, this.key(url));
    });
    this.updateCurrent(root);
    this.evict();
  },
  refresh(root) {
    this.queue = this.queue.filter(job => {
      job.images = new Set([...job.images].filter(img => img.isConnected &&
        this.key(img.dataset.imageUrl) === (job.key || this.key(job.url))));
      return job.generation === this.generation && job.images.size;
    });
    this.visible = new Set([...this.visible].filter(img => img.isConnected));
    const images = new Set(root.querySelectorAll('img[data-image-url]'));
    for (const img of this.observed.keys()) {
      if (images.has(img)) continue;
      this.observer.unobserve(img);
      this.observed.delete(img);
      this.visible.delete(img);
    }
    images.forEach(img => {
      const key = this.key(img.dataset.imageUrl);
      const changed = this.observed.get(img) !== key;
      if (this.cached(img.dataset.imageUrl) || changed && this.visible.has(img)) this.enqueue(img, false);
      if (!this.observed.has(img)) this.observer.observe(img);
      this.observed.set(img, key);
    });
    this.drain();
    this.updateCurrent(root);
    this.evict();
  },
  enqueue(img, drain = true) {
    const url = img.dataset.imageUrl;
    const key = this.key(url);
    if (this.cache.has(key)) {
      const entry = this.cache.get(key);
      this.cache.delete(key);
      this.cache.set(key, entry);
      this.reveal(img, entry.blobUrl);
      return;
    }
    const pending = this.activeJobs.get(key) ||
      this.queue.find(job => (job.key || this.key(job.url)) === key &&
        job.generation === this.generation);
    if (pending) { pending.images.add(img); pending.url = url; return; }
    this.queue.push({ images: new Set([img]), url, key, generation: this.generation });
    if (drain) this.drain();
  },
  async drain() {
    if (!this.queue.length || this.active >= 4) return;
    const bounds = main.getBoundingClientRect();
    // Fetch pixels in the viewport before the surrounding prefetch area.
    const inViewport = job => [...job.images].some(img => {
      if (!img.isConnected || !this.visible.has(img)) return false;
      const rect = img.getBoundingClientRect();
      return rect.bottom > bounds.top && rect.top < bounds.bottom;
    });
    const foreground = [], prefetch = [];
    for (const job of this.queue) (inViewport(job) ? foreground : prefetch).push(job);
    this.queue = [...foreground, ...prefetch];
    while (this.active < 4 && this.queue.length) {
      const job = this.queue.shift();
      if (job.generation !== this.generation ||
          ![...job.images].some(img => img.isConnected && this.visible.has(img) &&
            this.key(img.dataset.imageUrl) === (job.key || this.key(job.url)))) continue;
      this.active++;
      let key = job.key || this.key(job.url);
      this.activeJobs.set(key, job);
      const controller = new AbortController();
      this.controllers.add(controller);
      (async () => {
        let requestedUrl = job.url;
        let releasePixels;
        try {
          let renewed = false;
          const recover = async () => {
            renewed = true;
            const url = await sankakuMediaRecovery.recover(job.images, requestedUrl, controller.signal);
            if (!url || controller.signal.aborted || job.generation !== this.generation) return false;
            const previousKey = key;
            for (const img of job.images)
              if (this.key(img.dataset.imageUrl) === previousKey) img.dataset.imageUrl = url;
            job.url = requestedUrl = url;
            job.key = key = this.key(url);
            if (this.activeJobs.get(previousKey) === job) this.activeJobs.delete(previousKey);
            this.activeJobs.set(key, job);
            return true;
          };
          if (CatalogLogic.signedMediaExpired(requestedUrl)) await recover();
          if (controller.signal.aborted || job.generation !== this.generation) return;
          const priority = [...job.images].some(img => img.closest?.('.detail-image')) ? 'foreground' : undefined;
          let blob;
          try { blob = await readMediaBlob(requestedUrl, controller.signal, { priority }); }
          catch (error) {
            if (error.name === 'AbortError' || renewed || !await recover()) throw error;
            blob = await readMediaBlob(requestedUrl, controller.signal, { priority });
          }
          if (controller.signal.aborted || job.generation !== this.generation) return;
          const matches = [...job.images].filter(img => img.isConnected && this.visible.has(img) &&
            this.key(img.dataset.imageUrl) === key);
          if (!matches.length) return;
          // The feed, viewer preparation and modal share one URL and decoder.
          // A late feed completion must never replace/revoke another owner's
          // already visible cache entry, including while its decode is pending.
          releasePixels = this.pin(requestedUrl);
          controller.signal.addEventListener('abort', releasePixels, { once: true });
          const entry = this.rememberBlob(requestedUrl, blob);
          if (typeof Image === 'function') {
            try { await this.decode(entry); }
            catch { throw new Error('Image decode failed'); }
          }
          if (controller.signal.aborted || job.generation !== this.generation) return;
          const activeMatches = matches.filter(img => img.isConnected && this.visible.has(img) &&
            this.key(img.dataset.imageUrl) === key);
          if (!activeMatches.length) return;
          for (const img of activeMatches) {
            this.reveal(img, entry.blobUrl, true);
          }
          this.updateCurrent(main);
          this.evict();
        } catch (error) {
          if (error.name !== 'AbortError' && job.url !== requestedUrl &&
              !job.retried && job.generation === this.generation) {
            job.retried = true;
            this.queue.push(job);
          } else if (error.name !== 'AbortError')
            for (const img of job.images)
              if (img.isConnected && this.key(img.dataset.imageUrl) === key &&
                  !img.getAttribute('src'))
                img.closest('.card-art, .detail-image')?.classList.add('failed');
        } finally {
          if (releasePixels) {
            controller.signal.removeEventListener('abort', releasePixels);
            releasePixels();
          }
          this.controllers.delete(controller);
          if (this.activeJobs.get(key) === job) this.activeJobs.delete(key);
          this.active--;
          this.drain();
        }
      })();
    }
  },
  evict() {
    if (this.bytes <= 48 * 1024 * 1024) return;
    for (const [url, entry] of this.cache) {
      if (this.bytes <= 48 * 1024 * 1024) break;
      if (this.current.has(url) || this.pinned.has(url)) continue;
      URL.revokeObjectURL(entry.blobUrl);
      this.cache.delete(url);
      this.bytes -= entry.size;
    }
  }
};

const autoFeed = {
  observer: null, marker: null, margin: '', tabId: null,
  lastTop: 0, lastAt: 0, speed: 0,
  intersect(entries) {
    for (const entry of entries) {
      if (!entry.isIntersecting || entry.target.isConnected === false) continue;
      const tab = currentTab();
      // Returning to the same scroll position is not a request for another
      // page. Keep the existing buffer; resume lookahead on actual scrolling.
      // A short/empty page still fills the visible viewport automatically.
      if (tab?.resumePrefetchAt !== undefined &&
          Math.abs(main.scrollTop - tab.resumePrefetchAt) < 8 &&
          main.scrollHeight - main.scrollTop > main.clientHeight * 1.25) continue;
      if (!tab || tab.id !== Number(entry.target.dataset.tabId) ||
          (entry.target.dataset.autoLoad === 'related'
            ? tab.relatedLoading || !tab.relatedHasMore || tab.relatedError
            : entry.target.dataset.autoLoad === 'follows'
              ? tab.loading || tab.followLoadingMore || !tab.hasMore || tab.followLoadError
            : tab.loading || !tab.hasMore || tab.loadError)) continue;
      autoFeed.observer.unobserve(entry.target);
      this.marker = null;
      void this.load(tab, entry.target.dataset.autoLoad);
    }
  },
  async load(tab, kind) {
    const started = Date.now();
    try {
      if (kind === 'profile') await loadProfile(tab, true);
      else if (kind === 'related') await loadRelated(tab, true);
      else if (kind === 'recommendations') await loadRecommendations(tab, true);
      else if (kind === 'follows') await loadMoreFollows(tab);
      else await loadSearch(tab, true);
    } finally {
      const elapsed = Math.max(250, Math.min(15000, Date.now() - started));
      tab.feedLoadMs = tab.feedLoadMs ? (tab.feedLoadMs + elapsed) / 2 : elapsed;
      if (currentTab()?.id === tab.id) this.mount();
    }
  },
  mount() {
    const tab = currentTab();
    if (tab?.resumePrefetchAt !== undefined && Math.abs(main.scrollTop - tab.resumePrefetchAt) >= 8) {
      delete tab.resumePrefetchAt;
      this.marker = null;
    }
    const now = Date.now();
    if (this.tabId !== tab?.id) {
      this.tabId = tab?.id;
      this.lastTop = main.scrollTop || 0;
      this.lastAt = now;
      this.speed = 0;
    } else {
      const delta = (main.scrollTop || 0) - this.lastTop;
      const elapsed = now - this.lastAt;
      if (delta > 0)
        this.speed = Math.max(this.speed * 0.65, delta / Math.max(16, elapsed));
      else if (delta < 0 || elapsed > 1200) this.speed = 0;
      this.lastTop = main.scrollTop || 0;
      this.lastAt = now;
    }
    const height = Math.max(600, main.clientHeight || 900);
    // Keep two screens ready; faster scrolling and slower replies increase the lead.
    const screens = Math.min(6, Math.max(2,
      Math.ceil(2 + this.speed * (tab?.feedLoadMs || 2500) / height)));
    const margin = `0px 0px ${screens * height}px 0px`;
    if (!this.observer || margin !== this.margin) {
      this.observer?.disconnect();
      this.observer = new IntersectionObserver(entries => this.intersect(entries),
        { root: main, rootMargin: margin });
      this.margin = margin;
      this.marker = null;
    }
    const marker = main.querySelector('[data-auto-load]');
    if (marker === this.marker) return;
    this.observer.disconnect();
    this.marker = marker;
    if (marker) this.observer.observe(marker);
  }
};

let virtualScrollPending = false;
main.addEventListener('load', event => {
  if (!event.target.matches?.('img[data-image-url]')) return;
  rememberCardFingerprint(event.target);
  rememberImageDimensions(event.target);
  if (event.target.matches?.('.profile-page .grid .card img[data-image-url]')) {
    const tab = currentTab();
    if (tab?.kind === 'profile') scheduleProfileBanner(tab);
  }
}, true);
main.addEventListener('error', event => {
  if (event.target.matches?.('video[data-video-url]'))
    event.target.parentElement.classList.add('failed');
}, true);
main.addEventListener('playing', event => {
  if (event.target.matches?.('video[data-video-url]'))
    event.target.parentElement.classList.remove('failed');
}, true);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pauseDetailVideos();
    quickPreview.querySelectorAll('video').forEach(video => video.pause());
  }
  recommendationExposureTracker.refresh(true);
  if (document.hidden) flushRecommendationExposure();
});

main.addEventListener('scroll', () => {
  const tab = currentTab();
  if (!tab || main.dataset.tabId !== String(tab.id)) return;
  tab.scrollTop = main.scrollTop;
  if (tab.kind === 'profile') scheduleProfileBanner(tab);
  if (virtualScrollPending) return;
  virtualScrollPending = true;
  requestAnimationFrame(() => {
    virtualScrollPending = false;
    if (currentTab() !== tab) return;
    groupRepairs.scan();
    autoFeed.mount();
    if (typeof transferredMediaHydration !== 'undefined') transferredMediaHydration.scan();
    if (expireRetainedFeedWorks(tab)) {
      const bounds = main.getBoundingClientRect();
      const anchor = [...main.querySelectorAll('.card[data-work-key]')]
        .find(card => {
          const rect = card.getBoundingClientRect();
          return rect.bottom > bounds.top && rect.top < bounds.bottom;
        });
      const anchorKey = anchor?.dataset.workKey;
      const anchorTop = anchor?.getBoundingClientRect().top;
      render();
      const nextAnchor = [...main.querySelectorAll('.card[data-work-key]')]
        .find(card => card.dataset.workKey === anchorKey);
      if (nextAnchor && anchorTop !== undefined)
        main.scrollTop += nextAnchor.getBoundingClientRect().top - anchorTop;
    }
    for (const [key, state] of Object.entries(tab.virtualState || {})) {
      const top = tab.gridTops?.[key];
      if (top === undefined) continue;
      const row = Math.max(0, Math.min(state.totalRows - 1,
        Math.floor((main.scrollTop - top) / state.pitch)));
      if (state.startRow > 0 && row < state.startRow + 2 ||
          state.endRow < state.totalRows && row > state.endRow - state.visibleRows - 2) {
        render();
        break;
      }
    }
    if (typeof recommendationExposureTracker !== 'undefined' && !recommendationExposureTracker.observerSupported)
      recommendationExposureTracker.refresh();
  });
});
window.addEventListener('resize', () => {
  const tab = currentTab();
  if (tab?.virtualState) tab.virtualState = {};
  if (tab) render();
});
new ResizeObserver(() => alignTabStrip(true)).observe(tabsNode);

const recommendationExposureTracker = DartRecommendationExposure.createTracker({
  root: main,
  getSession: () => {
    const tab = currentTab();
    return tab?.kind === 'recommendations' && main.dataset.tabId === String(tab.id) ? tab : null;
  },
  getGeneration: tab => tab.recommendationSeed,
  getKeys: card => [card.dataset.workKey, ...workMemberKeys(card)],
  isVisible: () => !document.hidden && !quickPreview.open,
  onExpose: rememberRecommendationExposure
});
quickPreview.addEventListener('close', () => recommendationExposureTracker.refresh(true));

document.querySelectorAll('[data-icon]').forEach(node => node.innerHTML = svg(node.dataset.icon));
document.getElementById('back-button').innerHTML = svg('back');
document.getElementById('forward-button').innerHTML = svg('forward');
document.getElementById('menu-button').innerHTML = svg('menu');
document.getElementById('bookmarks-button').innerHTML = svg('bookmark');
document.getElementById('likes-button').innerHTML = svg('heart');
document.getElementById('settings-button').innerHTML = svg('settings');

document.getElementById('new-tab-button').addEventListener('click', () => createTab('home', 'Главная', {}, { forceNew: true }));
document.getElementById('tab-list-button').addEventListener('click', toggleTabList);
tabListPanel.querySelector('input').addEventListener('input', renderTabList);
tabListPanel.addEventListener('click', event => {
  // A close button is detached during rendering; its click must stay inside the panel.
  event.stopPropagation();
  const close = event.target.closest('[data-tab-list-close]');
  if (close) { changeTabsFromList(() => closeTab(Number(close.dataset.tabListClose))); return; }
  if (event.target.closest('[data-tab-list-close-lists]')) { changeTabsFromList(closeSearchAndProfileTabs); return; }
  if (event.target.closest('[data-tab-list-clear]')) {
    changeTabsFromList(clearTabs, true); return;
  }
  const selected = event.target.closest('[data-tab-select]');
  if (selected) { activate(Number(selected.dataset.tabSelect)); hideTabPanels(); }
  if (event.target.closest('[data-tab-list-dismiss]')) hideTabPanels();
});
tabListPanel.querySelector('input').addEventListener('keydown', event => {
  if (event.key === 'Enter') tabListPanel.querySelector('[data-tab-select]')?.click();
  else if (event.key === 'ArrowDown') { event.preventDefault(); tabListPanel.querySelector('[data-tab-select]')?.focus(); }
});
tabContextMenu.addEventListener('click', event => {
  const control = event.target.closest('[data-tab-menu]');
  if (!control) return;
  const id = Number(control.dataset.tabId);
  const action = control.dataset.tabMenu;
  hideTabPanels();
  if (action === 'pin') pinTab(id, !findTab(id)?.pinned);
  else if (action === 'close') closeTab(id);
  else closeOtherTabs(id, action);
});
document.getElementById('back-button').addEventListener('click', () => travel(-1));
document.getElementById('forward-button').addEventListener('click', () => travel(1));
document.getElementById('menu-button').addEventListener('click', () => document.getElementById('sidebar').classList.toggle('collapsed'));
document.getElementById('brand-button').addEventListener('click', () => createTab('home', 'Главная'));
document.getElementById('bookmarks-button').addEventListener('click', () => createTab('bookmarks', 'Закладки'));
document.getElementById('likes-button').addEventListener('click', () => createTab('likes', 'Понравившиеся'));
document.getElementById('settings-button').addEventListener('click', () => openSettings());

tabsNode.addEventListener('click', event => {
  const pin = event.target.closest('[data-pin]');
  if (pin) { pinTab(Number(pin.dataset.pin), !findTab(Number(pin.dataset.pin))?.pinned); return; }
  const close = event.target.closest('[data-close]');
  if (close) { closeTab(Number(close.dataset.close)); return; }
  const tab = event.target.closest('[data-tab]');
  if (tab) activate(Number(tab.dataset.tab));
});
tabsNode.addEventListener('dblclick', event => {
  if (event.target.closest('button')) return;
  const tab = event.target.closest('[data-tab]');
  if (tab) pinTab(Number(tab.dataset.tab));
});
tabsNode.addEventListener('contextmenu', event => {
  const tab = event.target.closest('[data-tab]');
  if (!tab) return;
  event.preventDefault();
  showTabContextMenu(Number(tab.dataset.tab), event.clientX, event.clientY);
});
tabsNode.addEventListener('auxclick', event => {
  if (event.button !== 1) return;
  const tab = event.target.closest('[data-tab]');
  if (tab) { event.preventDefault(); closeTab(Number(tab.dataset.tab)); }
});
tabsNode.addEventListener('keydown', event => {
  const tabNode = event.target.closest('[data-tab]');
  if (!tabNode || !['ArrowLeft', 'ArrowRight', 'Delete'].includes(event.key)) return;
  event.preventDefault();
  const index = tabs.findIndex(tab => tab.id === Number(tabNode.dataset.tab));
  if (event.key === 'Delete') { closeTab(tabs[index].id); return; }
  const next = tabs[index + (event.key === 'ArrowLeft' ? -1 : 1)];
  if (next) {
    activate(next.id);
    tabsNode.querySelector(`[data-tab="${next.id}"]`)?.focus();
  }
});

document.getElementById('sidebar').addEventListener('click', event => {
  const kind = event.target.closest('[data-nav]')?.dataset.nav;
  if (kind === 'home') createTab('home', 'Главная');
  else if (kind === 'search') openSearch('');
  else if (kind === 'adult') openSearch('', { rating: 'explicit' });
  else if (kind === 'recommendations') createTab('recommendations', 'Рекомендации');
  else if (kind === 'follows') createTab('follows', 'Подписки');
  else if (kind === 'bookmarks') createTab('bookmarks', 'Закладки');
  else if (kind === 'favorites') createTab('favorites', 'Favorites', { rating: currentTab()?.rating || 'all' });
  else if (kind === 'likes') createTab('likes', 'Понравившиеся');
  else if (kind === 'recent') createTab('recent', 'Недавно открытое');
  else if (kind === 'settings') openSettings();
});

document.getElementById('search-form').addEventListener('submit', event => {
  event.preventDefault();
  openSearch(searchInput.value, currentSearchOptions());
});
searchInput.addEventListener('focus', showPopover);
searchInput.addEventListener('input', () => {
  const tab = currentTab();
  if (tab) tab.searchDraft = { query: tab.kind === 'detail' ? '' : tab.query || '', value: searchInput.value };
  showPopover();
});
// Mouse ownership follows the real pointer across the modal and sidebar. The
// modal makes main inert and fires pointerleave without moving the mouse;
// tracking main alone either loses its position or retains an obsolete one.
document.addEventListener('pointermove', event => {
  if (event.pointerType === 'mouse') quickPreviewPointer = { x: event.clientX, y: event.clientY };
});
document.addEventListener('pointerleave', event => {
  // Coordinates outside the document intentionally have no artwork target.
  // Null is reserved for Tab's explicit handover to keyboard focus.
  if (event.pointerType === 'mouse') quickPreviewPointer = { x: event.clientX, y: event.clientY };
});
let artworkLikeFeedback = null;
let artworkLikeFeedbackTimer = null;
function showArtworkLikeFeedback(event) {
  if (!Number.isFinite(event?.clientX) || !Number.isFinite(event?.clientY)) return;
  clearTimeout(artworkLikeFeedbackTimer);
  artworkLikeFeedback?.remove();
  const heart = document.createElement('span');
  heart.className = 'artwork-like-feedback';
  heart.setAttribute('aria-hidden', 'true');
  heart.innerHTML = svg('heart');
  let x = event.clientX, y = event.clientY;
  // The top layer keeps the heart above modal previews without stealing focus.
  if (typeof heart.showPopover === 'function') {
    heart.setAttribute('popover', 'manual');
    document.body.append(heart);
    heart.showPopover();
  } else {
    const host = quickPreview.open ? quickPreview : document.body;
    if (host === quickPreview) {
      const bounds = host.getBoundingClientRect();
      heart.style.position = 'absolute';
      x = (x - bounds.left) * host.offsetWidth / bounds.width - host.clientLeft;
      y = (y - bounds.top) * host.offsetHeight / bounds.height - host.clientTop;
    }
    host.append(heart);
  }
  heart.style.left = `${x}px`;
  heart.style.top = `${y}px`;
  artworkLikeFeedback = heart;
  artworkLikeFeedbackTimer = setTimeout(() => {
    heart.remove();
    if (artworkLikeFeedback === heart) {
      artworkLikeFeedback = null;
      artworkLikeFeedbackTimer = null;
    }
  }, 1000);
}
const artworkImageGestures = DartArtworkGestures.create({
  resolve(event) {
    const tab = currentTab();
    if (quickPreview.open) {
      if (!event.target.matches?.('img.quick-preview-image') || !quickPreviewWork) return null;
      const generation = quickPreviewGeneration;
      return { item: quickPreviewWork, context: quickPreview, target: generation,
        valid: () => quickPreview.open && quickPreviewGeneration === generation };
    }
    if (!tab || !main.contains(event.target)) return null;
    const control = event.target.closest?.('button.card-art[data-action="open"], .detail-image img[data-action="zoom-image"]');
    if (!control || control.matches('button') && !control.querySelector('img[data-image-url]')) return null;
    const detail = control.dataset.action === 'zoom-image';
    const item = detail ? tab.item : itemForControl(control);
    if (!item) return null;
    const artwork = detail && quickPreviewArtworkAt(control, tab, itemIndex);
    return { item, context: tab, target: `${control.dataset.action}:${item.key}:${control.dataset.imageUrl || ''}`,
      valid: () => currentTab() === tab && !quickPreview.open,
      single: () => detail ? artwork && openQuickPreview(artwork, 'fullscreen') : openDetail(item, { origin: control }) };
  },
  like: (item, event) => {
    showArtworkLikeFeedback(event);
    void toggleSavedWork(item, 'likes', true);
  }
});
document.addEventListener('pointerdown', event => artworkImageGestures.pointerdown(event), true);
document.addEventListener('pointermove', event => artworkImageGestures.pointermove(event), true);
for (const type of ['keydown', 'pointercancel', 'dragstart', 'contextmenu'])
  document.addEventListener(type, () => artworkImageGestures.cancel(), true);
window.addEventListener('blur', () => artworkImageGestures.cancel());
main.addEventListener('scroll', () => artworkImageGestures.cancel());
for (const surface of [main, quickPreview]) {
  surface.addEventListener('click', event => {
    if (artworkImageGestures.click(event)) event.stopImmediatePropagation();
  }, true);
  surface.addEventListener('dblclick', event => {
    if (artworkImageGestures.dblclick(event)) event.stopImmediatePropagation();
  }, true);
}
quickPreview.addEventListener('cancel', event => {
  event.preventDefault();
  closeQuickPreview();
});
quickPreview.addEventListener('wheel', event => {
  if (!quickPreview.open) return;
  if (!recommendationTagMenu.hidden || event.target.closest?.('input, textarea, select, [contenteditable], [role="slider"]')) return;
  const stage = quickPreview.querySelector('.quick-preview-stage');
  if (!stage) return;
  const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? stage.clientHeight : 1);
  const action = DartPreviewGallery.wheelMode({ length: quickPreviewGallery?.state.length || 1,
    scale: quickPreviewView.scale, ctrlKey: event.ctrlKey || event.metaKey, video: !!stage.querySelector('video') });
  if (action === 'native') return;
  event.preventDefault();
  if (action === 'page') {
    const direction = quickPreviewGalleryWheel?.(delta, performance.now());
    if (direction) moveQuickPreviewGallery(direction);
  } else if (action === 'pan') {
    quickPreviewView = { ...quickPreviewView,
      x: quickPreviewView.x - event.deltaX * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? stage.clientWidth : 1),
      y: quickPreviewView.y - delta };
    paintQuickPreview(true);
  } else zoomQuickPreview(quickPreviewView.scale * Math.exp(-delta * 0.0015), event.clientX, event.clientY);
}, { passive: false });
quickPreview.addEventListener('pointerdown', event => {
  const stage = event.target.closest?.('.quick-preview-stage');
  if (!stage || event.target.closest?.('button') || ![0, 1].includes(event.button)) return;
  if (event.button === 1) event.preventDefault();
  if (quickPreview.querySelector('video') || quickPreviewView.scale <= 1 || quickPreviewDrag) return;
  event.preventDefault();
  quickPreviewDrag = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY,
    x: quickPreviewView.x, y: quickPreviewView.y, moved: false };
});
quickPreview.addEventListener('pointermove', event => {
  if (!quickPreviewDrag || event.pointerId !== quickPreviewDrag.pointerId) return;
  if (!quickPreviewDrag.moved) {
    if (Math.hypot(event.clientX - quickPreviewDrag.clientX, event.clientY - quickPreviewDrag.clientY) <= 8) return;
    quickPreviewDrag.moved = true;
    event.target.closest?.('.quick-preview-stage')?.setPointerCapture(event.pointerId);
  }
  quickPreviewView = { ...quickPreviewView,
    x: quickPreviewDrag.x + event.clientX - quickPreviewDrag.clientX,
    y: quickPreviewDrag.y + event.clientY - quickPreviewDrag.clientY };
  paintQuickPreview(true);
});
function stopQuickPreviewDrag(event) {
  if (!quickPreviewDrag || event.pointerId !== quickPreviewDrag.pointerId) return;
  quickPreviewDrag = null;
  const stage = quickPreview.querySelector('.quick-preview-stage');
  if (stage?.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
  paintQuickPreview(true);
}
quickPreview.addEventListener('pointerup', stopQuickPreviewDrag);
quickPreview.addEventListener('pointercancel', stopQuickPreviewDrag);
quickPreview.addEventListener('lostpointercapture', stopQuickPreviewDrag);
quickPreview.addEventListener('auxclick', event => {
  if (event.button === 1 && event.target.closest?.('.quick-preview-stage')) event.preventDefault();
});
quickPreview.addEventListener('click', event => {
  const previewAction = event.target.closest?.('button[data-preview-action]')?.dataset.previewAction;
  if (previewAction) {
    if (previewAction === 'close') closeQuickPreview();
    else if (previewAction === 'gallery-previous') moveQuickPreviewGallery(-1);
    else if (previewAction === 'gallery-next') moveQuickPreviewGallery(1);
    else if (previewAction === 'gallery-retry') void quickPreviewGallery?.retry();
    else if (previewAction === 'fit') zoomQuickPreviewFromCenter(1);
    else if (previewAction === 'zoom-in') zoomQuickPreviewFromCenter(quickPreviewView.scale * 1.5);
    else if (previewAction === 'zoom-out') zoomQuickPreviewFromCenter(quickPreviewView.scale / 1.5);
    else if (previewAction === 'retry') openQuickPreview({ item: quickPreviewWork,
      url: quickPreview.querySelector('video').dataset.videoUrl, route: quickPreviewRoute }, quickPreview.classList.contains('fullscreen') ? 'fullscreen' : 'window');
    return;
  }
  const button = event.target.closest?.('button[data-action]');
  if (button && quickPreviewWork) {
    if (button.dataset.action === 'like') void toggleSavedWork(quickPreviewWork, 'likes');
    if (button.dataset.action === 'bookmark') void toggleSavedWork(quickPreviewWork, 'bookmarks');
    if (button.dataset.action === 'artwork-more') openContentContextMenu({...contentContextTarget(button),mediaUrl:quickPreview.querySelector('.quick-preview-image')?.dataset.imageUrl||quickPreview.querySelector('.quick-preview-image')?.dataset.videoUrl,mediaElement:quickPreview.querySelector('.quick-preview-image')},0,0);
  } else if (event.target === quickPreview) {
    const bounds = quickPreview.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom) closeQuickPreview();
  } else if (quickPreview.classList.contains('fullscreen') && quickPreviewView.scale === 1 &&
      event.target === quickPreview.querySelector('.quick-preview-stage')) {
    closeQuickPreview();
  }
});
document.addEventListener('keydown', event => {
  const tab = currentTab();
  if (!quickPreview.open && tab?.kind !== 'detail') return;
  const dialog = document.querySelector('dialog[open]');
  const blocked = dialog && dialog !== quickPreview || !tabListPanel.hidden ||
    !tabContextMenu.hidden || !recommendationTagMenu.hidden || !popover.hidden ||
    document.activeElement?.closest?.('.tabs-bar');
  const focused = document.activeElement;
  // Native video controls retain Space, volume and playback keys. Artwork
  // shortcuts must still work after interacting with the modal player.
  const shortcutFocus = quickPreview.open && focused?.tagName === 'VIDEO' && quickPreview.contains(focused)
    ? null : focused;
  const action = DartArtworkNavigation.shortcut(event, shortcutFocus, blocked);
  if (!action) return;
  const route = quickPreview.open ? quickPreviewRoute : tab.artworkRoute;
  if (!route || event.repeat && route.engine.state.busy) return;
  event.preventDefault(); event.stopImmediatePropagation();
  if (action === 'like') void toggleSavedWork(quickPreview.open ? quickPreviewWork : tab.item, 'likes');
  else if (action === 'bookmark') void toggleSavedWork(quickPreview.open ? quickPreviewWork : tab.item, 'bookmarks');
  else void moveArtwork(action === 'previous' ? -1 : 1);
}, true);

document.addEventListener('keydown', event => {
  // Tab explicitly hands selection to keyboard focus. A later mouse movement
  // hands it back to the artwork currently under the pointer.
  if (event.key === 'Tab') quickPreviewPointer = null;
  const space = event.code === 'Space' || event.key === ' ';
  if (space && quickPreviewSpaceHeld) {
    event.preventDefault(); event.stopImmediatePropagation(); return;
  }
  if (quickPreview.open) {
    if(!recommendationTagMenu.hidden)return;
    const galleryDirection = typeof quickPreviewGallery !== 'undefined' && quickPreviewGallery &&
      DartPreviewGallery.shortcut(event, document.activeElement);
    if (galleryDirection) {
      event.preventDefault(); event.stopImmediatePropagation();
      moveQuickPreviewGallery(galleryDirection);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeQuickPreview();
    } else if (space) {
      if (event.target.closest?.('button') || !quickPreviewShortcutAllowed(event, event.target)) return;
      quickPreviewSpaceHeld = true;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!event.repeat) closeQuickPreview();
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      zoomQuickPreviewFromCenter(quickPreviewView.scale * 1.5);
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      zoomQuickPreviewFromCenter(quickPreviewView.scale / 1.5);
    } else if (event.key === '0') {
      event.preventDefault();
      zoomQuickPreviewFromCenter(1);
    }
    return;
  }
  const focusedImage = document.activeElement;
  if (space) {
    if (!quickPreviewShortcutAllowed(event, focusedImage) || document.querySelector('dialog[open]') ||
        !tabListPanel.hidden || !tabContextMenu.hidden || !recommendationTagMenu.hidden) return;
    const target = quickPreviewPointer
      ? document.elementFromPoint(quickPreviewPointer.x, quickPreviewPointer.y) : focusedImage;
    const artwork = target && main.contains(target)
      ? quickPreviewArtworkAt(target, currentTab(), itemIndex) : null;
    if (!artwork) {
      // Moving off an artwork must not activate the old card merely because
      // closing its preview restored focus there.
      if (quickPreviewPointer && focusedImage?.matches?.('button.card-art[data-action="open"]')) {
        event.preventDefault(); event.stopImmediatePropagation();
      }
      return;
    }
    event.preventDefault(); event.stopImmediatePropagation();
    quickPreviewSpaceHeld = true;
    openQuickPreview(artwork);
    return;
  }
  if (event.key === 'Enter' && !event.repeat && focusedImage?.matches?.('.detail-image img[data-image-url]')) {
    const artwork = quickPreviewArtworkAt(focusedImage, currentTab(), itemIndex);
    if (artwork) {
      event.preventDefault(); event.stopImmediatePropagation();
      openQuickPreview(artwork, 'fullscreen');
    }
  }
}, true);
document.addEventListener('keyup', event => {
  if (!quickPreviewSpaceHeld || event.code !== 'Space' && event.key !== ' ') return;
  quickPreviewSpaceHeld = false;
  event.preventDefault(); event.stopImmediatePropagation();
}, true);
window.addEventListener('blur', () => { quickPreviewSpaceHeld = false; });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && (!tabListPanel.hidden || !tabContextMenu.hidden)) {
    event.preventDefault(); hideTabPanels(); document.getElementById('tab-list-button').focus(); return;
  }
  if (handleSelectedTagEnter(event)) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    searchInput.focus();
    searchInput.select();
    showPopover();
  } else if (event.key === 'Escape' && (!popover.hidden ||
      document.activeElement === searchInput && tagSuggestionTerm)) {
    hidePopover();
    searchInput.focus();
  }
});
document.addEventListener('click', event => {
  if (!event.target.closest('.tab-list-panel, .tab-context-menu, #tab-list-button')) hideTabPanels();
  if (!event.target.closest('.search-form')) hidePopover();
});

function currentSearchOptions() {
  const tab = currentTab();
  if (tab?.kind === 'favorites' && tab.favoriteType !== 'artwork') return { rating: 'all' };
  return tab?.kind === 'search'
    ? { rating: tab.rating, selectedSources: [...tab.selectedSources],
        sort: tab.sort, feed: tab.feed }
    : { rating: tab?.rating === 'explicit' ? 'explicit' : 'all' };
}

function selectedArtworkTagQuery(tab) {
  return CatalogLogic.normalizeSearch((tab.selectedTags || [])
    .map(tag => String(tag).trim().replace(/\s+/g, '_')).join(' '));
}

function runSelectedTagSearch(tab) {
  const query = selectedArtworkTagQuery(tab);
  if (!query) return;
  openSearch(query, { ...currentSearchOptions(), temporary: tab.kind === 'detail' });
}

function handleArtworkTagClick(event, control, tab) {
  if (tab?.kind !== 'detail' || !control.matches('.tag-link[data-action="query"]')) return false;
  const tag = control.dataset.query;
  if (event.ctrlKey && event.button === 0) {
    event.preventDefault();
    const selected = tab.selectedTags || [];
    const next = selected.includes(tag) ? selected.filter(value => value !== tag) : [...selected, tag];
    if (selectedArtworkTagQuery({ selectedTags: next }).length > 200) {
      toast('Слишком длинная комбинация тегов. Выберите меньше тегов.');
      return true;
    }
    tab.selectedTags = next;
    render();
    return true;
  }
  if ((tab.selectedTags || []).includes(tag)) {
    event.preventDefault();
    runSelectedTagSearch(tab);
    return true;
  }
  return false;
}

function handleSelectedTagEnter(event) {
  if (event.key !== 'Enter' || event.defaultPrevented || event.isComposing || event.repeat ||
      event.ctrlKey || event.altKey || event.metaKey) return false;
  const tab = currentTab();
  if (tab?.kind !== 'detail' || !tab.selectedTags?.length) return false;
  const target = event.target;
  if (target.isContentEditable || target.closest('input, textarea, select, [contenteditable], .search-form') ||
      target.closest('button, a') && !target.closest('.tag-list')) return false;
  event.preventDefault();
  runSelectedTagSearch(tab);
  return true;
}

function activeTagTerm() {
  if (/[\s,]$/.test(searchInput.value)) return '';
  return CatalogLogic.normalizeSearch(searchInput.value).split(' ').at(-1) || '';
}

function renderPopover() {
  const typed = CatalogLogic.normalizeSearch(searchInput.value);
  const history = getSearchHistory().filter(entry => !typed || entry.toLowerCase().includes(typed)).slice(0, 6);
  popover.innerHTML = `${history.length ? '<div class="popover-title">Недавние запросы</div>' + history.map(entry => `<div class="popover-history-row"><button type="button" class="popover-row popover-history-query" data-query="${escapeHtml(entry)}" data-no-i18n>${escapeHtml(entry)}</button><button type="button" class="popover-history-remove" data-history-remove="${escapeHtml(entry)}" title="Remove from recent searches" aria-label="Remove from recent searches"><span aria-hidden="true">×</span></button></div>`).join('') : ''}
    ${tagSuggestions.length ? `<div class="popover-title">Теги</div>${tagSuggestions.map(tag => `<button type="button" class="popover-row tag-suggestion" data-tag="${escapeHtml(tag.name)}"><span data-no-i18n>#${escapeHtml(tag.name.replaceAll('_', ' '))}</span><span class="popover-muted" title="Число записей в каталогах до объединения, проверки доступности и применения фильтров.">${tag.sources.map(source => escapeHtml(names[source] || source)).join(' · ')} · ${Number(tag.count).toLocaleString(globalThis.DartI18n?.locale || 'en-US')}</span></button>`).join('')}` : ''}
    ${favoriteTags.length ? `<div class="popover-title" style="margin-top:12px">Избранные теги</div>${favoriteTags.filter(tag => !typed || tag.includes(typed)).slice(0, 5).map(tag => `<button type="button" class="popover-row" data-context-tag="${escapeHtml(tag)}" data-query="${escapeHtml(tag)}"><span data-no-i18n>#${escapeHtml(tag)}</span> <span class="popover-muted">избранное</span></button>`).join('')}` : ''}`;
  popover.hidden = !popover.children.length;
}
function showPopover() {
  const term = activeTagTerm();
  if (term !== tagSuggestionTerm) {
    tagSuggestionTerm = term;
    tagSuggestions = [];
    tagSuggestionController?.abort();
    clearTimeout(tagSuggestionTimer);
    if (term.length >= 2) {
      tagSuggestionTimer = setTimeout(async () => {
        const controller = new AbortController();
        tagSuggestionController = controller;
        try {
          const suggestions = await request(`/api/tags?q=${encodeURIComponent(term)}`,
            { signal: controller.signal });
          if (tagSuggestionTerm === term && !controller.signal.aborted &&
              activeTagTerm() === term) {
            tagSuggestions = suggestions;
            if (document.activeElement === searchInput) renderPopover();
          }
        } catch { /* Search still works when tag suggestions are unavailable. */ }
      }, 250);
    }
  }
  renderPopover();
}
function hidePopover() {
  popover.hidden = true;
  clearTimeout(tagSuggestionTimer);
  tagSuggestionController?.abort();
  tagSuggestionTerm = '';
  tagSuggestions = [];
}
popover.addEventListener('click', event => {
  const remove = event.target.closest('[data-history-remove]');
  if (remove) {
    event.preventDefault(); event.stopPropagation();
    const query = remove.dataset.historyRemove;
    const controls = [...popover.querySelectorAll('[data-history-remove]')];
    const position = controls.findIndex(control => control.dataset.historyRemove === query);
    if (!removeSearchHistory(query)) return;
    renderPopover();
    const remaining = [...popover.querySelectorAll('[data-history-remove]')];
    (remaining[Math.max(0, Math.min(position, remaining.length - 1))] || searchInput).focus({ preventScroll: true });
    return;
  }
  const tag = event.target.closest('[data-tag]')?.dataset.tag;
  if (tag) { openSearch(CatalogLogic.completeTag(searchInput.value, tag), currentSearchOptions()); return; }
  const query = event.target.closest('[data-query]')?.dataset.query;
  if (query) openSearch(query, currentSearchOptions());
});

document.addEventListener('contextmenu', event => {
  const context = contentContextTarget(event.target);
  if (!context) { closeRecommendationTagMenu(); return; }
  event.preventDefault();
  openContentContextMenu(context, event.clientX, event.clientY);
});

document.addEventListener('keydown', event => {
  if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return;
  const context = contentContextTarget(event.target);
  if (!context) return;
  event.preventDefault();
  openContentContextMenu(context, 0, 0);
});

recommendationTagMenu.addEventListener('click', async event => {
  const rating = event.target.closest('[data-nsfw-rating]')?.dataset.nsfwRating;
  if (rating === 'q' || rating === 'e') {
    viewerPreferences = { ...viewerPreferences,
      nsfwRatings: { ...viewerPreferences.nsfwRatings, [rating]: !viewerPreferences.nsfwRatings[rating] } };
    closeRecommendationTagMenu(true);
    saveViewerPreferences();
    refreshNsfwTabs();
    main.querySelector(nsfwFilterSelector)?.focus({ preventScroll: true });
    return;
  }
  const action = event.target.closest('[data-context-action]')?.dataset.contextAction;
  const context = recommendationTagMenu.context;
  if (action && context) {
    closeRecommendationTagMenu(true);
    if (action === 'artwork-upscale') { void DartUpscale.open({ item: context.item, url: context.upscaleUrl }); return; }
    if (action === 'artwork-upscale-cancel') { DartUpscale.cancel(context.item, context.upscaleUrl); return; }
    if (action === 'artwork-upscale-restore') {
      if (DartUpscale.resultFor(context.item,context.upscaleUrl)?.visible) DartUpscale.restore(context.item,context.upscaleUrl);
      else DartUpscale.show(context.item,context.upscaleUrl); return;
    }
    if (action === 'artwork-upscale-download') { DartUpscale.download(context.item,context.upscaleUrl); return; }
    if(action==='artwork-group'){openFavoriteGroupPicker(context.item,context.trigger);return;}
    if(action==='artwork-ungroup'){const pack=favoriteGroupFor(context.item);if(pack)await favoriteGroupsController().ungroup(pack.groupId);return;}
    if (action?.startsWith('artwork-')) { await artworkActionsController().run(action.slice(8),context); return; }
    if (action === 'copy-value') { await artworkActionsController().run(action,context); return; }
    if (action === 'copy') await copyArtworkTags(context.item);
    else if (action === 'artwork-favorite') await favoritesController().toggleArtwork(context.item);
    else if (action === 'favorite') await toggleFavoriteTag(context.tag, !context.favorite);
    else if (context.kind === 'author') await setAuthorHidden(context.author, !context.hidden);
    else {
      const tag = CatalogLogic.normalizeExcludedTags([context.tag])[0];
      const excludedTags = context.hidden ? contentPreferences.excludedTags.filter(entry => entry !== tag)
        : [...new Set([...contentPreferences.excludedTags, tag])];
      if (excludedTags.length > 100) { toast('The hidden tag limit has been reached'); return; }
      await saveContentPreferences({ ...contentPreferences, excludedTags });
    }
    return;
  }
  const mode = event.target.closest('[data-tag-mode]')?.dataset.tagMode;
  const tag = recommendationTagMenu.tag;
  if (!mode || !tag) return;
  const previous = recommendationTagPreferences[tag] || 'normal';
  if (mode === 'normal') delete recommendationTagPreferences[tag];
  else recommendationTagPreferences[tag] = mode;
  closeRecommendationTagMenu();
  try { localStorage.setItem('artcatalog-recommendation-tag-preferences',
    JSON.stringify(recommendationTagPreferences)); } catch { /* Storage may be unavailable. */ }
  try { await saveRecommendationTagPreference(tag, mode); }
  catch {
    if (previous === 'normal') delete recommendationTagPreferences[tag];
    else recommendationTagPreferences[tag] = previous;
    toast('Не удалось сохранить настройку тега. Попробуйте ещё раз.');
  }
  for (const tab of tabs.filter(entry => entry.kind === 'recommendations')) {
    tab.recommendationController?.abort();
    tab.recommendationVersion = (tab.recommendationVersion || 0) + 1;
    if (tab.id === activeId) {
      tab.scrollTop = 0;
      main.scrollTop = 0;
      loadRecommendations(tab);
    } else tab.started = false;
  }
});

document.addEventListener('pointerdown', event => {
  if (!recommendationTagMenu.contains(event.target)) closeRecommendationTagMenu();
});
document.addEventListener('keydown', event => {
  if (recommendationTagMenu.hidden) return;
  if (event.key === 'Escape') { event.preventDefault(); closeRecommendationTagMenu(true); return; }
  if (event.key === 'Tab') { closeRecommendationTagMenu(); return; }
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const buttons = [...recommendationTagMenu.querySelectorAll('button:not(:disabled)')];
  const index = buttons.indexOf(document.activeElement);
  buttons[event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 :
    (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]
    ?.focus({ preventScroll: true });
});
function handleContentMenuScroll() {
  if(!recommendationTagMenu.hidden&&(main.scrollTop!==recommendationTagMenu.sourceScrollTop||main.scrollLeft!==recommendationTagMenu.sourceScrollLeft))
    closeRecommendationTagMenu();
}
main.addEventListener('scroll', handleContentMenuScroll);
main.addEventListener('toggle',event=>{if(event.target.matches?.('[data-hidden-artworks]')&&currentTab())currentTab().hiddenArtworksOpen=event.target.open;},true);
window.addEventListener('resize', () => closeRecommendationTagMenu());
window.addEventListener('blur', () => closeRecommendationTagMenu());

main.addEventListener('input', event => {
  const tab = currentTab();
  if (tab?.kind === 'recommendations' && event.target.matches('[data-recommendation-other-filter]')) {
    tab.otherTagFilter = event.target.value;
    const list = main.querySelector('.recommendation-other-list');
    if (list) list.innerHTML = renderRecommendationOtherList(tab);
    const count = main.querySelector('.recommendation-other-count');
    if (count) count.textContent = `${filteredRecommendationOtherTags(tab).length} из ${tab.recommendationTagGroups?.other.length || 0}`;
    return;
  }
  if (tab?.kind !== 'follows') return;
  if (event.target.name === 'artistTag' && event.target.closest('#artist-follow-form'))
    tab.artistTagDraft = event.target.value;
  if (event.target.name === 'gelbooruTag' && event.target.closest('.follow-tag-form'))
    tab.editingFollowTag = event.target.value;
});

main.addEventListener('change', event => {
  if (event.target.name === 'videoSound' && currentTab()?.kind === 'settings') {
    viewerPreferences = { ...viewerPreferences, videoSound: event.target.checked };
    saveViewerPreferences();
    for (const video of document.querySelectorAll('video[data-video-url]'))
      DartViewerPreferences.configureVideo(video, viewerPreferences, true);
    return;
  }
  if (event.target.id === 'profile-transfer-file') {
    const file = event.target.files?.[0];
    if (file) void profileTransferController().choose(file).then(ready => {
      if (ready) main.querySelector('#profile-transfer-consent')?.focus({ preventScroll: true });
    });
    return;
  }
  if (event.target.name === 'profileApplySettings') {
    profileTransferController().applySettings(event.target.checked); return;
  }
  if (event.target.name === 'profileTransferConsent') {
    profileTransferController().setConsent(event.target.checked); return;
  }
  if (currentTab()?.kind !== 'settings' || contentPreferencesSaving) return;
  const name = event.target.name;
  if (name === 'interfaceLanguage') {
    saveContentPreferences({ ...contentPreferences, language: event.target.value });
    return;
  }
  if (name === 'hideFromScreenCapture') {
    savePrivacyStatus(event.target.checked);
    return;
  }
  if (name === 'artworkTabs') {
    tabPreferences.artworkTabs = event.target.value === 'new' ? 'new' : 'preview';
    try { localStorage.setItem('artcatalog-tab-preferences', JSON.stringify(tabPreferences)); }
    catch { /* The server also stores this choice with the session. */ }
    if (tabPreferences.artworkTabs === 'new')
      for (const tab of tabs) tab.preview = false;
    saveSession(); render(); toast('Настройки вкладок сохранены'); return;
  }
  if (name === 'attributionPriority') {
    saveContentPreferences({ ...contentPreferences, attributionPriority: event.target.value });
    return;
  }
  if (name === 'hideViewedAndSaved') {
    saveContentPreferences({ ...contentPreferences, hideViewedAndSaved: event.target.checked });
    return;
  }
  if (name === 'showFollowedArtists') {
    saveContentPreferences({ ...contentPreferences, hideFollowedArtists: !event.target.checked });
    return;
  }
  if (name?.startsWith('curation-')) {
    const key = name.slice('curation-'.length);
    if (['enabled', 'popularity', 'personal', 'freshness', 'resolution'].includes(key))
      saveCurationPreferences({ [key]: event.target.checked });
    return;
  }
  if (name === 'hideFurry') {
    saveContentPreferences({ ...contentPreferences, hideFurry: event.target.checked });
    return;
  }
  if (name !== 'hideGenerated' && name !== 'hideAssisted') return;
  const aiMode = name === 'hideGenerated'
    ? event.target.checked ? 'generated' : 'all'
    : event.target.checked ? 'generated-and-assisted' : 'generated';
  saveContentPreferences({ ...contentPreferences, aiMode });
});

main.addEventListener('submit', async event => {
  const formNode = event.target;
  if (formNode.classList.contains('favorites-add-form')) {
    event.preventDefault();
    const tab = currentTab();
    if (tab?.kind === 'favorites') await favoritesController().add(tab, new FormData(formNode).get('tag'));
    return;
  }
  if (formNode.id === 'excluded-tags-form') {
    event.preventDefault();
    const input = String(new FormData(formNode).get('tags') || '');
    const tags = input.split(/[,;\n]+/).map(tag => tag.trim()).filter(Boolean);
    if (!tags.length) { toast('Введите один или несколько тегов'); return; }
    if (tags.some(tag => tag.length > 100)) {
      toast('Один тег не может быть длиннее 100 символов'); return;
    }
    const canonicalTags = tags.flatMap(tag => CatalogLogic.normalizeExcludedTags([tag]));
    if (new Set([...contentPreferences.excludedTags, ...canonicalTags]).size > 100) {
      toast('Можно исключить не больше 100 тегов'); return;
    }
    const excludedTags = CatalogLogic.normalizeExcludedTags([
      ...contentPreferences.excludedTags, ...canonicalTags]);
    await saveContentPreferences({ ...contentPreferences, excludedTags });
    return;
  }
  if (formNode.id === 'artist-follow-form') {
    event.preventDefault();
    const tab = currentTab();
    const tag = normalizeFollowTag(new FormData(formNode).get('artistTag'));
    if (!tag || tag.length > 100 || !/^[\p{L}\p{N}_.()-]+$/u.test(tag)) {
      toast('Укажите один тег художника без специальных команд поиска'); return;
    }
    if (followedKeys.has(CatalogLogic.followKey({ source: 'danbooru', artistId: tag }))) {
      toast('Этот художник уже в подписках'); return;
    }
    if (tab?.kind === 'follows') tab.artistTagDraft = '';
    await toggleFollow({ source: 'danbooru', artistId: tag, service: '',
      name: tag.replaceAll('_', ' ') });
    return;
  }
  if (formNode.classList.contains('follow-tag-form')) {
    event.preventDefault();
    const tab = currentTab();
    const tag = normalizeFollowTag(new FormData(formNode).get('gelbooruTag'));
    try {
      follows = await request('/api/follows/gelbooru-tag', { method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: formNode.dataset.followKey, tag }) });
      followedKeys = new Set(follows.map(CatalogLogic.followKey));
      if (tab?.kind === 'follows') {
        tab.editingFollowKey = null;
        tab.editingFollowTag = null;
        loadFollowFeed(tab);
      }
      toast('Тег Gelbooru сохранён');
    } catch { toast('Не удалось сохранить тег Gelbooru'); }
    return;
  }
  if (formNode.id === 'sankaku-login-form') {
    event.preventDefault();
    if (sankakuSigningIn) return;
    const form = new FormData(formNode);
    const login = form.get('login'), password = form.get('password');
    formNode.querySelector('[name="password"]').value = '';
    sankakuSigningIn = true; sankakuLoginError = ''; render();
    try {
      settings = await request('/api/sankaku/login', { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login, password }) });
      toast('Вход в Sankaku выполнен');
      for (const tab of tabs.filter(tab => tab.kind === 'detail' && tab.item?.source === 'sankaku')) loadDetail(tab);
      for (const tab of tabs.filter(tab => tab.kind === 'recommendations'))
        retryRecommendationSources(tab, ['sankaku'], false);
    } catch (error) { sankakuLoginError = error.message; }
    finally { sankakuSigningIn = false; render(); }
    return;
  }
  if (formNode.id !== 'settings-form') return;
  event.preventDefault();
  const form = new FormData(formNode);
  try {
    settings = await request('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: form.get('userId'), apiKey: form.get('apiKey'),
        rule34UserId: form.get('rule34UserId'), rule34ApiKey: form.get('rule34ApiKey') }) });
    for (const tab of tabs.filter(tab => tab.kind === 'recommendations'))
      retryRecommendationSources(tab, ['gelbooru', 'rule34'], false);
    render(); toast('Настройки сохранены');
  } catch { toast('Не удалось сохранить настройки'); }
});

main.addEventListener('mousedown', event => {
  if (event.button === 1 && event.target.closest('[data-action="open"]')) event.preventDefault();
});
main.addEventListener('auxclick', event => {
  if (event.button !== 1) return;
  const control = event.target.closest('[data-action="open"]');
  const item = control && itemForControl(control);
  if (item) { event.preventDefault(); openDetail(item, { separate: true, background: !event.shiftKey, origin: control }); }
});
let favoriteDraggedKey=null,favoriteDropClickUntil=0;
function clearFavoriteDropTargets(){for(const card of main.querySelectorAll('.favorite-drop-target'))card.classList.remove('favorite-drop-target');}
main.addEventListener('dragstart',event=>{
  const card=event.target.closest('[data-favorite-draggable]');
  if(!card)return;
  if(favoriteGroupsController().pending||!event.dataTransfer){event.preventDefault();return;}
  favoriteDraggedKey=card.dataset.workKey;
  event.dataTransfer.setData('application/x-dart-favorite',favoriteDraggedKey);event.dataTransfer.effectAllowed='move';
  card.classList.add('favorite-dragging');closeRecommendationTagMenu();
});
main.addEventListener('dragover',event=>{
  const card=event.target.closest('[data-favorite-draggable]');
  if(!card||!event.dataTransfer?.types.includes('application/x-dart-favorite')||favoriteGroupsController().pending||card.dataset.workKey===favoriteDraggedKey)return;
  event.preventDefault();event.dataTransfer.dropEffect='move';clearFavoriteDropTargets();card.classList.add('favorite-drop-target');
});
main.addEventListener('dragleave',event=>{const card=event.target.closest('.favorite-drop-target');if(card&&!card.contains(event.relatedTarget))card.classList.remove('favorite-drop-target');});
main.addEventListener('drop',event=>{
  const card=event.target.closest('[data-favorite-draggable]');
  const from=event.dataTransfer?.getData('application/x-dart-favorite');
  if(!card||!from)return;
  event.preventDefault();favoriteDropClickUntil=Date.now()+300;clearFavoriteDropTargets();favoriteDraggedKey=null;
  void favoriteGroupsController().merge(from,card.dataset.workKey);
});
main.addEventListener('dragend',()=>{favoriteDraggedKey=null;clearFavoriteDropTargets();for(const card of main.querySelectorAll('.favorite-dragging'))card.classList.remove('favorite-dragging');});

// The middle mouse button keeps a permanent background tab for tag searches
// and artist profiles, as it does for links in a browser.
const middleClickTabActions = '[data-action="query"], [data-action="creator-profile"], [data-action="uploader-profile"], [data-action="attribution-primary"]';
main.addEventListener('mousedown', event => {
  if (event.button === 1 && event.target.closest(middleClickTabActions)) event.preventDefault();
});
main.addEventListener('auxclick', event => {
  if (event.button !== 1) return;
  const control = event.target.closest(middleClickTabActions);
  if (!control) return;
  event.preventDefault();
  const keep = { separate: true, background: true };
  const action = control.dataset.action;
  if (action === 'query') {
    openSearch(control.dataset.query || '', { ...currentSearchOptions(), ...keep });
    return;
  }
  const item = itemForControl(control);
  if (!item) return;
  if (action === 'creator-profile') openCreator(item, keep);
  else if (action === 'uploader-profile') openUploader(item, keep);
  else if (control.dataset.creatorId) openCreator(item, keep);
  else openPreferredAttribution(item, false, keep);
});

main.addEventListener('click', event => {
  if(Date.now()<favoriteDropClickUntil&&event.target.closest('[data-favorite-draggable]')){event.preventDefault();return;}
  const control = event.target.closest('[data-action]');
  if (!control) return;
  const tab = currentTab();
  const action = control.dataset.action;
  if (tab?.kind === 'favorites' && favoritesController().handle(control, tab)) {
    if (action === 'favorites-add') main.querySelector('#favorite-new-tag')?.focus();
    return;
  }
  const item = itemForControl(control);
  if (action === 'artwork-more' || action === 'content-more') { const context=contentContextTarget(control); if(context)openContentContextMenu(context,0,0); return; }
  if (action === 'favorite-groups-retry') { void favoriteGroupsController().load(); return; }
  if (action === 'favorite-ungroup') { void favoriteGroupsController().ungroup(control.dataset.groupId); return; }
  if (action === 'artwork-restore' && item) { void artworkActionsController().setHidden(item,false); return; }
  if (action === 'hidden-artworks-retry') { void artworkActionsController().load(); return; }
  if (action === 'hidden-artworks-more') { tab.hiddenArtworksOpen=true;tab.hiddenArtworkLimit=(tab.hiddenArtworkLimit||50)+50;render();return; }
  if (action === 'zoom-image' && tab?.kind === 'detail') {
    const artwork = quickPreviewArtworkAt(control, tab, itemIndex);
    if (artwork) openQuickPreview(artwork, 'fullscreen');
  }
  else if (action === 'settings-section' && tab?.kind === 'settings') {
    profileTransferController.instance?.resetConsent();
    tab.settingsSection = ['content', 'curation', 'authors', 'sources', 'tabs', 'appearance', 'language', 'privacy', 'transfer', 'upscale'].includes(control.dataset.section)
      ? control.dataset.section : 'content';
    saveSession(); render();
    if (tab.settingsSection === 'privacy') loadPrivacyStatus();
  }
  else if (action === 'profile-export' && tab?.kind === 'settings') void profileTransferController().export();
  else if (action === 'profile-select' && tab?.kind === 'settings') main.querySelector('#profile-transfer-file')?.click();
  else if (action === 'profile-import' && tab?.kind === 'settings') void profileTransferController().import();
  else if (action === 'profile-cancel' && tab?.kind === 'settings') profileTransferController().cancel();
  else if (action === 'theme-choice' && tab?.kind === 'settings') {
    if (globalThis.DartTheme?.setPreference(control.dataset.themeChoice)) {
      saveSession(); render();
    }
  }
  else if (action === 'content-settings') openSettings('content');
  else if (action === 'remove-excluded-tag' && tab?.kind === 'settings')
    saveContentPreferences({ ...contentPreferences,
      excludedTags: contentPreferences.excludedTags.filter(tag => tag !== control.dataset.tag) });
  else if (action === 'unhide-author' && tab?.kind === 'settings') {
    const author = contentPreferences.hiddenAuthors.find(entry =>
      CatalogLogic.hiddenAuthorKey(entry) === control.dataset.authorKey);
    if (author) void setAuthorHidden(author, false);
  }
  else if (action === 'open' && item) openDetail(item, {
    separate: event.ctrlKey || event.metaKey, background: (event.ctrlKey || event.metaKey) && !event.shiftKey, origin: control });
  else if (action === 'attribution-primary' && item) {
    const tabOptions = { temporary: tab?.kind === 'detail', separate: event.shiftKey };
    if (control.dataset.creatorId) openCreator(item, tabOptions);
    else openPreferredAttribution(item, reveal, tabOptions);
  }
  else if (action === 'creator-profile' && item)
    openCreator(item, { temporary: tab?.kind === 'detail', separate: event.shiftKey });
  else if (action === 'uploader-profile' && item)
    openUploader(item, { temporary: tab?.kind === 'detail', separate: event.shiftKey });
  else if (action === 'original' && item?.originalUrl)
    window.open(item.originalUrl, '_blank', 'noopener');
  else if (action === 'follow-tag-search' && item?.followedArtistTag)
    openSearch(item.followedArtistTag, { rating: tab?.rating || 'general',
      selectedSources: [item.source], sort: 'recent', feed: 'illustrations' });
  else if (action === 'bookmark' && item) toggleSavedWork(item, 'bookmarks');
  else if (action === 'like' && item) toggleSavedWork(item, 'likes');
  else if (action === 'follow') toggleFollow({ source: control.dataset.followSource,
    artistId: control.dataset.followArtist, service: control.dataset.followService,
    name: control.dataset.followName });
  else if (action === 'unfollow') {
    const follow = follows.find(entry => entry.key === control.dataset.followKey);
    if (follow) toggleFollow(follow);
  }
  else if (action === 'edit-follow-tag' && tab?.kind === 'follows') {
    const follow = follows.find(entry => entry.key === control.dataset.followKey);
    if (follow?.source === 'danbooru') {
      tab.editingFollowKey = follow.key;
      tab.editingFollowTag = follow.gelbooruTag || follow.artistId;
      render();
    }
  }
  else if (action === 'cancel-follow-tag' && tab?.kind === 'follows') {
    tab.editingFollowKey = null;
    tab.editingFollowTag = null;
    render();
  }
  else if (action === 'follow-profile') {
    const follow = follows.find(entry => entry.key === control.dataset.followKey);
    if (follow?.source === 'danbooru')
      openSearch(follow.artistId, { rating: tab?.rating || 'general',
      selectedSources: [...CatalogLogic.supportedSources], sort: 'recent',
        feed: 'illustrations' });
    else if (follow) createTab('profile', follow.name, { profileRef: { source: follow.source,
      artist: follow.artistId }, rating: tab?.rating || 'general' });
  }
  else if (action === 'external' && item) window.open(item.sourceUrl, '_blank', 'noopener');
  else if (action === 'profile-external' && tab?.profile?.url) window.open(tab.profile.url, '_blank', 'noopener');
  else if (action === 'favorite-tag' && tab?.kind === 'search')
    void toggleFavoriteTag(control.dataset.tag);
  else if (action === 'query') {
    if (!handleArtworkTagClick(event, control, tab))
      openSearch(control.dataset.query || '', { ...currentSearchOptions(),
        temporary: tab?.kind === 'detail', separate: event.shiftKey });
  }
  else if (action === 'detail-tags-reset' && tab?.kind === 'detail') {
    tab.selectedTags = [];
    render();
  }
  else if (action === 'detail-tags-more' && tab?.kind === 'detail') {
    tab.showAllTags = !tab.showAllTags;
    render();
  }
  else if (action === 'recommendation-tags-more' && tab?.kind === 'recommendations') {
    tab.showMoreRecommendationNames = !tab.showMoreRecommendationNames;
    render();
  }
  else if (action === 'recommendation-other' && tab?.kind === 'recommendations') {
    tab.otherTagsOpen = !tab.otherTagsOpen;
    render();
  }
  else if (action === 'all') openSearch('', { rating: tab?.rating || 'general',
    selectedSources: tab?.selectedSources || [...defaultSources],
    sort: tab?.sort || 'recent', feed: tab?.feed || 'illustrations' });
  else if (action === 'more-retry' && tab && !tab.loading) { tab.loadError = false; loadSearch(tab, true); }
  else if (action === 'retry-search' && tab && !tab.loading) {
    if (tab.kind === 'recommendations') loadRecommendations(tab);
    else if (Object.keys(tab.pausedSources || {}).length) loadSearch(tab, true, true);
    else loadSearch(tab);
  }
  else if (action === 'recommendation-refresh' && tab?.kind === 'recommendations')
    { clearCatalogResponses(); loadRecommendations(tab); }
  else if (action === 'recommendation-copyright-more' && tab?.kind === 'recommendations') {
    tab.showMoreRecommendationCopyright = !tab.showMoreRecommendationCopyright;
    render();
  }
  else if (action === 'recommendation-more-retry' && tab?.kind === 'recommendations') {
    retryRecommendationSources(tab);
  }
  else if (action === 'recommendation-continue' && tab?.kind === 'recommendations') {
    tab.emptyRecommendationRounds = 0;
    tab.recommendationPaused = false;
    loadRecommendations(tab, true);
  }
  else if (action === 'recommendation-rating' && tab?.kind === 'recommendations') {
    if (tab.rating === control.dataset.rating) return;
    tab.rating = control.dataset.rating;
    saveSession(); loadRecommendations(tab);
  }
  else if (action === 'recommendation-source' && tab?.kind === 'recommendations') {
    const source = control.dataset.source;
    const selected = tab.selectedSources.includes(source)
      ? tab.selectedSources.filter(entry => entry !== source)
      : [...tab.selectedSources, source];
    if (!selected.length) return;
    tab.selectedSources = selected;
    saveSession(); loadRecommendations(tab);
  }
  else if (action === 'follow-refresh' && tab?.kind === 'follows') {
    clearCatalogResponses(); loadFollowFeed(tab, true);
  }
  else if (action === 'follow-order' && tab?.kind === 'follows') {
    void setFollowOrder(tab, control.dataset.order);
  }
  else if (action === 'follow-manage-toggle' && tab?.kind === 'follows') {
    tab.followManageOpen = !tab.followManageOpen;
    render();
  }
  else if (action === 'follow-more-retry' && tab?.kind === 'follows') {
    tab.followLoadError = false;
    loadMoreFollows(tab);
  }
  else if (action === 'follow-rating' && tab?.kind === 'follows') {
    if (tab.rating === control.dataset.rating) return;
    tab.rating = control.dataset.rating;
    saveSession(); loadFollowFeed(tab, true);
  }
  else if (action === 'profile-more-retry' && tab && !tab.loading) { tab.loadError = false; loadProfile(tab, true); }
  else if (action === 'related-retry' && tab?.kind === 'detail') retryRelatedSearch(tab);
  else if (action === 'profile-retry' && tab?.kind === 'profile') loadProfile(tab);
  else if (action === 'creator-retry' && tab?.kind === 'detail') loadCreatorWorks(tab, true);
  else if (action === 'settings') openSettings('sources');
  else if (action === 'sankaku-auth') {
    sankakuLoginError = '';
    openSettings('sources');
    loadSettings().then(() => {
      main.querySelector('#sankaku-login-form')?.scrollIntoView({ block: 'center' });
      main.querySelector('#sankaku-login-form [name="login"]')?.focus();
    });
  }
  else if (action === 'sankaku-logout' && !sankakuSigningIn) {
    sankakuSigningIn = true;
    request('/api/sankaku/logout', { method: 'POST' }).then(value => {
      settings = value; sankakuLoginError = ''; toast('Вы вышли из Sankaku');
    }).catch(error => toast(error.message)).finally(() => { sankakuSigningIn = false; render(); });
  }
  else if (action === 'filter' && tab) {
    const source = control.dataset.source;
    const selected = tab.selectedSources.includes(source)
      ? tab.selectedSources.filter(entry => entry !== source)
      : [...tab.selectedSources, source];
    if (!selected.length) return;
    tab.selectedSources = selected;
    saveSession();
    loadSearch(tab);
  }
  else if (action === 'category' && tab) {
    const category = control.dataset.category;
    if (tab.rating === category) return;
    tab.feed = 'illustrations';
    if (tab.feed === 'illustrations') tab.rating = category;
    saveSession();
    loadSearch(tab);
  }
  else if (action === 'sort' && tab && tab.sort !== control.dataset.sort) {
    if (!['recent', 'popular'].includes(control.dataset.sort)) return;
    tab.sort = control.dataset.sort;
    saveSession();
    loadSearch(tab);
  }
  else if (action === 'mode' && tab) {
    const mode = control.dataset.mode;
    if (tab.rating === mode) return;
    tab.feed = 'illustrations';
    if (tab.feed === 'illustrations') tab.rating = mode;
    tab.selectedSources = [...defaultSources];
    tab.sort = 'recent';
    saveSession();
    loadSearch(tab);
  }
  else if (action === 'profile-rating' && tab?.kind === 'profile') {
    if (tab.rating === control.dataset.rating) return;
    tab.rating = control.dataset.rating;
    saveSession(); loadProfile(tab);
  }
});

window.addEventListener('online', () => { void clientStateWriter.flush(); });
window.addEventListener('resize', () => { if (quickPreview.open) paintQuickPreview(true); });
window.addEventListener('beforeunload', () => {
  tagPreviewController.instance?.dispose();
  recommendationExposureTracker.stop();
  groupRepairs.stop(); stopQuickPreviewMedia();
  saveSession();
  const patch = tabs.length && clientStateWriter.unloadPatch(captureClientState());
  void favoritesController.instance?.flush(true, 60 * 1024 - (patch ? new TextEncoder().encode(patch).length : 0));
  if (patch) void fetch('/api/client-state', { method: 'POST', keepalive: true,
    headers: { 'Content-Type': 'application/json' }, body: patch }).catch(() => {});
  globalThis.DartVideoPreview?.dispose();
  for (const entry of imageLoader.cache.values()) URL.revokeObjectURL(entry.blobUrl);
});

globalThis.DartUpscale?.configure({ readImage: DartUpscaleMedia.create({
  logic: CatalogLogic, cached: url => imageLoader.cached(url), read: readMediaBlob,
  renew: (id, signal) => sankakuMediaRecovery.post(id, signal), apply: detail => sankakuMediaRecovery.apply(detail)
}), toast, openSettings, currentImage: () => {
  if (quickPreview.open) {
    const image = quickPreview.querySelector('img.quick-preview-image[data-image-url]');
    return image ? { item: quickPreviewWork, url: image.dataset.imageUrl } : null;
  }
  if (currentTab()?.kind !== 'detail') return null;
  const images = [...main.querySelectorAll('.detail-image:not([hidden]) > img[data-image-url]')];
  const bounds = main.getBoundingClientRect(), center = (bounds.top + bounds.bottom) / 2;
  const image = images.find(image => image.matches(':hover')) || images.find(image => {
    const rect = image.getBoundingClientRect(); return rect.top <= center && rect.bottom >= center;
  }) || images.find(image => image.getBoundingClientRect().bottom > bounds.top) || images[0];
  return image ? { item: currentTab().item, url: image.dataset.imageUrl } : null;
} });

tagPreviewController();

globalThis.DartKeyboardScroll?.attach(document, {
  owner: () => {
    if (quickPreview.open || !tabListPanel.hidden || !tabContextMenu.hidden ||
        !recommendationTagMenu.hidden || !popover.hidden || document.activeElement?.closest?.('.tabs-bar')) return null;
    const dialogs=document.querySelectorAll('dialog[open]');
    return dialogs[dialogs.length-1] || main;
  },
  scope: currentTab
});

function bootstrapApplication() {
  // Favorites-only data can arrive after the first tab; their controllers
  // already publish into the affected screen. Keep visibility and ranking
  // inputs ready before starting feeds so hidden/saved works cannot flash in.
  void Promise.allSettled([loadFavoriteTags(), favoritesController().loadArtworks(), favoriteGroupsController().load()]);
  return Promise.allSettled([refreshBookmarks(), refreshLikes(), refreshFollows(), loadSettings(),
    loadContentPreferences(), loadClientState(), loadRecommendationTagPreferences(),
    loadViewedTokens(), artworkActionsController().load()]).then(() => {
    void recordViewedWorks([...recent, ...likes, ...bookmarks]);
    if (!restoreSession()) createTab('home', 'Главная');
  });
}

void bootstrapApplication();

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
icons.star = '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/>';
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
tabListPanel.innerHTML = '<div class="tab-list-head"><strong>Открытые вкладки</strong><button class="tab-close" type="button" data-tab-list-dismiss aria-label="Закрыть список вкладок">×</button></div><input id="tab-list-search" type="search" autocomplete="off" placeholder="Найти вкладку…" aria-label="Найти вкладку"><div class="tab-list-items"></div><div class="tab-list-footer"><button type="button" data-tab-list-clear title="Закрыть все вкладки, включая закреплённые">Очистить всё</button></div>';
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
let quickPreviewGeneration = 0;
let quickPreviewView = { scale: 1, x: 0, y: 0 };
let quickPreviewDrag = null;
const tabs = [];
const itemIndex = new Map();
let nextId = 1;
let activeId = null;
let navigation = [];
let navPosition = -1;
let tabPreferences = { artworkTabs: 'preview' };
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
let contentPreferences = { language: globalThis.DartI18n?.language || 'en', aiMode: 'all', excludedTags: [], attributionPriority: 'creator',
  hideViewedAndSaved: false, hiddenAuthors: [] };
let contentPreferencesSaving = false;
let contentPreferencesRevision = 0;
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
const visualHashCache = new Map();

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

async function request(path, options = {}) {
  const fetchOptions = options;
  const response = await fetch(path, fetchOptions);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw Object.assign(new Error(body.error || `HTTP ${response.status}`),
      { authRequired: !!body.authRequired, status: response.status, retryAt: body.retryAt });
  }
  const result = await response.json();
  if (Array.isArray(result?.items)) result.items = CatalogLogic.filterCatalogItems(result.items);
  if (!fetchOptions.signal?.aborted &&
      (path.startsWith('/api/search?') || path.startsWith('/api/profile?')))
    await addCatalogVisualHashes(result.items || [], fetchOptions.signal);
  return result;
}

const visualHashJobs = [];
let activeVisualHashJobs = 0;
function runVisualHashJob(job) {
  return new Promise(resolve => {
    visualHashJobs.push({ job, resolve });
    const drain = () => {
      while (activeVisualHashJobs < 4 && visualHashJobs.length) {
        const entry = visualHashJobs.shift();
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
  return { hash, perceptualHash: CatalogLogic.perceptualImageHash(
    context.getImageData(0, 0, 32, 32).data),
    aspectRatio: (bitmap.naturalWidth || bitmap.width) / (bitmap.naturalHeight || bitmap.height) };
}

async function catalogThumbnailFingerprint(url, loadedUrl = '') {
  const key = CatalogLogic.mediaCacheKey(url);
  if (!visualHashCache.has(key)) {
    const pending = runVisualHashJob(async () => {
      const response = await fetch(loadedUrl.startsWith('blob:') ? loadedUrl : `/api/image?url=${encodeURIComponent(url)}`,
        { signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error('Thumbnail unavailable');
      const bitmap = await createImageBitmap(await response.blob());
      try { return catalogBitmapFingerprint(bitmap); }
      finally { bitmap.close(); }
    }).then(hash => { if (!hash) visualHashCache.delete(key); return hash; });
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
      item.visualPHash || img.dataset.fingerprintPending) return;
  img.dataset.fingerprintPending = 'true';
  // Always decode through the same ImageBitmap path: DOM image downscaling
  // can produce different hashes even from identical cached bytes.
  const fingerprint = await catalogThumbnailFingerprint(item.thumbnail, img.src);
  delete img.dataset.fingerprintPending;
  if (!fingerprint) return;
  const update = { visualHash: fingerprint.hash, visualPHash: fingerprint.perceptualHash,
    visualAspectRatio: fingerprint.aspectRatio };
  Object.assign(item, update);
  // Old saved works gain evidence from thumbnails that are already visible;
  // opening Liked must not download the whole saved collection up front.
  const lists = [likes, bookmarks, recent, ...tabs.flatMap(tab => [tab.items, tab.related, tab.creatorWorks])];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    let changed = false;
    for (const candidate of list) if (candidate.key === item.key) {
      Object.assign(candidate, update); changed = true;
    }
    if (changed) CatalogLogic.invalidateGrouping(list);
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
  }, 120);
}

async function addCatalogVisualHashes(items, signal) {
  await Promise.all(items.filter(item => CatalogLogic.needsVisualFingerprint(item) &&
      !(/^[a-f0-9]{16}$/i.test(item.visualHash || '') && /^[a-f0-9]{16}$/i.test(item.visualPHash || '')))
    .map(async item => {
      if (signal?.aborted) return;
      const fingerprint = await catalogThumbnailFingerprint(item.thumbnail);
      if (fingerprint && !signal?.aborted) {
        item.visualHash = fingerprint.hash;
        item.visualPHash = fingerprint.perceptualHash;
        item.visualAspectRatio = fingerprint.aspectRatio;
      }
    }));
}

function toast(message) {
  toastNode.textContent = globalThis.DartI18n?.translate(message) || message;
  toastNode.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastNode.classList.remove('visible'), 3000);
}

function findTab(id) { return tabs.find(tab => tab.id === id); }
function currentTab() { return findTab(activeId); }
function rememberItem(item) {
  if (!item?.key) return item;
  const remembered = CatalogLogic.mergeWorkMetadata(itemIndex.get(item.key), item);
  itemIndex.set(item.key, remembered);
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

function saveSession() {
  const descriptors = tabs.map(tab => ({
    kind: tab.kind, title: tab.title, query: tab.query || '',
    searchQuery: tab.kind === 'detail' ? tab.searchQuery || '' : undefined,
    selectedSources: tab.selectedSources, rating: tab.rating || 'general',
    sort: tab.sort || 'recent', feed: tab.feed || 'illustrations',
    item: tab.kind === 'detail' ? tab.item : undefined,
    profileRef: tab.kind === 'profile' ? tab.profileRef : undefined,
    settingsSection: tab.kind === 'settings' ? tab.settingsSection || 'content' : undefined,
    preview: !!tab.preview, pinned: !!tab.pinned, scrollTop: tab.scrollTop || 0
  }));
  const session = { tabs: descriptors, savedWorksVersion: 1, activeIndex: tabs.findIndex(tab => tab.id === activeId),
    tabPreferences: { ...tabPreferences } };
  try {
    localStorage.setItem('artcatalog-session', JSON.stringify(session));
  }
  catch { /* Browser storage may be unavailable. */ }
  fetch('/api/client-state', { method: 'POST', keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session, themePreference: globalThis.DartTheme?.preference || 'system',
      recent, searchHistory: getSearchHistory(),
      mediaDuplicatePairs: detailImageDeduper.duplicates.entries() })
  }).catch(() => {});
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
    const state = CatalogLogic.cleanClientState(await request('/api/client-state'));
    detailImageDeduper.duplicates.restore(state.mediaDuplicatePairs);
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
  if (!tab || tab.started) return;
  tab.started = true;
  if (tab.kind === 'home' || tab.kind === 'search') loadSearch(tab);
  if (tab.kind === 'bookmarks') loadBookmarks(tab);
  if (tab.kind === 'likes') loadLikes(tab);
  if (tab.kind === 'recommendations') loadRecommendations(tab);
  if (tab.kind === 'follows') loadFollowFeed(tab);
  if (tab.kind === 'settings') { loadSettings(); loadContentPreferences(); }
  if (tab.kind === 'detail') loadDetail(tab);
  if (tab.kind === 'profile') loadProfile(tab);
}

function restoreSession() {
  let session;
  try { session = CatalogLogic.cleanClientState({ session: JSON.parse(localStorage.getItem('artcatalog-session') || 'null') }).session; }
  catch { return false; }
  if (!session || !Array.isArray(session.tabs) || !session.tabs.length) return false;
  if (session.tabPreferences)
    tabPreferences.artworkTabs = session.tabPreferences.artworkTabs === 'new' ? 'new' : 'preview';
  const allowed = new Set(['home', 'search', 'detail', 'profile', 'bookmarks', 'likes',
    'recommendations', 'follows', 'recent', 'settings']);
  let hasPreview = false;
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
      sort: saved.sort === 'popular' ? 'popular' : 'recent',
      feed: 'illustrations',
      item: saved.item?.key ? rememberItem(saved.item) : saved.item,
      profileRef: saved.profileRef,
      settingsSection: ['content', 'authors', 'sources', 'tabs', 'appearance', 'language'].includes(saved.settingsSection)
        ? saved.settingsSection : 'content',
      items: [], errors: {}, page: 0,
      loading: false, started: false,
      scrollTop: Math.max(0, Number(saved.scrollTop) || 0),
      pinned: !!saved.pinned,
      preview: saved.kind === 'detail' && !!saved.preview && !saved.pinned && !hasPreview });
    hasPreview ||= tabs.at(-1).preview;
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
    if (['home', 'bookmarks', 'likes', 'follows', 'recommendations', 'recent', 'settings'].includes(kind)) return true;
    if (kind === 'search') return (tab.query || '') === (extra.query || '') &&
      tab.rating === (extra.rating || 'general') && tab.sort === (extra.sort || 'recent') &&
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
  const tab = { id: nextId++, kind, title, items: [], errors: {}, page: 0,
    loading: false, scrollTop: 0, selectedSources: [...defaultSources],
    rating: 'general', sort: 'recent', feed: 'illustrations', ...extra };
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
  } else createTab('settings', 'Настройки', { settingsSection: section });
}

function navigationEntry(tab) {
  return { id: tab.id, view: tab.kind === 'detail' ? tab : null };
}

function recordDetailVisit(tab) {
  recent = [tab.item, ...recent.filter(entry => entry.key !== tab.item.key)].slice(0, 40);
  localStorage.setItem('artcatalog-recent', JSON.stringify(recent));
  void recordViewedWorks([tab.item]);
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

function activate(id, record = true, view = null) {
  if (!findTab(id)) return;
  if (activeId === id && (!view || view === currentTab())) return;
  closeQuickPreview();
  hideTabPanels();
  const previous = currentTab();
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
  if (previous?.kind === 'follows' && previous.loading) {
    previous.followController?.abort();
    previous.lastLoadedAt = 0;
  }
  activeId = id;
  if (record) {
    navigation = navigation.slice(0, navPosition + 1);
    navigation.push(navigationEntry(currentTab()));
    navPosition = navigation.length - 1;
  }
  render();
  main.scrollTop = currentTab()?.scrollTop || 0;
  const selected = currentTab();
  if (selected?.kind === 'detail') recordDetailVisit(selected);
  const wasStarted = selected?.started;
  startTab(selected);
  if (wasStarted && selected?.kind === 'follows' &&
      Date.now() - (selected.lastLoadedAt || 0) > 60000) loadFollowFeed(selected);
  else if (selected?.kind === 'follows') scheduleFollowRetry(selected);
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
  abortTab(tabs[index]);
  tabs.splice(index, 1);
  const removedBefore = navigation.slice(0, navPosition + 1).filter(entry => entry.id === id).length;
  navigation = navigation.filter(entry => entry.id !== id);
  navPosition = Math.max(-1, navPosition - removedBefore);
  if (wasActive) {
    activeId = tabs[Math.max(0, index - 1)]?.id || tabs[0]?.id || null;
    if (!activeId) { createTab('home', 'Главная'); return; }
    if (navigation[navPosition]?.id !== activeId) {
      navigation = navigation.slice(0, navPosition + 1);
      navigation.push(navigationEntry(currentTab()));
      navPosition = navigation.length - 1;
    }
  }
  render();
  if (wasActive) main.scrollTop = currentTab()?.scrollTop || 0;
  startTab(currentTab());
  saveSession();
}

function travel(direction) {
  let target = navPosition + direction;
  while (target >= 0 && target < navigation.length && !findTab(navigation[target].id)) target += direction;
  if (target < 0 || target >= navigation.length) return;
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

function clearTabs() {
  for (const tab of tabs) abortTab(tab);
  tabs.length = 0;
  navigation = [];
  navPosition = -1;
  activeId = null;
  createTab('home', 'Главная');
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
  query = CatalogLogic.normalizeSearch(query);
  if (query) {
    const history = getSearchHistory().filter(entry => entry !== query);
    history.unshift(query);
    localStorage.setItem('artcatalog-search-history', JSON.stringify(history.slice(0, 12)));
  }
  searchInput.value = query;
  hidePopover();
  const feed = 'illustrations';
  const title = query || (
    options.rating === 'explicit' ? 'NSFW иллюстрации' : 'Иллюстрации');
  return createTab('search', title, { query, rating: options.rating || 'all', ...options, feed });
}

function getSearchHistory() {
  try { return JSON.parse(localStorage.getItem('artcatalog-search-history') || '[]'); }
  catch { return []; }
}

function scheduleRule34Recovery(tab) {
  if (tab.rule34RecoveryTimer) clearTimeout(tab.rule34RecoveryTimer);
  tab.rule34RecoveryTimer = null;
  if (findTab(tab.id) !== tab || activeId !== tab.id || tab.loading) return;
  let retryAt;
  if (tab.kind === 'home' || tab.kind === 'search') {
    if (tab.pausedSources?.rule34) retryAt = tab.rule34RetryAt;
  } else if (tab.kind === 'recommendations') {
    const times = Object.values(tab.recommendationPools || {}).flat()
      .flatMap(group => group.streams).filter(stream => stream.sources.includes('rule34'))
      .map(stream => stream.retryAt).filter(value => Number.isFinite(value) && value > 0);
    if (times.length) retryAt = Math.min(...times);
  }
  if (!Number.isFinite(retryAt) || retryAt <= 0) return;
  tab.rule34RecoveryTimer = setTimeout(() => {
    tab.rule34RecoveryTimer = null;
    if (findTab(tab.id) !== tab || activeId !== tab.id || tab.loading) return;
    if (tab.kind === 'recommendations') {
      tab.recommendationPaused = false;
      tab.emptyRecommendationRounds = 0;
      return loadRecommendations(tab, true);
    }
    return loadSearch(tab, true, true, ['rule34']);
  }, Math.max(500, retryAt - Date.now()));
}

async function loadSearch(tab, append = false, retryFailed = false, retrySources = null) {
  if (!findTab(tab.id) || append && (tab.loading || !retryFailed &&
      (tab.hasMore === false || tab.loadError))) return;
  if (!append) tab.searchController?.abort();
  const controller = new AbortController();
  tab.searchController = controller;
  const version = tab.requestVersion = (tab.requestVersion || 0) + 1;
  tab.loading = true;
  if (!append) {
    tab.page = 0; tab.items = []; tab.errors = {}; tab.hasMore = true;
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
  }
  const sources = retryFailed ? Object.keys(tab.pausedSources || {})
    .filter(source => !retrySources || retrySources.includes(source)) :
    Object.keys(tab.sourcePages).filter(source => !tab.pausedSources[source]);
  if (!sources.length) { tab.loading = false; return; }
  const requestedPages = Object.fromEntries(sources.map(source =>
    [source, tab.sourcePages[source]]));
  if (activeId === tab.id) render();
  const page = Math.min(...Object.values(requestedPages));
  const query = tab.query || '';
  const params = new URLSearchParams({ q: query, page: String(page),
    pages: sources.map(source => `${source}:${requestedPages[source]}`).join(','),
    sources: sources.join(','), rating: tab.rating || 'general',
    sort: tab.sort || 'recent', kind: tab.feed || 'illustrations' });
  try {
    const response = await request(`/api/search?${params}`, { signal: controller.signal });
    if (!findTab(tab.id) || version !== tab.requestVersion) return;
    const merged = append ? [...tab.items, ...response.items] : response.items;
    tab.items = [...new Map(merged.map(item => [item.key, item])).values()];
    const errors = { ...tab.errors };
    delete errors.network;
    for (const source of sources) {
      if (response.errors?.[source] || response.notices?.[source]) errors[source] = response.errors?.[source] || response.notices[source];
      else delete errors[source];
    }
    tab.errors = errors;
    if (sources.includes('rule34')) tab.rule34RetryAt = response.retryAt?.rule34 || 0;
    tab.searchPageStats = CatalogLogic.rememberSearchPageStats(tab.searchPageStats,
      response.sourceStats, requestedPages, response.errors);
    const progress = CatalogLogic.advanceSearchSources(tab.sourcePages,
      tab.pausedSources, sources, response);
    tab.sourcePages = progress.pages;
    tab.pausedSources = progress.paused;
    tab.page = Math.max(tab.page, ...Object.values(requestedPages));
    tab.hasMore = Object.keys(tab.sourcePages).some(source =>
      !tab.pausedSources[source]);
    tab.loadError = false;
    rememberItems(response.items);
  } catch (error) {
    if (error.name !== 'AbortError' && version === tab.requestVersion) {
      tab.loadError = append;
      if (!append) {
        tab.hasMore = false;
        tab.errors = { network: 'Локальный сервер не ответил. Повторите запрос.' };
      }
    }
  } finally {
    if (version === tab.requestVersion) {
      tab.loading = false;
      if (activeId === tab.id) render();
      if (typeof scheduleRule34Recovery === 'function') scheduleRule34Recovery(tab);
    }
  }
}

function setSavedWorks(collection, items) {
  const keys = new Set(items.flatMap(item => [item.key, ...(item.memberKeys || [])]));
  if (collection === 'likes') { likes = items; likedKeys = keys; }
  else { bookmarks = items; savedKeys = keys; }
  rememberItems(items);
  for (const tab of tabs.filter(tab => tab.kind === collection)) tab.items = items;
}

async function refreshSavedWorks(collection) {
  try {
    setSavedWorks(collection, CatalogLogic.filterCatalogItems(await request(`/api/${collection}`)));
    return true;
  } catch { toast(collection === 'likes' ? 'Не удалось прочитать лайки' : 'Закладки не удалось прочитать'); return false; }
}

async function refreshBookmarks() { return refreshSavedWorks('bookmarks'); }
async function refreshLikes() { return refreshSavedWorks('likes'); }

async function loadFavoriteTags() {
  try {
    favoriteTags = await request('/api/favorite-tags');
    if (currentTab()?.kind === 'home' || currentTab()?.kind === 'search') render();
  } catch { toast('Избранные теги не удалось прочитать'); }
}

async function toggleFavoriteTag(query, requestedFavorite) {
  const tag = CatalogLogic.favoriteTagFromQuery(query);
  if (!tag || favoriteTagPending.has(tag)) return;
  favoriteTagPending.add(tag);
  try {
    const favorite = requestedFavorite ?? !favoriteTags.includes(tag);
    favoriteTags = await request('/api/favorite-tags', { method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag, favorite }) });
    render();
    toast(favorite ? `Тег #${tag} добавлен в избранное` : `Тег #${tag} удалён из избранного`);
  } catch { toast('Не удалось сохранить избранный тег'); }
  finally { favoriteTagPending.delete(tag); }
}

async function loadViewedTokens() {
  try { viewedTokens = new Set(await request('/api/viewed-identities')); }
  catch { toast('Историю просмотренных работ не удалось прочитать'); }
}

async function recordViewedWorks(items) {
  const incoming = [...new Set((items || []).flatMap(CatalogLogic.workHistoryTokens))]
    .filter(token => !viewedTokens.has(token) && !viewedPending.has(token));
  if (!incoming.length) return;
  for (const token of incoming) viewedPending.add(token);
  try {
    for (let index = 0; index < incoming.length; index += 60) {
      const batch = incoming.slice(index, index + 60);
      await request('/api/viewed-identities', { method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch) });
      for (const token of batch) viewedTokens.add(token);
    }
  } catch { toast('Историю просмотренных работ не удалось сохранить'); }
  finally { for (const token of incoming) viewedPending.delete(token); }
}

async function refreshFollows() {
  try {
    follows = CatalogLogic.filterCatalogItems(await request('/api/follows'));
    followedKeys = new Set(follows.map(CatalogLogic.followKey));
    return true;
  } catch {
    toast('Подписки не удалось прочитать');
    return false;
  }
}

function createRecommendationPools(liked, sources, preferences) {
  const selected = CatalogLogic.recommendationQueryGroups(liked, preferences);
  const selectedSources = sources.filter(source => CatalogLogic.supportedSources.includes(source));
  return Object.fromEntries(['priority', 'names', 'other'].map(kind => [kind,
    selected[kind].map(({ tag }) => ({ tag, kind, streams: [
      ...(selectedSources.length ? [{ nextPage: 0, sources: [...selectedSources] }] : [])
    ] })).filter(group => group.streams.length)]));
}

function recommendationPoolsHaveMore(pools) {
  return Object.values(pools || {}).some(pool => pool.some(group =>
    group.streams.some(stream => stream.sources.length)));
}

function nextRecommendationGroup(tab, kind, excluded = new Set()) {
  const pool = tab.recommendationPools?.[kind] || [];
  if (!pool.length) return null;
  const cursor = tab.recommendationCursors[kind] || 0;
  for (let offset = 0; offset < pool.length; offset++) {
    const index = (cursor + offset) % pool.length;
    const group = pool[index];
    if (excluded.has(group.tag) || !group.streams.some(stream => stream.sources.length &&
        (!stream.retryAt || stream.retryAt <= Date.now()))) continue;
    tab.recommendationCursors[kind] = (index + 1) % pool.length;
    return group;
  }
  return null;
}

function selectRecommendationGroups(tab) {
  const chosen = [];
  const excluded = new Set();
  const add = kind => {
    const group = nextRecommendationGroup(tab, kind, excluded);
    if (group) { chosen.push(group); excluded.add(group.tag); }
    return !!group;
  };
  if (add('priority')) {
    const second = (tab.recommendationRound++ % 3 === 2) ? 'names' : 'other';
    if (!add(second)) add(second === 'other' ? 'names' : 'other');
  } else {
    add('other');
    const second = (tab.recommendationRound++ % 3 === 2) ? 'names' : 'other';
    if (!add(second)) add(second === 'other' ? 'names' : 'other');
  }
  return chosen;
}

function prepareRecommendationProfile(tab, liked = CatalogLogic.filterWorks(
  CatalogLogic.groupWorks(likes), contentPreferences)) {
  recommendationVisitCount = (recommendationVisitCount + 1) % 1000000;
  try { localStorage.setItem('artcatalog-recommendation-visit-count',
    String(recommendationVisitCount)); } catch { /* Storage may be unavailable. */ }
  const previousSeed = tab.recommendationSeed || 0;
  tab.recommendationSeed = (Math.floor(Math.random() * 0xffffffff) ^
    recommendationVisitCount) >>> 0 || 1;
  if (tab.recommendationSeed === previousSeed)
    tab.recommendationSeed = (tab.recommendationSeed + 1) >>> 0 || 1;
  tab.recommendationTags = CatalogLogic.recommendationTags(liked, 6);
  tab.recommendationTagGroups = CatalogLogic.recommendationTagGroups(liked);
  tab.emptyRecommendationRounds = 0;
  tab.recommendationPaused = false;
  tab.recommendationPools = createRecommendationPools(liked,
    tab.selectedSources, recommendationTagPreferences);
  const start = kind => {
    const count = Math.min(tab.recommendationPools[kind].length, 8);
    return count ? recommendationVisitCount % count : 0;
  };
  tab.recommendationCursors = { priority: start('priority'), names: start('names'),
    other: start('other') };
  tab.recommendationRound = 0;
  tab.hasMore = recommendationPoolsHaveMore(tab.recommendationPools);
}

async function mergeRecommendationsAsync(...args) {
  if (typeof Worker !== 'function' || mergeRecommendationsAsync.state === false)
    return CatalogLogic.mergeRecommendations(...args);
  try {
    if (!mergeRecommendationsAsync.state) {
      const worker = new Worker('/catalog-worker.js');
      const state = { worker, jobs: new Map(), nextId: 0 };
      state.fail = () => {
        worker.terminate();
        mergeRecommendationsAsync.state = false;
        for (const job of state.jobs.values()) job.reject(new Error('Ranking worker unavailable'));
        state.jobs.clear();
      };
      worker.addEventListener('message', ({ data }) => {
        const job = state.jobs.get(data.id);
        if (!job) return;
        state.jobs.delete(data.id);
        if (data.error) job.reject(new Error(data.error));
        else job.resolve(data.value);
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
        state.jobs.set(id, { resolve, reject });
        timer = setTimeout(state.fail, 10000);
        try { state.worker.postMessage({ id, args }); }
        catch { state.fail(); }
      });
    } finally { clearTimeout(timer); state.jobs.delete(id); }
  } catch {
    // Keep the same ranking if worker creation is unavailable in the host.
    return CatalogLogic.mergeRecommendations(...args);
  }
}

async function loadRecommendations(tab, append = false) {
  if (!findTab(tab.id) || append && (tab.loading || !tab.hasMore || tab.loadError)) return;
  if (!append) tab.recommendationController?.abort();
  const controller = new AbortController();
  tab.recommendationController = controller;
  const version = tab.recommendationVersion = (tab.recommendationVersion || 0) + 1;
  const visibleLikes = CatalogLogic.filterWorks(
    CatalogLogic.groupWorks(likes), contentPreferences);
  if (!append) {
    tab.items = []; tab.errors = {}; tab.loadError = false;
    tab.retainedFeedWorks = new Map();
    delete tab.retainedFeedHeights;
    delete tab.expiredFeedWorks;
    delete tab.expiredFeedTokens;
    prepareRecommendationProfile(tab, visibleLikes);
  }
  const groups = selectRecommendationGroups(tab);
  tab.hasMore = recommendationPoolsHaveMore(tab.recommendationPools);
  if (!groups.length) {
    tab.loading = false;
    tab.recommendationPaused = tab.hasMore;
    if (activeId === tab.id) render();
    if (typeof scheduleRule34Recovery === 'function') scheduleRule34Recovery(tab);
    return;
  }
  tab.loading = true;
  if (activeId === tab.id) render();
  try {
    const jobs = groups.flatMap(group => group.streams.filter(stream =>
      stream.sources.length && (!stream.retryAt || stream.retryAt <= Date.now()))
      .map(stream => ({ group, stream })));
    const results = await Promise.all(jobs.map(async ({ group, stream }) => {
      const params = new URLSearchParams({
        q: group.tag.replaceAll(' ', '_'),
        page: String(stream.nextPage), sources: stream.sources.join(','),
        rating: tab.rating, sort: 'recent', kind: 'illustrations' });
      try {
        return { group, stream, response: await request(`/api/search?${params}`,
          { signal: controller.signal }) };
      } catch (error) { return { group, stream, error }; }
    }));
    if (!findTab(tab.id) || version !== tab.recommendationVersion ||
        controller.signal.aborted) return;
    const candidateGroups = groups.map(group => ({ kind: group.kind, items: [] }));
    tab.loadError = false;
    for (const { group, stream, response, error } of results) {
      if (error) {
        if (error.name !== 'AbortError') tab.loadError = true;
        continue;
      }
      candidateGroups[groups.indexOf(group)].items.push(...(response.items || []));
      const requestedSources = [...stream.sources];
      for (const source of requestedSources)
        if (!response.errors?.[source] && !response.notices?.[source]) delete tab.errors[source];
      Object.assign(tab.errors, response.notices || {}, response.errors || {});
      const failedRule34 = requestedSources.includes('rule34') && response.errors?.rule34;
      const failedPage = stream.nextPage;
      stream.nextPage++;
      stream.sources = stream.nextPage < 100 ? response.hasMoreSources || [] : [];
      stream.retryAt = 0;
      if (failedRule34) {
        const paused = requestedSources.length === 1 ? stream :
          { nextPage: failedPage, sources: ['rule34'] };
        paused.nextPage = failedPage;
        paused.sources = ['rule34'];
        paused.retryAt = /user id|api key|ключ API/i.test(failedRule34) ? Infinity :
          response.retryAt?.rule34 || Date.now() + 15000;
        if (paused !== stream) group.streams.push(paused);
      }
    }
    const previousCount = tab.items.length;
    const ranked = await mergeRecommendationsAsync(visibleLikes, tab.items,
      candidateGroups, tab.rating, recommendationTagPreferences, tab.recommendationSeed);
    if (!findTab(tab.id) || version !== tab.recommendationVersion || controller.signal.aborted) return;
    tab.items = CatalogLogic.filterWorks(ranked, contentPreferences);
    if (contentPreferences.hideViewedAndSaved)
      tab.items = tab.items.filter(item => !CatalogLogic.workHistoryTokens(item)
        .some(token => viewedTokens.has(token)) || isRetainedFeedWork(tab, item));
    tab.emptyRecommendationRounds = tab.items.length === previousCount
      ? (tab.emptyRecommendationRounds || 0) + 1 : 0;
    tab.hasMore = recommendationPoolsHaveMore(tab.recommendationPools);
    tab.recommendationPaused = tab.hasMore && tab.emptyRecommendationRounds >= 4;
    rememberItems(tab.items);
  } finally {
    if (version === tab.recommendationVersion) {
      tab.loading = false;
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
  if (entry.source !== 'rule34') return request(entry.path, { signal });
  const state = requestFollowSource.rule34 ||= {
    tail: Promise.resolve(), nextAt: 0, retryAt: 0, failures: 0, message: ''
  };
  const previous = state.tail;
  let release;
  state.tail = new Promise(resolve => { release = resolve; });
  await previous;
  try {
    if (signal.aborted) throw Object.assign(new Error('Cancelled'), { name: 'AbortError' });
    if (state.retryAt > Date.now())
      throw Object.assign(new Error(state.message), { retryAt: state.retryAt, cooledDown: true });
    if (state.nextAt > Date.now()) await waitFollowRequest(state.nextAt - Date.now(), signal);
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
    state.nextAt = Date.now() + 1000;
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
    stream.source === 'rule34' ? requestFollowSource.rule34?.retryAt || 0 : 0);
}

function scheduleFollowRetry(tab) {
  if (tab.followRetryTimer) clearTimeout(tab.followRetryTimer);
  tab.followRetryTimer = null;
  if (!findTab(tab.id) || activeId !== tab.id || tab.loading || tab.followLoadingMore) return;
  const pending = (tab.followStreams || [])
    .filter(stream => stream.error || followStreamRetryAt(stream) > Date.now())
    .map(followStreamRetryAt).filter(Number.isFinite);
  if (!pending.length) return;
  tab.followRetryTimer = setTimeout(() => {
    tab.followRetryTimer = null;
    if (findTab(tab.id) && activeId === tab.id && !tab.loading && !tab.followLoadingMore)
      void loadMoreFollows(tab);
  }, Math.max(500, Math.min(...pending) - Date.now()));
}

function updateFollowFeed(tab) {
  const feed = CatalogLogic.buildFollowFeed(tab.followGroups, tab.rating,
    Number.MAX_SAFE_INTEGER);
  const visible = CatalogLogic.filterWorks(CatalogLogic.groupWorks(feed.items),
    contentPreferences);
  const visibleKeys = new Set(visible.flatMap(item => item.memberKeys || [item.key]));
  tab.items = visible;
  tab.newKeys = new Set([...feed.newKeys].filter(key => visibleKeys.has(key)));
  tab.followSourceErrors = Object.fromEntries(tab.followStreams.filter(stream => stream.error)
    .map(stream => [stream.source, stream.error]));
  tab.hasMore = tab.followStreams.some(stream => followStreamRetryAt(stream) <= Date.now());
  rememberItems(visible);
}

function flushFollowUpdate(tab) {
  if (tab.followUpdateTimer) clearTimeout(tab.followUpdateTimer);
  tab.followUpdateTimer = null;
  updateFollowFeed(tab);
  tab.followPublished = true;
  if (activeId === tab.id) render();
}

function queueFollowUpdate(tab, version) {
  if (!tab.followPublished) { flushFollowUpdate(tab); return; }
  if (tab.followUpdateTimer) return;
  tab.followUpdateTimer = setTimeout(() => {
    tab.followUpdateTimer = null;
    if (findTab(tab.id) && version === tab.followVersion && !tab.followController.signal.aborted)
      flushFollowUpdate(tab);
  }, 150);
}

async function markFollowItemsSeen(tab, groups, version) {
  if (activeId !== tab.id || !groups.length) return;
  const displayedKeys = new Set(tab.items.flatMap(item => item.memberKeys || [item.key]));
  const workKeys = new Map();
  for (const { follow, items } of groups) {
    if (!workKeys.has(follow.key)) workKeys.set(follow.key, new Set());
    for (const item of items)
      if (displayedKeys.has(item.key)) workKeys.get(follow.key).add(item.key);
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
    } catch { tab.seenError = true; }
  }
}

async function loadFollowFeed(tab) {
  if (!findTab(tab.id)) return;
  tab.followController?.abort();
  if (tab.followUpdateTimer) clearTimeout(tab.followUpdateTimer);
  tab.followUpdateTimer = null;
  tab.followPublished = !!tab.items?.length;
  if (tab.followRetryTimer) clearTimeout(tab.followRetryTimer);
  const controller = new AbortController();
  tab.followController = controller;
  const version = tab.followVersion = (tab.followVersion || 0) + 1;
  const previousGroups = new Map((tab.followGroups || []).map(group => [group.follow.key, group]));
  tab.loading = true; tab.items ||= []; tab.newKeys ||= new Set();
  tab.followStreams = []; tab.hasMore = false;
  tab.followLoadingMore = false; tab.followLoadError = false;
  tab.followErrors = []; tab.followSourceErrors = {}; tab.followSourceNotices = {}; tab.seenError = false;
  if (requestFollowSource.rule34?.retryAt === Infinity)
    requestFollowSource.rule34.retryAt = 0;
  if (activeId === tab.id) render();
  try {
    const available = await refreshFollows();
    if (!findTab(tab.id) || version !== tab.followVersion || controller.signal.aborted) return;
    if (!available) {
      tab.followErrors.push('Не удалось загрузить список подписок.');
      return;
    }
    tab.followGroups = follows.map(follow => ({ follow,
      items: [...(previousGroups.get(follow.key)?.items || [])] }));
    const jobs = tab.followGroups.flatMap(group =>
      CatalogLogic.followFeedRequests(group.follow, tab.rating,
        settings.hasApiKey, settings.hasRule34ApiKey, 0, settings.sankakuAvailable).map(entry => ({ group, entry })));
    const regularJobs = jobs.filter(job => job.entry.source !== 'rule34');
    const rule34Jobs = jobs.filter(job => job.entry.source === 'rule34');
    const valid = () => findTab(tab.id) && version === tab.followVersion && !controller.signal.aborted;
    const worker = async queue => {
      while (queue.length && valid()) {
        const { group, entry } = queue.shift();
        const stream = { follow: group.follow, source: entry.source, group,
          buffer: [], nextPage: 0, emptyPages: 0 };
        try {
          const response = await requestFollowSource(entry, controller.signal);
          if (!valid()) return;
          Object.assign(tab.followSourceNotices, response.notices || {});
          if (response.errors?.[entry.source]) throw new Error(response.errors[entry.source]);
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
      }
    };
    const regular = Promise.all([worker(regularJobs), worker(regularJobs), worker(regularJobs)])
      .then(() => { if (valid()) flushFollowUpdate(tab); });
    await Promise.all([regular, worker(rule34Jobs)]);
    if (!valid()) return;
    flushFollowUpdate(tab);
    await markFollowItemsSeen(tab, tab.followGroups, version);
  } finally {
    if (version === tab.followVersion) {
      if (tab.followUpdateTimer) clearTimeout(tab.followUpdateTimer);
      tab.followUpdateTimer = null;
      tab.loading = false;
      if (!controller.signal.aborted) tab.lastLoadedAt = Date.now();
      if (findTab(tab.id) && activeId === tab.id) render();
      scheduleFollowRetry(tab);
    }
  }
}

async function loadMoreFollows(tab) {
  if (!findTab(tab.id) || tab.loading || tab.followLoadingMore ||
      !tab.followStreams?.length) return;
  const batch = tab.followStreams.filter(stream => followStreamRetryAt(stream) <= Date.now()).slice(0, 3);
  if (!batch.length) {
    updateFollowFeed(tab);
    scheduleFollowRetry(tab);
    return;
  }
  const version = tab.followVersion;
  const controller = tab.followController;
  tab.followLoadingMore = true;
  if (activeId === tab.id) render();
  tab.followStreams = tab.followStreams.filter(stream => !batch.includes(stream));
  try {
    const results = await Promise.all(batch.map(async stream => {
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
        if (response.errors?.[stream.source]) throw new Error(response.errors[stream.source]);
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
    }));
    if (!findTab(tab.id) || version !== tab.followVersion || controller.signal.aborted) return;
    const seenGroups = [];
    tab.followLoadError = false;
    for (const { stream, items, error } of results) {
      if (error) deferFollowStream(stream, error);
      else if (items?.length) {
        stream.group.items.push(...items);
        seenGroups.push({ follow: stream.follow, items });
      }
      if (error || stream.buffer.length || stream.nextPage !== null)
        tab.followStreams.push(stream);
    }
    updateFollowFeed(tab);
    if (activeId === tab.id) render();
    await markFollowItemsSeen(tab, seenGroups, version);
  } finally {
    if (version === tab.followVersion) {
      tab.followLoadingMore = false;
      if (activeId === tab.id) render();
      scheduleFollowRetry(tab);
    }
  }
}

async function loadBookmarks(tab) {
  tab.loading = true;
  render();
  await refreshBookmarks();
  tab.items = bookmarks;
  tab.loading = false;
  if (activeId === tab.id) render();
}

async function loadLikes(tab) {
  tab.loading = true;
  render();
  await refreshLikes();
  tab.items = likes;
  tab.loading = false;
  if (activeId === tab.id) render();
}

async function loadSettings() {
  try { settings = await request('/api/settings'); }
  catch { toast('Настройки не удалось прочитать'); }
  if (currentTab()?.kind === 'settings') render();
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
      excludedTags: CatalogLogic.normalizeExcludedTags(saved.excludedTags),
      hiddenAuthors: (Array.isArray(saved.hiddenAuthors) ? saved.hiddenAuthors : [])
        .filter(author => CatalogLogic.hiddenAuthorKey(author)),
      attributionPriority: ['creator', 'original', 'uploader'].includes(saved.attributionPriority)
        ? saved.attributionPriority : 'creator',
      hideViewedAndSaved: saved.hideViewedAndSaved === true
    };
    globalThis.DartI18n?.setLanguage(contentPreferences.language);
  } catch { toast('Фильтры содержимого не удалось прочитать'); }
  if (currentTab()?.kind === 'settings') render();
}

function applyContentPreferences(saved) {
  const before = contentPreferences;
  contentPreferences = { ...saved, hiddenAuthors: saved.hiddenAuthors || [] };
  globalThis.DartI18n?.setLanguage(contentPreferences.language);
  const contentChanged = ['aiMode', 'excludedTags', 'hideViewedAndSaved', 'hiddenAuthors']
    .some(key => JSON.stringify(before[key]) !== JSON.stringify(contentPreferences[key]));
  if (!contentChanged) return;
  for (const tab of tabs) {
    tab.retainedFeedWorks = new Map();
    delete tab.retainedFeedHeights;
    delete tab.expiredFeedWorks;
    delete tab.expiredFeedTokens;
    tab.profileBanner = '';
    if (tab.kind === 'follows' && tab.followGroups && tab.followStreams) updateFollowFeed(tab);
    if (tab.kind !== 'recommendations') continue;
    tab.recommendationController?.abort();
    tab.recommendationVersion = (tab.recommendationVersion || 0) + 1;
    tab.started = false;
    tab.items = [];
    tab.recommendationTags = [];
    tab.recommendationTagGroups = { names: [], other: [] };
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
  try {
    const saved = await request('/api/content-preferences', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: next.language || globalThis.DartI18n?.language || 'en', aiMode: next.aiMode,
        excludedTags: CatalogLogic.normalizeExcludedTags(next.excludedTags),
        attributionPriority: next.attributionPriority,
        hideViewedAndSaved: next.hideViewedAndSaved })
    });
    applyContentPreferences(saved);
    toast('Настройки сохранены');
  } catch { toast('Не удалось сохранить фильтры'); }
  finally {
    contentPreferencesSaving = false;
    render();
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
  const params = new URLSearchParams({ source: item.source, id: item.id,
 });
  try {
    const detail = await request(`/api/detail?${params}`, { signal: controller.signal });
    if (controller.signal.aborted || findTab(tab.id) !== tab) return;
    if (detail) {
      tab.item = rememberItem(CatalogLogic.mergeDetailPages(tab.item, detail));
      tab.title = tab.item.title;
      recent = recent.map(entry => entry.key === tab.item.key
        ? CatalogLogic.mergeDetailPages(entry, detail) : entry);
      localStorage.setItem('artcatalog-recent', JSON.stringify(recent));
      if (savedKeys.has(tab.item.key) || likedKeys.has(tab.item.key)) {
        await Promise.all([refreshBookmarks(), refreshLikes()]);
        if (controller.signal.aborted || findTab(tab.id) !== tab) return;
      }
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
    loadCreatorWorks(tab);
    loadRelated(tab);
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
          tab.creatorWorks = selectCreatorWorks(item, tab.creatorCandidates);
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
    tab.creatorLoading = false;
    if (findTab(tab.id) === tab && activeId === tab.id) render();
  }
}

function selectCreatorWorks(item, candidates) {
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
    if (selected.length >= 12) break;
  }
  return selected.slice(0, 12);
}

async function loadRelated(tab, append = false) {
  if (findTab(tab.id) !== tab || append && (tab.relatedLoading ||
      !tab.relatedHasMore || tab.relatedError)) return;
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
    tab.relatedRetryPending = false;
    tab.relatedHasMore = tab.relatedSearches.length > 0;
    tab.relatedLoadedOnce = false;
    tab.relatedError = false;
    if (tab.virtualState) delete tab.virtualState.related;
  }
  if (!tab.relatedQuery) {
    tab.relatedHasMore = false;
    if (findTab(tab.id) === tab && activeId === tab.id) render();
    return;
  }
  const controller = new AbortController();
  tab.relatedController = controller;
  const version = tab.relatedVersion = (tab.relatedVersion || 0) + 1;
  tab.relatedLoading = true;
  const rating = ratingFilterFor(item);
  const before = filterFeedWorks(tab.related, 'related').length;
  if (findTab(tab.id) === tab && activeId === tab.id) render();
  try {
    // Limit work per scroll event, not the total number of related results.
    for (let batch = 0; batch < 3; batch++) {
      const group = nextRelatedSearch(tab);
      if (!group) break;
      const sources = Object.keys(group.pages).filter(source => !tab.relatedPaused[source]);
      const params = new URLSearchParams({ q: group.query, page: String(Math.min(...sources.map(source => group.pages[source]))),
        pages: sources.map(source => `${source}:${group.pages[source]}`).join(','),
        sources: sources.join(','), rating, sort: 'recent', kind: 'illustrations' });
      const response = await request(`/api/search?${params}`, { signal: controller.signal });
      if (findTab(tab.id) !== tab || controller.signal.aborted || version !== tab.relatedVersion) return;
      const progress = CatalogLogic.advanceSearchSources(group.pages, tab.relatedPaused, sources, response);
      for (const source of sources) {
        if (response.errors?.[source]) tab.relatedErrors[source] = response.errors[source];
        else {
          delete tab.relatedErrors[source];
          const fingerprint = (response.items || []).filter(entry => entry.source === source)
            .map(entry => entry.key).sort().join('|');
          // Some sources ignore pagination at their limit. Do not fetch the same page forever.
          if (fingerprint && fingerprint === group.fingerprints[source]) delete progress.pages[source];
          group.fingerprints[source] = fingerprint;
        }
      }
      group.pages = progress.pages;
      tab.relatedPaused = progress.paused;
      tab.related = mergeRelatedWorks(item, tab.related, response.items || []);
      tab.relatedHasMore = relatedSearchHasMore(tab);
      tab.relatedLoadedOnce = true;
      rememberItems(tab.related);
      if (findTab(tab.id) === tab && activeId === tab.id) render();
      if (filterFeedWorks(tab.related, 'related').length - before >= 24) break;
    }
    tab.relatedHasMore = relatedSearchHasMore(tab);
    tab.relatedError = false;
  } catch (error) {
    if (error.name !== 'AbortError' && version === tab.relatedVersion)
      tab.relatedError = true;
  }
  finally {
    if (version === tab.relatedVersion) {
      tab.relatedLoading = false;
      if (findTab(tab.id) === tab && activeId === tab.id) render();
      if (findTab(tab.id) === tab && tab.relatedRetryPending) retryRelatedSearch(tab);
    }
  }
}

function relatedSearchHasMore(tab) {
  return (tab.relatedSearches || []).some(group =>
    Object.keys(group.pages).some(source => !tab.relatedPaused[source]));
}

function retryRelatedSearch(tab) {
  if (tab.relatedLoading) { tab.relatedRetryPending = true; return; }
  tab.relatedRetryPending = false;
  tab.relatedError = false;
  tab.relatedPaused = {};
  tab.relatedErrors = {};
  tab.relatedHasMore = relatedSearchHasMore(tab);
  loadRelated(tab, true);
}

function nextRelatedSearch(tab) {
  const groups = tab.relatedSearches || [];
  for (let offset = 0; offset < groups.length; offset++) {
    const index = (tab.relatedCursor + offset) % groups.length;
    const group = groups[index];
    if (!Object.keys(group.pages).some(source => !tab.relatedPaused[source])) continue;
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
  const ranked = CatalogLogic.rankRelated(item, [...existing, ...incoming], Infinity);
  const position = entry => Math.min(...[entry.key, ...(entry.memberKeys || [])]
    .map(key => positions.get(key) ?? Infinity));
  // Appending must preserve the visible cards and the scroll position.
  return ranked.sort((a, b) => position(a) - position(b));
}

async function loadProfile(tab, append = false) {
  if (!append) tab.profileBanner = '';
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
  if (!findTab(tab.id) || append && (tab.loading || tab.hasMore === false || tab.loadError)) return;
  if (!append) tab.profileController?.abort();
  const controller = new AbortController();
  tab.profileController = controller;
  const version = tab.profileVersion = (tab.profileVersion || 0) + 1;
  tab.loading = true;
  if (!append) {
    tab.items = []; tab.page = 0; tab.profileError = false;
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
    if (!findTab(tab.id) || version !== tab.profileVersion) return;
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

function openCreator(item) {
  const attribution = CatalogLogic.workAttribution(item);
  const creator = item.profileParticipantTag
    ? attribution.participants.find(person => person.tag === item.profileParticipantTag)
    : attribution.creator || attribution.participants[0];
  if (!creator) { toast('Автор этой работы пока не определён'); return; }
  createTab('profile', creator.name, { profileRef: CatalogLogic.creatorProfileRef(item, creator.tag),
    rating: ratingFilterFor(item) });
}

function openUploader(item) {
  const uploader = CatalogLogic.workAttribution(item).uploader;
  const id = item.uploaderId || (['gelbooru', 'rule34', 'sankaku'].includes(item.source) ? item.artistId : '');
  if (!uploader || !id) { toast('Загрузчик этой работы не указан'); return; }
  if (item.source === 'danbooru') {
    window.open(`https://danbooru.donmai.us/users/${encodeURIComponent(id)}`, '_blank', 'noopener');
    return;
  }
  createTab('profile', uploader.name, { profileRef: { source: item.source,
    artist: id, service: '' }, rating: ratingFilterFor(item) });
}

function openPreferredAttribution(item, reveal = false) {
  const primary = CatalogLogic.workAttribution(item, contentPreferences.attributionPriority).primary;
  if (primary.role === 'creator' || primary.role === 'contributor') openCreator(item, reveal);
  else if (primary.role === 'uploader') openUploader(item);
  else if (primary.role === 'original' && item.originalUrl)
    window.open(item.originalUrl, '_blank', 'noopener');
  else toast('Автор пока не определён. Проверьте исходную ссылку и теги работы.');
}

function openDetail(item, options = {}) {
  item = rememberItem(item);
  const from = currentTab();
  retainFeedWork(from, item);
  const searchQuery = from?.kind === 'search' ? from.query :
    from?.kind === 'detail' ? from.relatedQuery || from.searchQuery || '' : '';
  const keys = new Set([item.key, ...(item.memberKeys || [])]);
  const existing = tabs.find(tab => tab.kind === 'detail' &&
    [tab.item.key, ...(tab.item.memberKeys || [])].some(key => keys.has(key)));
  if (existing) {
    const grouped = CatalogLogic.groupWorks([existing.item, item])[0];
    existing.item = rememberItem(CatalogLogic.mergeDetailPages(grouped, existing.item));
    saveSession();
    if (options.separate && existing.preview) pinTab(existing.id);
    if (!options.background) activate(existing.id);
    return existing;
  }
  const rating = ratingFilterFor(item);
  const previewMode = !options.separate && tabPreferences.artworkTabs === 'preview';
  const preview = previewMode && tabs.find(tab => tab.kind === 'detail' && tab.preview && !tab.pinned);
  if (!preview) return createTab('detail', item.title, { item, rating, searchQuery,
    preview: previewMode }, { background: !!options.background });
  if (from) from.scrollTop = main.scrollTop;
  abortTab(preview);
  const replacement = { id: preview.id, kind: 'detail', title: item.title,
    item, rating, searchQuery, preview: true, items: [], errors: {}, page: 0,
    loading: false, scrollTop: 0, selectedSources: [...defaultSources],
    sort: 'recent', feed: 'illustrations' };
  tabs[tabs.indexOf(preview)] = replacement;
  if (activeId === preview.id) activeId = null;
  main.dataset.tabId = '';
  activate(replacement.id);
  return replacement;
}

function isSavedWork(item, collection) {
  const keys = collection === 'likes' ? likedKeys : savedKeys;
  return [item.key, ...(item.memberKeys || [])].some(key => keys.has(key));
}

function savedWorkButton(item, collection, detail = false) {
  const like = collection === 'likes';
  const saved = isSavedWork(item, collection);
  const label = like ? saved ? 'Unlike' : 'Like' : saved ? 'Remove bookmark' : 'Add bookmark';
  return `<button type="button" class="${detail ? 'detail-save-button ' : ''}${like ? 'heart-button' : 'bookmark-button'}${saved ? ' saved' : ''}" data-action="${like ? 'like' : 'bookmark'}" data-key="${escapeHtml(item.key)}" title="${label}" aria-label="${label}" aria-pressed="${saved}"${savedWorkPending.has(collection + ':' + item.key) ? ' disabled' : ''}>${svg(like ? 'heart' : 'bookmark')}</button>`;
}

function quickPreviewShortcutAllowed(event, focused) {
  if (event.code !== 'Space' && event.key !== ' ') return false;
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey ||
      focused?.isContentEditable) return false;
  return !focused?.closest?.('input, textarea, select, [contenteditable]');
}

function quickPreviewArtworkAt(target, tab, index) {
  const opener = target?.closest?.('button.card-art[data-action="open"]');
  const cardImage = opener?.querySelector?.('img[data-image-url]');
  const cardItem = opener && index.get(opener.dataset.key);
  if (cardImage && cardItem) {
    const url = [...(cardItem.images || []), cardItem.thumbnail, cardImage.dataset.imageUrl]
      .find(candidate => candidate && !CatalogLogic.videoMimeType(candidate));
    return url ? { item: cardItem, image: cardImage, url } : null;
  }
  if (tab?.kind !== 'detail' || !target?.matches?.('.detail-image img[data-image-url]')) return null;
  const url = target.dataset.imageUrl;
  return url && !CatalogLogic.videoMimeType(url) ? { item: tab.item, image: target, url } : null;
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
  quickPreviewView = quickPreviewClampPan(quickPreviewView, stage.clientWidth, stage.clientHeight);
  stage.classList.toggle('zoomed', quickPreviewView.scale > 1.01);
  stage.classList.toggle('panning', !!quickPreviewDrag);
  image.style.transitionDuration = instant || quickPreviewDrag ? '0s' : '';
  image.style.transform = `translate3d(${quickPreviewView.x}px, ${quickPreviewView.y}px, 0) scale(${quickPreviewView.scale})`;
  quickPreview.querySelector('.quick-preview-zoom').textContent = `${Math.round(quickPreviewView.scale * 100)}%`;
  quickPreview.querySelector('[data-preview-action="zoom-out"]').disabled = quickPreviewView.scale <= 1;
  quickPreview.querySelector('[data-preview-action="zoom-in"]').disabled = quickPreviewView.scale >= 6;
  quickPreview.querySelector('[data-preview-action="fit"]').disabled = quickPreviewView.scale <= 1;
}

function zoomQuickPreview(nextScale, clientX, clientY) {
  const stage = quickPreview.querySelector('.quick-preview-stage');
  if (!stage) return;
  const bounds = stage.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;
  const pointX = Math.max(-bounds.width / 2,
    Math.min(bounds.width / 2, clientX - bounds.left - bounds.width / 2));
  const pointY = Math.max(-bounds.height / 2,
    Math.min(bounds.height / 2, clientY - bounds.top - bounds.height / 2));
  quickPreviewView = quickPreviewZoomAt(quickPreviewView, nextScale,
    pointX, pointY, bounds.width, bounds.height);
  paintQuickPreview();
}

function zoomQuickPreviewFromCenter(nextScale) {
  const bounds = quickPreview.querySelector('.quick-preview-stage')?.getBoundingClientRect();
  if (bounds) zoomQuickPreview(nextScale,
    bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
}

function openQuickPreview({ item, image, url }) {
  if (!item || !url || quickPreview.open) return;
  item = quickPreviewWork = rememberItem(item);
  retainFeedWork(currentTab(), item);
  const preview = image.currentSrc || image.getAttribute?.('src') ||
    imageLoader.cached(image.dataset.imageUrl)?.blobUrl || '';
  const full = imageLoader.cached(url)?.blobUrl || `/api/image?url=${encodeURIComponent(url)}`;
  quickPreviewView = { scale: 1, x: 0, y: 0 };
  quickPreviewDrag = null;
  quickPreview.innerHTML = `<div class="quick-preview-stage">
    <img class="quick-preview-image" alt="${escapeHtml(item.title || 'Изображение')}" src="${escapeHtml(preview || full)}" draggable="false">
    <div class="quick-preview-tools" role="group" aria-label="Image zoom">
      <button type="button" data-preview-action="zoom-out" title="Zoom out" aria-label="Zoom out" disabled>−</button>
      <span class="quick-preview-zoom" aria-live="off">100%</span>
      <button type="button" data-preview-action="zoom-in" title="Zoom in" aria-label="Zoom in">+</button>
      <button type="button" data-preview-action="fit" title="Fit image" aria-label="Fit image" disabled>↺</button>
    </div>
    <button type="button" class="quick-preview-close" data-preview-action="close" title="Close preview" aria-label="Close preview">×</button>
    <div class="quick-preview-actions">${savedWorkButton(item, 'likes', true)}${savedWorkButton(item, 'bookmarks', true)}</div>
  </div>`;
  quickPreview.showModal();
  quickPreview.focus({ preventScroll: true });
  quickPreview.querySelector('.quick-preview-image').addEventListener('load', () => paintQuickPreview(true));
  paintQuickPreview(true);
  recordDetailVisit({ item });
  const generation = ++quickPreviewGeneration;
  if (preview && preview !== full) {
    const loaded = new Image();
    loaded.onload = () => {
      if (quickPreview.open && generation === quickPreviewGeneration)
        quickPreview.querySelector('.quick-preview-image').src = full;
    };
    loaded.src = full;
  }
}

function closeQuickPreview() {
  if (!quickPreview.open) return;
  ++quickPreviewGeneration;
  quickPreviewDrag = null;
  quickPreview.close();
  quickPreview.replaceChildren();
  quickPreviewWork = null;
}

async function toggleSavedWork(item, collection) {
  const pendingKey = collection + ':' + item.key;
  if (savedWorkPending.has(pendingKey)) return;
  savedWorkPending.add(pendingKey);
  syncSavedWorkButtons();
  const sourceTab = currentTab();
  const clickedVisibleFeedCard = visibleFeedCard(sourceTab, item);
  const clickedVisibleFeedHeight = clickedVisibleFeedCard?.getBoundingClientRect().height || 0;
  try {
    if (item.source === 'sankaku' && !isSavedWork(item, collection)) {
      try {
        const detail = await request(`/api/detail?source=sankaku&id=${encodeURIComponent(item.id)}`);
        item = rememberItem(CatalogLogic.mergeDetailPages(item, detail));
      } catch { /* Retain the available preview and tag names if details are restricted. */ }
    }
    const response = await request(`/api/${collection}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item)
    });
    const keys = new Set([item.key, ...(item.memberKeys || [])]);
    const remaining = (collection === 'likes' ? likes : bookmarks).filter(entry =>
      ![entry.key, ...(entry.memberKeys || [])].some(key => keys.has(key)));
    setSavedWorks(collection, response.saved ? [item, ...remaining] : remaining);
    if (response.saved) {
      if (clickedVisibleFeedCard) retainFeedWork(sourceTab, item, clickedVisibleFeedHeight);
      void recordViewedWorks([item]);
    }
    syncSavedWorkButtons();
    await refreshSavedWorks(collection);
    syncSavedWorkButtons();
    for (const tab of tabs.filter(entry => entry.kind === 'recommendations')) {
      if (collection !== 'likes') continue;
      tab.recommendationController?.abort();
      tab.recommendationVersion = (tab.recommendationVersion || 0) + 1;
      if (tab.id === activeId) {
        if (!contentPreferences.hideViewedAndSaved)
          tab.items = tab.items.filter(entry => !isSavedWork(entry, 'likes'));
        tab.loading = false;
        tab.loadError = false;
        tab.errors = {};
        prepareRecommendationProfile(tab);
        render();
      } else tab.started = false;
    }
    const tab = currentTab();
    if (tab?.kind === 'bookmarks' || tab?.kind === 'likes' || tab?.kind === 'recommendations') render();
    if (response.saved && contentPreferences.hideViewedAndSaved && tab?.kind === 'detail') render();
    toast(collection === 'likes' ? response.saved ? 'Добавлено в понравившиеся' : 'Лайк удалён'
      : response.saved ? 'Добавлено в закладки' : 'Удалено из закладок');
  } catch { toast(collection === 'likes' ? 'Не удалось изменить лайк' : 'Не удалось изменить закладки'); }
  finally { savedWorkPending.delete(pendingKey); syncSavedWorkButtons(); }
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
    button.title = label;
    button.disabled = savedWorkPending.has(collection + ':' + button.dataset.key);
    globalThis.DartI18n?.translateTree(button);
  });
}

async function toggleFollow(ref) {
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
  document.getElementById('back-button').disabled = navPosition <= 0;
  document.getElementById('forward-button').disabled = navPosition >= navigation.length - 1;
  document.querySelectorAll('.side-link').forEach(button => {
    const current = currentTab();
    const nav = button.dataset.nav;
    button.classList.toggle('active', nav === current?.kind || current?.kind === 'search' &&
      (nav === 'adult' && current.rating === 'explicit' && current.feed === 'illustrations' ||
       nav === 'search' && current.rating !== 'explicit' && current.feed === 'illustrations'));
  });
  if (currentTab()?.kind === 'detail') searchInput.value = '';
  else searchInput.value = currentTab()?.query || '';
}

function pauseDetailVideos() {
  main.querySelectorAll('video[data-video-url]').forEach(video => video.pause());
}

function render() {
  const tab = currentTab();
  const sameTab = tab && main.dataset.tabId === String(tab.id);
  const scrollTop = sameTab
    ? main.scrollTop : tab?.scrollTop || 0;
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
    imageLoader.refresh(main);
  } else {
    pauseDetailVideos();
    main.innerHTML = markup;
    globalThis.DartI18n?.translateTree(main);
    imageLoader.mount(main);
  }
  main.dataset.tabId = String(tab.id);
  main.scrollTop = scrollTop;
  measureVirtualGrids(tab);
  if (tab.kind === 'profile') scheduleProfileBanner(tab);
  autoFeed.mount();
  if (typeof scheduleRule34Recovery === 'function') scheduleRule34Recovery(tab);
}

function renderNodeKey(node) {
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const value = node.getAttribute('data-work-key') ||
    node.getAttribute('data-grid-key') || node.id;
  return value ? `${node.tagName}:${value}` : '';
}

function canReconcileNode(current, next) {
  if (current.nodeType !== next.nodeType) return false;
  if (current.nodeType !== Node.ELEMENT_NODE) return true;
  if (current.tagName !== next.tagName) return false;
  if (current.tagName === 'IMG') {
    if (CatalogLogic.mediaCacheKey(current.dataset.imageUrl) ===
        CatalogLogic.mediaCacheKey(next.dataset.imageUrl)) return true;
    const oldWork = current.closest?.('article[data-work-key]')?.dataset.workKey;
    return !!oldWork && oldWork === next.closest?.('article[data-work-key]')?.dataset.workKey;
  }
  if (current.tagName === 'VIDEO')
    return current.dataset.videoUrl === next.dataset.videoUrl;
  return true;
}

function reconcileChildren(parent, desired) {
  const keyed = new Map();
  for (const child of parent.childNodes) {
    const key = renderNodeKey(child);
    if (key) keyed.set(key, child);
  }
  let cursor = parent.firstChild;
  for (const next of [...desired.childNodes]) {
    const key = renderNodeKey(next);
    const match = key ? keyed.get(key) :
      cursor && !renderNodeKey(cursor) && canReconcileNode(cursor, next) ? cursor : null;
    if (!match || !canReconcileNode(match, next)) {
      parent.insertBefore(next, cursor);
      continue;
    }
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
}

function renderHome(tab) {
  const grouped = filterFeedWorks(tab.items, tab);
  const first = grouped.slice(0, 7);
  const rest = grouped.slice(7);
  const headline = tab.rating === 'explicit' ? `${tab.sort === 'popular' ? 'Популярные' : 'Новые'} NSFW иллюстрации` :
    tab.rating === 'all' ? 'Все изображения' :
    `${tab.sort === 'popular' ? 'Популярные' : 'Новые'} иллюстрации`;
  return `<div class="content">
    <div class="favorite-tags">${favoriteTags.length ? favoriteTags.map((tag, i) => `<button class="tag-chip chip-${i % 6}" data-action="query" data-query="${escapeHtml(tag)}">${escapeHtml(tag.replaceAll('_', ' '))}<small>#${escapeHtml(tag)}</small></button>`).join('') : '<span class="favorite-tags-empty">Избранные теги появятся здесь. Найдите один тег и нажмите ☆ рядом с его названием.</span>'}</div>
    <div class="mode-tabs">
      ${[['general', 'Обычные'], ['explicit', 'NSFW'], ['all', 'Все изображения']].map(([mode, label]) => `<button class="mode-tab ${mode === tab.rating && tab.feed === 'illustrations' || mode === tab.feed ? 'active' : ''}" data-action="mode" data-mode="${mode}">${label}</button>`).join('')}
    </div>
    <section class="section"><div class="section-head"><h2>${headline}</h2><div class="section-head-actions">${`<button class="text-button ${tab.sort === 'popular' ? 'selected' : ''}" data-action="sort" data-sort="${tab.sort === 'popular' ? 'recent' : 'popular'}">${tab.sort === 'popular' ? 'Сначала новые' : 'Популярные'}</button>`}<button class="text-button" data-action="all">Показать все</button></div></div>
      ${renderErrors(tab.errors)}${tab.loading && !tab.items.length ? skeletons(7) : !first.length && hasResultError(tab.errors) ? '<div class="empty">Результаты не получены. Повторите поиск.</div>' : !first.length && tab.items.length ? emptyFeedMessage(tab) : renderGrid(first, '', new Set(), true)}
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
    <div class="search-heading"><h1>${title}${tab.query ? ` · <span data-no-i18n>${escapeHtml(tab.query)}</span>` : ''}</h1>${favoriteTag ? `<button class="favorite-tag-button ${isFavorite ? 'active' : ''}" data-action="favorite-tag" data-tag="${escapeHtml(favoriteTag)}" aria-label="${isFavorite ? 'Убрать тег из избранного' : 'Добавить тег в избранное'}" title="${isFavorite ? 'Убрать из избранных тегов' : 'Добавить в избранные теги'}" aria-pressed="${!!isFavorite}">${isFavorite ? '★' : '☆'}</button>` : ''}</div>
    <p class="section-sub">Ищите по тегам, выбирайте источники и рейтинг.</p>
    <div class="search-tools">
      <div class="source-filters">${[['general', 'Обычные'], ['explicit', 'NSFW'], ['all', 'Все изображения']].map(([rating, label]) => `<button class="filter-button ${rating === tab.rating ? 'active' : ''} ${rating === 'explicit' ? 'adult-filter' : ''}" data-action="category" data-category="${rating}">${label}</button>`).join('')}</div>
       ${`<div class="source-filters">${Object.entries(names).map(([source, name]) => `<button class="filter-button ${tab.selectedSources.includes(source) ? 'active' : ''}" data-action="filter" data-source="${source}" aria-pressed="${tab.selectedSources.includes(source)}">${name}${sourceKeyHint(source)}</button>`).join('')}</div>`}
      ${`<div class="sort-row"><button class="sort-button ${tab.sort === 'recent' ? 'active' : ''}" data-action="sort" data-sort="recent">Новые</button><button class="sort-button ${tab.sort === 'popular' ? 'active' : ''}" data-action="sort" data-sort="popular">Популярные</button><span>${tab.sort === 'popular' ? 'Danbooru, Gelbooru и Rule34 — по оценкам за всё время. Sankaku — официальный порядок популярности сайта.' : 'Последние публикации всех выбранных источников.'}</span></div>`}
    </div>
    ${renderErrors(tab.errors)}
    ${!blockedQuery && (tab.items.length || Object.keys(tab.searchPageStats || {}).length) ? renderSearchSummary(tab) : ''}
    ${blockedQuery ? '<div class="empty">Запрос содержит тег, скрытый фильтрами содержимого. <button class="inline-retry" data-action="content-settings">Изменить фильтры</button></div>' : tab.loading && !tab.items.length ? skeletons(12) : !tab.items.length && hasResultError(tab.errors) ? '<div class="empty">Результаты не получены. Повторите поиск.</div>' : renderGrid(tab.items, 'search')}
    ${renderFeedTail(tab)}
  </div>`;
}

function renderSearchSummary(tab) {
  const knownTokens = new Set([...viewedTokens, ...[...likes, ...bookmarks].flatMap(CatalogLogic.workHistoryTokens)]);
  const counts = CatalogLogic.searchResultCounts(tab.items, contentPreferences, knownTokens);
  if (contentPreferences.hideViewedAndSaved) {
    counts.shown = filterFeedWorks(tab.items, tab).filter(item => !isExpiredFeedWork(tab, item)).length;
    counts.hiddenKnown = counts.works - counts.hiddenContent - counts.shown;
  }
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

function renderRecommendationTagChips(tags) {
  return tags.map(({ tag, count }) => {
    const mode = recommendationTagPreferences[tag] || 'normal';
    const common = mode === 'normal' && CatalogLogic.isBroadRecommendationTag(tag);
    const hint = mode === 'priority' ? 'Показывать чаще' :
      mode === 'disabled' ? 'Выключен для рекомендаций' :
        common ? 'Общий тег: включите жёлтый приоритет, чтобы он влиял на подбор' :
          'Правая кнопка — настроить рекомендации';
    return `<button class="filter-button recommendation-tag recommendation-tag-${mode}${common ? ' recommendation-tag-common' : ''}" data-action="query" data-recommendation-tag="${escapeHtml(tag)}" data-query="${escapeHtml(tag.replaceAll(' ', '_'))}" title="${hint}"><span data-no-i18n>#${escapeHtml(tag)}</span> <small>×${count}</small></button>`;
  }).join('');
}

function closeRecommendationTagMenu(returnFocus = false) {
  if (recommendationTagMenu.hidden) return;
  recommendationTagMenu.hidden = true;
  if (returnFocus) {
    let trigger = recommendationTagMenu.trigger;
    const context = recommendationTagMenu.context;
    if (!trigger?.isConnected && context) {
      trigger = [...document.querySelectorAll(contentTagSelector + ', [data-context-author-id]')]
        .find(element => {
          const candidate = contentContextTarget(element);
          return candidate?.kind === context.kind && (context.kind === 'tag'
            ? candidate.tag === context.tag
            : CatalogLogic.hiddenAuthorKey(candidate.author) === CatalogLogic.hiddenAuthorKey(context.author));
        });
    }
    trigger?.focus({ preventScroll: true });
  }
  recommendationTagMenu.trigger = null;
  recommendationTagMenu.context = null;
}

const contentTagSelector = '.tag-link[data-query], .tag-chip[data-query], [data-recommendation-tag], .tag-suggestion[data-tag], .favorite-tag-button[data-tag], .excluded-tag[data-tag], [data-context-tag]';
function contentContextTarget(target) {
  const chip = target.closest(contentTagSelector);
  if (chip) {
    const raw = chip.dataset.contextTag || chip.dataset.query || chip.dataset.tag;
    const tag = CatalogLogic.favoriteTagFromQuery(String(raw || '').trim().replace(/\s+/g, '_'));
    if (tag) return { trigger: chip, kind: 'tag', tag,
      recommendationTag: chip.dataset.recommendationTag };
  }
  const author = target.closest('[data-context-author-id]');
  if (!author) return null;
  const identity = { source: author.dataset.contextAuthorSource,
    artistId: author.dataset.contextAuthorId, name: author.dataset.contextAuthorName };
  return CatalogLogic.hiddenAuthorKey(identity) ? { trigger: author, kind: 'author', author: identity } : null;
}

function openContentContextMenu(context, x, y) {
  closeRecommendationTagMenu();
  const tag = context.tag;
  const hidden = context.kind === 'tag'
    ? contentPreferences.excludedTags.includes(CatalogLogic.normalizeExcludedTags([tag])[0])
    : contentPreferences.hiddenAuthors.some(author => CatalogLogic.hiddenAuthorKey(author) === CatalogLogic.hiddenAuthorKey(context.author));
  const current = recommendationTagPreferences[context.recommendationTag] || 'normal';
  recommendationTagMenu.context = { ...context, hidden, favorite: tag && favoriteTags.includes(tag) };
  recommendationTagMenu.tag = context.recommendationTag;
  recommendationTagMenu.trigger = context.trigger;
  recommendationTagMenu.innerHTML = `<div class="recommendation-tag-menu-title" data-no-i18n>${escapeHtml(tag ? '#' + tag.replaceAll('_', ' ') : context.author.name)}</div>
    <button type="button" role="menuitem" data-context-action="hide"${contentPreferencesSaving ? ' disabled' : ''}>${svg('hide')}<span>${hidden ? 'Unhide' : 'Hide'}</span></button>
    ${tag ? `<button type="button" role="menuitem" data-context-action="favorite"${favoriteTagPending.has(tag) ? ' disabled' : ''}>${svg('star')}<span>${favoriteTags.includes(tag) ? 'Unfavorite' : 'Favorite'}</span></button>` : ''}
    ${context.recommendationTag ? `<div class="recommendation-tag-menu-separator" role="separator"></div>
    <button type="button" role="menuitemradio" aria-checked="${current === 'priority'}" data-tag-mode="priority"><span class="recommendation-menu-dot priority-dot"></span>Показывать чаще</button>
    <button type="button" role="menuitemradio" aria-checked="${current === 'disabled'}" data-tag-mode="disabled"><span class="recommendation-menu-dot disabled-dot"></span>Выключить тег</button>
    <button type="button" role="menuitemradio" aria-checked="${current === 'normal'}" data-tag-mode="normal">Обычный режим</button>` : ''}`;
  globalThis.DartI18n?.translateTree(recommendationTagMenu);
  recommendationTagMenu.hidden = false;
  if (!x && !y) { const rect = context.trigger.getBoundingClientRect(); x = rect.left; y = rect.bottom; }
  const width = recommendationTagMenu.offsetWidth;
  const height = recommendationTagMenu.offsetHeight;
  recommendationTagMenu.style.left = `${Math.max(8, Math.min(x, window.innerWidth - width - 8))}px`;
  recommendationTagMenu.style.top = `${Math.max(8, Math.min(y, window.innerHeight - height - 8))}px`;
  recommendationTagMenu.querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
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

function renderRecommendations(tab) {
  const tags = tab.recommendationTags || [];
  const visibleLikes = CatalogLogic.filterWorks(
    CatalogLogic.groupWorks(likes), contentPreferences);
  const groups = tab.recommendationTagGroups || { names: [], other: [] };
  const visibleNames = tab.showMoreRecommendationNames
    ? groups.names : groups.names.slice(0, 6);
  const hiddenNameCount = Math.max(0, groups.names.length - 6);
  return `<div class="content"><h1>Рекомендации</h1>
    <p class="section-sub">Подборка по тегам изображений, которые вы отметили сердечком. Понравившиеся работы не повторяются.</p>
    ${!likes.length ? '<div class="empty feature-empty">Поставьте лайк сердечком, и здесь появятся рекомендации.</div>' : !visibleLikes.length ? '<div class="empty feature-empty">Все понравившиеся работы скрыты фильтрами. Измените настройки содержимого, чтобы получить рекомендации.</div>' : !tags.length ? '<div class="empty feature-empty">У понравившихся работ пока нет подходящих тегов для подбора.</div>' : `
      <div class="recommendation-tags"><span>Ваши частые теги</span>${renderRecommendationTagChips(visibleNames)}${hiddenNameCount ? `<button class="filter-button" data-action="recommendation-tags-more" aria-expanded="${!!tab.showMoreRecommendationNames}">${tab.showMoreRecommendationNames ? 'Свернуть' : `Ещё +${hiddenNameCount}`}</button>` : ''}<button class="filter-button recommendation-other-toggle" data-action="recommendation-other" aria-expanded="${!!tab.otherTagsOpen}" aria-controls="recommendation-other-panel">Other</button></div>
      ${tab.otherTagsOpen ? `<div class="recommendation-other-panel" id="recommendation-other-panel"><div class="recommendation-other-heading"><strong>Теги содержания</strong><span class="recommendation-other-count">${filteredRecommendationOtherTags(tab).length} из ${groups.other.length}</span></div><p class="recommendation-other-note">Частые необычные теги влияют на подбор. Приглушённые общие теги учитываются только с жёлтым приоритетом. Настройка — правой кнопкой мыши.</p><input class="recommendation-other-filter" type="search" data-recommendation-other-filter value="${escapeHtml(tab.otherTagFilter || '')}" placeholder="Найти тег, например group_sex" aria-label="Найти тег содержания"><div class="recommendation-other-list">${renderRecommendationOtherList(tab)}</div></div>` : ''}
      <div class="search-tools">
        <div class="source-filters">${[['general', 'Обычные'], ['explicit', 'NSFW'], ['all', 'Все изображения']].map(([rating, label]) => `<button class="filter-button ${rating === tab.rating ? 'active' : ''} ${rating === 'explicit' ? 'adult-filter' : ''}" data-action="recommendation-rating" data-rating="${rating}">${label}</button>`).join('')}</div>
        <div class="source-filters">${Object.entries(names).map(([source, name]) => `<button class="filter-button ${tab.selectedSources.includes(source) ? 'active' : ''}" data-action="recommendation-source" data-source="${source}" aria-pressed="${tab.selectedSources.includes(source)}">${name}${sourceKeyHint(source)}</button>`).join('')}</div>
      </div>
      <section class="section"><div class="section-head"><h2>Для вас</h2><button class="text-button" data-action="recommendation-refresh">Обновить</button></div>
        ${renderErrors(tab.errors)}
         ${tab.loading && !tab.items.length ? skeletons(10) : tab.items.length ? renderGrid(tab.items, 'recommendations') : contentPreferences.hideViewedAndSaved ? '<div class="empty">Непросмотренных работ по этим тегам пока нет. Попробуйте другой тег или источник.</div>' : '<div class="empty">По выбранным тегам пока нет подходящих работ. Попробуйте другой рейтинг или источник.</div>'}
        ${tab.loading && tab.items.length ? '<div class="feed-status">Подбираем ещё…</div>' : tab.loadError ? '<div class="feed-status">Не удалось продолжить подбор. <button data-action="recommendation-more-retry">Повторить</button></div>' : tab.hasMore && tab.recommendationPaused ? '<div class="feed-status">Новых совпадений пока нет. <button data-action="recommendation-continue">Искать дальше</button></div>' : tab.hasMore ? `<div class="feed-sentinel" data-auto-load="recommendations" data-tab-id="${tab.id}" aria-hidden="true"></div>` : tab.items.length ? '<div class="feed-status">Все доступные рекомендации загружены</div>' : ''}
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
  return `<button class="${className}" ${authorContextData({ ...ref, source: ref.source === 'danbooru' ? 'artist' : ref.source })} data-action="follow" data-follow-source="${escapeHtml(ref.source)}" data-follow-artist="${escapeHtml(ref.artistId)}" data-follow-service="${escapeHtml(ref.service || '')}" data-follow-name="${escapeHtml(ref.name || ref.artistId)}" aria-pressed="${following}">${displayLabel}</button>`;
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
      <button class="text-button" data-action="unfollow" data-follow-key="${escapeHtml(follow.key)}">Отписаться</button></div></div>`;
}

function renderFollows(tab) {
  const manageOpen = !!tab.followManageOpen || !follows.length;
  const sourceStatus = Object.entries(tab.followSourceErrors || {}).map(([source, message]) =>
    `${names[source] || source}: ${message}${followSourceNeedsSettings(message) ? '' : ' Повторяем автоматически.'}`)
    .join('\n') || tab.followErrors?.[0] || '';
  const sourceIcon = sourceStatus ? `<span class="follow-source-status" tabindex="0" role="img" title="${escapeHtml(sourceStatus)}" aria-label="${escapeHtml(sourceStatus)}">ⓘ</span>` : '';
  return `<div class="content"><h1>Подписки</h1>
    <p class="section-sub">Одна подписка на тег художника показывает работы Danbooru, Gelbooru, Rule34 и Sankaku при подключённых источниках. Закрытые работы Sankaku требуют входа. Последние изображения обновляются при открытии вкладки; новые отмечены.</p>
    ${follows.length ? `<button class="follow-manage-toggle" type="button" data-action="follow-manage-toggle" aria-expanded="${manageOpen}" aria-controls="follow-management">${manageOpen ? 'Скрыть список подписок' : `Управление подписками · ${follows.length}`}</button>` : ''}
    ${manageOpen ? `<div id="follow-management" class="follow-management"><form id="artist-follow-form" class="search-tools follow-add-form"><label>Добавить художника по тегу
      <input name="artistTag" maxlength="100" value="${escapeHtml(tab.artistTagDraft || '')}" placeholder="например, sample_artist" required></label>
      <button class="secondary-button" type="submit">Подписаться</button>
      <small>На Gelbooru и Rule34 поиск идёт по тегу художника. Подписка на загрузчика остаётся отдельной.</small></form>
      ${follows.length ? `<div class="followed-artists">${follows.map(follow => renderFollowArtist(follow, tab)).join('')}</div>` : ''}</div>` : ''}
    ${!settings.hasApiKey ? '<div class="source-notice">Для работ Gelbooru укажите API key в настройках.</div>' : ''}
    ${!follows.length ? '<div class="empty feature-empty">Добавьте тег художника или нажмите «Подписаться» на его работе.</div>' : `
      <div class="search-tools"><div class="source-filters">${[['general', 'Обычные'], ['explicit', 'NSFW'], ['all', 'Все изображения']].map(([rating, label]) => `<button class="filter-button ${rating === tab.rating ? 'active' : ''} ${rating === 'explicit' ? 'adult-filter' : ''}" data-action="follow-rating" data-rating="${rating}">${label}</button>`).join('')}</div></div>
      <section class="section"><div class="section-head"><h2>Последние работы${tab.newKeys?.size ? ` · ${tab.newKeys.size} новых` : ''}</h2><div class="follow-feed-actions">${sourceIcon}<button class="text-button" data-action="follow-refresh">Обновить</button></div></div>
        ${tab.followSourceNotices?.sankaku || tab.followSourceErrors?.sankaku ? renderErrors({ sankaku: tab.followSourceErrors?.sankaku || tab.followSourceNotices.sankaku }, 'follow-refresh') : ''}
        ${tab.seenError ? '<div class="source-notice">Не удалось сохранить отметку просмотра. При следующем открытии метка «Новое» может повториться.</div>' : ''}
         ${tab.loading && !tab.items.length ? skeletons(10) : tab.items.length ? renderGrid(tab.items, 'follows', tab.newKeys, true) : '<div class="empty">В этом рейтинге пока нет изображений от авторов, на которых вы подписаны.</div>'}
         ${tab.loading && tab.items.length ? '<div class="feed-status">Обновляем остальных авторов…</div>' :
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
    <div class="source-filters">${[['general', 'Обычные'], ['explicit', 'NSFW'], ['all', 'Все']].map(([rating, label]) => `<button class="filter-button ${tab.rating === rating ? 'active' : ''}" data-action="profile-rating" data-rating="${rating}">${label}</button>`).join('')}</div>
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
    { tags: CatalogLogic.normalizeSearch(query).split(/\s+/) }, contentPreferences);
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

function isHideableFeed(tab, gridKey = '') {
  return tab?.kind === 'home' || tab?.kind === 'recommendations' ||
    tab?.kind === 'search' || tab?.kind === 'detail' && gridKey === 'related';
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
  if (!contentPreferences.hideViewedAndSaved || !tab) return;
  const card = visibleFeedCard(tab, item);
  if (!visibleHeight && !card) return;
  tab.retainedFeedWorks ||= new Map();
  tab.retainedFeedWorks.set(item.key, new Set(CatalogLogic.workHistoryTokens(item)));
  const height = card?.getBoundingClientRect().height || visibleHeight;
  if (height) {
    tab.retainedFeedHeights ||= new Map();
    tab.retainedFeedHeights.set(item.key, height);
  }
}

function isRetainedFeedWork(tab, item) {
  if (!tab?.retainedFeedWorks?.size) return false;
  const tokens = CatalogLogic.workHistoryTokens(item);
  return [...tab.retainedFeedWorks.values()].some(held =>
    tokens.some(token => held.has(token)));
}

function expiredFeedSlot(tab, item) {
  if (!tab?.expiredFeedWorks?.size) return null;
  const key = item.key;
  const direct = tab.expiredFeedWorks.get(key);
  if (direct) return direct;
  for (const token of CatalogLogic.workHistoryTokens(item)) {
    const owner = tab.expiredFeedTokens?.get(token);
    if (owner) return tab.expiredFeedWorks.get(owner) || null;
  }
  return null;
}

function isExpiredFeedWork(tab, item) { return !!expiredFeedSlot(tab, item); }

function expireRetainedFeedWorks(tab) {
  if (!tab?.retainedFeedWorks?.size) return false;
  const bounds = main.getBoundingClientRect();
  const margin = Math.max(450, main.clientHeight || 900);
  const cards = [...main.querySelectorAll('.card[data-work-key]')].map(card => ({
    card, tokens: CatalogLogic.workHistoryTokens(
      itemIndex.get(card.dataset.workKey) || { key: card.dataset.workKey })
  }));
  let knownTokens;
  let changed = false;
  for (const [key, held] of tab.retainedFeedWorks) {
    const shown = cards.find(entry => entry.tokens.some(token => held.has(token)));
    const rect = shown?.card.getBoundingClientRect();
    if (!rect || rect.bottom < bounds.top - margin || rect.top > bounds.bottom + margin) {
      tab.retainedFeedWorks.delete(key);
      knownTokens ||= new Set([...viewedTokens,
        ...[...likes, ...bookmarks].flatMap(CatalogLogic.workHistoryTokens)]);
      if ([...held].some(token => knownTokens.has(token))) {
        tab.expiredFeedWorks ||= new Map();
        tab.expiredFeedTokens ||= new Map();
        tab.expiredFeedWorks.set(key, {
          height: tab.retainedFeedHeights?.get(key) || rect?.height || 0
        });
        for (const token of held) tab.expiredFeedTokens.set(token, key);
      }
      tab.retainedFeedHeights?.delete(key);
      changed = true;
    }
  }
  return changed;
}

function filterFeedWorks(items, tab, alreadyGrouped = false, gridKey = '') {
  const supported = CatalogLogic.filterCatalogItems(items);
  const works = CatalogLogic.filterWorks(
    alreadyGrouped ? supported : CatalogLogic.groupWorks(supported), contentPreferences);
  const hideKnown = contentPreferences.hideViewedAndSaved && isHideableFeed(tab, gridKey);
  if (!hideKnown) return works;
  const knownTokens = new Set([...viewedTokens,
    ...[...likes, ...bookmarks].flatMap(CatalogLogic.workHistoryTokens)]);
  return works.filter(item => isRetainedFeedWork(tab, item) || isExpiredFeedWork(tab, item) ||
    !CatalogLogic.workHistoryTokens(item).some(token => knownTokens.has(token)));
}

function emptyFeedMessage(tab, gridKey = '') {
  return contentPreferences.hideViewedAndSaved &&
    (tab?.kind === 'home' || tab?.kind === 'search' || tab?.kind === 'recommendations' ||
     tab?.kind === 'detail' && gridKey === 'related')
    ? '<div class="empty">На этой странице нет новых для вас работ. Каталог продолжит загрузку при прокрутке. <button class="inline-retry" data-action="content-settings">Настроить скрытие</button></div>'
    : '<div class="empty">Работы на этой странице скрыты фильтрами содержимого. <button class="inline-retry" data-action="content-settings">Изменить фильтры</button></div>';
}

function renderGrid(items, key = '', newKeys = new Set(), alreadyGrouped = false) {
  if (!items.length) return '<div class="empty">Здесь пока нет изображений. Измените запрос или выберите другой источник.</div>';
  const tab = currentTab();
  const works = filterFeedWorks(items, tab, alreadyGrouped, key);
  if (!works.length) return emptyFeedMessage(tab, key);
  const attribute = key ? ` data-grid-key="${escapeHtml(key)}"` : '';
  if (!key || works.length <= 160 || !tab)
    return `<div${attribute}><div class="grid">${works.map(item =>
      renderFeedCard(item, tab, newKeys)).join('')}</div></div>`;
  tab.virtualState ||= {};
  const state = tab.virtualState[key] ||= { cols: 7, pitch: 260, startRow: 0, endRow: 0 };
  const cols = Math.max(1, state.cols);
  const totalRows = Math.ceil(works.length / cols);
  state.totalRows = totalRows;
  const scrollTop = main.dataset.tabId === String(tab.id) ? main.scrollTop : tab.scrollTop || 0;
  const gridTop = tab.gridTops?.[key] ?? 0;
  const row = Math.max(0, Math.floor((scrollTop - gridTop) / state.pitch));
  state.visibleRows = Math.max(1, Math.ceil((main.clientHeight || 1440) / state.pitch));
  if (state.startRow > 0 && row < state.startRow + 2 ||
      state.endRow < totalRows && row > state.endRow - state.visibleRows - 2) {
    state.startRow = Math.max(0, Math.min(totalRows - 1, row - 4));
  }
  state.endRow = Math.min(totalRows, state.startRow + state.visibleRows + 8);
  const visible = works.slice(state.startRow * cols, state.endRow * cols);
  const top = Math.round(state.startRow * state.pitch);
  const bottom = Math.round(Math.max(0, totalRows - state.endRow) * state.pitch);
  return `<div class="virtual-grid"${attribute}><div class="virtual-spacer" style="height:${top}px"></div><div class="grid">${visible.map(item =>
    renderFeedCard(item, tab, newKeys)).join('')}</div><div class="virtual-spacer" style="height:${bottom}px"></div></div>`;
}

function renderFeedCard(item, tab, newKeys) {
  const expired = tab?.expiredFeedWorks?.size ? expiredFeedSlot(tab, item) : null;
  if (expired) {
    const height = Number.isFinite(expired.height) && expired.height > 0
      ? ` style="height:${Math.round(expired.height)}px"` : '';
    return `<article class="card feed-placeholder" data-work-key="${escapeHtml(item.key)}" aria-hidden="true"${height}></article>`;
  }
  return renderCard(item, (item.memberKeys || [item.key]).some(key => newKeys.has(key)));
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
    const cards = [...wrapper.querySelectorAll('.grid > .card')];
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

function renderCard(item, isNew = false) {
  item = rememberItem(item);
  const imageCount = galleryImages(item).length;
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
  return `<article class="card" data-work-key="${escapeHtml(item.key)}"><div class="card-art ${isNew ? 'new-item' : ''}">
    <button class="card-art" data-action="open" data-key="${escapeHtml(item.key)}" data-i18n-keep="${escapeHtml(JSON.stringify(/^(Работа|Artwork|Werk) #/.test(item.title) ? [] : [item.title]))}" aria-label="Открыть ${escapeHtml(item.title)} · ${escapeHtml(sourceTitle)}">
      ${item.thumbnail ? `<img data-image-url="${escapeHtml(item.thumbnail)}" alt="" decoding="async">` : `<span class="text-preview"${/^(Работа|Artwork|Werk) #/.test(item.title) ? '' : ' data-no-i18n'}>${escapeHtml(item.title.slice(0, 180))}</span>`}
      <span class="image-fail">Изображение недоступно</span>
      <span class="source-badge" title="${escapeHtml(sourceTitle)}">${escapeHtml(sourceBadge)}</span>
      ${isNew ? '<span class="new-badge">Новое</span>' : ''}
      ${isAdultRating(item.rating) ? `<span class="rating-badge" title="${ratingLabel(item.rating) === 'Q' ? 'Questionable — пограничный контент' : 'NSFW — откровенный контент'}">${ratingLabel(item.rating)}</span>` : ''}
      ${imageCount > 1 ? `<span class="image-count">▣ ${imageCount}</span>` : ''}
      ${item.images?.some(url => CatalogLogic.videoMimeType(url)) ? '<span class="video-badge" role="img" aria-label="Видео" title="Видео">▶</span>' : ''}
    </button>
    ${savedWorkButton(item, 'likes')}
  </div><button class="card-title" data-action="open" data-key="${escapeHtml(item.key)}" data-i18n-keep="${escapeHtml(JSON.stringify(/^(Работа|Artwork|Werk) #/.test(item.title) ? [] : [item.title]))}" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</button>
  <button class="card-artist" data-action="${taggedArtist && primary.role === 'unknown' ? 'follow-tag-search' : 'attribution-primary'}" data-key="${escapeHtml(item.key)}" ${['creator', 'contributor'].includes(primary.role) ? creatorActionData(item) : workAuthorContextData(item, primary)} data-i18n-keep="${escapeHtml(JSON.stringify(primary.role === 'unknown' && !taggedArtist ? [] : [artistLabel]))}" title="${escapeHtml(roleLabel)}: ${escapeHtml(artistLabel)}"><span class="artist-avatar">${escapeHtml((taggedArtist && primary.role === 'unknown' ? artistLabel.slice(1) : artistLabel)[0].toUpperCase())}</span><span><small>${escapeHtml(roleLabel)}</small>${escapeHtml(artistLabel)}</span></button>${currentTab()?.sort === 'popular' && Number.isInteger(item.popularityCount) ? `<div class="card-popularity">Голоса: ${item.popularityCount}</div>` : ''}</article>`;
}

function skeletons(count) {
  return `<div class="grid loading-grid">${Array.from({ length: count }, () => '<div class="card"><div class="card-art"></div><div class="card-title"></div><div class="card-artist"></div></div>').join('')}</div>`;
}

function renderDetail(tab) {
  const item = tab.item = rememberItem(tab.item);
  if (CatalogLogic.isWorkHidden(item, contentPreferences))
    return `<div class="content"><div class="empty feature-empty">Эта работа скрыта фильтрами содержимого. <button class="inline-retry" data-action="content-settings">Изменить фильтры</button></div></div>`;
  const images = galleryImages(item);
  const tags = CatalogLogic.artworkTags(item, tab.searchQuery);
  const visibleTags = tab.showAllTags ? tags : tags.slice(0, 40);
  const visibleCreatorWorks = selectCreatorWorks(item, tab.creatorCandidates || tab.creatorWorks || []);
  const attribution = CatalogLogic.workAttribution(item, contentPreferences.attributionPriority);
  const primary = attribution.primary;
  const primaryRole = primary.roleLabel || { creator: 'Автор', uploader: 'Загрузчик', original: 'Исходная площадка',
    unknown: 'Автор' }[primary.role];
  const sourceLabel = [...new Set(CatalogLogic.workSources(item).map(record => names[record.source]))]
    .join(' · ') || names[item.source] || item.source;
  return `<div class="content"><div class="detail-layout">
    <div>${tab.detailAccessMessage || item.requiresAuthentication ? `<div class="source-notice source-warning"><span>${escapeHtml(tab.detailAccessMessage || (settings.hasSankakuSession ? 'Для этой работы Sankaku требуется дополнительный доступ аккаунта на сайте.' : item.accessMessage))}</span><button data-action="sankaku-auth">${settings.hasSankakuSession ? 'Аккаунт Sankaku' : 'Авторизуйтесь'}</button></div>` : ''}${images.length ? `<div class="artwork-stage">${images.map((url, index) => renderDetailImage(item, url, index)).join('')}</div>` : ''}
      <div class="detail-meta"><h1>${escapeHtml(item.title)}</h1>
        <div class="muted">${escapeHtml(sourceLabel)} · ${escapeHtml(formatDate(item.published))}${item.rating ? ` · <span${ratingLabel(item.rating) === 'Q' ? ' title="Questionable — пограничный контент"' : ''}>${escapeHtml(ratingLabel(item.rating))}</span>` : ''}</div>
        <div class="detail-actions">${savedWorkButton(item, 'bookmarks', true)}${savedWorkButton(item, 'likes', true)}
          <button class="secondary-button" data-action="external" data-key="${escapeHtml(item.key)}">Открыть на сайте ↗</button></div>
        ${tags.length ? renderArtworkTags(tab, tags, visibleTags) : ''}
      </div>
    </div>
    <aside class="creator-panel"><div class="creator-heading" ${workAuthorContextData(item, primary)}><span class="artist-avatar">${escapeHtml((primary.name || '?')[0].toUpperCase())}</span><div><div class="muted">${escapeHtml(primaryRole)}</div><div class="creator-name"${primary.role !== 'unknown' ? ' data-no-i18n' : ''}>${escapeHtml(primary.name)}</div></div></div>
      ${renderParticipantProfiles(item, attribution)}
      ${attribution.original ? `<div class="attribution-entry"><strong>Исходная ссылка</strong><button class="attribution-link" data-action="original" data-key="${escapeHtml(item.key)}" data-no-i18n title="${escapeHtml(attribution.original.url)}">${escapeHtml(attribution.original.name)} ↗</button></div>` : ''}
      <dl><dt>${sourceLabel.includes(' · ') ? 'Каталоги' : 'Каталог'}</dt><dd class="work-sources">${renderWorkSources(item)}</dd><dt>ID работы · ${escapeHtml(names[item.source] || item.source)}</dt><dd>${escapeHtml(item.id)}</dd></dl></aside>
  </div>
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
  </div>` : ''}<div class="tag-list">${visibleTags.map(tag => {
    const kind = CatalogLogic.artworkTagKind(tab.item, tag);
    const picked = selected.has(tag);
    return `<button class="tag-link${kind ? ` tag-link-${kind}` : ''}${picked ? ' tag-link-selected' : ''}" data-action="query" data-query="${escapeHtml(tag)}" aria-pressed="${picked}" title="${picked ? 'Клик или Enter — искать выбранные теги. Ctrl + клик — снять выбор.' : 'Ctrl + клик — выбрать тег. Обычный клик — искать этот тег.'}">#${escapeHtml(tag.replaceAll('_', ' '))}</button>`;
  }).join('')}${tags.length > 40 ? `<button class="tag-link tag-more" data-action="detail-tags-more">${tab.showAllTags ? 'Свернуть теги' : `Ещё ${tags.length - 40} тегов`}</button>` : ''}</div>`;
}

function renderDetailImage(item, url, index) {
  if (CatalogLogic.videoMimeType(url)) {
    const poster = item.thumbnail && !CatalogLogic.videoMimeType(item.thumbnail)
      ? `/api/image?url=${encodeURIComponent(item.thumbnail)}` : '';
    return `<div class="detail-video"><video data-video-url="${escapeHtml(url)}" src="/api/video?url=${encodeURIComponent(url)}"${poster ? ` poster="${escapeHtml(poster)}"` : ''} controls autoplay muted loop playsinline preload="metadata" aria-label="${escapeHtml(item.title)}"></video><span class="video-fail" role="status">Видео не удалось воспроизвести. Попробуйте ещё раз или откройте запись на сайте.</span></div>`;
  }
  const previewUrl = index === 0 ? item.thumbnail : '';
  const preview = imageLoader.cached(url)?.blobUrl ||
    (previewUrl ? imageLoader.cached(previewUrl)?.blobUrl : '');
  const size = longDetailImageSize(url, previewUrl);
  return `<div class="detail-image${size ? ' long-image' : ''}"${size ? ` style="aspect-ratio: ${size.width} / ${size.height}"` : ''}><img data-action="zoom-image" data-image-url="${escapeHtml(url)}"${previewUrl ? ` data-preview-url="${escapeHtml(previewUrl)}"` : ''}${preview ? ` src="${escapeHtml(preview)}"` : ''} alt="${escapeHtml(item.title)}" role="button" tabindex="0" aria-label="Увеличить изображение: ${escapeHtml(item.title)}" decoding="async"><span class="image-fail">Изображение недоступно</span></div>`;
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
  saveTimer: null,
  unique(urls, comparePixels = false) {
    const revision = this.duplicates.revision;
    const images = DartMediaDuplicates.uniqueImages(urls, this.duplicates,
      CatalogLogic.mediaCacheKey, key => comparePixels ? this.signatures.get(key)?.value : null);
    if (this.duplicates.revision !== revision) {
      clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => { this.saveTimer = null; saveSession(); }, 250);
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
    if (!img.isConnected || img.dataset.imageUrl !== url) return;
    const unique = new Set(this.unique([...stage.querySelectorAll('.detail-image img[data-image-url]')]
      .map(image => image.dataset.imageUrl), true));
    for (const image of stage.querySelectorAll('.detail-image img[data-image-url]')) {
      image.closest('.detail-image').hidden = !unique.has(image.dataset.imageUrl);
    }
    syncGalleryImageCounts();
  }
};

function galleryImages(item) {
  return item.images?.length ? detailImageDeduper.unique(CatalogLogic.artworkMedia(item).images)
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
    badge.textContent = `▣ ${count}`;
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

function renderSettings() {
  const section = ['content', 'authors', 'sources', 'tabs', 'appearance', 'language'].includes(currentTab()?.settingsSection)
    ? currentTab().settingsSection : 'content';
  const themePreference = globalThis.DartTheme?.preference || 'system';
  const hideGenerated = contentPreferences.aiMode !== 'all';
  const hideAssisted = contentPreferences.aiMode === 'generated-and-assisted';
  const excluded = contentPreferences.excludedTags || [];
  const hiddenAuthors = contentPreferences.hiddenAuthors || [];
  return `<div class="content settings-panel"><h1>Настройки</h1><p class="section-sub">Фильтры и подключения хранятся на этом компьютере.</p>
    <div class="settings-layout">
      <nav class="settings-sections" aria-label="Разделы настроек" role="tablist">
        <button type="button" id="settings-tab-content" role="tab" aria-selected="${section === 'content'}" aria-controls="settings-panel" class="settings-section ${section === 'content' ? 'active' : ''}" data-action="settings-section" data-section="content">Контент<span>AI и исключённые теги</span></button>
        <button type="button" id="settings-tab-authors" role="tab" aria-selected="${section === 'authors'}" aria-controls="settings-panel" class="settings-section ${section === 'authors' ? 'active' : ''}" data-action="settings-section" data-section="authors">Авторы<span>Автор, источник и загрузчик</span></button>
        <button type="button" id="settings-tab-sources" role="tab" aria-selected="${section === 'sources'}" aria-controls="settings-panel" class="settings-section ${section === 'sources' ? 'active' : ''}" data-action="settings-section" data-section="sources">Источники<span>Подключения и ключи</span></button>
        <button type="button" id="settings-tab-tabs" role="tab" aria-selected="${section === 'tabs'}" aria-controls="settings-panel" class="settings-section ${section === 'tabs' ? 'active' : ''}" data-action="settings-section" data-section="tabs">Вкладки<span>Просмотр и закрепление</span></button>
        <button type="button" id="settings-tab-appearance" role="tab" aria-selected="${section === 'appearance'}" aria-controls="settings-panel" class="settings-section ${section === 'appearance' ? 'active' : ''}" data-action="settings-section" data-section="appearance">Оформление<span>Цвет и тема</span></button>
        <button type="button" id="settings-tab-language" role="tab" aria-selected="${section === 'language'}" aria-controls="settings-panel" class="settings-section settings-language-section ${section === 'language' ? 'active' : ''}" data-action="settings-section" data-section="language">Язык<span data-no-i18n>English · Русский · Deutsch</span></button>
      </nav>
      <div class="settings-view" id="settings-panel" role="tabpanel" aria-labelledby="settings-tab-${section}">
        ${section === 'appearance' ? `<div class="settings-card"><h2>Тема оформления</h2><p>Системный режим автоматически выбирает светлую или тёмную тему по настройке Windows. Можно выбрать постоянную тему вручную.</p>
          <div class="theme-choices" role="group" aria-label="Тема оформления">
            ${[
              ['system', 'Системная', 'Следует цвету Windows'],
              ['light', 'Светлая', 'Светлый стандарт DART'],
              ['dark', 'Тёмная', 'Тёмный стандарт DART'],
              ['list', 'Лист', 'Графит, холодный голубой и полутоновые точки']
            ].map(([value, label, description]) => `<button type="button" class="theme-choice" data-action="theme-choice" data-theme-choice="${value}" aria-pressed="${themePreference === value}"><span class="theme-swatch theme-swatch-${value}" aria-hidden="true"></span><span class="theme-choice-copy"><strong>${label}</strong><small>${description}</small></span></button>`).join('')}
          </div><p class="settings-hint">Выбор применяется сразу и сохраняется на этом компьютере.</p></div>` : ''}
        ${section === 'language' ? `<div class="settings-card"><h2>Язык интерфейса</h2><p>Выберите язык интерфейса. Названия работ, имена авторов и поисковые теги остаются на языке источника.</p>
          <label class="language-picker">Язык<select name="interfaceLanguage" aria-label="Язык интерфейса">
            <option value="en" ${contentPreferences.language === 'en' ? 'selected' : ''}>English</option>
            <option value="ru" ${contentPreferences.language === 'ru' ? 'selected' : ''}>Русский</option>
            <option value="de" ${contentPreferences.language === 'de' ? 'selected' : ''}>Deutsch</option>
          </select></label><p class="settings-hint">Выбор сохраняется в этом профиле и применяется сразу.</p><p class="settings-hint">Английский — язык по умолчанию.</p></div>` : ''}
        ${section === 'content' ? `
        <div class="settings-card"><h2>AI изображения</h2><p>Выберите, какие работы показывать в поиске, рекомендациях, профилях, похожих работах, понравившихся и закладках. Сохранённые работы остаются на месте.</p>
          <label class="settings-toggle"><input type="checkbox" name="hideGenerated" ${hideGenerated ? 'checked' : ''} ${contentPreferencesSaving ? 'disabled' : ''}><span><strong>Скрывать AI-generated</strong><small>Работы с метками AI генерации и известных генераторов.</small></span></label>
          <label class="settings-toggle settings-toggle-child"><input type="checkbox" name="hideAssisted" ${hideAssisted ? 'checked' : ''} ${!hideGenerated || contentPreferencesSaving ? 'disabled' : ''}><span><strong>Скрывать также AI-assisted</strong><small>Если выключено, работы с участием AI остаются видимыми.</small></span></label>
          <p class="settings-hint">Учитываются метки вроде #ai_generated, #ai-created, #ai_art, #stable_diffusion, #novelai и #ai-assisted. Работа без такой метки не определяется автоматически как AI.</p>
        </div>
        <div class="settings-card"><h2>Уже просмотренное</h2><p>По желанию убирайте знакомые работы из иллюстраций, рекомендаций и раздела «Похожие работы». Понравившиеся, закладки и история просмотра останутся доступны в своих вкладках.</p>
          <label class="settings-toggle"><input type="checkbox" name="hideViewedAndSaved" ${contentPreferences.hideViewedAndSaved ? 'checked' : ''} ${contentPreferencesSaving ? 'disabled' : ''}><span><strong>Скрывать просмотренные и сохранённые работы</strong><small>Учитываются также объединённые копии одной работы из разных источников. Изначально выключено.</small></span></label>
        </div>
        <div class="settings-card"><h2>Исключённые теги</h2><p>Работы с указанными тегами не появятся в каталоге. Совпадение точное: #latex не скрывает #latex_gloves.</p>
          <form id="excluded-tags-form" class="excluded-tags-form"><input name="tags" type="text" maxlength="1000" autocomplete="off" placeholder="Например, 3d, ai_generated_background" aria-label="Добавить исключённые теги" ${contentPreferencesSaving ? 'disabled' : ''}><button class="primary-button" type="submit" ${contentPreferencesSaving ? 'disabled' : ''}>Добавить</button></form>
          ${excluded.length ? `<div class="excluded-tags-list">${excluded.map(tag => `<button type="button" class="excluded-tag" data-action="remove-excluded-tag" data-tag="${escapeHtml(tag)}" data-i18n-keep="${escapeHtml(JSON.stringify([tag]))}" aria-label="Убрать тег ${escapeHtml(tag)}"><span data-no-i18n>#${escapeHtml(tag.replaceAll(' ', '_'))}</span> <span aria-hidden="true">×</span></button>`).join('')}</div>` : '<p class="settings-hint">Список пуст. Можно ввести несколько тегов через запятую.</p>'}
          <p class="settings-hint">Фильтр проверяет все теги объединённой работы из Danbooru, Gelbooru, Rule34 и Sankaku.</p>
        </div>` : section === 'authors' ? `
        <div class="settings-card"><h2>Hidden authors</h2><p>Right-click an author and choose Hide to hide their works in every section. You can unhide them here.</p>
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
        <div class="settings-card"><h2>Как открывать работы</h2>
          <label class="settings-toggle"><input type="radio" name="artworkTabs" value="preview" ${tabPreferences.artworkTabs === 'preview' ? 'checked' : ''}><span><strong>Одна временная вкладка просмотра</strong><small>Следующий арт заменяет временную вкладку. «Назад» возвращает предыдущую работу и место в выдаче.</small></span></label>
          <label class="settings-toggle"><input type="radio" name="artworkTabs" value="new" ${tabPreferences.artworkTabs === 'new' ? 'checked' : ''}><span><strong>Каждая работа в отдельной вкладке</strong><small>Открытые работы остаются в верхней строке до закрытия.</small></span></label>
        </div><div class="settings-card"><h2>Управление вкладками</h2><p>Ctrl + клик или средняя кнопка мыши открывает работу в отдельной фоновой вкладке. Ctrl + Shift + клик сразу переключает на неё.</p><p>Двойной клик по временной вкладке или значок закрепления оставляет её открытой. Закреплённые вкладки защищены от команд «Закрыть остальные» и «Закрыть справа».</p><p>Кнопка списка рядом с «+» показывает все вкладки с полными названиями и поиском. Меню по правому клику помогает закрывать несколько вкладок.</p></div>` : section === 'sources' ? `
        <div class="settings-card"><h2>Источники</h2><p>Danbooru доступен без ключа. Gelbooru и Rule34 требуют ваши user ID и API key.</p>
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
      `/api/detail?source=sankaku&id=${encodeURIComponent(id)}`,
      { signal: AbortSignal.timeout(20000) })).catch(() => null).then(detail => {
        entry.until = [...entry.signals].every(signal => signal.aborted) ? 0 : Date.now() + 60000;
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
      const updated = CatalogLogic.renewWorkMedia(item, detail);
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

const imageLoader = {
  queue: [], active: 0, controllers: new Set(), cache: new Map(), bytes: 0,
  current: new Set(), visible: new Set(), activeJobs: new Map(), generation: 0,
  key(url) { return CatalogLogic.mediaCacheKey(url); },
  cached(url) { return this.cache.get(this.key(url)); },
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
    this.queue = [];
    this.activeJobs.clear();
    for (const controller of this.controllers) controller.abort();
    this.visible.clear();
    root.querySelectorAll('img[data-image-url]').forEach(img => {
      const url = img.dataset.imageUrl;
      if (!url) return;
      if (this.cached(url)) this.enqueue(img, false);
      this.observer.observe(img);
    });
    this.updateCurrent(root);
    this.evict();
  },
  refresh(root) {
    this.observer.disconnect();
    this.queue = this.queue.filter(job => {
      job.images = new Set([...job.images].filter(img => img.isConnected &&
        this.key(img.dataset.imageUrl) === (job.key || this.key(job.url))));
      return job.generation === this.generation && job.images.size;
    });
    this.visible = new Set([...this.visible].filter(img => img.isConnected));
    root.querySelectorAll('img[data-image-url]').forEach(img => {
      if (this.cached(img.dataset.imageUrl)) this.enqueue(img, false);
      this.observer.observe(img);
    });
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
      if (img.getAttribute('src') !== entry.blobUrl) img.src = entry.blobUrl;
      img.closest('.card-art, .detail-image')?.classList.remove('failed');
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
    this.queue.sort((first, second) => Number(inViewport(second)) - Number(inViewport(first)));
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
          let response = await fetch(`/api/image?url=${encodeURIComponent(requestedUrl)}`, { signal: controller.signal });
          if (!response.ok && !renewed && await recover())
            response = await fetch(`/api/image?url=${encodeURIComponent(requestedUrl)}`, { signal: controller.signal });
          if (!response.ok) throw new Error('Image unavailable');
          const blob = await response.blob();
          if (job.generation !== this.generation) return;
          const blobUrl = URL.createObjectURL(blob);
          const matches = [...job.images].filter(img => img.isConnected && this.visible.has(img) &&
            this.key(img.dataset.imageUrl) === key);
          if (!matches.length) { URL.revokeObjectURL(blobUrl); return; }
          if (matches.some(img => img.getAttribute('src')) && typeof Image === 'function') {
            const decoded = new Image();
            decoded.src = blobUrl;
            try { await decoded.decode(); }
            catch { URL.revokeObjectURL(blobUrl); throw new Error('Image decode failed'); }
          }
          if (job.generation !== this.generation) { URL.revokeObjectURL(blobUrl); return; }
          const activeMatches = matches.filter(img => img.isConnected && this.visible.has(img) &&
            this.key(img.dataset.imageUrl) === key);
          if (!activeMatches.length) { URL.revokeObjectURL(blobUrl); return; }
          const old = this.cache.get(key);
          if (old) { URL.revokeObjectURL(old.blobUrl); this.bytes -= old.size; }
          this.cache.delete(key);
          this.cache.set(key, { blobUrl, size: blob.size });
          this.bytes += blob.size;
          for (const img of activeMatches) {
            img.src = blobUrl;
            img.closest('.card-art, .detail-image')?.classList.remove('failed');
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
      if (this.current.has(url)) continue;
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
  if (document.hidden) pauseDetailVideos();
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
    autoFeed.mount();
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
  });
});
window.addEventListener('resize', () => {
  const tab = currentTab();
  if (tab?.virtualState) tab.virtualState = {};
  if (tab) render();
});
new ResizeObserver(() => alignTabStrip(true)).observe(tabsNode);

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
  else if (kind === 'likes') createTab('likes', 'Понравившиеся');
  else if (kind === 'recent') createTab('recent', 'Недавно открытое');
  else if (kind === 'settings') openSettings();
});

document.getElementById('search-form').addEventListener('submit', event => {
  event.preventDefault();
  openSearch(searchInput.value, currentSearchOptions());
});
searchInput.addEventListener('focus', showPopover);
searchInput.addEventListener('input', showPopover);
main.addEventListener('pointermove', event => {
  if (event.pointerType === 'mouse') quickPreviewPointer = { x: event.clientX, y: event.clientY };
});
main.addEventListener('pointerleave', () => { quickPreviewPointer = null; });
quickPreview.addEventListener('cancel', event => {
  event.preventDefault();
  closeQuickPreview();
});
quickPreview.addEventListener('wheel', event => {
  if (!quickPreview.open) return;
  event.preventDefault();
  const stage = event.target.closest?.('.quick-preview-stage');
  if (!stage) return;
  const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? stage.clientHeight : 1);
  zoomQuickPreview(quickPreviewView.scale * Math.exp(-delta * 0.0015),
    event.clientX, event.clientY);
}, { passive: false });
quickPreview.addEventListener('pointerdown', event => {
  const stage = event.target.closest?.('.quick-preview-stage');
  if (!stage || event.target.closest?.('button') || ![0, 1].includes(event.button)) return;
  if (event.button === 1) event.preventDefault();
  if (quickPreviewView.scale <= 1 || quickPreviewDrag) return;
  event.preventDefault();
  quickPreviewDrag = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY,
    x: quickPreviewView.x, y: quickPreviewView.y };
  stage.setPointerCapture(event.pointerId);
  paintQuickPreview(true);
});
quickPreview.addEventListener('pointermove', event => {
  if (!quickPreviewDrag || event.pointerId !== quickPreviewDrag.pointerId) return;
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
quickPreview.addEventListener('dblclick', event => {
  if (!event.target.closest?.('.quick-preview-stage') || event.target.closest?.('button')) return;
  event.preventDefault();
  if (quickPreviewView.scale > 1) zoomQuickPreviewFromCenter(1);
  else zoomQuickPreview(2.5, event.clientX, event.clientY);
});
quickPreview.addEventListener('click', event => {
  const previewAction = event.target.closest?.('button[data-preview-action]')?.dataset.previewAction;
  if (previewAction) {
    if (previewAction === 'close') closeQuickPreview();
    else if (previewAction === 'fit') zoomQuickPreviewFromCenter(1);
    else if (previewAction === 'zoom-in') zoomQuickPreviewFromCenter(quickPreviewView.scale * 1.5);
    else if (previewAction === 'zoom-out') zoomQuickPreviewFromCenter(quickPreviewView.scale / 1.5);
    return;
  }
  const button = event.target.closest?.('button[data-action]');
  if (button && quickPreviewWork) {
    if (button.dataset.action === 'like') void toggleSavedWork(quickPreviewWork, 'likes');
    if (button.dataset.action === 'bookmark') void toggleSavedWork(quickPreviewWork, 'bookmarks');
  } else if (event.target === quickPreview) {
    const bounds = quickPreview.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom) closeQuickPreview();
  }
});
document.addEventListener('keydown', event => {
  if (quickPreview.open) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeQuickPreview();
    } else if (event.code === 'Space' || event.key === ' ') {
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
  if ((event.key === 'Enter' || event.code === 'Space') && !event.repeat &&
      focusedImage?.matches?.('.detail-image img[data-image-url]')) {
    const artwork = quickPreviewArtworkAt(focusedImage, currentTab(), itemIndex);
    if (artwork) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openQuickPreview(artwork);
    }
    return;
  }
  if (!quickPreviewPointer || !quickPreviewShortcutAllowed(event, document.activeElement) ||
      document.querySelector('dialog[open]') || !tabListPanel.hidden || !tabContextMenu.hidden ||
      !recommendationTagMenu.hidden) return;
  const hovered = document.elementFromPoint(quickPreviewPointer.x, quickPreviewPointer.y);
  if (!hovered || !main.contains(hovered)) return;
  const artwork = quickPreviewArtworkAt(hovered, currentTab(), itemIndex);
  if (!artwork) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  openQuickPreview(artwork);
}, true);
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
  } else if (event.key === 'Escape' && !popover.hidden) {
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
  openSearch(query, currentSearchOptions());
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
  popover.innerHTML = `${history.length ? '<div class="popover-title">Недавние запросы</div>' + history.map(entry => `<button type="button" class="popover-row" data-query="${escapeHtml(entry)}" data-no-i18n>${escapeHtml(entry)}</button>`).join('') : ''}
    ${tagSuggestions.length ? `<div class="popover-title">Теги Danbooru · Gelbooru · Rule34</div>${tagSuggestions.map(tag => `<button type="button" class="popover-row tag-suggestion" data-tag="${escapeHtml(tag.name)}"><span data-no-i18n>#${escapeHtml(tag.name.replaceAll('_', ' '))}</span><span class="popover-muted">${tag.sources.map(source => escapeHtml(names[source] || source)).join(' · ')} · ${Number(tag.count).toLocaleString(globalThis.DartI18n?.locale || 'en-US')}</span></button>`).join('')}` : ''}
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
          if (tagSuggestionTerm === term && !popover.hidden) {
            tagSuggestions = suggestions;
            renderPopover();
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

recommendationTagMenu.addEventListener('click', async event => {
  const action = event.target.closest('[data-context-action]')?.dataset.contextAction;
  const context = recommendationTagMenu.context;
  if (action && context) {
    closeRecommendationTagMenu(true);
    if (action === 'favorite') await toggleFavoriteTag(context.tag, !context.favorite);
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
main.addEventListener('scroll', () => closeRecommendationTagMenu());
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
  if (currentTab()?.kind !== 'settings' || contentPreferencesSaving) return;
  const name = event.target.name;
  if (name === 'interfaceLanguage') {
    saveContentPreferences({ ...contentPreferences, language: event.target.value });
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
  if (name !== 'hideGenerated' && name !== 'hideAssisted') return;
  const aiMode = name === 'hideGenerated'
    ? event.target.checked ? 'generated' : 'all'
    : event.target.checked ? 'generated-and-assisted' : 'generated';
  saveContentPreferences({ ...contentPreferences, aiMode });
});

main.addEventListener('submit', async event => {
  const formNode = event.target;
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
  if (item) { event.preventDefault(); openDetail(item, { separate: true, background: !event.shiftKey }); }
});
main.addEventListener('click', event => {
  const control = event.target.closest('[data-action]');
  if (!control) return;
  const tab = currentTab();
  const action = control.dataset.action;
  const item = itemForControl(control);
  if (action === 'zoom-image' && tab?.kind === 'detail') {
    const artwork = quickPreviewArtworkAt(control, tab, itemIndex);
    if (artwork) openQuickPreview(artwork);
  }
  else if (action === 'settings-section' && tab?.kind === 'settings') {
    tab.settingsSection = ['content', 'authors', 'sources', 'tabs', 'appearance', 'language'].includes(control.dataset.section)
      ? control.dataset.section : 'content';
    saveSession(); render();
  }
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
    separate: event.ctrlKey || event.metaKey, background: (event.ctrlKey || event.metaKey) && !event.shiftKey });
  else if (action === 'attribution-primary' && item) {
    if (control.dataset.creatorId) openCreator(item);
    else openPreferredAttribution(item, reveal);
  }
  else if (action === 'creator-profile' && item)
    openCreator(item);
  else if (action === 'uploader-profile' && item) openUploader(item);
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
      openSearch(control.dataset.query || '', currentSearchOptions());
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
    loadRecommendations(tab);
  else if (action === 'recommendation-more-retry' && tab?.kind === 'recommendations') {
    tab.loadError = false; loadRecommendations(tab, true);
  }
  else if (action === 'recommendation-continue' && tab?.kind === 'recommendations') {
    tab.emptyRecommendationRounds = 0;
    tab.recommendationPaused = false;
    loadRecommendations(tab, true);
  }
  else if (action === 'recommendation-rating' && tab?.kind === 'recommendations') {
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
  else if (action === 'follow-refresh' && tab?.kind === 'follows') loadFollowFeed(tab);
  else if (action === 'follow-manage-toggle' && tab?.kind === 'follows') {
    tab.followManageOpen = !tab.followManageOpen;
    render();
  }
  else if (action === 'follow-more-retry' && tab?.kind === 'follows') {
    tab.followLoadError = false;
    loadMoreFollows(tab);
  }
  else if (action === 'follow-rating' && tab?.kind === 'follows') {
    tab.rating = control.dataset.rating;
    saveSession(); loadFollowFeed(tab);
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
    tab.feed = 'illustrations';
    if (tab.feed === 'illustrations') tab.rating = category;
    saveSession();
    loadSearch(tab);
  }
  else if (action === 'sort' && tab && tab.sort !== control.dataset.sort) {
    tab.sort = control.dataset.sort;
    saveSession();
    loadSearch(tab);
  }
  else if (action === 'mode' && tab) {
    const mode = control.dataset.mode;
    tab.feed = 'illustrations';
    if (tab.feed === 'illustrations') tab.rating = mode;
    tab.selectedSources = [...defaultSources];
    tab.sort = 'recent';
    saveSession();
    loadSearch(tab);
  }
  else if (action === 'profile-rating' && tab?.kind === 'profile') {
    tab.rating = control.dataset.rating;
    saveSession(); loadProfile(tab);
  }
});

window.addEventListener('beforeunload', () => {
  saveSession();
  for (const entry of imageLoader.cache.values()) URL.revokeObjectURL(entry.blobUrl);
});

Promise.allSettled([refreshBookmarks(), refreshLikes(), refreshFollows(), loadSettings(),
  loadContentPreferences(), loadClientState(), loadRecommendationTagPreferences(),
  loadViewedTokens(), loadFavoriteTags()]).finally(() => {
  void recordViewedWorks([...recent, ...likes, ...bookmarks]);
  if (!restoreSession()) createTab('home', 'Главная');
});

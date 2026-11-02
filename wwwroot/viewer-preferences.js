(function(root, factory) {
  const api = factory();
  root.DartViewerPreferences = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis, function() {
  const configuredVideos = new WeakMap();
  const ratingViews = new WeakMap();

  function normalize(value) {
    return { nsfwRatings: { q: value?.nsfwRatings?.q !== false, e: value?.nsfwRatings?.e !== false },
      videoSound: value?.videoSound === true };
  }

  function rating(mode, value) {
    if (mode !== 'explicit') return mode;
    const { q, e } = normalize(value).nsfwRatings;
    return q && e ? 'explicit' : q ? 'questionable' : e ? 'explicit-only' : 'none';
  }

  function configureVideo(video, value, force = false) {
    const source = video.dataset?.videoIdentity || video.dataset?.videoUrl || video.src || '';
    if (configuredVideos.has(video) && configuredVideos.get(video) === source && !force) return;
    video.defaultMuted = video.muted = !normalize(value).videoSound;
    configuredVideos.set(video, source);
  }

  function filterItems(items, selection, matches, revision = 0) {
    if (selection === 'explicit' || selection === 'all') return items;
    const known = ratingViews.get(items);
    if (known?.selection === selection && known.revision === revision &&
        known.length === items.length && known.matches === matches) return known.items;
    const filtered = items.filter(item => matches(item, selection));
    const result = filtered.length === items.length ? items : filtered;
    ratingViews.set(items, { selection, revision, length: items.length, matches, items: result });
    return result;
  }

  return { normalize, rating, configureVideo, filterItems };
});

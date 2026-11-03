importScripts('/catalog-logic.js');
try {
  importScripts('/visual-search.js', '/visual-search-loader.js');
} catch { /* Optional Rust assets must not disable catalog processing. */ }

let recommendationProfile = null;
function sameRecommendationData(first, second) {
  if (Object.is(first, second)) return true;
  if (!first || !second || typeof first !== 'object' || typeof second !== 'object') return false;
  const array = Array.isArray(first);
  if (array !== Array.isArray(second) || array && first.length !== second.length) return false;
  if (!array && (Object.prototype.toString.call(first) !== '[object Object]' ||
      Object.prototype.toString.call(second) !== '[object Object]')) return false;
  const keys = Object.keys(first);
  return keys.length === Object.keys(second).length && keys.every(key =>
    Object.prototype.hasOwnProperty.call(second, key) && sameRecommendationData(first[key], second[key]));
}
self.addEventListener('message', ({ data }) => {
  try {
    let args = data.args;
    if (data.profileId !== undefined) {
      if (Array.isArray(args[0])) recommendationProfile = { id: data.profileId, liked: args[0] };
      if (!recommendationProfile || recommendationProfile.id !== data.profileId)
        throw new Error('Recommendation profile is unavailable');
      args = [recommendationProfile.liked, ...args.slice(1)];
    }
    // Compare with the sent data, including if a merge enriches its input in place.
    const prefix = data.operation !== 'followFeed' && Array.isArray(args[1]) ? structuredClone(args[1]) : [];
    let value = data.operation === 'followFeed'
      ? CatalogLogic.groupFollowFeed(...args)
      : CatalogLogic.mergeRecommendations(...args);
    const reusedPrefix = [];
    if (Array.isArray(value) && prefix.length) {
      const byKey = new Map(prefix.map((item, index) => [item.key, index]));
      // Creator evidence can rebuild an entire connected prefix even when its
      // records did not change. Compare all plain data here in the worker, then
      // refer to unchanged input records so their UI metadata caches stay warm.
      // Any learned field, alias or media keeps its complete replacement record.
      value = value.map((item, position) => {
        const index = byKey.get(item.key);
        if (index === undefined || !sameRecommendationData(item, prefix[index])) return item;
        reusedPrefix.push([position, index]);
        return null;
      });
    }
    self.postMessage({ id: data.id, value, ...(reusedPrefix.length ? { reusedPrefix } : {}) });
  } catch (error) {
    self.postMessage({ id: data.id, error: error.message || String(error) });
  }
});

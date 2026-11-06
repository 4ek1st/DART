importScripts('/visual-layout.js', '/catalog-logic.js');
try {
  importScripts('/visual-search.js', '/visual-search-loader.js');
} catch { /* Optional Rust assets must not disable catalog processing. */ }

let recommendationProfile = null;
const groupedReplies = new Map();
const groupingCacheKey = data => data.operation === 'groupWorks' && typeof data.groupingCacheKey === 'string' &&
  data.groupingCacheKey.length > 0 && data.groupingCacheKey.length <= 80 ? data.groupingCacheKey : '';
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
  const groupingKey = groupingCacheKey(data);
  try {
    let args = data.args;
    if (data.profileId !== undefined) {
      if (Array.isArray(args[0])) recommendationProfile = { id: data.profileId, liked: args[0] };
      if (!recommendationProfile || recommendationProfile.id !== data.profileId)
        throw new Error('Recommendation profile is unavailable');
      args = [recommendationProfile.liked, ...args.slice(1)];
    }
    const mergesRecommendations = !['followFeed', 'groupWorks', 'workAnalysis'].includes(data.operation);
    const groupingBase = groupingKey && groupedReplies.get(groupingKey);
    const matchedBase = groupingBase && groupingBase.id === data.baseReplyId ? groupingBase : null;
    // Recommendation merges use their existing sent prefix. Saved grouping
    // uses only an exact acknowledged prior reply; no full library prefix is
    // sent a second time merely to return its unchanged records.
    const prefix = matchedBase ? matchedBase.value : mergesRecommendations && Array.isArray(args[1]) ? structuredClone(args[1]) : [];
    let value;
    if (data.operation === 'followFeed') value = CatalogLogic.groupFollowFeed(...args);
    else if (data.operation === 'groupWorks') value = CatalogLogic.groupWorks(...args);
    else if (data.operation === 'workAnalysis') {
      const [liked, preferences = {}, background = [], options = {}] = args;
      value = { tags: CatalogLogic.recommendationTags(liked, 6),
        tagGroups: CatalogLogic.recommendationTagGroups(liked, 2, preferences),
        queryGroups: CatalogLogic.recommendationQueryGroups(liked, preferences, background, options) };
    }
    else value = CatalogLogic.mergeRecommendations(...args);
    const complete = value, reusedPrefix = [];
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
    if (groupingKey && Array.isArray(complete)) {
      groupedReplies.delete(groupingKey);
      groupedReplies.set(groupingKey, { id: data.id, value: complete });
      while (groupedReplies.size > 4) groupedReplies.delete(groupedReplies.keys().next().value);
    }
    self.postMessage({ id: data.id, value, ...(reusedPrefix.length ? { reusedPrefix } : {}),
      ...(groupingKey ? { groupingCacheKey: groupingKey } : {}),
      ...(matchedBase && reusedPrefix.length ? { baseReplyId: matchedBase.id } : {}) });
  } catch (error) {
    if (groupingKey) groupedReplies.delete(groupingKey);
    if (data.operation === 'workAnalysis' && data.profileId !== undefined && recommendationProfile?.id === data.profileId)
      recommendationProfile = null;
    self.postMessage({ id: data.id, error: error.message || String(error) });
  }
});

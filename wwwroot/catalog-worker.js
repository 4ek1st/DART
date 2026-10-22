importScripts('/catalog-logic.js');

let recommendationProfile = null;
self.addEventListener('message', ({ data }) => {
  try {
    let args = data.args;
    if (data.profileId !== undefined) {
      if (Array.isArray(args[0])) recommendationProfile = { id: data.profileId, liked: args[0] };
      if (!recommendationProfile || recommendationProfile.id !== data.profileId)
        throw new Error('Recommendation profile is unavailable');
      args = [recommendationProfile.liked, ...args.slice(1)];
    }
    const value = data.operation === 'followFeed'
      ? CatalogLogic.groupFollowFeed(...args)
      : CatalogLogic.mergeRecommendations(...args);
    self.postMessage({ id: data.id, value });
  } catch (error) {
    self.postMessage({ id: data.id, error: error.message || String(error) });
  }
});

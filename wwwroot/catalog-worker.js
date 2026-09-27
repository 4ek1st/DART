importScripts('/catalog-logic.js');

self.addEventListener('message', ({ data }) => {
  try {
    const value = CatalogLogic.mergeRecommendations(...data.args);
    self.postMessage({ id: data.id, value });
  } catch (error) {
    self.postMessage({ id: data.id, error: error.message || String(error) });
  }
});

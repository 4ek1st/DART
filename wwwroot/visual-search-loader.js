// Optional local acceleration never holds first paint or a catalog response.
try {
  globalThis.DartVisualSearchModule?.load()?.catch(() => {});
} catch { /* The existing JavaScript implementation remains available. */ }

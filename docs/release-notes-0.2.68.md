# Consistent artwork browsing and smoother recommendations

- Artwork viewers keep the version and gallery order shown in the selected feed card when background loading adds another catalog or version. Newly learned media and attribution remain available; renewed media links are used, and removed versions stay removed.
- Closing and reopening Space keeps already viewed or liked cards in the current feed visit available in the same order. Explicit artwork hides, hidden creators and rating filters still apply immediately.
- Recommendation background processing preserves unchanged artwork records when publishing another batch. This avoids repeatedly rebuilding existing metadata and filtering caches while browsing a large feed.
- Regression coverage checks actual decoded media against rendered cards across the application, including image and video navigation, fullscreen, gallery versions, late source updates and returning to a feed.

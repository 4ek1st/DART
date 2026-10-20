## Configurable curation

- Added Settings > Curation with an opt-in master switch and four independent
  factors: community ratings, your local likes, publication age, and original
  image resolution. English, Russian and German are supported.
- Added Curated alongside New and Popular in discovery. Curation ranks the
  available results and also refines recommendations and related works.
- Community ratings are compared within their catalog and content rating.
  Missing data is neutral, and mirrored copies do not add extra rating points.
  Resolution uses original dimensions from all four catalogs; sketches, line art
  and pixel art are not penalized for their dimensions.
- Ranking uses existing metadata without extra image downloads. A cached, linear
  liked-tag profile avoids blocking the UI on a large personal library. Full
  recommendation reranking continues in its worker.
- New pages keep the existing card order. Following, artist profiles, liked
  works, bookmarks and history keep their normal ordering.
- Curation settings survive restarts and older content-settings forms, while
  preserving unrelated preferences and unknown profile fields.

Curation is optional and initially off. Enable it in Settings > Curation and
select the factors you want. This is metadata-based ranking, with room for new
and unrated works; it does not assign an artistic-quality verdict to images.

# Faster saved collections and Favorites

- Liked and Bookmarks prepare their shared artwork grouping in the background, keeping collection reads and the interface responsive.
- Favorites and Recommendations share background artwork analysis and reuse unchanged evidence. Existing cards stay usable while a new analysis completes.
- Favorites skips recommendation-only tag combinations. Worker messages reuse unchanged artwork records and analysis profiles instead of repeatedly transferring complete results.
- Favorites activity uses bounded packing and parsing caches. Building a large viewing summary no longer holds the global profile lock during decoding.
- Feed membership checks use the existing viewed/saved indexes without repeatedly copying the entire viewing history.
- Space navigation reuses metadata already present in the visible artwork list. Saving from the viewer prepares the next collection snapshot in the background before it is displayed; concurrent saves and newer metadata are preserved.
- Required performance rules and regression checks cover evidence reuse, artwork grouping, recommendation order, activity packing and concurrent profile access. Filters, grouped identities and saved data remain preserved.

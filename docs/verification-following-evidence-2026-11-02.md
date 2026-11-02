# Following visual evidence retention

The reported Windows Following feed displayed many Sankaku variants as separate works. A private read-only copy of 12 cached records was examined through the existing local media proxy and an isolated headless browser. All 12 thumbnails decoded successfully. The current grouping rules recognized two works, containing 9 and 3 variants; changing similarity thresholds was unnecessary.

The failure was in the lifetime of visual evidence. `rememberCardFingerprint` enriched the displayed list, but Following rebuilt its next result from provider records and `followComputed` records that still lacked those fingerprints. The private reproduction produced 2 visible groups, then 12 groups after either source or computed-cache rebuilding. Cached fingerprints also needed to populate the thumbnail identity cache before fresh provider responses arrived after startup.

The fix propagates confirmed thumbnail evidence to Following's backing records, retains it in the coalesced preview-cache write, and reuses existing cached evidence for the same media identity. This applies to all supported catalogs. It does not broaden artist/character/publication matching or modify the similarity thresholds. A different media URL cannot inherit another file's fingerprint solely because its artwork ID matches.

The private 12-record reproduction now produces 2 groups for the visible list, source rebuild, computed-cache rebuild and cold-cache/fresh-provider transition. Three public regression tests use existing sanitized Sankaku fixtures and cover those transitions plus one cache write after a visible batch. They failed before their respective fixes and pass afterward. All 787 Node tests pass, including 65 targeted Following/navigation/source-recovery tests. The actual reported records, URLs and thumbnails remain outside Git and release assets. No direct changes were made to the running installed frontend or personal saved collections during this QA.

The source fix is coordinated with the parallel Windows Favorites work for guarded publication. Binary publication/activation must be reported separately from these source and runtime-fixture checks.

## Faster preparation and card updates

- Reuse tag normalization and validate cached grouping evidence without creating
  temporary arrays for every cache hit. Prepare media identity records once and
  avoid building unused attribution details during visual grouping.
- Skip descendant reconciliation for an unchanged artwork card. Check both
  requested and actual markup, so likes, save failures, renewed media, translated
  labels and late metadata still update normally. Retain decoded images and focus.
- These shared paths serve search, Following, recommendations, artist pages and
  saved works. Grouping rules, filters, saved data and source requests are retained.

Local comparisons verify identical complete grouping output, including refreshed
metadata. Updating 84 unchanged cards took a median 0.7 ms instead of 8.7 ms in
the isolated browser reconciliation check; this excludes template generation,
network requests and image loading. Large-library timings varied with host load
and are not a promise of a fixed application startup or navigation time.

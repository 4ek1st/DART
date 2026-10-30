# DART 0.2.52 performance check

Compared against 0.2.51 on Windows, 2026-10-30. This pass changes the common
catalog preparation and existing-card update paths. It does not change provider
requests, grouping thresholds, filtering rules, profile formats or the Rust core.

## Changes

- Validate existing derived evidence in place. Allocate its signature only on a
  cache miss, preserving the previous scalar/reference/array-length contract and
  explicit invalidation for in-place nested edits.
- Find the visual creator from the same normalized, ordered participants without
  creating attribution details that this computation does not use. Reuse the
  same object-scoped weak cache and invalidation.
- Cache pure filter-tag normalization for at most 4,096 short primitive strings.
  Empty results remain cacheable; long input and dynamic conversions stay uncached.
- Build image identity records once per identity computation rather than twice.
- Remember requested and reconciled actual markup per card in a WeakMap. Skip
  the descendant walk only when both still match. Direct DOM updates, changed
  labels, save rollback and late metadata continue through normal reconciliation.
  Remember a new value only after reconciliation succeeds.

## Grouping comparison

Read the existing saved-works file once into memory without modifying it. Load
separate baseline and candidate modules with the same bundled WASM accelerator.
Each scenario has one excluded warmup and six alternating repetitions. Cloning
and complete-output JSON hashing are outside the timed region. A new container
prevents the identical-array fast path from hiding recomputation.

| Scenario | 0.2.51 median | 0.2.52 median |
| --- | ---: | ---: |
| Large collection, fresh objects | 6,406.33 ms | 3,911.99 ms |
| Large collection, existing objects in a new array | 1,319.74 ms | 1,146.00 ms |
| Large collection, member metadata changed and invalidated | 2,156.51 ms | 1,519.57 ms |
| Small collection, fresh objects | 26.25 ms | 18.62 ms |
| Small collection, existing objects in a new array | 12.89 ms | 10.86 ms |
| Small collection, member metadata changed and invalidated | 13.09 ms | 9.77 ms |

Complete serialized output matched in every scenario. The metadata update
traversed the actual underlying group members and changed the output hash, rather
than just editing a saved wrapper. Source files and the original saved-works
file remained unchanged during this comparison. No private artwork metadata,
URLs, tags, saved-work contents or profile fingerprints are included here.

These are Node wall-clock comparisons, not application startup, UI latency or
provider response measurements. Host load/GC produced substantial variance in
the large collection: the fresh baseline ranged from 2,765 to 13,771 ms and the
candidate from 2,591 to 7,654 ms. Do not present the medians as a stable speedup
on every navigation. The small-collection measurements were much less variable.

The VM harness explicitly supplies TextEncoder/TextDecoder and independently
checks SHA media identities and full neutral grouping output against ordinary
production-module loading. Earlier measurements from a VM without TextEncoder
were invalidated, since its missing hash computation entered the error fallback.

## Browser reconciliation

Own hidden browser context; 84 neutral synthetic cards and 16 desired-tree
passes. The baseline uses the original reconciler and the candidate uses the
actual changed function, including both markup serializations and comparisons.
Template generation and parsing are excluded for both.

| Stage | 0.2.51 | 0.2.52 |
| --- | ---: | ---: |
| Median warm reconciliation | 8.7 ms | 0.7 ms |
| Observed range including the first candidate pass | 5.8-10.3 ms | 0.6-8.7 ms |

Verified retained card/image identity, focused controls, changed metadata and
save state, appended cards and decoded image sources. Tests also cover direct
save mutations/rollback, image failure, hover frames, reconciliation retry after
a write error and replacement cards. This measurement is an isolated stage;
it does not mean a whole page or an image loads twelve times faster.

The actual changed app.js also passed 20 checks with a separate in-memory API
fixture: artwork opening while a Following source remains pending, navigation
and saved-work shortcuts, retained viewed cards, and an intentionally failed like
POST during a background feed publication. The failed save restored the heart
and enabled its control. Repeated navigation did not add search/image requests,
and there were no JavaScript errors or warnings in that run.

## Audit boundaries

Following, search, recommendations and tab return already share request
deduplication, bounded media transport/cache, cancellation ownership, foreground
priority and virtualization. Increasing media retention was not necessary.

An isolated five-frame hover decode cache saved roughly 11 ms over two minutes
of ordinary playback while adding retained decoded image memory. It was not
adopted. Eager cloning of a large artwork-navigation source is measurable, but
sharing its mutable data would risk changing the active browsing sequence; that
change was also not adopted in this pass.

The installed application and original profile were not restarted or modified
for the comparison. Real provider latency and native-window interaction are
outside the synthetic browser check. The quarantined native chrome test harness
was not built or used.

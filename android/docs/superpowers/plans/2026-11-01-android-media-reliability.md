# Android media reliability

Goal: fix ordinary phone browsing in Android 0.1.11: video posters, cold images, jumping cards, stalled loading and navigation delays. Fold-specific redesign and unrelated desktop changes are outside scope.

Confirmed source faults to reproduce: cold progressive binding never fetches its small preview; visible image requests can occupy every image worker and queue a navigation request; video detail branches deliberately display only a play icon; fullscreen removes the poster at preparation rather than first-frame rendering; one undecoded thumbnail gates the entire published feed; late preferred catalog identities replace stable row IDs.

- [x] Capture untouched 0.1.11 source and cold/staggered native baseline in an isolated hidden read-only QA emulator.
- [x] Fix cold preview/full sequencing, independent foreground admission, stale/cancelled/recycled bindings and bounded cache behavior using actual neutral HTTP holds.
- [x] Keep real video posters visible through buffering until the first decoded frame; add clear loading, error and retry behavior with generation/lifecycle guards.
- [x] Publish metadata into stable card slots without a decoded-prefix barrier; keep representative poster and row identity stable during a visit while allowing metadata enrichment and source renewal.
- [x] Preserve viewport position through legitimate grouping changes and avoid unnecessary full-list rebinds.
- [x] Verify ordinary compact-phone cold open, scroll, paging, back, rapid previous/next, photo/video transitions and cancellation; measure scoped frame/loading evidence before and after.
- [x] Apply the user's added Following requirements: independent shallow-page request coverage, genuine New/date order across authors, stable exposed and traversed prefixes, unseen-tail updates, and fullscreen-only video autoplay.
- [ ] Run the full Android unit/lint/build checks, verify the existing signing certificate, sync only reviewed Android files into the shared source and publish a separate non-latest Android release.

Use neutral fixtures only. Keep user profiles, credentials, installed PC software, physical-phone data and existing signing identity intact. No new dependencies, cache deletion on the user's device, archives or source/model/provider changes outside these Android fixes.

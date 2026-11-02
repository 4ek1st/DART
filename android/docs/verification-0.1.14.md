# Android 0.1.14 verification

## Scope and isolation

Android imported-profile browsing, media recovery, navigation and in-app updates. Windows binaries, its update channel and the original desktop profile are unchanged. All Android runtime checks use our hidden, read-only ArtCatalogQA emulator, API 35 / Android 15, compact portrait display, 2 GiB RAM and a normal 192 MiB heap growth limit. The physical Fold 7 / Android 17 and ordinary ArtCatalogPhone AVD are not controlled or updated.

The private 18.86 MB desktop export is read-only. Owned temporary emulator users receive copies; diagnostics report aggregate counts and timings rather than artwork titles, tags, queries, IDs, credentials or media URLs. Private data, APK fixtures, signing keys and recordings remain outside Git and release assets.

## Large-profile reproduction and performance

The released source fails the real native import with an OutOfMemoryError while cloning another complete JSON document. The repaired codec imports without raising the heap limit or dropping collections. Streaming persistence, incremental identity indexes and reusable recommendation/curation data remove repeated complete-profile work.

The final performance scenario uses the actual transfer codec and Store, 3,280 input like records, 439 bookmarks, 118 follows and 74,472 viewed identities. Normalization retains 3,262 unique likes and 432 unique bookmarks with their original identities. One neutral interaction probe adds a like and bookmark; a fresh process confirms 3,263 likes, 433 bookmarks, all 118 follows and that exact probe after disk persistence.

With neutral independently delayed provider delivery, the measured candidate parses in 4.47 s and commits the import in 9.97 s. First bound cards and decoded previews arrive in Home at 7.49 s, Following at 0.96 s, search at 3.99 s and an author page at 0.55 s. Home includes the initial large taste build; search includes recalculation after the new like. These are emulator measurements of processing and controlled network scheduling, not external-provider or physical-phone speeds. The measured maximum main-thread heartbeat gap is 222 ms; this is not a 60 fps claim.

Home and Following remain clickable while another provider is held for four seconds. Returning preserves the same feed generation and cards. Opening a result takes 143-291 ms in the measured run; returning takes 207-208 ms. Liking and bookmarking persist, and cards remain in the current visit.

Native Simpleperf identifies grouping, sample construction, tag normalization and JSON allocation in the taste worker. Targeted changes retain ranking and grouping semantics, checked against existing fixtures and bit-identical curation weights. Host allocation measurements support the diagnosis but are not presented as phone benchmarks.

## Navigation, media and restoration

A failed preview no longer prevents advancing: optional preparation has a bounded wait, and media loading continues separately. Deferred pagination previously recursed until StackOverflowError; the same native regression now returns immediately, allows reverse navigation, retries the exact source cursors while the viewer is open, retains the selected work on late arrival and issues only the expected two requests.

Large local galleries restore from Store in order. The process-death state contains at most five neighbors on each side instead of serializing thousands of saved artworks. In-memory recreation retains the complete live gallery. Remote process-death restoration keeps the nearby buffer and next-page cursors; it does not promise all earlier fetched rows.

A real guest Sankaku recovery probe preserves a saved legacy numeric identity and its own exact hash, refreshes usable media in 1.82 s and decodes the actual preview in 3.44 s total. Background repairs use a separate bounded queue. Neutral native image/video checks cover selected-image priority, progressive loading, anchored regrouping and retaining a poster until the first video frame or a retryable error.

## Android updates

The fixed Android metadata channel is separate from Windows releases/latest. Checks and downloads use their own application-scoped worker. Metadata and download size are bounded; downloads are explicit and cancellable. Installation verifies the APK file digest, size, exact package, higher version code and the installed signing certificate, then uses a read-only FileProvider URI and Android's installer. Unknown-source permission requires an explicit action; returning after denial does not trigger a prompt loop. The updater does not read profile credentials.

The full Android JVM suite passes 278 tests with zero failures, errors or skips. Release lint has zero errors and 33 existing warnings; this is not described as warning-free. An independent read-only review and a separate SDK 35 compile approve the final updater core, manifest and provider configuration.

Native updater checks use a local, synthetic future debug APK signed with the same debug certificate and the real PackageManager archive validator. Only the fixed feed/asset URLs are mapped inside the debug source set. Manual checking finds the candidate without downloading; a temporary connection failure retains it; cancellation removes the partial file; retry produces the verified complete APK. Listener callbacks run on the main thread. This test mapping and its fixture APK are absent from the release.

On the actual Home screen, the update arrow appears before Settings is opened. At 360dp and 130% font size the update panel wraps without overlap; rotation preserves the Updates route and ready state. Denying the Android installation permission returns to the ready page without reopening it. Granting permission opens the real system installer; cancelling it returns without a loop. A second explicit install succeeds from code 15 to the owned synthetic code 16. The installed code is confirmed through PackageManager, the now-current update badge disappears, and saved collections, all 67 existing viewed identities, tag preferences and hidden-author settings remain equal across installation. The separate signed release smoke check below uses nonempty saved collections.

Signed release, public-feed and downloaded-asset results are recorded below after completion.

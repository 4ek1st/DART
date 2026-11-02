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

The final native navigation run passes 13/13 assertions, including rapid inputs, a slow page boundary, reverse browsing, filtered pages, retry, failed images and cancellation. Ordinary artwork transitions move the whole page; the check confirms both retained bitmaps and opposite outgoing/incoming movement. The obsolete image-only/fixed-controls oracle and a fixture that accidentally reused another work's exact URL were corrected in debug code, without changing production animation or duplicate detection.

A real guest Sankaku recovery probe preserves a saved legacy numeric identity and its own exact hash, refreshes usable media in 1.82 s and decodes the actual preview in 3.44 s total. Background repairs use a separate bounded queue. Neutral native image/video checks cover selected-image priority, progressive loading, anchored regrouping and retaining a poster until the first video frame or a retryable error.

On the final build, fullscreen video shows its poster at 803 ms and the first rendered frame at 4.05 s; PixelCopy confirms actual nonblack video frames. Actual video → image → video swipes resume a new video rendering session. An injected failure appears at 918 ms with the poster retained. Tapping the real Retry control recovers playback and rendered frames. Both scenarios have zero AndroidRuntime crashes or ANRs. The loopback deliberately delays media; these values validate state transitions rather than external streaming speed.

## Android updates

The fixed Android metadata channel is separate from Windows releases/latest. Checks and downloads use their own application-scoped worker. Metadata and download size are bounded; downloads are explicit and cancellable. Installation verifies the APK file digest, size, exact package, higher version code and the installed signing certificate, then uses a read-only FileProvider URI and Android's installer. Unknown-source permission requires an explicit action; returning after denial does not trigger a prompt loop. The updater does not read profile credentials.

The full Android JVM suite passes 278 tests with zero failures, errors or skips. Release lint has zero errors and 33 existing warnings; this is not described as warning-free. An independent read-only review and a separate SDK 35 compile approve the final updater core, manifest and provider configuration.

Native updater checks use a local, synthetic future debug APK signed with the same debug certificate and the real PackageManager archive validator. Only the fixed feed/asset URLs are mapped inside the debug source set. Manual checking finds the candidate without downloading; a temporary connection failure retains it; cancellation removes the partial file; retry produces the verified complete APK. Listener callbacks run on the main thread. This test mapping and its fixture APK are absent from the release.

On the actual Home screen, the update arrow appears before Settings is opened. At 360dp and 130% font size the update panel wraps without overlap; rotation preserves the Updates route and ready state. Denying the Android installation permission returns to the ready page without reopening it. Granting permission opens the real system installer; cancelling it returns without a loop. A second explicit install succeeds from code 15 to the owned synthetic code 16. The installed code is confirmed through PackageManager, the now-current update badge disappears, and saved collections, all 67 existing viewed identities, tag preferences and hidden-author settings remain equal across installation. The separate signed release smoke check below uses nonempty saved collections.

## Signed release and public feed

The signed APK is built from the clean, reviewed source `b71f6326313c0ffb1049f58b7149d23dde15609f`, package `com.artcatalog.mobile`, version `0.1.14`, code `15`, minimum API `26`. APK Signature Scheme v2/v3 verification passes with the existing certificate SHA-256 `b97a808c1adcfa9b0489b04b09848f8638eb6df276d259f044d58f1fd01fcf5d`. The APK is 2,186,426 bytes; SHA-256 is `f5f5c15a4d7910651d82eac9dd3cb27a85aa894ff6a5425a368d7a84d40334ac`. Release inspection excludes debug classes, fixtures, profile files and signing material.

The published `android-v0.1.14` APK and checksum are downloaded again. Their digest, bytes and signing certificate match the staged build and GitHub's asset digest. The fixed public `android/update.json` serves that exact package, code, URL, size and SHA-256. Publication uses `--latest=false`; GitHub's Windows latest remains `v0.2.56`.

The downloaded signed APK installs over signed 0.1.13 in a separate owned emulator user with a neutral nonempty profile. The real My page shows one like, one bookmark and one followed artist after the update. Saved keys, viewed identity, favorite tag, normalized hidden author and priority preference remain present. The untouched primary emulator profile is byte-for-byte unchanged, as is the original desktop export.

Before any Settings interaction, the release app automatically fetches and caches the live public feed; no badge is shown for its current version. The actual Settings → Updates route shows installed 0.1.14 and Up to date. Tapping Check for updates advances the persisted check timestamp and returns to Up to date. This validates the production background/manual network path in addition to the synthetic newer-version installation test.

The Android source mirror contains the reviewed changes with matching file hashes. The owned hidden emulator is stopped after verification. Physical Galaxy Fold 7 / Android 17, personal provider sessions and real-account rate limits are not part of this emulator result.

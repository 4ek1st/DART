# Additional defect audit for 0.2.35

## Confirmed defects

1. Following and recommendation rating checks discarded `s`, `sensitive`,
   `safe` and `sfw` despite the backend accepting them as ordinary content.
2. A grouped mirror could bypass a hidden source uploader when the preferred
   record came from a different catalog.
3. Closing an active library tab made a background artwork visible without
   recording its visit or running the full activation path.
4. Duplicate history entries and reused preview-tab IDs could lose the displayed
   artwork's history position or let an old pending arrow complete after Back.
5. The preparation deadline stopped network reads but could not settle a caller
   waiting for a stalled browser image decoder.
6. A late cached-frame decode failure on a previous card stopped a newer card's
   active video hover preview.
7. Pending like/bookmark guards used the representative post key. Another source
   or saved variant could invert the same operation. Exact aliases also needed
   their saved keys included in the native mutation payload.
8. The 1,000,000-byte client-state API limit rejected a real grouped-metadata
   session of nine pinned detail tabs with forty members each: 1,530,580 bytes.
   The signed 0.2.34 baseline returned HTTP 413 for that isolated fixture.

## Regression and integration coverage

Every defect was reproduced with a failing production-function regression or a
request to the signed baseline. Focused checks cover both removal and saving,
independent collections, pending/error controls, complete saved alias closure,
ordinary/adult rating boundaries, uploader source scoping, retry/cancellation,
distinct detail snapshots and exact scroll restoration.

The large-session API regression checks full metadata round-trip, the exact
16 MiB boundary, UTF-8 byte count, chunked requests, malformed/foreign/oversized
writes retaining prior state, and persistence after a server restart. This API
test runs under the guarded publisher with the other native integration tests.

## Hidden UI checks

Microsoft Edge at 2560 x 1440, scale 1, using a separate copy of the profile and
neutral synthetic artwork. Catalog responses were controlled; like/unlike writes
used the real native API in the copied profile. Closing the active library
recorded the newly visible artwork; another catalog's heart reflected the pending
write and then removed the existing saved alias without creating a duplicate.

The media stability scenario also retained the 160-to-161 grid, preserved decoded
images, completed eight warm left/right transitions without repeated full-image
requests, and sampled zero blank artwork frames. Completed cached images were
not fetched again on return; newly visible prefetch targets remain allowed.
Small-window and reduced-motion checks remained covered.

All 28 original profile file hashes were unchanged in the recorded hidden UI
runs. The installed application was not activated or replaced. These browser
checks do not establish external-provider latency or native full-window input
coverage; the quarantined optional `tests/chrome` harness was not used.

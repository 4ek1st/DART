# DART 0.2.63 verification

Published: https://github.com/4ek1st/DART/releases/tag/v0.2.63

- Binary source: `a33bbc634e6cfaa572c58f677e177980d5b35bbd`.
- Signed sequence: `63`; predecessor is official sequence 62, `d75c3e475a2373b7d5fb8f09b9502d362444edab791e991004486e4284764994`.
- EXE size: `83,931,674` bytes.
- EXE SHA-256 / build ID: `1bc15acf7cbd5dbeb7fc04b4b44b71a203619e395bfd8195771478231f39f825`.

## Gates and review

The canonical guarded publisher passed 893/893 Node checks, native catalog/profile/saved-data/upscale fixtures, privacy fixtures and update/signature/ancestry/profile-preservation checks. The source stayed clean during verification and signing. No protected base, receipt or installed release pointer was rewritten manually.

A fresh read-only review identified one Important issue: lifecycle cancellation prevented later automatic processing of the same image. Four transitions were reproduced RED before fixing: fresh DOM reopen, Auto off/on, background/return, and failed preference-save rollback. All are GREEN; pending job deduplication, manual ownership, original/result overrides and bounded genuine errors remain covered. The complete 893-test suite passed after the fix. No deferred Minor findings remain.

Android reference provenance was regenerated after adding the desktop-only option to skip unused combinations. Default query/ranking/grouping/curation/fingerprint fixture data was identical; only its source hash and matching test expectation changed. The offline native Android conformance test passed 4/4. Android runtime source and APK were unchanged.

## UI and performance

Synthetic Edge checks exercised Favorites panel alignment, narrow layout, dark/light/List themes, selected controls, outer-image hover with stable card dimensions, failed/dragging previews, reduced motion, shared artwork menus, existing all-tag copying, group persistence and selected-image download/copy. Viewer filtering and keyboard/video preferences also passed their existing browser fixture.

The new browser fixture exercised absent-module Auto state, persisted checked state, partial scale/Auto saves, idle feed thumbnails, Space auto processing through the real image worker and a mocked job response, and U original/result comparison without another job. It did not install or execute the optional GPU module. The unchanged module's actual inference coverage is recorded for 0.2.62; this release makes no new GPU quality or speed claim.

`node scripts/benchmark-favorites.cjs` reproduces an offline CPU benchmark against base `2435a62`: 2,000 synthetic likes, 70 content tags per like, 50 characters, 200 artists and 300 recent works. Three fresh Node processes per version alternate before/after. Median Mine preparation was 416.26 ms before and 211.69 ms after; subsequent forced recalculations fell from 363.67–384.69 ms to 2.14–2.42 ms. System calculations after the shared evidence was prepared took 1.66–2.06 ms. These figures measure `cards()` only, excluding DOM, image decoding, native I/O and network loading. All benchmark runs retained 50 cards and covers. No general recommendation-accuracy claim is made.

Character-cover fixtures cover exactly one normalized matching typed name, optional `solo`, duplicates, multiple/wrong/missing typed names, Mine/System, history and liked fallback, ratings, hidden/incomplete metadata, rich metadata and preserved counters/placeholders. Tags and saved Artworks keep their separate behavior.

## Exact public artifact

The public EXE and signed manifest were downloaded again. The existing trusted ECDSA public key verified the manifest; source/version/sequence, predecessor, size and SHA-256 matched. Sixteen frontend assets served by the exact downloaded EXE matched the canonical source checkout byte for byte.

Two cold server-only starts used a fresh isolated profile. Defaults were 2× and Auto off. Partial native writes enabled Auto and then selected 4× without resetting Auto. The second start retained 4× / Auto on. The optional module stayed absent and its cache remained empty. Test-owned processes were terminated after completed atomic preference requests; this is not evidence of graceful native GUI shutdown.

The installed updater reported current `0.2.62`, available `0.2.63`, `verified: true`, and no error. Publication and verification did not activate or restart the user's application or use the personal profile as test data. Native GUI interaction remains untested because the quarantined `tests/chrome` harness was not rebuilt or used. Browser coverage is synthetic and does not claim exhaustive combinations or live-provider reliability.

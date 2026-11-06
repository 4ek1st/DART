# DART 0.2.74 verification

Verified on 2026-11-06. Published with `scripts/Publish-Release.ps1`; no installed files were overwritten and the running application was not restarted.

## Immutable release

- Public release: https://github.com/4ek1st/DART/releases/tag/v0.2.74
- Binary source commit: `15b3d6d28caee2f69d5c10da3dbc22b4a78f3c39`.
- Sequence: `74`; ancestor: `885851c1e99a325185f8eaea5afe58bc1c08b4334d03e2367412ffb48116a31b` (0.2.73).
- EXE size: `83972752` bytes.
- Build ID / SHA-256: `8a02ab0dce51268a70ffa25ad06505e092472a713fb8b859a7bcd75b7380a7ef`.
- Public signed manifest passed ECDSA verification using the existing installation's trusted public key. The sealed EXE's complete hash and size matched the manifest and GitHub asset digest/size. This is not a claim that a second complete EXE download was performed.
- Exact sealed EXE started in server-only mode with a neutral data directory and an isolated copy of the installed receipt/configuration. Fourteen embedded frontend assets, including provider pages, source status and preview gallery, matched the committed source byte for byte.
- Its real update check reported installed `0.2.73`, available `0.2.74`, `verified: true`, no error. Empty neutral Liked, Bookmarks and Favorites were preserved.
- The actual installation's active receipt SHA-256 stayed `086a7e7a34c176d7133c8260459471d9ad399e46588e796a38d2153b65da7146`. No personal profile was written or migrated.

## Required release checks

- All `tests/*.test.cjs`, serialized: **1253/1253 passed**.
- Full native catalog/identity/grouping/profile/concurrency/media fixtures passed, including the new Danbooru transport, source availability and artist enrichment budget cases.
- Native privacy and signed-update/activation/profile-preservation fixtures passed.
- Visual-search artifact guard and canonical-source/base/clean-tree guards passed.
- One initial publisher attempt stopped before signing/publication because an existing cancellation test used a competing 280 ms timer. A deliberately paused event loop reproduced the same failure: the 250 ms outer grace fired, but the inner zero-delay cancellation had not yet run when the assertion executed. The test now awaits the actual bounded abort event, preserves its grace/stale-pixel/pin assertions, and includes the paused-loop regression. No production cancellation behavior was changed to pass it.

## Hidden browser checks

All used neutral local fixtures and existing headless Edge; no visible window, desktop focus, real artwork or live-profile mutation was required.

- **751/751** grid/viewer consistency checks across Home, Search, Recommendations, Following, Liked, Bookmarks, Recent, Favorites, profiles and Related, at **2560 x 1440**. Selected work identity, grouped members and decoded pixels remained consistent through detail, Space and fullscreen navigation.
- **477/477** all-provider outage/filter/recovery checks: each of four providers unavailable in Search, Recommendations, Following and Related, plus all providers unavailable. AI/furry/tag/author/rating/followed/viewed/saved filters and unique card identities remained intact after failure and recovery.
- A separate **18/18** real-input boundary run crossed 12 consecutive Right steps while Danbooru page 1 remained pending. Healthy sources reached page 3 without closing Space or scrolling the grid; Back remained usable. Keydown-to-preview-DOM commits measured **4.1-28.0 ms**, with no observed browser long tasks. Automation round trips were **18-39 ms** in that isolated run. A concurrent two-browser run had larger automation round trips; these figures describe the isolated neutral fixture, not remote download latency.
- **75/75** gallery checks, including all four providers, ten contexts, explicit page-two selection, deduplicated pages, W/S and Up/Down, wheel paging, zoom/pan, A/D, F/B, mixed-video teardown, cancellation, loading/error/retry, reduced motion and **420 x 800** layout. Current and next images have separate rounded frames, actual next-image pixels, visible gutters and an independent compact page control.
- **42/42** source-dot checks across four outages/recovery, auth/network neutrality, EN/RU/DE, themes and compact layout.
- **35/35** return/highlight checks with **640 works**, including 130 real arrow presses beyond the rendered virtual window, Escape/Space/X, removed targets and reduced motion. Close-to-outline commits: **5.7-9.5 ms** normally, **36.6 ms** for the deep virtual return.
- Existing real-pointer Space regression passed: unliking/removal, stationary mouse, 24 rapid close/reopen pairs, scroll, viewport reentry and blur reset. Expectations use the actual post-return mouse target after the requested scroll-to-last behavior.
- No browser runtime errors in the successful final matrices. Related-card pixel waiting was scoped to the selected Related grid rather than an offscreen duplicate in the author strip.

## Provider and cancellation guarantees

- Native Danbooru fixtures cover shared Retry-After delta/date, one recovery probe, bounded queue/body/cache, identical GET sharing, fresh cached reads, malformed endpoint shapes, caller cancellation, and request-scoped 401/403/400/422 failures. Explicit server deadlines remain shared.
- Genuine loader tests cross three boundaries in Search, Following, Recommendations and Related with a held peer; hidden-only and duplicate-only pages and reverse cancellation are covered. Generation-owned source failures prevent late older successes from clearing newer server deadlines. A failed recommendation rank aborts queued publication before it can commit.
- Danbooru 403 without a server deadline remains an access-neutral query pause in Recommendations; it does not mark credentials invalid or disable other queries. Rule34/Gelbooru auth handling remains unchanged. No website challenge bypass was added.
- Supplementary attribution retains its two-second budget. A real shared Rule34 client at 1.1-second pacing with three cold candidates returned confirmed cached and early validated credits after approximately 2006 ms; unconfirmed/general tags were not guessed. Caller cancellation completed in approximately 151 ms without fallback publication.

## External state and coverage limits

Direct diagnosis initially confirmed Danbooru HTTP 503 maintenance with `Retry-After: 30`. A later generic-client probe returned Cloudflare HTTP 403; the actual sealed application's neutral Danbooru search still returned HTTP 503 with a future retry deadline, and its status endpoint correctly reported website unavailability. That cold API check took approximately **1510 ms**. DART's request isolation/recovery is verified; Danbooru's external service was not restored by this release.

When every eligible provider is pending, browsing must still wait for a real usable response or timeout. Completely unknown detail metadata must be obtained before constructing supplementary queries. These checks do not establish that every real network/media transfer is instant or the whole application is lag-free.

The quarantined optional `tests/chrome` native GUI harness was not rebuilt, restored or run. Native startup/API and embedded-asset checks passed; browser interaction coverage used Edge rather than a live native window.

Private reports, screenshots and raw logs remain outside Git under `%LOCALAPPDATA%\ArtCatalogBuild`, including `publish-074-final.log`, `release-074-qa`, `viewer-grid-074-final`, `provider-outage-074-final2`, `provider-boundary-074-timing`, `preview-gallery-polish-074`, `preview-return-074` and `source-status-ui-074`.

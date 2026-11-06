# DART 0.2.75 verification

Verified on 2026-11-06. Scope: correct Space-gallery centering, adjacent-image peeks, the vertical page control and W/S keyboard handling. No provider, recommendation, collection-store or profile implementation was changed.

## Reproduced failures and resulting behavior

- Before the fix, the real 2560 x 1440 browser fixture placed the image center at approximately y=612 instead of y=720, and reduced an original 1600 x 1200 fit to 1437 x 1078. The gallery footer was included in layout and subtracted from the available viewport.
- The new layout never subtracts gallery controls or neighbors from the image's fit. The main frame has the same bounds as the unchanged single-image viewer. Portrait, square, landscape and mixed-aspect pages remain centered at first, middle and last positions and through loading/error states.
- Previous and next fragments are limited to narrow strips of existing free space. The previous fragment shows the previous image's lower edge at the top of the window; the next fragment shows the next image's upper edge at the bottom. At the window boundary the corners are square and there is no gap to the viewport edge. The top strip is absent on page one, the bottom strip on the last page.
- The up/count/down control is vertical, centered beside the image on its left. Narrow layouts place it safely over the image without shifting the artwork. A fullscreen image that uses all vertical space keeps its full size and uses the page controls instead of covering image pixels with peeks.
- W/S previously recognized only English event.key values. A failing unit regression reproduced KeyW with Russian key=ц. Physical KeyW/KeyS now work across layouts, with modifier, input and composition guards. A/D, F/B, arrow browsing, native video playback and zoom/pan behavior remain covered.
- At most two adjacent still images are prepared through the existing cache and transport. Inactive movies are not downloaded. Stale readers cannot replace a newer page or artwork. Page transitions use opacity without translating the selected image away from its center.

## Verification

- All required serialized Node tests: **1254/1254 passed** through the guarded publisher.
- Full native catalog, profile/concurrency, media, privacy and update-system fixtures passed. Canonical-source/base/clean-tree and visual-search guards passed.
- Focused gallery, Space, media and lifecycle tests: **45/45 passed**.
- Actual headless Edge gallery checks: **270/270 passed**, zero runtime errors. Four sources, all ten artwork surfaces, 2560 x 1440, 420 x 800, reduced motion, portrait/square/landscape and mixed aspect ratios were covered.
- Browser checks compare the main frame against original fit dimensions and against a same-aspect single-image opener. They inspect both adjacent images' decoded pixels, first/middle/last visibility, their exact viewport-edge positions and square boundary corners, plus the control's left-hand position and vertical order.
- Real browser input covered English W/S, trusted Russian ц/ы and Ц/Ы physical-key events, both vertical arrow buttons, clicking either neighbor, wheel navigation, retry/error/cancellation, mixed video teardown, text-entry protection, F/B and A/D.
- Grid/viewer identity and decoded-pixel matrix: **751/751 passed** across Home, Search, Recommendations, Following, Liked, Bookmarks, Recent, Favorites, profiles and Related. Its static-image opener now explicitly selects a static card; progressive recommendations can place a movie at the former hard-coded slot eight. The separate mixed-video path remains intact.
- Existing actual-pointer Space regression passed, including removal/unliking, stationary pointer, 24 rapid close/reopen pairs, scroll, viewport reentry and blur reset.

## Large-library cost check

The neutral fixture included **2440 saved works**, **100000 initial viewed identities** (103120 after ordinary identity learning), dense tags and **16 mixed tabs**. Distinct deterministic SVG pixels prevent the fixture from accidentally presenting thousands of identical images to duplicate detection. The same performance scenario can pin every frontend asset from the 0.2.74 commit with `--performance-only --compare-ref efd1d52`.

One sequential comparison, using identical inputs and real keyboard/pointer actions:

| Measurement | 0.2.74 | 0.2.75 |
| --- | ---: | ---: |
| Initial fixture entry, automation round trip | 857 ms | 828 ms |
| Cold Space entry, automation round trip | 639 ms | 616 ms |
| Warm Space return, automation round trip | 566 ms | 621 ms |
| Maximum measured W/S keydown to page DOM publication | 91.5 ms | 32.4 ms |
| Bookmark action including fixture response | 154 ms | 157 ms |
| Unlike/re-like including fixture response | 640 / 522 ms | 612 / 562 ms |

This is a paired fixture observation, not a statistical speed claim. Existing render/save tasks of approximately 105-160 ms were observed in both versions. They were investigated with the unchanged-version comparison and were not addressed by this narrowly scoped geometry/key fix. Large-library entry/save delays and real network/media latency are not claimed to be eliminated. The gallery's geometry calculation uses no offsetHeight read and is reused until viewport/fit dimensions change.

## Published artifact and isolated native startup

- Release: https://github.com/4ek1st/DART/releases/tag/v0.2.75
- Binary source: `e82c1d59a5169594ac702f34ab829b852031a3a8`; sequence **75**, descending from 0.2.74 build `8a02ab0dce51268a70ffa25ad06505e092472a713fb8b859a7bcd75b7380a7ef`.
- Size: **83973149 bytes**; EXE SHA-256/build ID: `5c452ecd121fd6f85d3486e6fe013b7c7c138b47ae022ca846b20ea26e3b1cf6`.
- The public manifest passed trusted ECDSA verification; sealed EXE hash/size matched it and the GitHub asset digest/size. No second complete public EXE download is claimed.
- The exact sealed EXE started with server-only mode, a neutral profile and an isolated receipt/configuration copy. Fourteen embedded frontend assets matched the committed source byte for byte; neutral Liked, Bookmarks and Favorites stayed empty.
- The native update check reported installed **0.2.74**, available **0.2.75**, available/verified true and no error. An immediate initial check had not yet listed the new version; a subsequent ordinary check passed without an application or source change. No unobserved cause is asserted for that transient result.
- The actual installed active receipt remained `1df94b11768ac3dffe5b5b00faee869c893f3540952efa1fc84a3a377c80f8d1`. No activation, live restart or personal-profile mutation was performed.
- The quarantined optional native GUI harness was not rebuilt or run. Interaction proof uses headless Edge; exact native EXE startup/API/assets were verified separately.

Reports and screenshots remain outside Git under `%LOCALAPPDATA%\ArtCatalogBuild`: `gallery-075-final-gallery`, `gallery-075-grid-final`, `gallery-075-perf-before`, `gallery-075-perf-after`, `gallery-075-final-space.log`, `publish-075.log` and `release-075-qa`. The portrait middle-page screenshot shows the final edge-flush, square-boundary design.

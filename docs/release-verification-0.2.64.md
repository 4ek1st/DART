# DART 0.2.64 verification

Published: https://github.com/4ek1st/DART/releases/tag/v0.2.64

- Binary source: `c660ec7b74dc7efc186afc36f4c47de9dcc880a4`.
- Signed sequence: `64`; predecessor is official sequence 63, `1bc15acf7cbd5dbeb7fc04b4b44b71a203619e395bfd8195771478231f39f825`.
- EXE size: `83,934,653` bytes.
- EXE SHA-256 / build ID: `fb899f9219607ea1c1142e21715107f5dff060991811260fa7dc6e6230cc3dda`.

## Gates and independent review

The complete Node suite passed 937/937 before publication and again inside the canonical guarded publisher. Native catalog, saved-work, profile-transfer, media, privacy and update/signature/ancestry/profile-preservation fixtures passed. A fresh independent review found no actionable Important or Critical issues and separately passed 39 focused tests. Source remained clean through signing. No protected base, receipt, configuration or active release pointer was manually rewritten.

The Android reference was regenerated because the shared desktop module gained a desktop Following ordering helper and session fields. The resulting reference data differed only in its source SHA-256. All existing recommendation, grouping, curation and fingerprint cases were unchanged; offline Java conformance passed 4/4. Android runtime and APK were unchanged.

## User-interface verification

Headless Edge at 2560x1440 and 760x1000 exercised Date/Random through real controls. Four synthetic artists and older/recent works were mixed; an exact 48-card prefix survived two delayed background arrivals, and an exact 50-card prefix survived six paginated arrivals. Space and arrows used the displayed order across the update. Date restored chronology. Random mode and seed survived a client-state POST and reload. Narrow controls remained clickable with no page overflow. No console or application errors occurred.

The viewer fixture reproduced the reported focus failure before the fix: Home focused, artwork hovered, Space preview opened, backdrop clicked, then another Space activated Home. The corrected flow returns focus to the artwork. Home and actual Back, backdrop dismissal, the modal close button, held Space, repeat/release ownership, Space reopening without pointer movement, Enter to detail, ordinary buttons, editable inputs and native video Space were checked. Mouse video controls worked, video double-clicks emitted no like writes, and image double-click likes remained available. The full browser fixture passed repeatedly after the correction.

Sankaku full-size renewal has bounded known-expired and unexpected-failure recovery tests, including cancellation, cached pixels and a synthetic integration through the real recovery/read-media helpers. It does not assert that every remote access restriction can be renewed.

## Runtime audit and performance boundaries

An isolated native server and hidden Edge used a private copy of an authorized real profile. The sampled path covered Likes, ten hover-Space open/close cycles, detail and three arrow transitions, artist profile, Favorites, Bookmarks, Recent, Home, Search, Recommendations, Following, deep scroll and every settings section. The personal profile and visible installed window were not controlled or mutated by the harness. No private profile files, credentials, queries, content screenshots or traces are part of this repository or release.

Ten preview cycles previously retained ten additional route snapshots. The final run retained zero additional routes. Three detail transitions in the original sampled run took 3128/2201/2821 ms; the final run using a copy of that audit profile took 175/84/935 ms. These are separate live-provider runs with different cache/network conditions, not a controlled network benchmark or a universal latency guarantee. Following opened a preview while its background feed was loading in 146 ms in the final sample. No JavaScript errors or duplicate displayed card keys were observed in the sampled grids. One remote detail request returned HTTP 503; navigation remained usable. This is not exhaustive duplicate-content or provider reliability coverage.

The source-cost regression uses actual saved-detail refresh and route sync. A synthetic 3800-work, three-detail CPU measurement changed from 4596.5 ms to 182.0 ms, while grouping input sizes changed from three full 3800-item arrays to three single items. All cards and positions remained retained. Discovery feeds still reconsider the full pool for curation. A conservative grouping-revision transition can still require one full refresh. Timings exclude native I/O and image/network loading; the committed tests assert incremental work and retained metadata/order rather than machine-specific speed thresholds.

## Exact public artifact and installation boundary

The public EXE and signed manifest were downloaded again. The existing trusted ECDSA public key verified the manifest; source/version/sequence, predecessor, size and SHA-256 matched. Seventeen embedded frontend assets served by the downloaded EXE matched the canonical checkout byte for byte.

Two cold server-only starts used a new isolated profile. Native session cleaning and persistence retained Random mode, maximum uint32 seed, viewer Q/NSFW and sound preferences, the Upscale settings section, and 4x / Auto upscale preferences. The optional module remained absent and was not downloaded or executed.

The installed updater reported current `0.2.63`, available `0.2.64`, `available: true`, `verified: true`, no rate limit and no error. The active release pointer SHA-256 remained `5545475dd532710feac363f5825307b1e79ed720cef34f61202e3657f034afd8` before and after publication. The user's installed application was not activated or restarted. Native GUI interaction remains untested: the quarantined `tests/chrome` harness was not rebuilt or used. Browser tests cover the rendered frontend with synthetic media, and the private audit covered the native backend with live providers; neither claims exhaustive real-device behavior.

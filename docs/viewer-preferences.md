# NSFW rating selection and video sound

Right-click an NSFW mode button to enable Q and NSFW independently. The same
menu is available on Home, Search, Recommendations, Following and artist
profiles, including Shift+F10/Context Menu, arrow keys and Escape. Both choices
start enabled. Disabling both produces an explicit empty state and stops catalog
requests and delayed retries. The selection applies only to NSFW mode.

Preferences belong to the Windows viewer session and persist through the
profile-backed client-state writer. Changing a rating resets only adult feeds
and their detached navigation sources. Following uses separate preview cache
partitions for the selected ratings while retaining its existing adult seen
state. Provider pages continue advancing by received records, including pages
whose records are all excluded by the chosen rating.

Settings > Appearance > Video playback contains **Open videos with sound**.
Silent playback remains the default. The preference applies to artwork pages,
Space preview and fullscreen. Hover samples remain silent. Manual mute changes
remain effective in the current player, including ordinary rerenders and signed
URL renewal. Opening another video reapplies the saved default.

## Verification

- `node --test --test-concurrency=1 tests/*.test.cjs` (expand the glob in PowerShell).
- `dotnet run --project tests/Rule34FixtureTests.csproj --no-restore`.
- `tests/browser/viewer-preferences.cjs`, with `DART_PLAYWRIGHT_PATH` and
  `DART_BROWSER_EXE` pointing to installed Playwright and Edge. This fixture uses
  a private HTTP server, a synthetic profile and a generated audiovisual WebM,
  at 2560x1440 with the browser's normal autoplay policy. It checks actual mouse
  and keyboard interactions, both audio defaults, native player controls and
  session reload. It never opens the user's installed window.
- Android runtime code is unchanged. The shared catalog's provenance fixture and
  its pinned test hash were regenerated; `:app:testDebugUnitTest` checks existing
  native behavior against those fixtures.

Browser fixtures validate filtering and playback controls independently of live
provider availability. Native provider fixtures cover the four catalog mappings,
precise rating requests, raw-page continuation, cache separation and persistence.

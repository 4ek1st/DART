# Artwork actions and Favorite groups

Right-click a catalog card, artwork page, quick preview or fullscreen image to
open its actions. The artwork page and viewer also have a more button. Tags and
author names take precedence and retain their own menus.

In Favorites → Artworks, drag a card onto another to make a group. The target
supplies the cover. Existing groups can be merged the same way. The menu's
**Group with another Favorite** picker provides a keyboard alternative.
**Ungroup artworks** restores separate cards without removing any Favorite.
Group members open in the shared finite artwork reader; each member keeps its
own source identity, tags, like, bookmark, download and copy actions.

Manual groups are ordered references in `favorite-artwork-groups-v1.json`.
They do not change automatic copy identities or recommendation weights. The
native store validates saved membership, serializes concurrent writes, retains
extension fields and a backup, and rejects writes on damaged primary metadata.
Invisible or removed Favorites are omitted from the displayed group; their
metadata references do not create artworks or bypass filters.
New aliases reconcile every connected group before a validated atomic write.
Saved order is preserved even when discovery curation is enabled. Changing or
ungrouping a pack refreshes open group readers while keeping the current work.

Hidden works use a separate saved-work store under `hidden-artworks-v1`, with
strong aliases/hash matching and desired-state updates. Likes, bookmarks and
history remain independently stored. Content settings provides paged restoration.

Favorites entity covers use the actual catalog card renderer. System choices
reuse the recommendation tag/query groups over existing likes and manual tag
preferences. A like count is never reported as a dated view count. Activity
covers preserve bounded gallery metadata; richer known records take precedence.

Copying a loaded image reuses its pixels. A cold original must pass an encoded
dimension check before bitmap allocation (16 megapixels, maximum edge 8192).
Conversions run one at a time; unknown/animated containers that cannot be bounded
from their headers ask the user to open the image first or download the original.
The header layout follows [PNG IHDR](https://www.w3.org/TR/png-3/#11IHDR) and the
[WebP container specification](https://developers.google.com/speed/webp/docs/riff_container).

Verification uses `tests/favorite-groups.test.cjs`,
`tests/artwork-actions.test.cjs`, `tests/artwork-menu-routing.test.cjs`, the
Favorites tests and native fixture runner. `tests/browser/artwork-actions.cjs`
requires an explicitly isolated `DART_QA_BACKEND`, installed Playwright via
`DART_PLAYWRIGHT_PATH`, and Edge via `DART_BROWSER_EXE`. It seeds only that test
profile and uses generated SFW PNGs. Provider/media replies are synthetic;
persistence goes through the real native API. Clipboard writes are captured by
a test adapter, and browser-managed download bytes are supplied at the download
boundary because they bypass page request interception in Edge. The test checks
the original selected media URL, filename and resulting file bytes. This is
separate from live-provider availability and native Windows/WebView interaction.

Never use the personal Documents profile or the quarantined `tests/chrome`
harness for these checks. Desktop publication uses the canonical guarded
publisher; testing does not activate the user's installed window.

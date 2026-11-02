# DART 0.2.61 verification

Published on 2026-11-02 through the registered canonical
`scripts/Publish-Release.ps1` pipeline:
[DART 0.2.61](https://github.com/4ek1st/DART/releases/tag/v0.2.61).

- Source commit: `bd7ae2a5652795fafb37dffb215d68823376a795`.
- Signed sequence: **61**, version **0.2.61**.
- Public `DART.Windows.exe`: **83,890,889 bytes**.
- SHA-256/build ID: `cb9ce8bc2319f11b0943a450f6c0afc61c0893a0095c4acdc18b58f6f1bb5b14`.
- Public EXE and signed manifest were downloaded from this exact release.
  ECDSA signature, artifact hash/size, source commit and ancestry containing
  the verified sequence-60 build were checked independently.

The canonical publisher repeated **856/856 Node tests**, native provider,
Favorites, hiding/group persistence, privacy and updater fixtures before sealing.
One fresh whole-change review found five Important issues; all were fixed in
one regression-tested pass: alias-bridge group reconciliation, selected gallery
URL renewal/owner resolution, live group-reader updates, saved group order under
curation, and copy memory bounds before decoding. No findings were deferred.

Browser QA used generated SFW PNGs and an isolated native profile. It checked
drag/drop grouping and group merging, restart, grid- and detail-origin ungroup,
detail-origin regroup with the current artwork preserved, Space/arrows, normal
fullscreen click, likes, B bookmark, background tabs, author/tag precedence,
menus inside the modal, Escape ordering, cold and loaded PNG copying, selected
links/tags/download requests, persistent hide/restore, recommendation-backed
System picks, shared card computed styles, light/List themes and narrow layout.
Following chronology and Q/E/video preference browser fixtures also passed.
Clipboard writes and downloaded file bytes were captured/supplied at explicit
test boundaries. These tests do not establish live-provider availability or
native WebView clipboard/drag interaction. The quarantined `tests/chrome`
harness was not rebuilt or executed.

The exact public EXE started twice in server-only mode with the isolated profile.
A group and hidden artwork survived the process restart; all three Favorite
artworks, six likes and one bookmark remained. Its embedded `app.js`,
`favorite-groups.js`, `artwork-image-copy.js` and `favorites.css` matched the
canonical source hashes.

The installed sequence-60 app remained active. A native update check reported
`currentVersion=0.2.60`, `version=0.2.61`, `available=true`, `verified=true`, with
no error. No live profile migration, window restart or release activation was
performed. The publisher advanced the guarded release base to sequence 61;
no release-base, head, activation receipt or signing key was manually rewritten.

# DART 0.2.62 verification

Published: https://github.com/4ek1st/DART/releases/tag/v0.2.62

- Binary source: `964efa8a55bf840a2361f7f8156e53f61815120e`.
- Signed sequence: `62`; verified predecessor includes the official sequence 61.
- EXE size: `83,927,496` bytes.
- EXE SHA-256 / build ID: `d75c3e475a2373b7d5fb8f09b9502d362444edab791e991004486e4284764994`.

## Release gates

The canonical guarded publisher passed 867 Node tests (867 pass, 0 fail), native catalog/saved-data/profile-transfer/upscale fixtures, screen-capture privacy fixtures, and update-system/signature/ancestry/profile-preservation fixtures. The source was clean and unchanged during signing. No base or installed release pointer was rewritten by hand.

The optional component fixtures cover pinned download/file integrity, unsafe extraction rejection, repair, cancellation, saved scale across restart, image limits, serialized processing, duplicate submission, immediate queue capacity release after cancellation, result caching and cache clearing.

## Runtime behavior

Hidden Edge with the real local DART backend and a separate test profile completed the first-use download/install, saved default 2×/4×, right-click launch, U launch, inline results, ⋮ PNG saving and original/result switching. It also exercised Space preview, zoom, cached-image adoption and return to the artwork, transparent-image suppression and a narrow settings layout. No separate upscaling dialog appeared. Original element geometry and original pixel dimensions were retained.

Neutral images were processed by the actual pinned native component: 384×256 to 768×512 and 1536×1024, and 1920×1080 to 3840×2160 and 7680×4320. Alpha was retained. These synthetic fixtures prove the flow and dimensions; they are not a quality or speed guarantee for every artwork or GPU.

## Public artifact

The public EXE and signed manifest were downloaded again. ECDSA signature, artifact SHA-256, size, source commit, version/sequence and release ancestry were checked against the existing trusted public key.

The downloaded EXE cold-started twice in server-only mode with an isolated profile. Thirteen served frontend resources matched the canonical source byte for byte, including the new upscaling files and the shared artwork menu/group/copy modules. Viewer preferences and the default upscale scale survived restart. The optional engine remained absent until explicitly requested.

The installed updater reported `currentVersion: 0.2.61`, `version: 0.2.62`, `available: true`, `verified: true`, with no error. Publication and checks did not activate or restart the installed application.

Native Windows GUI interactions were not automated: the optional `tests/chrome` harness remains quarantined under AGENTS.md. UI coverage used hidden Edge; native startup coverage used the exact public EXE in server-only mode. Personal collections, keys and media were not used as test fixtures.

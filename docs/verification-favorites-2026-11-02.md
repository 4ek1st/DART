# Favorites implementation verification

Feature scope: independent Characters/Tags and Mine/System collections, square
last-viewed covers, local 30-day distinct-work activity, persistent manual tags,
and the user-requested separate Artworks collection with viewer/context stars.

Before final review, all 802 Node tests and the native provider/storage fixture
runner passed. Focused Favorites cases were first observed failing before their
implementation, then passed for filtering, old undated history, independent
switches, persistence, rollback, batching and the new artwork collection.

The production frontend was opened through the Browser plugin against the real
native Favorites endpoints in a separate, neutral QA profile. Only images and
provider detail/search responses were replaced with synthetic SFW fixtures.
The installed application and personal Documents profile were not used for QA.

Observed browser behavior:

- Characters/Mine, Characters/System, Tags/Mine and Tags/System select independently.
- Six distinct fixture works produced 4/6 (67%) for one character and 6/6 (100%)
  for shared content tags. Generic `solo` was absent from System suggestions.
- Adding `cloud` preserved existing choices and displayed an honest undated empty
  cover/count instead of inventing browsing history.
- A last-viewed cover opened the exact fixture artwork. Square images decoded;
  measured cover dimensions were 220 by 220 CSS pixels with no horizontal overflow.
- Saving an artwork set its Favorite star while Like and Bookmark stayed false.
- The work appeared in Artworks and remained there after reloading the session.
- Fullscreen/Space viewer stars removed and restored the same separate membership.

Native fixtures also cover restart, strong/hash/transitive mirror grouping,
metadata-only enrichment, malformed log-tail recovery, the existing 100-tag limit,
damaged manual classification protection, and independent artwork persistence.

Activity begins with this update. Older undated recent history may supply a cover
but does not manufacture dated statistics. New activity and artwork collections
are local to this device; existing profile transfer continues to preserve its
original fields. The quarantined optional `tests/chrome` harness was not run.

Final review, combined-source verification and publication evidence are appended
after their actual completion.

The final independent code review raised five Important findings and no Critical or Minor findings. All five received reproducing regressions and fixes: complete cover filtering evidence, A/B/A event ordering, stale refresh rejection, immediate shutdown delivery with durable session outbox, and visible-summary refresh. The final feature suite passed 808/808 Node tests and all native fixtures. A real slim-to-native-API-to-summary-to-catalog-filter check passed four exclusion cases: character, copyright, uploader and mirror uploader. Artwork Favorites remained present after restarting the isolated native process. A 130,426-byte Unicode request also exposed private JSON expansion; compact UTF-8 logging and separately bounded private envelopes correct it while the network API retains its 160,000-byte limit.
Publication moved to 0.2.59 so the other chat could release its completed 0.2.58 rating/audio changes independently.

## Published artifact and final gates

Windows 0.2.59 was published through the canonical guarded publisher from
`1f4fcba164e08dd4e3448bc84b829f47b81f3fc7`, after preserving the verified
0.2.58 source and release base. The complete combined suite passed **820/820
Node tests**, native provider/storage/privacy/update fixtures, and **260 Android
unit tests**. Android runtime code was not changed; only exact-source provenance
test metadata was regenerated. The original strict desktop hash assertion remains.

Public assets were downloaded again and independently checked:

- Release: <https://github.com/4ek1st/DART/releases/tag/v0.2.59>
- Sequence: `59`.
- EXE size: `83,875,791` bytes.
- EXE SHA-256/build ID:
  `6db2839b02e2e27ed2a628c331f30612cf375d4cad78d66e15b48b263e50739a`.
- ECDSA signature, artifact size/hash, source commit and signed 0.2.58 ancestry
  verified against the registered installation's public key.
- The downloaded EXE started twice with `--server-only` and a separate synthetic
  profile. Six embedded frontend files matched the verified source byte for byte.
- Artwork save/remove/idempotence and likes/bookmarks independence passed against
  that exact EXE. The compact Unicode batch was accepted. Favorite types/origins,
  artwork membership and the durable activity outbox survived a cold restart.
  Replayed activity retained its original earlier day and cleared after acknowledgement.
- The installed updater reported `currentVersion=0.2.58`, `version=0.2.59`,
  `available=true`, `verified=true`, and an empty error. Activation was left to the
  user's update button; the live user window/profile was not used for runtime QA.

## Implementation rulings and limits

- Isolation used an ordinary Git clone because managed-worktree creation rejected
  the canonical directory outside this chat's roots. It was rebased and fast-forwarded
  into the registered source before publishing. Drift was the risk; combined gates,
  exact source hashes and signed ancestry checked the final integration.
- Artwork Favorites reuse the atomic library engine in a separate owned directory.
  The risk was mingling libraries; restart/mirror/independence fixtures and exact-EXE
  API checks demonstrated that the original likes/bookmarks remain separate.
- Counts describe historical opens in the selected rating. Content exclusions hide
  covers and saved artwork tiles; they do not retroactively rewrite history counts.
  A user expecting excluded subjects to reduce those numbers will still see their
  prior viewing activity.
- Manual character/tag choices persist. Their covers use the retained activity and
  bounded recent history, so a cover can be absent once both sources lose it.
  This is shown explicitly as an empty preview. Individual artwork Favorites retain
  their saved artwork metadata independently.
- New activity, classifications and artwork Favorites remain local. Existing profile
  transfer and Android functionality keep their original scope. Cross-device transfer
  of the new data and a mobile Favorites UI were not added.
- Provider/account availability was not inferred from synthetic fixtures. The native
  quarantined `tests/chrome` harness stayed excluded; browser UI and exact-EXE API
  checks do not establish native window gesture coverage.
- Publishing separately as 0.2.59 preserved the other chat's completed 0.2.58 changes.
  It adds one offered version while retaining the signed release chain.

The fresh independent review had no deferred Minor findings. All five Important
findings were fixed with reproducing regressions before publication.


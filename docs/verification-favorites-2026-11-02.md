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


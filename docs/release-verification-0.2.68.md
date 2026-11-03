# DART 0.2.68 verification

Published: https://github.com/4ek1st/DART/releases/tag/v0.2.68

- Binary source: `f6ee6b83011562c8348785841348636ba6d4c21d`.
- Signed sequence: `68`; predecessor is official sequence 67, `24a4ce93a8cab531e186d06acb45b0a31a1c021744258327ed63284eb1b74d8f`.
- Public EXE size: `83,937,843` bytes.
- Sealed EXE SHA-256 / build ID: `d2cb685c9ee4c5de595632d71a9ea02d845798669f0ea93f87c024a75a5f402a`.

## Reproduced correspondence failures

The old viewer route discarded a known/viewed neighbor when Space was closed and opened again, although that card remained in the current grid visit. The regression failed with expected second work but actual third work; native decoded pixels also confirmed the wrong picture. Retention now applies to actual retained keys, including viewed, pending-viewed, liked, bookmarked and followed-artist changes. Manual artwork hides, hidden creators and rating exclusions remain earlier gates. An incoming mirror or a new work from the same artist cannot borrow another card's retained slot.

Late catalog evidence could also change the preferred member of a group while the underlying grid's redraw was deferred. Back then selected the new member's image instead of the version still displayed by the card. The pixel/URL regression confirmed both different originals and different pixels. Route-local presentation now retains original slot order while keeping all current metadata, members and new media. Only currently owned files can be retained; matching confirmed hashes and normalized identities refresh signatures without resurrecting removed versions. When two existing slots merge, the earlier retained slot determines default presentation. Explicitly selecting another gallery image still selects that original.

Home, Related and creator strips now capture their actual rendered lists instead of recomputing them from a newer source pool. Home preserves its first section and continuation in order. The same presentation drives image preparation, neighboring preloads, Space, detail galleries, fullscreen and the initial detail poster, preventing a new preferred thumbnail from flashing before the retained original.

## Browser and regression coverage

At 2560x1440, the final real Edge matrix passed **751/751** checks across Home, Search, Recommendations, Following, Likes, Bookmarks, Recent, Favorites Artworks, Author Profile and Related. Every surface included all four catalogs. Checks compare actual card DOM, member aliases, selected original URLs and decoded native full-media pixels, waiting for the original cache blob rather than accepting only a thumbnail. Coverage includes click/detail, Space, Enter/fullscreen, next/back, close/reopen, retained scroll, exact mirrors, genuine versions, generated native WebM, image/video transitions and each surface's second gallery image. Related creator-strip origins and Home's section boundary have additional checks.

The separate late-publication Recommendations fixture passed with no errors or failed checks, preserving its full existing 239-slot prefix, grouped versions, mirror aliases, deep virtual scrolling and manual hides. Existing viewer-preferences and Space reliability browser tests also passed again, covering mouse/focus ownership, Tab/Shift+Tab, native video controls, Home/Back protection, stationary reopening, modal pointer movement, 24 rapid pairs and viewport exit/reentry.

The first expanded matrix had three fixture timeouts after implicit Playwright scrolling cancelled an artwork gesture. Explicit scroll settling before a pointer click resolved them without a production change. The final complete run had no exceptions or browser errors. An early parallel Node sweep encountered one concurrent native build-file lock; the isolated subtest passed, and the publisher's later complete sequential run passed **1001/1001**. Root independently passed 70 focused cases before committing. Independent review found no actionable remaining issue.

## Recommendation publication and measured latency

The ranking worker returned newly cloned copies of the entire published prefix on every batch. Same-artist regrouping could rebuild equivalent records too. Main-thread identity caches then treated all existing works as changed, repeatedly merging metadata, filtering and regrouping while the viewer was active.

The worker now compares its output with a pre-merge snapshot and transmits references for structurally unchanged prefix records. The main thread restores the job's original references. Real nested changes retain full replacement records. Validation covers wire shape, indices, placeholders and complete hydration before settling the job; malformed replies disable the worker and promptly use the original-argument fallback. Interleaved jobs, same-artist rebuilds and in-place worker mutations are regression-tested. Ranking, grouping rules, preferences and provider requests are unchanged.

The committed latency fixture used 4000 neutral likes, 100000 viewed identities, production paging from 1440 to 1920 works, 48 real Arrow/A/D moves and ten Space taps during background publication. Baseline and candidate were pinned coherently and run separately without competing builds or browser tests:

| Measurement | Frozen 0.2.67 | Final 0.2.68 source |
| --- | ---: | ---: |
| Maximum input to painted frame | 581.9 ms | 112.9 ms |
| p95 input to painted frame | 80.8 ms | 77.5 ms |
| Maximum queued input | 305.5 ms | 61.0 ms |
| Maximum frame gap | 536.1 ms | 166.8 ms |
| Maximum main-thread long task | 321.0 ms | 107.0 ms |
| Maximum synchronous navigation | 314.2 ms | 77.3 ms |
| Maximum source-item processing | 147.5 ms | 24.2 ms |
| Maximum metadata remembering | 84.2 ms | 6.3 ms |

The candidate received all 58 inputs, invoked all 48 moves, individually painted 54 results and superseded four intermediate results. The final preview remained open, with no JavaScript errors or sampled blank images. Image preparation maximum was 0.2 ms. These are controlled fixture measurements, not a guarantee of zero dropped frames or live-provider latency on every device. Catalog logic is unchanged from the baseline after normalizing line endings.

Final browser source SHA-256 values were app `bf2f41a5d26c79ab9511391117f8d6659392021210f798706e91b7946507e440`, worker `1c7497e65f715f99c761183a05e01267fd32481c3c5b4cc7148c28f7a461fcd4` and catalog logic `71a400becd210b5b14b6205ccbf84ec3688f1cf86f231bac8b21d9f4c0d2ba28`. Original profiling reports and neutral screenshots remain outside Git.

## Guarded release and installed-state boundary

The canonical publisher passed the full Node suite and native catalog, saved-data, profile transfer, media, privacy, update, signature, ancestry and profile-preservation gates before signing and publishing a clean committed source. GitHub reports the release as public, not a draft or prerelease, targeting the recorded binary source commit.

The public EXE and signed manifest were downloaded again. The manifest verified with the installation's trusted ECDSA key, including sequence, predecessor, source, size and artifact hash. The downloaded EXE's SHA-256 also matches GitHub's independently published asset digest exactly. Eighteen embedded frontend assets, including the changed worker, matched the checkout byte for byte. Two isolated server-only cold starts of this downloaded EXE passed idempotent likes, saved order/persistence, hidden-author restore/Unhide, Random uint32 seed, viewer settings and Upscale section/scale/Auto persistence. The optional processor remained absent. The download initially required retries; its successful completion was read after an initial sealed-copy smoke test, and the full native check was then rerun on the downloaded artifact. Owned download helpers were stopped; the personal profile and visible application were not used for these mutations.

The installed updater reported current `0.2.67`, available `0.2.68`, verified and available, with no error or rate limit. Its active-pointer SHA-256 remained `192cffaa8ff3842a3f8d0e42fa48a85b5a2bea8966dfff5b4322d30e23fd5018`. No installed activation, restart or personal-profile mutation was performed. Android runtime/APK and recommendation scoring were unchanged. The quarantined native `tests/chrome` harness was not rebuilt or used; browser checks do not establish physical-monitor frame timing or native window interaction coverage.

# DART 0.2.70 verification

Published: https://github.com/4ek1st/DART/releases/tag/v0.2.70

- Binary source: `ad4412cea681536fd6e639af6b49391647a3096f`.
- Signed sequence: `70`; predecessor is official sequence 69.
- EXE SHA-256/build ID: `8f0ba5bad27928be6ade042113e13a4729c2723e991fab10eace17f6403f968f`; size `83,942,016` bytes.

## Selection and bounded loading

The new tag tooltip uses exact canonical tag metadata, including typed tags and grouped members. It first checks recent works, already loaded dated summaries and loaded artwork with viewed-identity evidence. A cached, read-only Favorites summary can recover older available dated metadata. The summary step has a two-second timeout and short failure cooldown. It does not load/edit Favorites choices or record a view.

If no eligible viewed example exists, background catalog requests choose the first eligible exact search result. Catalog first rows are checked in the same round-robin order as search before selecting a later row, while bounded per-provider waits keep one failed provider from holding every other source. Selection honors source/rating, excluded content, hidden creators/artworks and the applicable followed-artist policy; viewed/saved discovery exclusion is intentionally not used for a viewed-example feature. Videos use their thumbnails without playback. Only thumbnail blobs are fetched.

The 300 ms delay avoids requests when passing quickly across tags. Metadata/image caches are bounded, scope keys include eligibility policy, every result is revalidated, and late cancelled results cannot reopen or overwrite another tooltip. A 4000-work neutral scan with 964000 repeated tag references measured 253–292 ms before pure-string normalization caching and 11–18 ms afterward. The known-library scan also yields in short cooperative slices with cancellation checks. These are CPU-stage measurements, not complete tooltip/network latency guarantees.

## Interaction and regression evidence

The real hidden Edge fixture passed **201/201** checks with zero exceptions, browser errors or server errors. It uses neutral SVG thumbnails and isolated profile/provider fixtures. Coverage includes actual Home, artwork-detail, Favorites, recommendation and autocomplete controls; viewed-first and dated-history selection; rejection of loaded-but-unviewed candidates; exact matching, first eligible search results, content/rating/author/manual-hide filters, loading/empty states, caches and early-leave/A-to-B cancellation.

Native decoded pixels are checked against the chosen thumbnail. Ready and pending tooltips survive unrelated background renders under a stationary pointer. Scope/anchor changes close them; native titles and ARIA descriptions are preserved/reconciled. Tab/focus, Escape without consuming unrelated handlers, context menus, ordinary clicks, scroll/resize/blur, actual dark 2560x1440 and light 700x900 layouts, viewport clamping and reduced motion passed. Russian/German viewed/empty captions and unmodified tag labels passed. Injected non-resolving image loading reaches the bounded empty state; late replies release their image pin once and cannot show stale pixels. Literal HTML-like labels remain text. Hovering does not cause new history, library or Favorite writes.

The old index/app snapshot reproduces the missing feature. New deterministic cases were RED before the normalization and media-cancellation fixes. The **26 new unit tests** cover exact normalization/metadata, priority/order, scoped TTL/LRU caches, errors/aborts, history cooldown, provider failures/order and decode/pin ownership. Existing partial-VM fixtures now model optional tooltip lifecycle state; the actual controller is tested in the browser. Root focused compatibility checks passed, independent review found no remaining actionable issue, and the final guarded publisher passed **1030/1030 Node tests** plus required native catalog/profile/media/privacy/update/signature/ancestry/preservation gates.

Final tested frontend SHA-256 values: app `f1e6ec7857214f26f1be2fadf32b66bc17f586b75c4c7b3e5315acc6da2561a9`, module `babea1a087387c1342aaa556a5f76455e739a202e6195618263e3710bee34654`, CSS `c5fa49aa4450242efefefbe665d2d58c4c2b0224c147d2e7b515fd653ce839a1`, index `f22302745e5de21e2452aa86971f1a1d0e85df06b9ff1fe889a86ae83379c21d`. Neutral screenshots, runtime reports and private QA profiles remain outside Git.

## Signed artifact and installed-state boundary

The canonical publisher signed and published the reviewed committed source. The downloaded public manifest verified with the trusted installed ECDSA key, source/sequence/predecessor/size/hash; GitHub's published asset digest matches the sealed EXE. An isolated server-only startup of that hash-identical sealed artifact returned five changed/new frontend assets byte-identical to the tested checkout. This scoped check did not redownload the full EXE or claim native window interaction coverage. The quarantined tests/chrome harness was not used. Android and shared catalog logic were unchanged.

The installed updater reported current 0.2.69, available 0.2.70, verified, no error/rate limit and no installation in progress. Its active-pointer SHA-256 remained `9a2daed9a83b1d5bebbbaa4061d1951c5bf715bdd9aec3c711e86996c088698f`. No installed activation, personal-profile mutation or visible application restart was performed.

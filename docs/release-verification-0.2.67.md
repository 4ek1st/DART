# DART 0.2.67 verification

Published: https://github.com/4ek1st/DART/releases/tag/v0.2.67

- Binary source: `3eacda58f58ba3deaf61d38b3574c780cc5f9020`.
- Signed sequence: `67`; predecessor is official sequence 66, `ca9021d4bd779683597668843a8f49e88a229361726b99078cb0285029716c7f`.
- EXE size: `83,935,731` bytes.
- EXE SHA-256 / build ID: `24a4ce93a8cab531e186d06acb45b0a31a1c021744258327ed63284eb1b74d8f`.

## Space reliability

Real hidden Edge reproduced two .66 failures at 2560x1440. First: Likes, hover the first artwork, Space, F to unlike it, Escape, stationary Space. Deferred rendering removed the opener, focus fell to main, and modal-induced pointerleave had erased the mouse position, so no artwork opened. Second: preserving only old main coordinates reopened the wrong artwork after the mouse moved inside the modal. The adopted fix tracks actual document-wide mouse coordinates, retaining Tab's explicit keyboard selection and native editable/video/control behavior.

The new committed reliability fixture supports an in-memory `--compare-ref ccfe804` RED comparison. Candidate and root reruns passed real pointer/keyboard unlike/repaint, movement inside the modal, 24 rapid close/open pairs, stationary-pointer scrolling, viewport exit and reentry. The full viewer fixture also passed Home/Back protection, pointer A/B/C/D, native video Space/mouse controls, text/buttons, Tab/Shift+Tab and held-key behavior. An outdated backdrop assertion was corrected: Space over blank backdrop coordinates must do nothing; selecting an artwork or using keyboard focus then opens it. The unit fixture now asserts extraction boundaries and registered handlers so a removed listener cannot silently omit coverage. Headless blur coverage explicitly dispatches the lifecycle event and does not claim real OS-window blur testing.

## Measured processing changes

Already-read Likes/Bookmarks previously painted twice synchronously. Ten deterministic loading tests cover warm/nonempty/empty lists, cold loading, failure/retry and late replies. At 2560x1440, 3000 neutral works with 98 virtualized cards were measured in 14 alternating baseline/candidate pairs, excluding the first two. Median cached loadLikes CPU changed from 23.5 to 13.1 ms; every invocation changed from two renders to one. The same decoded image/card nodes and saved sequence remained, with one initial API read. This is loader/render-stage CPU, not a whole-page or already-started-tab-return measurement.

The native saved-work path eagerly cloned the complete library before discovering an unsaved work, unchanged metadata or an already-liked work. It now matches under the existing lock, gives metadata callbacks detached artwork copies, and clones the whole library only for a real write. On the same roughly 35 MB private QA copy, clean alternating runs measured:

| Operation | Before, median range | After, median range | Allocation before / after |
| --- | ---: | ---: | ---: |
| Unsaved detail metadata | 167–214 ms | 5.71–6.58 ms | 67.20 / 0.846 MB |
| Unchanged saved metadata | 119.5–158.5 ms | 5.97–7.62 ms | 61.09 / 0.857 MB |
| Idempotent existing like | 33.5–50.7 ms | 6.06–7.88 ms | 34.50 / 1.052 MB |

Control library/history reads were unchanged; these measurements do not establish a universal improvement in provider or full-page latency. The new synthetic native allocation regression failed at 2,249,056 bytes against a 500 KB bound before the fix and passed afterward. It also checks unchanged bytes/revisions, blocked-backup isolation, successful edits, both collections, restart, order and unknown fields. Existing locking, external file-stamp checks, concurrent writers, corrupt-state recovery, atomic writes and rollback fixtures passed.

Cold first-library profiling still found substantial grouping/filter/history preparation on the UI thread. A bounded content-evidence change deduplicates raw tag strings once while preserving existing normalization, cache dependencies and filtering. Four alternating fresh-process pairs measured filterWorks median 341.27 to 252.57 ms, a 26.0% stage reduction; grouping control medians were 705.33 and 727.87 ms. All full grouped/visible/excluded JSON digests and four additional filter variants were identical. Four new neutral tests cover duplicate conversion cost, 30/70/100 tags across four sources, case/underscore/Unicode, participant/uploader scope and mutation invalidation. This removes about 89 ms from the measured cold filter stage, not the entire cold startup pause. Workerizing all cold preparation was not introduced as an unverified lifecycle rewrite.

## Broader runtime audit and gates

Separate native server/headless Edge runs on private profile copies covered startup, Likes, Bookmarks, Recent, Home, Search, Recommendations, Following, Favorites, author profiles, every settings section, detail/arrow transitions and repeated Space cycles. Both runs had zero page errors, failed steps, failed HTTP responses or duplicate displayed keys in the sampled grids. They used live providers and different caches/initial selected tabs, so their whole-page times are diagnostic observations, not a controlled before/after speed benchmark. The user's visible app and personal data were not controlled or written by these runs.

The guarded publisher passed 980/980 Node tests, native catalog/profile/saved-data/media/upscale fixtures, privacy and update/signature/ancestry/profile-preservation gates. Independent review caught a stale Space test extraction; after its repair, final review found no remaining Important issue and independently passed 24 targeted tests. Android reference regeneration changed only the matching desktop source hash; offline Java conformance passed 4/4. Android runtime/APK and recommendation scoring were unchanged.

## Exact public artifact

The public EXE and signed manifest were downloaded again. The trusted ECDSA key verified source/sequence/ancestry, size and SHA-256. Seventeen embedded frontend assets matched the checkout byte for byte. Two isolated native cold starts verified idempotent likes and saved order/persistence, hidden-author restore/Unhide, Random uint32 seed, viewer preferences and Upscale section/scale/Auto settings. The optional processor remained absent. The first added like smoke fixture was correctly rejected with HTTP 400 for an invalid media/thumbnail fixture; replacing it with supported neutral catalog URLs passed without changing production validation or fetching those URLs.

The installed updater reported current `0.2.65`, available `0.2.67`, verified and available, with no error/rate limit. Its active-pointer SHA-256 remained `d3252cbfd0e0fc4e4699a36129b71474f47de3fc633246e6411b4721d49efb24`. No installed activation, restart or protected-state rewrite was performed. Private profiles, credentials, metadata and traces remain outside Git and release assets. Native GUI automation remains untested because the quarantined tests/chrome harness was not rebuilt or run; browser and server-only coverage do not guarantee physical-monitor frame timing or exhaustive device behavior.

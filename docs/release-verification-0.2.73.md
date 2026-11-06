# DART 0.2.73 verification

Published: https://github.com/4ek1st/DART/releases/tag/v0.2.73

- Binary source: `fa1a330e0f4d9697e6fd9559158f60f30ccaa3bc`.
- Signed sequence: `73`; predecessor is official sequence 72.
- EXE SHA-256/build ID: `885851c1e99a325185f8eaea5afe58bc1c08b4334d03e2367412ffb48116a31b`.
- EXE size: `83,954,878` bytes.

## Scope and regression protection

The project instructions now require shared artwork processing, bounded background work, precise cache invalidation, realistic large-library interaction measurements and a performance regression whenever a measured bottleneck is fixed. Worker serialization and delivery count toward the interaction budget. The release pipeline already discovers every `tests/*.test.cjs`; the new cost and behavior checks therefore run in the normal guarded publisher rather than in a separate optional command.

Saved collections warm exact shared grouping before publication. Confirmed saved deltas publish serially per collection, retain immediate optimistic controls, rebase against current metadata and have bounded analysis retries. This prevents lost concurrent saves and quadratic grouping queues. Exact worker grouping remains authoritative: unchanged result rows reuse references only against a matching acknowledged cache owner, revision and metadata snapshot. Invalid or stale sparse replies request one complete worker result. Worker caches are bounded, and unavailable workers retain the existing fallback.

Favorites and Recommendations use a shared analysis service. Favorites omits unused recommendation combinations; partial evidence cannot replace full recommendation evidence. Successive stages reuse one versioned worker profile. Typed categories, query counts, ranking and filtering remain unchanged. The Android reference regeneration changed only its desktop source hash; all scenario payloads were identical. The current desktop reference tests passed 25/25, and fresh compilation of the actual Android Java classes followed by the offline JVM conformance suite passed 4/4. Android runtime and APK were not changed.

Viewed/saved membership no longer copies the entire history for each filter. Canonical grouped views reuse recommendation evidence while mixed, duplicated and invalidated views still regroup. Recommendation sorting preserves equal-comparator behavior. Favorites activity byte packing preserves the previous UTF-8 budget and removal order without repeatedly serializing the complete envelope.

Native Favorites reads capture a stable log prefix under the activity lease, then decode and summarize outside the global store lock. Parsed-log reuse is bounded and checks file stamps, time windows and future records. Revision/stamp validation rejects publication after concurrent writes. The existing 15-second summary TTL remains unchanged. The publisher's native concurrency fixture observed unrelated reads taking 1.9 ms during 571.6 ms of summary decoding, while preserving the captured prefix and subsequent activity/classification update.

## Controlled browser performance

Real hidden Edge at 2560x1440 used a neutral fixture with 4,690 likes, 2,000 bookmarks, 100,000 viewed identities, 40 tabs, dense tags and grouped versions. Baseline `b17a9d4` and final source used the same fixture. Detail replies resolve exact source and ID, including group members; unknown posts return 404. Only corrected fixture runs are used below. Reports and profiles remain outside Git.

| First entry | 0.2.72 wall time | 0.2.73 wall time | Largest observed main-thread task before / after |
| --- | ---: | ---: | ---: |
| Bookmarks | 362 ms | 177 ms | 173 / 70 ms |
| Liked | 356 ms | 136 ms | 253 / 56 ms |
| Favorites | 1,016 ms | 889 ms | 687 / 116 ms |
| Recommendations | 2,946 ms | 2,019 ms | 668 / 93 ms |

Startup measured 2,651 versus 2,702 ms; the 51 ms difference is within sequential-run variability, not evidence of a startup improvement. Five warm renders took 162 ms total for Bookmarks and 150 ms for Liked; eight took 430 ms for Favorites, including browser calls and frame waits. These are sampled fixture timings, not physical-monitor guarantees or live-provider benchmarks.

All eight F/B actions in the clean full scenario painted their optimistic state in 5.4-8 ms, with no tasks at least 50 ms in those saving phases. A separate profiled scenario recorded nine actions at 4.4-16.1 ms, all confirmed. The worker message receiver fell from 181/193 to 11/7 CPU samples across four actions in each collection at a 500-microsecond sampling interval; sparse replies remove repeated full-result deserialization. Input serialization remains (124/118 samples versus 123/126), and the profiled run contained one 53 ms saving task. Four sequential confirmed actions, including worker preparation and harness waits, took 1,404/1,293 ms total; optimistic paint and background completion are different measurements.

Navigation matched expected route order 18/18 times. Eight arrow steps in each collection and closure after confirmed changes produced no tasks at least 50 ms. Early closure while a save was pending remained usable and later published the correct saved state.

### Remaining measured limits

Cold first Space opening still has route/metadata preparation cost: 53/91 ms in the clean full run and up to 152 ms for Liked under profiling. A matching detail can create a new metadata object and still cause a merge even when its values are unchanged; this was also demonstrated with native DTO defaults. It is not dismissed as a fixture artifact. Completion after an early pending-save closure also had 50 and 80 ms tasks. Large cold DOM publication and input serialization remain measurable. This release does not claim that every path is below 50 ms or that the whole application is lag-free.

## Behavior, gates and exact artifact

The final real-browser matrix passed 751/751 checks across Home, Search, Recommendations, Following, Liked, Bookmarks, Recent, Favorites, Profile and Related. It compares actual rendered cards with decoded full-media pixels through detail, Space, fullscreen, versions and generated video. No browser errors or mismatches occurred. The Space reliability scenario also passed unlike/deferred rendering, stationary and moved pointer targets, 24 rapid open/close pairs, scrolling, viewport leave/reentry and blur cleanup.

The guarded publisher independently passed 1,183/1,183 Node tests plus required native catalog/storage/media/Favorites/profile-transfer, privacy and update/signature/ancestry/profile-preservation fixtures. The build completed with the existing MSB3277 WindowsBase/WebView2 reference warning; no dependency change was made for this release. Source stayed clean through signing and publication.

The downloaded public manifest verified against the installed trusted ECDSA public key. Version, sequence, predecessor, source commit, executable size and sealed binary SHA-256 matched; GitHub's public asset digest equals the sealed artifact hash. This check did not redownload the complete executable. An isolated server-only start of that exact sealed EXE served nine frontend assets byte-identical to the tested checkout, including grouping, worker transport and the new analysis module. Neutral saved collections and Favorites summary remained empty as expected.

Using an isolated copy of the installed receipt/configuration, the sealed EXE's actual update endpoint reported current 0.2.72 and available/verified 0.2.73, with no error or rate limit. The installed active-pointer SHA-256 remained `2656663cccaef93fa1886eaab007bf28b4137765a4560fb034bc361528f98238`. No activation, visible restart, personal-profile mutation or loose-file replacement was performed. The quarantined native `tests/chrome` harness was not rebuilt or used; native GUI interaction and physical-monitor timing remain outside this verification.

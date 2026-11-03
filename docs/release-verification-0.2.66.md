# DART 0.2.66 verification

Published: https://github.com/4ek1st/DART/releases/tag/v0.2.66

- Binary source: `7306335a5601ff827b5569a855967c61c2329e51`.
- Signed sequence: `66`; predecessor is official sequence 65, `f0283aa0246a5dde56f85dfde1cb4f363a9333bca17a8fb04181746a66250e90`.
- EXE size: `83,935,504` bytes.
- EXE SHA-256 / build ID: `ca9021d4bd779683597668843a8f49e88a229361726b99078cb0285029716c7f`.

## Author-filter freeze

The actual 2560x1440 browser flow reproduced the reported .65 failure: loaded Recommendations, artist context menu, Hide, then an empty tab with `started=false`, no tags, an aborted controller and no usable Refresh/Continue action. When hiding interrupted loading, `loading=true` remained with zero pending worker jobs. Scrolling initiated no recovery. This was a lifecycle reset/restart defect rather than a hung ranking worker.

Preference invalidation now aborts/version-invalidates the old generation, clears loading/error/pause/continuation/recovery-timer state, and starts only the active recommendation tab. Inactive tabs rebuild when activated. Failed preference saves preserve the existing controller, feed and preferences. No recommendation scoring changes were made.

The new neutral mutation/apply/start/loader suite watched eight failing cases before the fix; all nine pass afterward. It covers settled, paused, exhausted and pending loading, late old replies, inactive activation, failed saves, repeated Hide/Unhide, generic content filters and a legitimately empty profile after filtering.

The committed browser fixture supports an in-memory `--compare-ref a4cc241` .65 RED comparison without replacing source files. Current source passed both agent and root runs at 2560x1440: settled and in-flight scenarios, three distinct neutral authors per scenario, six real context-menu Hide/Unhide cycles, continued scrolling and Refresh, and rejection of late hidden-author results. No `page.reload()` was used and there were no page/console errors. No actual profile authors were hidden during QA.

## Visible pagination progress

The read-only audit independently reproduced an additional loading edge: incoming pending-viewed, bookmarked-without-persisted-viewed-token, or manually hidden works increased stored progress while the grid showed nothing. Six rounds issued twelve mock requests, never incrementing the four-empty-round guard. A followed-author control paused correctly. The existing per-query/source page cap still bounded the behavior; it was not an infinite loop.

Publication now uses the grid's existing eligibility pipeline with grouped input and preserved order. The three failing cases now pause after four rounds/eight mock requests. The six new tests also cover the followed-author control, current-visit card retention and rejection of a stale ranking job. The shared VM helper supplies the actual filtering helpers while preserving explicit fixture dependencies. Source selection, ranking mathematics and personal preferences are unchanged.

## Verification and installation boundary

The complete Node suite passed 964/964 before commit and again inside the canonical guarded publisher. Native catalog/profile/transfer/media/upscale, privacy and update/signature/ancestry/profile-preservation gates passed. Fresh independent review found no actionable Important or Critical issue and separately passed 68 focused tests. A suspected retry-on-return bug was withdrawn because its VM fixture omitted the actual render/recovery hook; it is not part of this release.

The exact public EXE and manifest were downloaded again. The trusted ECDSA key verified the signature; source, sequence, predecessor, size and SHA-256 matched. Seventeen served frontend assets matched the canonical checkout byte for byte. Two isolated native cold starts retained a neutral hidden-author entry, and native Unhide removed it. Random mode/uint32 seed, viewer preferences and Upscale section/scale/Auto settings also survived; the optional processor stayed absent.

The installed updater reported current `0.2.65`, available `0.2.66`, `available: true`, `verified: true` and no error or rate limit. Its active pointer SHA-256 remained `d3252cbfd0e0fc4e4699a36129b71474f47de3fc633246e6411b4721d49efb24` before and after publication. The user's running app was not activated, focused or restarted, and their profile was not mutated by QA. Source stayed clean during signing; protected release state was not manually rewritten. Android and recommendation scoring were untouched. Native GUI automation remains untested because the quarantined `tests/chrome` harness was not rebuilt or used; live-provider availability and personalized relevance are outside these neutral technical checks.

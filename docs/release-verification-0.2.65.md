# DART 0.2.65 verification

Published: https://github.com/4ek1st/DART/releases/tag/v0.2.65

- Binary source: `7f64a47a0b3e8b4c7446a4cce8e048306dba2632`.
- Signed sequence: `65`; predecessor is official sequence 64, `fb899f9219607ea1c1142e21715107f5dff060991811260fa7dc6e6230cc3dda`.
- EXE size: `83,935,299` bytes.
- EXE SHA-256 / build ID: `f0283aa0246a5dde56f85dfde1cb4f363a9333bca17a8fb04181746a66250e90`.

## Reproduced failures and regression coverage

The .64 Space test omitted switching the mouse target after closing a preview. A real headless Edge reproduction confirmed A remained focused: hovering B, C and D still opened A. The expanded browser fixture collected the wrong keys before its RED assertion. Root Node cases also failed before the correction. The fixed flow prioritizes the current pointer target; Tab/Shift+Tab hand selection to keyboard focus. Blank main content and the surrounding sidebar cannot activate the stale focused artwork. Closing via Space, Escape and the backdrop, Home/Back focus, held keys, Enter, native buttons, text fields, native video playback/mute and video-to-image transitions passed at 2560x1440. The earlier Following browser fixture also passed at 2560x1440 and 760x1000 after all production changes.

The .64 Random setter changed its mode before awaiting grouping. A fingerprint revision change could discard that worker result, leaving Random selected above Date items and causing repeated Random clicks to return early. Realistic Node tests with 128 groups and 1024 works failed before the fix. The setter now reorders the already loaded pool synchronously; delayed evidence uses the selected presentation generation. The committed busy browser fixture uses the actual app, DOM and active catalog worker with a held result. An in-memory .64 comparison reproduced the failure without switching source files. The final fixed run painted the correct selected styling and mixed DOM keys before releasing that worker in 59.2 ms; four repeated mode changes took 55.7–65.2 ms. Its first 16 cards represented 16 neutral artists, and its first 32 included both publication ages. Fingerprint cancellation retained the Random prefix. These are local input-to-correct-frame measurements, excluding completion of thumbnail downloads, not general network latency guarantees.

## Enlarged-image interaction

A dense replay using an isolated private profile copy reproduced background Following redraws during actual zoomed mouse dragging. In a six-second .64 sample, 13 underlying renders used 398 ms total, with a 48 ms maximum and two 50/60 ms long tasks. Pan-paint calls themselves cost at most 1 ms. A dense .63 comparison also exhibited this source of interruption; the evidence does not establish a .64-only pan regression.

The fix coalesces underlying page rendering while the preview is open. Data, workers and navigation continue updating. Closing reconciles the latest current view once before underlying upscale processing resumes. Four committed tests cover deferred publications/latest snapshot, close with an active drag and retained scroll, navigation to a different current view, and an unchanged close with no redraw. The expected RED failures became GREEN.

In the matching after trace, 14 deferred render calls rounded to 0 ms and there were no long tasks. Feed updates continued, and pan paints remained below 1 ms per call. One 70 ms animation-frame gap and garbage-collection activity remained; this is not a zero-stutter or universal frame-rate guarantee. Hidden Edge frame timing is not equivalent to physical-monitor presentation timing.

A separate neutral ready-upscale fixture checked actual 1.5x mouse panning and exact transform agreement between original and overlay. Two deferred publications caused no underlying paints; F/B still produced their two save requests with the modal open. Escape flushed the newest view once, and a navigation transition retained its Settings destination. The optional processor was mocked for this fixture and was not installed or executed. No image-quality reduction or cancellation of data loading was introduced.

## Gates and public artifact

Fresh independent review found no actionable Important or Critical issues and passed 79 focused tests. Root independently passed 67 focused tests before committing. The guarded canonical publisher then passed the complete 949/949 Node suite and native catalog/profile/media/upscale, privacy, update/signature/ancestry/profile-preservation fixtures. Source remained clean through signing. No protected release state was manually rewritten. Shared catalog logic, Android runtime and APK were unchanged.

The public EXE and manifest were downloaded again. The existing trusted ECDSA public key verified the signature; predecessor, source, sequence, size and SHA-256 matched. Seventeen served frontend assets matched the canonical checkout byte for byte. Two isolated native cold starts retained Random mode/maximum uint32 seed, viewer preferences, Upscale settings section and scale/Auto preferences. The optional module remained absent.

The installed updater reported current `0.2.64`, available `0.2.65`, `available: true`, `verified: true`, no error or rate limit. The active pointer SHA-256 remained `409e360fc42a723255a1a824d5f599055d5ef18ca8d6957c02c8375d43c3fbf2` before and after publication. The user's installed application was not activated or restarted. Native GUI interaction remains untested because the quarantined `tests/chrome` harness was not rebuilt or run. Private profile data, content, credentials and traces remain outside Git and public release assets.

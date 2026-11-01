# Android 0.1.12 verification

Scope: compact-phone image/video reliability, feed viewport behavior, Following chronology and fullscreen-only video autoplay. Desktop binaries and personal profiles were not used or changed by the tests.

## Automated verification

The complete Android JVM suite passes: 194 tests, zero failures/errors. Release compilation and lint in the canonical source pass with zero lint errors and 27 warnings. Warnings include existing persistence/API/style findings and touch/accessibility analysis of native custom views; they are not reported as a clean lint warning count.

New regression checks cover actual loopback HTTP body holds, foreground image admission while two visible workers are blocked, cancellation before execution, cold preview/full sequencing, per-visit presentation keys, signed URL renewal, failed poster fallback, viewport anchor selection, decoded video frame state, stale playback generations, variant selection and zoom geometry.

## Native before/after evidence

The untouched 0.1.11 sources were copied into a separate build before production edits. Both builds use the same hidden, read-only ArtCatalogQA emulator: API 35 / Android 15, a compact portrait display and neutral local HTTP/video fixtures. Debug fixtures and localhost networking are excluded from the release source set. The physical phone and normal ArtCatalogPhone AVD were not used.

| Scenario | 0.1.11 observation | Fixed candidate observation |
| --- | --- | --- |
| Cold progressive image, full response held | Only full file requested; first bitmap at 6719 ms | Small preview requested; first bitmap at 806 ms while full file continues |
| Foreground image behind two held visible image bodies | Foreground network starts at 6219 ms; bitmap at 6723 ms | Foreground network starts at 338 ms; bitmap at 978 ms |
| First feed thumbnail held | 48 metadata records already available; no cards until 2644 ms | Card slots are published from metadata independently of thumbnail readiness |
| Preferred mirror arrives late | Shown card count falls from 12 to 4 until mirror preview finishes | 48 published slots remain; existing poster bitmap and holder identities are retained |
| Valid duplicate grouping above viewport | The unchanged visible artwork moves 1048 px without user input | Chosen artwork's vertical offset changes by 0 px |
| Video detail preview | Only a stock play icon after ten seconds | Real poster appears at 752 ms with a play overlay |
| Video prepared before first decoded frame | Poster hidden at prepared, playback position zero | Poster retained for the additional 1.31 seconds until rendering proof; no premature hiding in 151 samples |
| Preview zoomed before full quality arrives | 2x zoom resets to 1x | 2x and normalized focus retained; another artwork explicitly resets to fit |

These are controlled fixture timings, not estimates of a particular provider or physical phone's network speed. Video proof includes native MediaPlayer callbacks and a successful PixelCopy of its actual surface, rather than treating OnPrepared or elapsed time as a displayed frame.

Actual window screenshots and direct poster drawing caught an additional candidate regression that state flags missed: `ImageView.setAlpha(int)` set drawable opacity to 1/255. All five poster resets now use float View opacity. The final candidate shows the opaque poster, spinner and loading label while video response headers are held for ten seconds; drawable alpha is 255, colored pixels are present at 1008 ms, playback position is zero, and first-frame proof arrives only at 13302 ms. An invalid MP4 retains the opaque poster and retry message; a real tap on that message successfully starts the next valid MP4. Real horizontal swipes show a photo and return to video in the same fullscreen dialog. Closing during a cold load does not revive the dismissed playback session.

Explore return is verified with twenty posts and saved RecyclerView row 14: opening a work and going back retains the same artwork and its raw vertical position with a zero-pixel delta. A reused ImageView retains the newer bitmap after an older held response settles, and repeating a warm bind does not replace that bitmap.

## Following and fullscreen autoplay

Native delayed Following uses 24 works from author A, six each from B and C arriving later at the same publication time, and two older D works. A real card opens at 1747 ms while the next author is still held until 9606 ms. Eight forward and six backward navigation requests establish a protected history of eleven works. Later B/C arrivals preserve that prefix in both the list and the open gallery, and the remaining tail rotates B/A/C in current source order. The current artwork remains stable; the two older works stay at final positions 36/37 among 38 distinct works. Liking and viewing a card keeps it in the same visit after later publication and return to the list.

The initial 24 New identities survive earlier empty provider replies. Opening works clears their New state while the immutable baseline still correctly classifies later new authors. Pure regression tests additionally cover a late known mirror, weak parent-only false matches, exact grouped-video poster ownership, successful-source checkpoints, failed/unselected source preservation and twelve-subscription request coverage. Publication date parsing and sorting run on the grouping worker; current generation, metadata/visibility revisions, exposed boundary and New identities are checked before applying a result. Group collapse rebases protected counts without pinning unrelated unseen cards.

The final native fixture also delivers a same-MD5 Sankaku mirror after the actual artwork has been opened: open at 1725 ms, mirror response at 2195 ms, merged alias visible at 2808 ms. Across 234 later samples the merged card occurs once, neither the raw mirror alias nor its merged primary regains New, and the current artwork and ready bitmap remain stable. The source performs one Following page-zero request; additional neutral author-work requests are identified separately from pagination/retry traffic.

Actual detail-to-fullscreen tapping starts the native MP4 without a second tap. A real photo-to-video swipe also starts playback automatically. Detail pages show their poster until that fullscreen action. Backgrounding during a held video response and returning retains an opaque poster and eventually resumes real playback. Physical-device autoplay/codec behavior remains outside the tested environment.

The shared release package remains `com.artcatalog.mobile`, versionName `0.1.12`, versionCode `13`, minSdk `26`, targetSdk `35`. The existing signing identity is used for an in-place update. Saved collections and Android Keystore handling are retained. Following adds optional per-provider/rating checkpoints and timestamps for new subscriptions; existing records are retained without a destructive migration.

## Limits

Physical Galaxy Fold 7 / Android 17 performance, external-provider authentication/latency and device-specific codecs remain unverified. Cold-content tests now draw more frames earlier, so their frame percentiles are not a valid old/new steady-state FPS comparison. No physical 60/120 FPS claim is made.

A separate warm-cache gesture pair used the same 48 input works, zero HTTP requests, four warmup swipes and eight measured 200 ms swipes in the same compact viewport. Baseline gfxinfo recorded 430 frames, 11.63% deadline-janky frames and p95 48 ms; the candidate recorded 487 frames, 9.24% and p95 46 ms. The old thumbnail-prefix gate initially exposed only 28 of those 48 inputs, so the realized lists/frame counts still differ. This single software-emulator sample is descriptive evidence with that limitation, not a controlled physical-device FPS or causality claim. General rendering cost remains measurable.

The viewport anchor preserves the selected visible work while retaining actual duplicate removal. Removing an odd number of cards can legitimately re-pair the two-column grid and move neighboring cards by one row; the fix does not retain duplicate cards or leave vacant slots to conceal that reflow.

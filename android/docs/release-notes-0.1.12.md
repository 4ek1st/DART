# DART for Android 0.1.12

- Cold artwork opens now request a small preview while the full file loads. Opening an artwork has a separate bounded execution lane, so slow feed thumbnails cannot occupy all image workers.
- Video detail pages show the real poster with a play control. Opening the fullscreen player starts playback automatically, including a swipe from a photo to a video. Fullscreen playback retains the poster until the first decoded frame reaches the surface, and provides loading, pause, error and retry states. Playback attempts are guarded against stale callbacks after closing or switching artworks.
- Feed metadata creates fixed card slots immediately. One slow thumbnail no longer holds the rest of the feed behind it. An already displayed representative preview and card identity remain stable when another catalog contributes a copy.
- Regrouping duplicates above the viewport preserves the visible artwork's vertical offset. Returning to Explore uses the complete row count, including its topic rows and header.
- Following combines authors into one publication timeline: genuine New works first, then publication date. Equal-date ties rotate authors. Only the unseen tail is reordered; visible cards and the furthest traversed fullscreen history remain stable. Fresh pages across subscriptions and available providers precede deep back-catalog pages.
- Following uses immutable visit baselines and separate successful-provider checkpoints. An initial response from a second catalog does not make its entire old catalog New, and a failed or unselected provider keeps its previous checkpoint. Late copies of opened works cannot regain the New badge.
- Newly loaded images have a short transition; cached identical images are left untouched. Progressive quality upgrades preserve zoom and the viewed part of an image.
- Fresh usable Sankaku media links can open directly; expired links and playback failures retain the renewal/retry path. Sources, grouping evidence, recommendations and saved profile formats remain compatible with the previous version.
- Profile imports now require explicit agreement after reviewing the selected filename and collection counts. Changing the file or settings scope requires fresh agreement. Legitimate desktop tag punctuation remains intact across import and export.

Install this APK over the existing Android app. Its package and signing identity are retained. These are shared compact-phone fixes; no Fold-only layout is required.

Validation includes automated tests and an isolated native Android 15 emulator with neutral delayed network/video fixtures. Physical Android 17 device performance and external-provider latency have not been measured in this release.

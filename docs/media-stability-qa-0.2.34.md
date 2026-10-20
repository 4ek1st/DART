# Media stability verification for 0.2.34

## Isolation

Hidden Microsoft Edge at 2560 x 1440, scale 1; additional 960 x 780 and reduced
motion coverage. Each run used a separate copy of the Documents profile. Neutral
synthetic artwork and controlled provider responses made delayed pixels and
pagination reproducible without exposing profile content. The 28 original
profile file hashes were unchanged in the recorded runs.

The initial source checks served the edited frontend through the previous signed
0.2.33 server host. They do not establish live provider latency or native window
interaction coverage. The optional quarantined `tests/chrome` harness was not
used. Installation remains a user action through the guarded updater.

## Confirmed failures and regression checks

- The unmodified signed 0.2.33 host replaced the grid, card and image when
  crossing 160 entries, and displayed 162 records including a same-file mirror.
  The edited frontend retained all three nodes and displayed 161 unique works.
- Frame-by-frame browser sampling initially found five empty artwork frames
  despite completed byte loading. Adopting the decoded image element reduced
  that count to zero in the controlled cold-next and eight warm-arrow sequence.
- Eight warm left/right transitions made no duplicate full-image requests.
  Returning from Settings to the loaded catalog made zero image requests.
- One mount plus ten unchanged refreshes for 100 cached images previously made
  1,100 observer registrations and 11 disconnects. Incremental subscriptions
  keep one registration per unchanged image and only the mount disconnect.
- Viewed work and its later same-file mirror stayed hidden after append with
  the hiding preference enabled. Original-card holds and offscreen placeholders
  did not grant the mirror another slot.
- A controlled Following completion with 20 immediate source responses now
  publishes the complete loading result once and writes one identical preview.
  The final render still clears loading. Independent regressions cover changed
  filters, source notices/cursors, retry deadlines and failed-write retries.
- Regression tests cover queued arrows over hidden-only pages, reverse and
  exhaustion, closing during image preparation, a full pinned cache, exact file
  identity, partial metadata, explicit file replacement and mutated identity
  arrays. Distinct full files sharing only thumbnails/artists stay separate.

## Adjacent product checks

Hidden UI traversal covered Home, New/Popular catalog ordering, Following with
New first, an artist profile, Liked, Bookmarks, history, Settings, arrow browsing,
cached returns, English/Russian/German labels, persistence and failed-save
recovery. No page JavaScript errors occurred. Real external network stalls and
native full-window behavior require separate observation in the installed app.

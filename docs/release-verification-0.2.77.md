# DART 0.2.77 verification

Scope: shared vertical keyboard scrolling on ordinary desktop pages. No grouping, filtering, recommendation, profile migration or Android runtime changes. The installed application is left for user-controlled updating.

## Behavior and regression evidence

One shared controller owns W/S and up/down scrolling. Physical key codes support English, Russian and German layouts. It selects the nearest scrollable panel within the current page or open dialog, uses one bounded animation and clamps movement to current content bounds. The short easing finishes within 160 ms of the last input when frames are delivered; a delayed frame completes the step without a trailing animation queue. Reduced motion scrolls immediately.

Existing handlers keep priority: Space preview retains gallery-frame navigation, horizontal artwork navigation remains unchanged, and native text fields, selectors, video/audio controls, menus and tab lists retain their keys. Mouse scrolling, pointer presses, focus changes, window blur and changed page/dialog ownership cancel pending motion. Per-input work does not scan artwork collections or viewing history.

- Red/green unit evidence: the missing shared owner failed first. A separate delayed-frame regression failed before the animation deadline was added; the final focused unit suite passes 10/10.
- Keyboard/viewer/gallery unit suites pass 31/31.
- Hidden Edge passes 65 keyboard checks across opened artwork, Home, search, recommendations, Following, Liked, Bookmarks, history, Favorites, creator profile and settings. All four keys are exercised on every screen, including a long 900x3000 artwork and a smaller settings viewport. Checks include holding/releasing, reduced motion, page boundaries, Space gallery ownership, nested panels/dialogs, text/media controls, Russian physical keys, menus, tab switching and blur cancellation.
- Existing hidden gallery suite passes 270/270 checks with no runtime errors, including keyboard, pointer, media, gallery paging and responsive behavior. No optional quarantined native GUI harness is executed.

## Performance

Neutral large fixture: 2,440 liked records, more than 100,000 viewed identities and 16 mixed tabs, dense tags and grouped pages, at 2560x1440. Keyboard-to-first-scroll measurements were 1.3-3.2 ms with no observed long task during those four scrolling actions. Holding S stopped at the same position after two subsequent 230 ms observations.

Sequential equivalent before/after gallery fixture, using 0.2.76 source as the baseline: cold viewer entry 665/550 ms, warm return 527/496 ms, bookmark completion 140/129 ms, like completion 518/521 ms and unlike 444/405 ms. Steady gallery-page keys were about 2.4-5.1/2.5-3.2 ms; the first measured gallery key was 14.5/41.5 ms. Existing cold/render and saved-action long tasks remain (139/164 ms maximum in this pair). These measurements do not establish a general speed improvement or a lag-free program; this release adds bounded scrolling without new library/history processing on the key path. Raw traces and neutral captures remain outside Git and release assets.

The guarded publisher must run all top-level Node tests, non-GUI native fixtures and signature/updater checks before sealing the complete EXE. Final artifact and update-offer evidence is recorded after publication.

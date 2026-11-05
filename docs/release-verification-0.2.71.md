# DART 0.2.71 verification

Published: https://github.com/4ek1st/DART/releases/tag/v0.2.71

- Binary source: `6e2a864837d3dc55e6740b18e15faaa04f6bfef1`.
- Signed sequence: `71`; predecessor is official sequence 70.
- EXE SHA-256/build ID: `54bfbaa3f5172f8bac1cae26a5678dd457721845035b839c961a7076757e6c63`; size `83,943,484` bytes.

## Requested selection behavior

The active detail work or active quick viewer supplies excluded key, confirmed hash and owned-media identities. Actual grouped members are also excluded. Parent, Pixiv publication, artist, character and upload-time identities do not prove the same drawing. Background detail tabs and Favorites covers are not treated as open artworks. Exclusion and typed-tag context are included in the hover cache scope and revalidated on selection.

Viewed candidates retain priority over search. Up to 48 distinct physical examples are considered without changing library order; exact mirrors share a slot and better metadata can replace a duplicate. Recent and dated history provide direct viewing evidence. Other loaded works need strong viewed identities, so a shared parent cannot turn an unseen different scene into a viewed example. Large scans yield in short cooperative slices and honor cancellation. Search uses the first available provider page with eligible examples and retains the existing bounded background requests.

The tooltip alone ranks examples by catalog metadata: a sole identified requested character is preferred over an ensemble; specific relevant focus tags precede generic compositions; plain backgrounds and usable dimensions provide modest tie-breakers. Equal scores retain original order. This is metadata-based selection, with no visual-recognition guarantee. For groups, the example comes from a member that actually owns the tag rather than a union-tag cover. Root and member content/source/rating/creator/manual-hide policies remain active. No main recommendation ranking, shared grouping rules, Android source or profile data were changed.

## Regression and rendering evidence

A coherent 0.2.70 browser baseline reproduces the actual defect through normal navigation: open artwork 103, hover its tag, and decode artwork 103 again as the viewed example. The corrected fixture selects other work 105 from search; separate cases verify another viewed example after current-group/version/hash suppression, solo character selection, relevant eye-focus selection and a clearer search example. The expanded browser test caught an overbroad Favorites-cover exclusion, which was corrected and covered in both real rendering and the app-context suite.

The final hidden Edge run passed **236/236 checks**, with zero browser or fixture-server errors. It verifies decoded thumbnail pixels, actual detail/Home/Favorites/recommendation/autocomplete controls, viewed priority, filter/source boundaries, stable ready/pending rendering, scoped caches, A-to-B cancellation, native title and ARIA restoration, ordinary click/context-menu behavior, focus and Escape, no hover-triggered view/library/favorite writes, empty/loading/error/timeout states, late image pin release and disposal. Actual dark 2560x1440, light 700x900, viewport clamping, reduced motion and English/Russian/German captions passed. Neutral screenshots were inspected; reports, fixtures and runtime data remain outside Git.

The **25 new deterministic cases** cover strong copy/version exclusion, weak-publication safety, representative ownership and scoring, physical-copy pool limits, real app cache/context transitions, Favorites eligibility, viewing proof and cooperative cancellation. The pre-change module failed 17/19 new pure selection cases without production rollback. Independent review reproduced and then verified the copy-pool and weak-view-proof fixes. Root focused interaction compatibility checks passed **132/132**. The guarded publisher passed **1055/1055 Node tests** and required native catalog/profile/media/privacy/update/signature/ancestry/preservation gates.

Final tested frontend SHA-256 values: app `7e3307330765630e97d9a29f209bfa7e903f03e5ce349858c956d63524ddeedf`; module `78b33a358c1290a71cec82082d8994a78d40fad9e305e98153f8c55b1d86e824`; CSS `c5fa49aa4450242efefefbe665d2d58c4c2b0224c147d2e7b515fd653ce839a1`; index `f22302745e5de21e2452aa86971f1a1d0e85df06b9ff1fe889a86ae83379c21d`.

## Published artifact and installation boundary

The canonical publisher signed and published the committed source. The downloaded public manifest verified with the trusted installed ECDSA key, version/source/sequence/predecessor/size/hash. GitHub's public asset digest matches the sealed EXE. An isolated server-only startup of that hash-identical sealed artifact returned five frontend assets byte-identical to the tested checkout. This scoped check did not redownload the complete EXE or claim native window interaction coverage. The quarantined tests/chrome harness was not used.

The installed version remains 0.2.70. Its active-pointer SHA-256 remained `5555086708c3dfa545ff85a5b5882dc70a186e334b5c9f57db9eff5f8625b059`. No installed activation, personal-profile mutation or visible application restart was performed. The post-publication installed-updater check encountered GitHub's rate limit and reported retry at `2026-11-05T10:40:47Z`; consequently detection through the normal update button has not been verified for this release. Public release/signature verification succeeded independently. No updater configuration or protected release state was reset to bypass that external limit.

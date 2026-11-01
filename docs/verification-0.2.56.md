# Windows 0.2.56 saved-library verification

## Reproduced causes

The running installed application was verified as signed 0.2.55, rather than assuming an old installation. Read-only inspection of a copied profile showed that newly added likes were already at the front of the saved array. The actual render/filter path reapplied global curation and moved those entries behind older, higher-ranked works. Bypassing discovery curation for saved libraries restores their natural order without rewriting the profile or disabling grouping/content filters.

The remaining blank Sankaku records in the inspected saved data had numeric legacy IDs and retained valid MD5 hashes. Controlled metadata-only requests showed the numeric post route and numeric ID search returning 400, while an exact retained-MD5 search returned one matching post with usable media. No copied refresh token was used or rotated; personal IDs, hashes, URLs and credentials are excluded from fixtures and release assets.

The full neutral rendered frontend also reproduced a separate mixed-group failure: media recovery obtained a mirror preview, then regrouping chose the empty/expired preferred member again. This caused repeated cached recovery/rerender cycles. Tests use the actual recovery controller, cache, metadata application, grouping and rendering, rather than mocking the media-application function.

## Regression coverage

Saved-order regressions failed before the change and now cover low-score recent likes, filtered/grouped mirrors at their latest saved slot, rendered and uncached gallery navigation in both directions, late metadata updates, removal preservation and curation preference changes. Discovery curation remains covered separately.

Native legacy-ID fixtures cover bounded exact-hash resolution, original requested identity, persistence after reopening, unchanged metadata/order/membership revision, canonical supplemental tag requests, modern direct requests, and rejection of empty, mismatched, ambiguous, media-less or wrong-ID responses. Grouped-member and owned-image-record tests prevent using a different variant's primary hash.

The changed backend also recovered one real missing record in an owned minimal copy using one guest metadata request: exact hash match, usable preview/full media and the original numeric identity, with persistence after reopening Likes and Bookmarks. No personal original file was written and no refresh token was copied or used.

Integrated JS and headless-rendered checks cover standalone imports, missing preferred-source previews, unavailable primary members, expired preferred previews and unrelated responses. Successful scenarios decode actual neutral image pixels, leave no text-only placeholders, produce no JavaScript errors and settle without recovery loops. Raw source members are not assigned another source's preview.

The Android conformance resource is regenerated only to update the desktop-source provenance hash. Its neutral recommendation, grouping, curation and fingerprint results must remain identical. Android application behavior and the published APK are not changed by this desktop release.

## Release boundary

Use the canonical guarded publisher with the existing signing/base identity. No manual replacement of the installed files, personal-profile rewrite, forced restart or tests/chrome harness is part of verification. A prepared/published release is distinct from activation in the user's running application.

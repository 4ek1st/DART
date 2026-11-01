# DART for Android 0.1.11

- Brought the local recommendation model, evidence thresholds, query groups, combinations, seeded variation and curation factors into line with the current Windows logic. Likes remain independent from Bookmarks.
- Added portable profile exchange with Windows: additive likes, bookmarks, follows, viewed identities, favorite tags, recommendation priorities and optional content/curation settings. Preview counts before merging; repeated import is idempotent. Existing profiles and Android Keystore credentials remain local.
- Sources deliver independently through bounded, cancellable request scheduling, shared successful-response caching, provider cooldowns and a reserved interaction lane. Rule34 accepts valid empty/JSON/XML responses without treating access failures as empty pages.
- Published feed cards remain in place for their visit. Only newly arriving works receive current viewed/saved/followed filters. Recommendation exposure records actually visible work groups rather than every downloaded item.
- Extended grouping and media identity safeguards across Danbooru, Gelbooru, Rule34 and Sankaku. Preserved participant roles, grouped members, visual fingerprints and popularity evidence through transfers.
- Added visible-only recovery of imported Sankaku thumbnails, renewed signed-media cache identities, background visual fingerprints and nearby-image preparation.
- Added English, Russian and German interface selection, the DART branding and global curation/followed-author settings. Retained native touch navigation, likes, bookmarks, screen-capture protection and a shared fullscreen host for photos and videos.

Android remains a standalone native application; a running PC or cloud account is not required. Windows-specific window chrome, keyboard/hover controls and Windows capture APIs are represented by Android touch controls and FLAG_SECURE. Matching algorithms do not guarantee identical live feeds when source access, filters, candidate availability or random visit state differ.

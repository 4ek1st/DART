# Portable profiles between Windows and Android

- Added Settings → Profile transfer with one shared JSON format for DART on Windows and Android 0.1.11.
- Export and merge likes, bookmarks, artist/uploader follows, permanent viewed identities, favorite tags and recommendation priorities. Likes and bookmarks stay independent, and catalog aliases prevent duplicate saved copies.
- Preview collection counts before merging. Existing entries remain, repeat imports do not rewrite unchanged profiles, and content/curation settings are applied only when explicitly selected.
- Retain grouped media, genuine variants, participant roles and visual grouping evidence. Create verified local backups before changing profile files and roll back on a failed write.
- Keep API credentials, account tokens, signed media links, update configuration and device/window settings out of exports. Visible imported Sankaku cards can refresh missing thumbnails by artwork ID.
- Added the Android 0.1.11 source update and deterministic cross-platform conformance fixtures for ranking, grouping, curation and visual fingerprints.

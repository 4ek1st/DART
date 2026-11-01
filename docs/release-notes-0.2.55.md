# Reliable profile transfer and imported media

- Fixed export of larger profiles. Portable JSON is compact, and the 20 MB limit is checked after cleaning trusted local metadata. All saved collections remain included; incoming files retain their existing size and validation limits.
- Added explicit agreement before importing a file on Windows and Android. Review the filename and collection counts, check the confirmation box, then confirm the transfer. A different file or settings selection requires fresh agreement. Cancel keeps the existing profile.
- Imported Sankaku cards can restore omitted or expired media links by artwork ID. Thumbnail recovery uses a fast media-only lookup, independent of supplemental tag loading, with bounded visible-only retries. Existing titles, attribution and tags remain intact.
- Kept API credentials, source account sessions and device settings local. Signed links are renewed on the receiving device rather than copied as credentials in the portable file.
- Android 0.1.12 includes cold image previews, video posters through first-frame rendering, fullscreen autoplay, stable Following chronology and browsing history, and compatible validation of legitimate desktop tag punctuation.

Updates retain the existing profile and use the normal signed updater. The private JSON export is for transfer between your own devices.

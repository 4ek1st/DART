# DART for Android 0.1.14

- Added Android update checks and an Updates page in Settings. A compact download arrow appears when a newer Android version is available, including before opening Settings. Downloads show progress and can be cancelled. Installation opens Android's standard confirmation screen and preserves the existing app profile.
- Large desktop profile imports no longer create several complete JSON copies in memory. Import and export stream their output, retain the existing size limit, consent and backup, and preserve saved identities and collection order.
- Reduced repeated whole-library grouping, identity indexing and taste calculation. Recommendations, Following, search and author pages reuse prepared data. Background metadata and image repairs no longer occupy the selected artwork's worker queue.
- Artwork navigation continues past unavailable images. Returning to a partially loaded feed keeps its cards and loading state. At a deferred page boundary, browsing back remains available while loading retries in the background.
- Restoring a large liked collection retains its order without serializing the entire collection into Android's activity-state bundle. Content-hidden entries are skipped consistently during browsing; viewing or liking an artwork does not remove its card from the current visit.
- Legacy saved Sankaku records can recover media through their own exact file hash while preserving the original saved identity. Video previews remain visible until the first frame or an actionable error.

Install this APK once over the existing Android app to enable future in-app updates. Do not uninstall or clear app data. APK downloads and installation require explicit actions; the updater checks the package, version, file digest and installed signing certificate. Windows updates remain separate.

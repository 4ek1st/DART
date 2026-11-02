# DART for Android 0.1.15

- Removed the Android in-app updater completely: background version checks, APK download/installation, update indicators and the Updates settings page.
- Removed android.permission.REQUEST_INSTALL_PACKAGES and the update FileProvider. About DART keeps a normal link to Android releases for manual downloads. Install downloaded APKs over the existing app to retain the local profile.
- Artwork actions now run from left to right: Like, Bookmark, Download original, Open source.
- Removed the Original publication row from artwork attribution. Original links remain in saved metadata. When Original link is explicitly selected as the attribution preference, Open source uses that link; otherwise it opens the catalog record.
- Kept the existing signing certificate, package, saved collections and profile format. Compact collection buttons retain their touch targets and support larger fonts.

The user reported a Play Protect warning for 0.1.14. Removing the updater and its installation permission is confirmed for this release; whether Google clears its classification has not been confirmed. No Play Protect bypass or automatic installation is included. Windows updates are separate and unchanged.

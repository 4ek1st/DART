# DART Android 0.1.10

Standalone Android app for Android 8.0+ (`com.artcatalog.mobile`). It is signed
with the same owner key as the previous Android release, so it can be installed
over 0.1.6 while retaining the local profile.

Changes since Android 0.1.6:

- Recommendations use likes, saved interests, tag preferences and exclusions.
  Feeds continue loading available sources when another source is restricted.
- Improved image preparation and scrolling, with previews prepared near the
  viewport and additional work pages loaded during browsing.
- Added fuller settings, distinct artist and uploader profiles, follows, and
  color cues for character, franchise and original tags.
- Grouped variants appear as one work, with all images in a vertical gallery.
  Swipe anywhere on a work to move to another work; double-tap an image to like.
- Work transitions slide the outgoing and incoming pages side by side. Removed
  the row of individual source records from the detail view.

Verification: 52 Android unit tests passed, release lint had 0 errors, and
the APK's v2/v3 signatures were verified. Navigation and grouped works were
also checked in Android 15 emulators. Physical-phone performance was not
measured in this release.

APK: `DART.Android-0.1.10.apk`. The release asset includes its SHA-256
checksum in the GitHub release notes.

The Windows release remains separate. This Android-specific release is not
marked as the latest release, so the Windows download and updater keep their
Windows release target.

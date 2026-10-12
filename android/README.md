# DART for Android

The current standalone mobile app is **ArtCatalog Mobile 0.1.10** for Android 8.0+
(API 26). It works without a Windows PC and currently has a Russian interface.
The Android and Windows apps have separate version numbers and may differ in features.

[Download the signed Android APK](https://github.com/4ek1st/DART/releases/download/android-v0.1.10/DART.Android-0.1.10.apk) · [Release notes](RELEASE-0.1.10.md)

Open the APK on your phone and allow installation from the app opening the file
if Android prompts you. The package is `com.artcatalog.mobile` and appears as
**ArtCatalog** on the device. Future owner-signed APKs can be installed over it
to keep the local profile.

## What is included

- Native phone layout with bottom navigation, search, two-column feeds, and full-screen viewing.
- Danbooru, Gelbooru, Rule34, and Sankaku sources, subject to their access rules.
- Local likes and bookmarks, recommendations, artist follows, history, image and video viewing.
- Swipe between works with a short slide animation. Double-tap an image to like its work.
- Multiple images of one work form a single vertical gallery; tags and artist links stay in the detail view.
- Local profile storage, import and export. API credentials stay on the device.

## Build from source

Requires JDK 17+, Android SDK platform and build-tools 35, and the included
Gradle wrapper. On Windows:

```powershell
.\gradlew.bat :app:testDebugUnitTest :app:lintRelease :app:assembleRelease
.\build-apk.ps1 -SdkPath 'C:\path\to\Android\Sdk' -JdkPath 'C:\path\to\jdk'
```

The release script signs with a private keystore outside the repository. A
newly generated keystore will not update an installation signed by the owner.
No personal profile, API keys, or signing key are included in this source tree.

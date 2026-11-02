# Play Protect review request: DART Android 0.1.14

Status: prepared locally. No appeal or APK upload has been submitted from this investigation. The Google classification remains unresolved. Local signature verification and application tests do not establish an antivirus verdict.

Official form: https://support.google.com/googleplay/android-developer/contact/protectappeals
Official guidance: https://developers.google.com/android/play-protect/warning-dev-guidance

## Form fields

- Contact email: provide the owner's contact email.
- Developer name: DART / 4ek1st (or the owner's chosen developer name).
- Package: com.artcatalog.mobile
- APK SHA-256: f5f5c15a4d7910651d82eac9dd3cb27a85aa894ff6a5425a368d7a84d40334ac
- Version: 0.1.14, version code 15.
- Published APK: https://github.com/4ek1st/DART/releases/download/android-v0.1.14/DART.Android-0.1.14.apk
- Source commit: b71f6326313c0ffb1049f58b7149d23dde15609f
- Signing certificate SHA-256: b97a808c1adcfa9b0489b04b09848f8638eb6df276d259f044d58f1fd01fcf5d

The form requests the SHA-256 of the APK uploaded to VirusTotal. An existing report for this hash was not retrievable through our public lookup. Uploading the public APK and sending the appeal require separate authorization; no private profile, credentials or personal screenshot should be included.

## Proposed additional information

Please review the Play Protect classification of DART for Android 0.1.14. A user reported the German warning "Schädliche App blockiert" during installation of this APK. We are requesting a classification review and do not yet know the malware category or trigger.

DART is an open-source artwork browser distributed through its GitHub Android releases. The published APK hash and its APK Signature Scheme v2/v3 signature match our reviewed build and existing signing certificate. Release assets contain no debug fixtures, profile files or signing keys.

Version 0.1.14 added an explicit in-app self-update flow and android.permission.REQUEST_INSTALL_PACKAGES. Its other platform permissions are INTERNET and ACCESS_NETWORK_STATE. AndroidX contributes one signature-protected receiver permission. There are no declared SMS, contacts, location, microphone, camera, accessibility-service, notification-listener or device-admin permissions/components.

The updater reads a fixed HTTPS metadata URL in this repository. An APK download requires an explicit tap. The app bounds the download, verifies its SHA-256 and size, checks its exact package, higher version code, supported SDK and equality with the installed signing certificate, and repeats validation before handing a read-only content URI to Android's standard installer. The Android permission and installer confirmations remain under user control. It does not silently install apps, load downloaded DEX into its own process or bypass Android security settings. Profile files and provider credentials are not read by this updater.

If the APK is incorrectly classified, please review its classification. We will not ask users to disable Play Protect to work around the warning.

## Evidence and limits

- The published GitHub asset reports the same SHA-256 and 2,186,426-byte size as our local signed APK.
- apksigner verifies the unchanged release certificate and valid v2/v3 signatures.
- The binary manifest has the three platform permissions above and the AndroidX signature permission.
- The source review of the updater found explicit user actions and package/hash/signature validation. It does not reveal Google's private detection reason.
- The local Windows Defender custom scan could not run: Product/Feature disabled, 0x80004005. No clean scan result is claimed, and antivirus settings were not changed.
- The owned Android QA emulator does not reproduce Google Play Protect's cloud classification. Its successful installation is functional testing only.

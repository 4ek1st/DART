# Android 0.1.13 settings verification

## Scope

Native Android settings layout and navigation only. Existing preference keys, profile/transfer schema, recommendation and provider logic remain unchanged. Windows application binaries are not built or replaced for this change.

## Automated checks

The existing JVM suite passes 196 tests with zero failures, errors or skips. Debug assembly and release lint pass. Lint has zero errors; existing API, persistence and custom-view findings remain and are not described as warning-free.

The language generator retains all 569 common desktop rows and every existing mobile alias. All 2,644 previous exact/trimmed aliases produce the same EN/RU/DE results after regeneration. New settings static strings have no missing translations or new alias collisions. The generator is deterministic; the isolated I18n suite passes 6/6.

Read-only review checked saved settings routes, back-stack/scroll restoration, non-secret excluded-tag drafts, immediate toggle/radio preferences, disabled dependent controls, encrypted credential handling, blank-key preservation, transfer consent and keyboard/bottom-navigation behavior. Retained recommendation settings use a revision guard so a result can finish while the page is offscreen; source operation completion refreshes the visible connection list.

## Native verification environment

The owned ArtCatalogQA emulator runs API 35 / Android 15, hidden, read-only, offline, with a fresh temporary Android user. The ordinary ArtCatalogPhone AVD, physical phone, personal Windows UI and personal profile are not used.

Baseline 0.1.12 and candidate screenshots/UI trees use 360dp and 412dp compact portrait widths, including 130% font size and English/German. The baseline confirms four adjacent tabs and several unrelated routing buttons before the actual Content controls. Appearance and Privacy require scrolling through that form. Font/language recreation loses the current settings route. The baseline tab titles remain reachable; no claim of clipped tab titles is made.

The new index exposes all sections directly with icon/title/description rows. It replaces the four tabs and hides the main bottom navigation within settings. Actual label-area taps toggle Generated exactly once, enable Assisted, and persist both values across Back/reopen. Disabling Generated makes Assisted non-clickable. The furry preference also persists. Typing a neutral excluded-tag draft, rotating to landscape and back preserves the exact draft and Content route; explicitly saving persists normalized tags. Updating the debug candidate and restarting retains these settings.

All ten index destinations and all four source subpages pass actual UI tap/Back navigation. Curation's four dependent factors are disabled with its master switch and become usable when enabled; changing an individual factor persists after returning. Invalid first-time API-key submissions and empty Sankaku sign-in are blocked locally. Privacy toggles the actual SECURE window flag on and off. Applying Light retains Appearance through recreation and Back returns to the index. The selected Language row retains its exact bounds after leaving a deeply scrolled index and returning. Font-size recreation retains the settings route. English, Russian and German layouts at 360dp/412dp with 130% font size show wrapping rows without label/switch overlap.

The new Profile transfer import action opens the real Android document picker. Selecting an owned neutral JSON from Downloads reaches the production confirmation dialog with the literal filename and collection counts. Existing explicit consent remains initially unchecked, confirmation disabled, and a disabled tap is ignored. Cancel returns to Profile transfer and preserves the exact catalogue bytes.

## Signed package

The final signed APK installs over 0.1.12 as `com.artcatalog.mobile`, versionName `0.1.13`, versionCode `14`, with the existing signing certificate. The owned emulator's pre-existing primary profile remains byte-for-byte unchanged and is never launched. A separate fresh temporary user opens the signed application's settings index offline and confirms the installed version; no FATAL/ANR is observed. Release inspection verifies the APK signature and excludes debug fixtures/classes. The published APK is downloaded again and matches its checksum and the local signed APK. The Android release does not replace Windows v0.2.55 as GitHub's latest release. No personal app or physical device is updated by these checks. The owned test emulator is stopped after verification.

## Limits

Physical Galaxy Fold 7 / Android 17 and external-provider authentication are not part of this UI check. No physical-device performance or real-account sign-in claim is made. Source validation uses neutral inputs with emulator connectivity disabled. Field focus, text entry and reaching Save by scrolling were checked, but the secondary emulator user did not visually draw the software keyboard even when the input-method service reported it shown. A rendered software-keyboard/resize pass is therefore not claimed.

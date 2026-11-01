# Android 0.1.11 verification

Scope: standalone native Android parity with DART Windows 0.2.54 and additive portable profile exchange. Personal phone, installed Windows application and original profiles were not used by these tests.

## Automated checks

- Complete Android JVM unit suite: 140 tests, zero failures/errors.
- Release lint and release compilation pass; zero lint errors, 23 warnings retained for review (including existing API/deprecation/style warnings).
- Deterministic fixtures generated from the canonical desktop JavaScript cover 24 neutral scenarios: six recommendation/query profiles, six grouping/media cases, four curation configurations and eight DCT fingerprints. Android compares these outputs, and a desktop Node gate detects drift in the canonical source/expected outputs.
- Tests cover bounded shared transport, cancellation/coalescing, source cooldowns, a healthy fourth source while three peers are held, empty/JSON/XML Rule34 responses, XML safety, canonical signed-image caches, stable published cards, grouped exposure budgets and validated/idempotent profile merging.
- The common neutral profile and actual native Android export are accepted by the desktop normalizer and isolated import/export endpoint.

## Native hidden emulator

Used the read-only ArtCatalogQA overlay, Android 35, serial emulator-5580, debug package com.artcatalog.mobile.debug. The normal ArtCatalogPhone AVD and physical phone were not opened. All catalog fixtures and the local MP4 are neutral and debug-only.

Verified real interface import preview/cancel, explicit merge, repeated no-op import, force-stop/restart persistence, export, English/German/Russian language selection and recreation, open/like/bookmark/back retaining 34/34 published works, and a Following card opening while a peer source remained held for 6.5 seconds. Two cards were available by the 1.6-second fixture checkpoint; late completion retained the open artwork.

Native VideoView fetched and decoded a neutral 2.2-second local MP4, looped in an aspect-fitted 1080×607 viewport, and real gestures navigated video → photo → video without leaving fullscreen. Renewing a Sankaku media signature reused the same decoded BitmapDrawable. A forced staging-write failure preserved quiescent profile bytes, collections and settings.

Additional native delta checks confirm cached discovery hides followed artists while Following remains available, failed Sankaku previews refresh once without a flood, and exported history retains newest-first order. Search continued through a wholly filtered middle page to pages 0, 1 and 2, ending with 32 unique visible works.

Native testing found and fixed two defects not exposed by the JVM: Android ICU rejected the Java `(?U)` regex flag after importing likes, and an initial unattached-window check prevented VideoView initialization. The post-fix crash buffer is empty.

## Package checks

Release package remains com.artcatalog.mobile, versionName 0.1.11, versionCode 12, min SDK 26 and target SDK 35. APK signatures v2/v3 verify and retain the existing certificate SHA-256 `b97a808c1adcfa9b0489b04b09848f8638eb6df276d259f044d58f1fd01fcf5d`.

Release DEX/resources exclude FixtureClient, MobileParityChecks, the neutral QA MP4 and debug localhost network-security configuration. The normal release retains cleartextTraffic=false. Updates are intended to install over the existing app with the same signing identity.

## Limits of the evidence

Physical-phone performance, external provider authentication/latency and capture behavior across specific recording apps are not established by these checks. Android retains native touch navigation rather than Windows window chrome/hover controls. Shared algorithms do not guarantee identical live candidates or random visit state. No personal profile was automatically transferred.

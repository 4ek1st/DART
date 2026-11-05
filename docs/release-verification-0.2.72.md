# DART 0.2.72 verification

Published: https://github.com/4ek1st/DART/releases/tag/v0.2.72

- Binary source: `7f2829cb90fa96f08b52de07a721026cd27c9d51`.
- Signed sequence: `72`; predecessor is official sequence 71.
- EXE SHA-256/build ID: `279f74d30e098bddd620f4c1cb2ae2adbe2ef705e24eb6998e66c6c4eda2d3e2`; size `83,943,482` bytes.

## Reproduction and narrow fix

The installed public updater had persisted an API-led retry deadline before 0.2.71 was published. Both its in-memory and stored early returns prevented a check of the public signed manifest until the API deadline. A direct read of that manifest returned HTTP 200 with verified release 0.2.71 while API discovery returned HTTP 403 with no quota remaining. The shared retry state could encode an API pause and a previous fallback result, so it did not prove that the public download route itself was currently blocked.

Public tokenless discovery now reads the signed latest-manifest URL directly, without GitHub API requests or credentials. Only the verified manifest version determines the pinned executable URL. The retry record identifies its discovery channel: the previous API-led record cannot pause the independent public route, while new public download rate limits, server deadlines and transient-error backoff persist normally across force checks, windows and restarts. Private token-bearing repositories retain their authenticated API route and existing deadlines. Signature, artifact hash/size, ancestry, version floor, source boundaries and guarded activation remain unchanged. No frontend, catalog, recommendation or profile changes were made.

## Verification evidence

The new native fixture failed against the old service with `working public manifest inherited GitHub API quota status`. The corrected complete updater fixture passes all five reporting groups. Coverage includes public discovery making zero API requests and sending no credentials; recovery from legacy API-led pauses; current-version followed by a newly published release before the old deadline; independent public 429/503/network retry and recovery; retained private legacy pauses; private/public access denials; token-host boundaries; signature/hash/version/ancestry rejection; exact pinned download; streamed/declared size limits; cancellation and cross-process lease serialization; publisher safeguards and profile preservation. Independent implementation review found no actionable remaining issue.

All **12 desktop-shell tests** pass, including automatic startup/focus/background discovery, install visibility only for verified offers, persisted server deadlines, concurrent request sharing and session-flush protection. No shell code change was required. The guarded publisher passed **1055/1055 Node tests** and required native catalog/profile/media/privacy/update/signature/ancestry/preservation checks.

Before publication, the updated ReleaseTool checked an isolated copy of the installed 0.2.70 receipt, signed current manifest and captured legacy retry state against the real public endpoint. It offered verified 0.2.71 with no error, rate limit or retry delay. After publication, the exact sealed 0.2.72 EXE was started server-only with a neutral profile and that isolated installation restored to the legacy retry input. Its actual `/api/updates/check` returned current 0.2.70, available/verified 0.2.72, empty error and no retry delay. The downloaded public envelope verified with the trusted ECDSA key; GitHub's public asset digest matches the sealed binary; five embedded frontend assets match the tested checkout. This artifact check did not redownload the complete EXE.

The already-open installed 0.2.70 program was also checked through its own loopback endpoint after its old API deadline elapsed. It offered verified 0.2.72 with no error, retry delay or rate limit. A read-only Windows accessibility query then confirmed the existing `Version available · DART 0.2.72` button was visible and enabled. No focus, click or installation action was used for that inspection. The legacy program's recovery after its deadline and the new binary's independent public route were verified separately.

The installed active-pointer SHA-256 remained `5555086708c3dfa545ff85a5b5882dc70a186e334b5c9f57db9eff5f8625b059`; its current version remains 0.2.70 until the user installs. No manual protected-state reset, loose-file replacement, personal-profile mutation, activation or visible restart was performed. The quarantined tests/chrome harness was not used. Isolated QA data, reports and verification scripts remain outside Git.

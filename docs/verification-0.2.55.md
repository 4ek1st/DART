# Windows 0.2.55 profile-transfer verification

The export failure was reproduced with an isolated copy of transfer metadata: indentation made a valid compact portable document exceed the shared 20 MiB output limit. Compact serialization and trusted-snapshot normalization fix this without raising inbound limits or omitting collections. Large-data regressions cover both indentation growth and internal provider metadata removed before the portable size check.

An isolated HTTP server returns the compact export successfully and accepts it for preview. The same private document passes the Android codec, in-memory merge/export and repeated idempotent merge. Private data, credentials and profile contents are excluded from this repository, fixtures and release assets. The user's installed process/profile was not replaced by these checks.

Rendered neutral transfer QA covers an unchecked file-scoped consent checkbox, disabled confirmation, keyboard focus, settings-scope/section revocation, cancel without an import request, explicit confirmed HTTP merge, a newly selected file requiring consent again, English/Russian/German and a compact desktop viewport. Controller tests cover busy guards and file/options captured before asynchronous work.

Sankaku recovery uses neutral native and JavaScript fixtures. A held supplemental tag endpoint blocks full detail but does not block media-only renewal. Renewed media persists in Likes/Bookmarks while title, creator, tags, group identity and collection membership stay intact; repeated renewal is a no-op. Full detail still performs its original tag enrichment. Visible-only two-lane recovery handles blank/expired previews and mixed-source members, with bounded idle retries and cancellation.

Final releases use the canonical guarded publisher and existing signing/update identity. Activation of the user's running application remains under its normal update flow; tests/chrome is excluded under repository instructions. Android package verification is documented separately in android/docs/verification-0.1.12.md.

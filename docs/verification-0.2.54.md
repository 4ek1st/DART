# DART 0.2.54 verification

This release adds shared Windows/Android profile transfer and integrates Android 0.1.11 source. Existing recommendation weights and desktop grouping rules are unchanged.

Isolated native fixtures cover separate collections, explicit artist/uploader roles, original-publication viewed identities, alias/hash deduplication, transitive alias bridges, genuine media variants, participant/fingerprint metadata, settings opt-in, repeated/empty no-op imports, bounded history with permanent viewed evidence, secret/signed-URL removal, verified backups and failed-write rollback.

Own loopback HTTP probes verify export/preview/import, concurrent no-op imports, same-origin rejection, invalid UTF-8/unsupported-version rejection and oversized-body rejection. Actual Android neutral exports pass the desktop normalizer and isolated import/export.

Seven rendered interface scenarios passed using an owned hidden Edge profile: real file chooser and input, preview/cancel, default settings opt-out, merge, no-change reimport with stable library bytes, actual JSON download and its reimport, persisted Russian and responsive German at 820×900. Downloaded bytes matched the response SHA-256. No unhandled JavaScript exceptions were observed. No personal browser, installed application or original profile was opened.

The guarded publisher is the authority for the final complete Node/native/privacy/updater tests, signed executable and source provenance. Android has its own verification report under android/docs/verification-0.1.11.md. Native tests/chrome remains excluded.

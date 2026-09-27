# DART — Discover Art

User instructions: for concrete implementation tasks proceed without asking for another confirmation. Preserve concurrent work and personal data. Do not create archives.

## Authoritative source and releases

- This repository is the canonical desktop source. Android is a separate project.
- Do not copy a publish folder, EXE, DLL, JavaScript or CSS over an installed application.
- Build and stage desktop releases only with `scripts/Publish-Release.ps1`. It checks the registered source directory, release base, tests and source drift, then signs one complete EXE.
- Do not delete or rewrite `.dart-release-base.json`, installed `release-head.json`, `active-release.bin`, `update-system.json` or the release signing key to get past a rejected release. A rejection requires reconciling with the current canonical source/history.
- After the one-time launcher migration, install through DART's update button or the guarded launcher activation command. Release directories are immutable.
- Never sign from an old copy or publish an unreviewed concurrent snapshot. Commit and verify all intended current changes before publishing.
- The Documents profile, API credentials, cached media, session state and signing key must stay outside Git and release assets.
- Before declaring an installed update complete, verify its signature/hash, active sequence, native startup and retained profile state.

## Test isolation

- `tests/chrome` is an optional native UI harness. Its generated DLL was quarantined by Bitdefender as `Gen:Variant.MSILHeracles.250901` on 2026-09-27. Do not rebuild, restore, execute or add exclusions for this harness until that detection is investigated. It is not included in the application or release assets. Use browser UI tests meanwhile, and report the native interaction coverage limitation.

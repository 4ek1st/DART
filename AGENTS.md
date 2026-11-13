# DART — Discover Art

User instructions: for concrete implementation tasks proceed without asking for another confirmation. Preserve concurrent work and personal data. Do not create archives.

Use the repository owner's configured Git identity. Add assistant or vendor co-author attribution only when the user explicitly requests it.

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

## Shared artwork processing and performance — direct user requirement

- Before adding an artwork feature or screen, identify and reuse the existing owners of grouping, identities, content filters, saved-state membership, attribution, recommendation evidence and media transport/cache/recovery. The same artwork must not acquire a parallel implementation or repeatedly rebuild the same evidence for another screen. Extend the shared mechanism when necessary.
- Do not repeatedly rebuild or copy the complete viewing history or saved library inside per-card, pointer, keyboard, pan/zoom, render or media-ready callbacks. Membership checks must use shared indexes/views; reuse unchanged grouping and derived metadata. Heavy cold analysis belongs in the shared worker rather than a render callback. Invalidate caches explicitly after replacement, same-size mutations or learned identities so speed never returns hidden works or stale artwork routes.
- Worker dispatch and result delivery are part of the interaction budget too: reuse unchanged profiles and complete artwork records rather than copying the whole collection for every action. Calculate only the evidence a screen consumes; Favorites must not wait for unused recommendation combinations. A background calculation alone does not prove that publishing its result is responsive.
- Keep large log reads, decoding and summary calculation outside the global profile/store lock. Snapshot inputs consistently, bound memory/queues/caches and reject stale publication after concurrent activity. Never trade profile integrity or accurate counts for a faster result.
- Before declaring a new artwork flow complete, measure its first entry, warm return, scrolling, like/bookmark action and viewer/Space transitions when relevant. Use hidden browser tests at 2560x1440 and a neutral large-library fixture (thousands of saved works, at least 100,000 viewed identities, dense tags, grouped variants and many mixed tabs). Preserve filters, ordering, statistics, duplicate protection, visible-card retention and keyboard/pointer behavior.
- Treat new synchronous tasks of 50 ms or more on an interaction path as a regression to investigate. Compare equivalent before/after fixtures and report cold versus warm timing separately; passing a build or a small fixture is insufficient. Use existing background workers or bounded cooperative work for heavy analysis, and keep the current usable content responsive while it completes.
- Performance regression tests for saved-work membership, Favorites activity packing, grouping/evidence reuse and recommendation ordering are required release checks. `scripts/Publish-Release.ps1` runs all `tests/*.test.cjs` plus the native Favorites/concurrency fixtures; do not disable these checks to ship a feature. Add a focused cost/behavior regression whenever a new bottleneck is fixed.
- Final verification must state what was measured and any remaining slow path. Do not claim the whole program is lag-free from one fast screen or from synthetic CPU timings alone. Keep personal data and raw performance traces outside Git and published releases.

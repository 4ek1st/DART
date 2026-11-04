# DART 0.2.69 verification

Published: https://github.com/4ek1st/DART/releases/tag/v0.2.69

- Binary source: `efb243e12db1218fc9781203a4d570247033d078`.
- Signed sequence: `69`, following official sequence 68.
- EXE SHA-256/build ID: `009aaa516a5bc9eeb1961f48a15ee7a109637b6bb333ba47c3a814425c1d6e56`; size `83,938,054` bytes.

## Diagnosis and bounded change

Favorites reused recommendation names for automatic Characters. That names bucket includes both typed characters and legacy title guesses; one wrong historical category could promote an ordinary content tag across every matching work. Automatic Favorites now requires typed name evidence and rejects known content/generic tags, including broad attributes already recognized by catalog logic. The same automatic guard covers viewing summaries and known metadata. Rejected character candidates remain Tags with their counts and priorities. Exact whole-tag checks retain series-qualified names. Explicit manual categories in Mine remain user choices. No recommendation ranking, catalog logic, provider parser, saved metadata or profile migration changed.

Three new unit regressions were RED before the change and GREEN afterward. The full Favorites unit suite passed 35/35, covering corrupt typed rows from each of four catalogs, title-only guesses, preserved counts/priorities, qualified names, typed known history, manual overrides and input immutability.

The real hidden Edge fixture at 2560x1440 passed 44/44 checks with zero browser/server errors. Serving the old Favorites module in memory reproduced 22 failed classification/count checks without exceptions. The fixed UI excludes the polluted content tag from Characters/System, retains it in Tags with rating-specific liked counts and viewing counts, and survives Refresh, rating/cache changes and manual/system round trips. Fixture data and manual choices receive no writes. Neutral screenshots and diagnostic reports remain outside Git. The tested Favorites module SHA-256 is `400666c4e615e8a980ea29f5548d371e766a5efca3c1005a0ba1fa1c6efb3e7a`.

## Release and runtime verification

The canonical guarded publisher passed 1004/1004 Node tests and the required native catalog/profile/media/privacy/update/signature/ancestry/preservation gates, then sealed the clean committed source. GitHub returned HTTP 502 at the final publication phase on two attempts. Publication resumed with the same sealed artifact and source after checking the canonical release base; uploaded draft assets were verified before making that draft public. No resealing, protected-state rewrite or new build was used to bypass the network failure.

The public signed manifest was downloaded and verified with the installed trusted ECDSA key, including sequence, predecessor, source and size. GitHub's public asset digest matches the sealed EXE's SHA-256. An isolated server-only native startup of this hash-identical sealed artifact returned an embedded Favorites module byte-identical to the tested source. This scoped smoke test did not redownload the full EXE or claim native window interaction coverage. The quarantined tests/chrome harness was not used.

The installed updater reports current 0.2.68, available 0.2.69, verified, with no error/rate limit and no installation in progress. The installed active-pointer SHA-256 remained `75aadec6f864358d63294b42b1c2ccf2bef49a744328bc29cd9d598652100460`. No installed activation, visible application restart or personal-profile mutation was performed.

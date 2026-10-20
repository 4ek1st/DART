# Cold startup follow-up to the additional defect audit

The eight application defects, regression coverage and hidden browser scenarios
are documented in [the 0.2.35 audit](audit-qa-0.2.35.md).

## Ninth confirmed defect

Four simultaneous first starts of the exact signed 0.2.35 executable, using
separate isolated profiles and an empty interface cache, produced one ready
server and three unhandled startup failures. The failures were sharing violations
while hashing extracted JavaScript and an access failure during atomic replacement.
Every instance used the same executable-hash cache without coordinating extraction.

Only the inactive 0.2.35 resource cache was temporarily isolated for this baseline
probe; its original 17 file hashes were restored afterward. The installed 0.2.29
receipt and personal profile were preserved. All owned probe processes exited.

## Fix and regression coverage

Extraction uses a named mutex keyed by the normalized full cache path, which
includes the per-user location and executable hash. Different cache paths remain
independent. Waiting is bounded, successful extraction releases the mutex, and a
terminated previous owner is handled as acquired ownership so repair can proceed.

The existing native fixture suite covers four-process cold extraction, exact
embedded resource bytes, damaged-file repair, released-lock reuse, independent
cache paths, equivalent case/trailing-separator paths, and abandoned-lock recovery.
It operates only in its own temporary directory. The guarded publisher runs this
fixture with the JavaScript, API, privacy and update integrity regression suites.

Exact packaged verification uses four hidden server-only starts before any other
probe warms the new executable's cache, followed by the copied-profile 1440p
browser scenarios described in the preceding audit. These checks do not establish
external-provider latency or native full-window input coverage. The quarantined
optional chrome harness is excluded. Activation is left to the user's updater.

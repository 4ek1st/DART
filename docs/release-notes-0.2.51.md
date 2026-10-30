## Rust visual grouping engine

- Added a bundled Rust/WebAssembly engine for visual candidate search in large
  grouping batches. The existing rules still decide which copies and versions
  belong together, preserving publication and creator boundaries.
- The interface, Following and recommendation workers load the engine without
  waiting for it. Small batches and unavailable or failed modules retain the
  JavaScript path. Guaranteed dense overflow is detected before Rust work starts.
- Added source/artifact verification and reproducible component builds. The
  installed application does not require Rust or any additional runtime.
- Retains the optimistic likes and saved-state improvements from 0.2.50. The
  local profile, saved works and settings do not require migration.

Large synthetic grouping batches improve in local measurements; this does not
establish a speedup for every profile or for network and rendering latency.

## Ratings, history and reliable saved actions

- Keep Sensitive and legacy Safe rating aliases in ordinary Following and
  recommendation results, consistently with catalog search and existing grouping.
- Keep a hidden source uploader hidden when their post is represented by an
  exact copy from another catalog. Source-specific uploader identities stay scoped.
- Record a background artwork as viewed/recent when closing the active tab makes
  it visible. Preserve its scroll position and normal activation behavior.
- Correct Back/Forward after closing tabs and reusing an artwork preview tab.
  Distinct artwork snapshots remain accessible; duplicate-only history disables
  unavailable navigation controls.
- Cancel stalled image decoding as well as network reads during artwork
  preparation. Late errors from an old hover preview cannot stop the current one.
- Share pending like/bookmark actions across confirmed copies and saved variants.
  Saved indicators and removals recognize existing catalog aliases, including
  overlapping legacy groups, without affecting the other saved collection.
- Save complete metadata-rich sessions up to 16 MiB. The limit is enforced on
  actual request bytes, including chunked uploads; invalid or oversized requests
  retain the previously saved state without truncating tabs or group metadata.

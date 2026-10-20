## Reliable startup and additional defect fixes

- Coordinate embedded interface extraction when multiple instances first start
  together. A terminated extractor no longer prevents the next instance from
  repairing or completing its own interface cache.
- Keep Sensitive and legacy Safe ratings in ordinary Following and
  recommendations, and honor hidden source uploaders through grouped copies.
- Correct history and viewed/recent tracking when closing tabs or reusing an
  artwork preview tab; retain each distinct artwork and its scroll position.
- Cancel stalled image decoding and ignore late failures from old video previews.
- Share pending likes and bookmarks across confirmed copies and saved variants.
  Existing catalog aliases can be removed without creating a duplicate save.
- Save complete metadata-rich sessions up to 16 MiB, with byte-accurate limits
  and preservation of the previous state when a request is invalid or too large.

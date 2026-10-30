## Faster likes and bookmarks

- Hearts respond immediately while the change is saved. A failed write restores
  the previous state, and controls for copies of the same work remain synchronized.
- Ordinary saves use a compact acknowledgement instead of rereading and merging
  the entire library. Changes from another window still trigger reconciliation.
- Cache validated saved data under the existing file lock, detect external file
  changes, and retain atomic writes, backup recovery and unknown saved fields.
- Save Sankaku works before waiting for remote metadata. Subsequent enrichment
  retains learned categories and identities without restoring removed likes.
- Keep recommendation cards in place and refresh only the loading tail when a
  like interrupts pagination, so automatic loading can continue.

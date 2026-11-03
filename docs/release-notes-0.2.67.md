# Space preview and browsing efficiency

- Space now follows the actual mouse position across the preview and underlying page. It can reopen the artwork under a stationary cursor after the previous card disappears or is replaced, and it selects the correct card after moving the mouse while a preview is open. Tab still selects by keyboard focus; blank areas do not activate an old card or Home/Back. Native video, editable controls and held-key protections remain available.
- Already loaded Likes and Bookmarks render their completed lists once instead of twice. Cold loading and error/retry states keep their existing behavior and saved order.
- Cold content filtering prepares duplicate tag strings once, reducing repeated work without changing filtering results or cache invalidation.
- Saved-artwork metadata refreshes no longer clone the entire library for unsaved works or unchanged details. Existing idempotent likes also avoid an unnecessary library copy. Real changes retain the existing locking, revision, atomic-write, backup and rollback rules.

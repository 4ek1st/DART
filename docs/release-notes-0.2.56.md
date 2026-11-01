# Recent likes and saved Sankaku previews

- Liked, Bookmarks and Recently opened retain their saved action order even when global curation is enabled. New local likes remain first; discovery ranking and content filtering keep their existing behavior. Opening a saved gallery uses that same order in both directions.
- Saved Sankaku posts with legacy numeric IDs can recover media through a bounded exact-MD5 lookup. The response must match the saved member's own hash. Empty, mismatched and ambiguous results are rejected. Existing saved identities, attribution, order and collection membership are preserved.
- Grouped cards use an available, non-expired mirror preview when the preferred source has no usable thumbnail. Refreshing media no longer drops that preview during regrouping or repeatedly rerenders a cached recovery result. Raw members retain their own attribution and media.
- Recovery still runs only for visible saved cards with bounded concurrency and retries. A response for an unrelated artwork cannot count as successful recovery.

Install through the existing signed updater. This release does not require importing the profile again or changing content preferences.

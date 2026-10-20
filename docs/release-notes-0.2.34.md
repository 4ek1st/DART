## Smoother artwork browsing and reliable duplicate filtering

- Keep visible cards, decoded images and video preview frames when a feed
  crosses the virtual-grid threshold. Background updates retain image visibility
  subscriptions instead of resetting every thumbnail.
- Prepare and decode neighboring artwork before replacing the current viewer.
  Known neighbors start warming immediately, alongside pagination. Short image
  transitions respect reduced-motion preferences; cached returns stay immediate.
- Correct rapid queued arrow navigation across filtered pages, reversing queued
  moves and reaching the end of a feed. Closing a preparing preview restores
  the position of the artwork still shown underneath.
- Protect prepared media from cache eviction until the viewer can use it.
- Recognize the same complete media file across Danbooru, Gelbooru, Rule34 and
  Sankaku even when a catalog omits its MD5. Compact file identities also prevent
  later copies of viewed or saved works returning when hiding is enabled.
- Preserve verified file evidence when partial metadata arrives, while allowing
  an explicitly replaced file to leave its former group. Existing viewport holds
  preserve their original slots without making room for later copies.
- Reuse artwork identity calculations when scanning large saved collections,
  while detecting in-place metadata changes.
- Coalesce repeated Following publications and identical preview-cache writes.
  Updated filters, source notices, retry readiness and failed-write retries
  continue to apply without an unnecessary duplicate final refresh.

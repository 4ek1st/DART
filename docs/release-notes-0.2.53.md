## Responsive feeds and video startup

- Publish ready recommendation results independently of slow sources. Retain
  the existing card prefix and commit only completed source pages. A failure or
  cancellation keeps uncommitted pages available for retry; supplementary
  background sampling no longer holds the first usable cards.
- Track actually visible recommendation cards, including deep scrolling and
  virtualized rows. Keep bounded history per artwork with its catalog aliases,
  preserving legacy history and keeping suggested works separate from viewed ones.
- Start selected videos without waiting up to 4.5 seconds for a poster to load
  and decode, including videos in mixed galleries during Space navigation.
- Share a bounded transport budget between catalog responses and image bodies,
  leaving a browser connection available for native video playback. Preserve
  foreground priority, adoption of preloaded work, cancellation and cache reuse.

No new recommendation controls or explanations were added. Personal ranking
weights, grouping rules, likes, bookmarks, subscriptions and profile formats
remain compatible. Install through the normal update control.

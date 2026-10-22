## Stable recommendations and faster artwork navigation

- Keep newly discovered file hashes, catalog copies and gallery pages when
  recommendations load more results. Existing cards keep their positions.
- Recognize strongly confirmed X/Pixiv repost variants while protecting distinct
  publications, artists and characters from accidental grouping.
- Continue searching automatically when the first recommendation sample contains
  only already viewed works.
- Reduce repeated tag normalization, library scans and worker transfers. Personal
  tag priorities and ranking rules are preserved.
- Prepare known neighboring images while their details load. Current artwork
  loading receives priority over speculative background downloads.
- Share one decoded image between the feed and Space preview; cancel obsolete
  preview readers without interrupting another active consumer.

## Smoother Following and artwork interaction

- Reuse unchanged Following works when other subscriptions update. Avoid repeated
  metadata processing and preserve ready images, card positions and learned copies.
- Speed up curation without changing scores or the selected quality factors.
- Prioritize the artwork being opened over background metadata preloads, including
  when Following is still fetching other authors.
- Prioritize full-size detail images over ordinary background media requests.

## Tag search reliability

- Fixed Gelbooru searches for tag aliases: works using the catalog's confirmed
  replacement tag now remain in the results, and subsequent pages keep loading.
  Unknown tags still cannot admit unrelated posts.
- Alias checks run only when literal tag verification fails, use the catalog's
  public alias records, and cache confirmed results without changing the query
  typed by the user.
- Fixed tag suggestions failing to appear when there is no matching recent
  search or favorite tag. Late responses cannot reopen a dismissed search menu.
- Simplified the suggestion heading and clarified that catalog tag counts are
  measured before access restrictions, rating, grouping and personal filters.

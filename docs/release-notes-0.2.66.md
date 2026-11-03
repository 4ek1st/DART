# Recommendations after hiding an author

- Hiding an author now starts the active recommendation feed again without reloading the page. Cancelling an in-flight generation clears its loading state, and stale results cannot restore the hidden author. Inactive recommendation tabs restart when reopened.
- Restoring an author and changing content filters use the same active-feed recovery. Failed preference saves keep the existing feed and preferences intact.
- Automatic pagination now counts works eligible for display. Pages containing only pending-viewed, saved or manually hidden works correctly count toward the existing empty-round pause instead of causing unnecessary requests. Cards already retained in the current visit keep their positions.

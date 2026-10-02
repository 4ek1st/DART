# DART 0.2.21

## Faster return to your pages

- Following keeps its loaded feed and scroll position. Leaving and returning no longer cancels and restarts every subscription check, or automatically refreshes a minute-old feed. Refresh remains available explicitly.
- Search, profiles and recommendations resume from the existing buffer. Returning to a populated page does not request another page until scrolling continues; short pages still fill the viewport automatically.
- Liking an artwork preserves the current recommendation order, visit and consumed query pages. Updated tastes apply to subsequent suggestions.
- Liked and Bookmarks reuse their loaded collections. Opening saved artwork enriches the existing metadata without downloading both collections again. Actual like/bookmark changes still synchronize with the saved collection.
- Duplicate checks and visible thumbnails share downloaded image bytes. Identical catalog requests from different pages share pending work and a short bounded cache. Cancelling one consumer does not break another; failures remain retryable, and explicit refresh and connection changes invalidate catalog responses.
- Clicking an already selected content rating keeps the current page instead of repeating its search.

Also includes recurring tag-combination learning from the preceding source revision. Likes, bookmarks, follows, filters, connections and personal data remain in your existing profile.

Validated with automated regression checks, hidden browser navigation at 2560 x 1440 and 1100 x 720, and an isolated copy of a personal profile. External source and network response times still affect the first uncached load.

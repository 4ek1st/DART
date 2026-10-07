# DART 0.2.22

## Browse artworks with the keyboard

- Left and Right open the previous and next work in the list you came from: Home, illustrations and search, Recommendations, Following, Liked, Bookmarks, recently opened works, artist profiles, related works and the artist's other works.
- F likes or unlikes the current artwork. The physical key also works with Russian or German keyboard layouts. Text fields, open menus and focused video controls retain their own keyboard behavior.
- Quick and full-screen image previews use the same route. Browsing stays in the current artwork tab, including pinned tabs; each viewer keeps its own position. The requested keyboard hint panel is omitted.
- Neighboring artwork details and images are prepared in both directions through the existing bounded caches. Near the end, the next page is prepared early; pressing Right shares that request rather than starting another one.
- Left continues to work after liking a work, hiding viewed works or closing the original feed tab. Forward paging can continue from a retained feed cursor even after the source tab closes.
- A slow or temporarily failed next-page request leaves the current artwork visible. The next Right press can retry. Rapid key presses and late responses cannot switch artwork after leaving the viewer.
- Confirmed catalog copies and grouped variants occupy one navigation step. Late metadata can join previously unidentified copies. Incremental grouping updates affected works using the existing grouping rules instead of reprocessing the entire saved collection for every metadata response.

Verified with automated regression checks, hidden Edge browser checks at 2560 x 1440 and 1100 x 720, and an isolated copy of a personal profile. External catalog and network response times still affect uncached pages and media. This release is prepared for installation through DART's update button; the running application and original profile were not replaced during testing.

# DART 0.2.23

## Double-click to like

- Two quick left clicks on an artwork image add it to Liked. This works in Home, illustrations and search, Recommendations, Following, artist profiles, Liked, Bookmarks, recently opened works, related works and the artist's other works, including video thumbnails.
- Artwork pages, every image in a grouped work, and quick or full-screen image previews use the same gesture. Liking one version saves the whole grouped artwork.
- Double-clicking an already liked work keeps its like. Repeated clicks and concurrent windows cannot turn an image like into an unlike. Existing library metadata and order remain intact.
- A single mouse click on an artwork thumbnail or detail image waits briefly for the second click, then opens the artwork or full-screen preview. Title clicks, keyboard activation, Ctrl clicks and middle clicks retain their existing opening behavior.
- Hearts and F continue to like or unlike. Arrow navigation is unchanged. Preview zoom remains available with the wheel and zoom buttons; double-clicking the preview now likes the work.
- Dragging or panning images does not like them. Leaving the tab, scrolling, using another control or closing the preview cancels pending image opening. A failed save leaves the image visible and permits another double-click to retry.

Verified with automated gesture, persistence, concurrent-store and regression checks, plus hidden Edge checks at 2560 x 1440 and 1100 x 720. The running application and original profile were not replaced. Install this release through DART's update button.

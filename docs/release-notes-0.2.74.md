# Resilient feeds and continuous Space browsing

- Available catalogs keep loading independently when another website is slow or unavailable. Search, Following, Recommendations and Related works publish usable results without waiting for every source.
- Danbooru requests share bounded queues, identical-request reuse and a recovery pause that respects the website's Retry-After response. API response bodies and supplementary attribution work have bounded waits.
- The four source indicators turn gray after confirmed website errors and explain the problem on hover or keyboard focus. Successful website responses restore the source color; network failures and access settings are handled separately.
- Space browsing can request successive feed pages while an earlier source is still pending. Hidden results and duplicates do not require closing the viewer and scrolling the grid to continue.
- Closing Space preview returns to the last displayed artwork and briefly outlines its card in blue, including in long virtualized grids.
- Grouped works show their next image below the preview. Scroll or use W/S and Up/Down to move through the work's images; A/D and Left/Right continue to move between works. The current image stays visible while the next page loads, with a retry available if it fails.
- Content filters, grouped identities, viewed and saved exclusions, current-feed card retention and personal data are preserved during source failures and recovery.

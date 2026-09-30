# DART 0.2.18

- Added an independent **Hide furry content** switch in **Settings → Content**, with English, Russian and German labels. It is off by default and stays saved across restarts.
- The filter applies to all four catalogs and to search, Home, Following, artist profiles, recommendations, related works, Liked, Bookmarks, history and open artwork pages.
- Recognizes explicit furry and anthro tags, including Sankaku's alternate relationship and character-type tags. Tags from every merged copy or version are checked.
- Likes, bookmarks and subscriptions are preserved. Turning off the switch restores works permitted by other filters; manually excluded tags remain independent.
- Ordinary animal ears, tails, fur clothing and unrelated artist names do not trigger the filter. Works without explicit furry tags are not automatically classified.
- Older preferences forms cannot reset the new switch. Failed saves restore the previous state, and controls are disabled while a save is pending.
- Negative search tags such as `-furry` remain usable when the filter is enabled.

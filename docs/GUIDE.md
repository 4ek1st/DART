# DART user guide

[← Back to the main page](../README.md)

## Install and launch

Download `DART.Windows.exe` from the [latest release](https://github.com/4ek1st/DART/releases/latest)
and run it. The EXE includes the app and .NET; you also need the
[Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2).

If DART is installed, use its Desktop or Start menu shortcut. The shortcut
launches the active release with your existing profile.

## Connect sources

Open the app's source settings.

| Source | What you need |
| --- | --- |
| Danbooru | No key is needed for basic search. |
| Gelbooru | Your `User ID` and `API key`. |
| Rule34 | Your `User ID` and `API key`. |
| Sankaku | Sign in with your username or email and password for features that require an account. |

API keys and tokens are stored in your Windows profile using encryption.
DART does not save your Sankaku password. Account and Plus restrictions
still apply; Sankaku two-factor sign-in is not supported yet.

## Search and browse

Enter one or more tags, then choose your sources and rating: general, NSFW,
or all images. Switch between new and popular posts. More results load as
you scroll.

Posts open in tabs. Confirmed character tags come first and appear in green;
`original` appears in purple. To search for a combination of tags, select
them with **Ctrl + click**, then press **Enter**.

Related variants and copies appear in one card when the source data confirms
a connection. A post's details can link to its entries on other sources.

Videos open in the built-in player with seeking, sound, and full-screen mode.
Format support depends on the codecs available to WebView2.

Hover over a video thumbnail to cycle through five still frames from across
the clip. Moving the pointer away restores its normal thumbnail. Preview frames
are prepared after a short hover delay and reused from a bounded memory cache;
the card does not play the video or its audio. Keyboard focus works too.
Windows' reduced-motion preference keeps thumbnails still. If a source is slow
or cannot provide a bounded preview, its normal thumbnail stays visible.

## Likes and recommendations

Click the heart to like a post. Recommendations use the tags of your liked
posts, your selected sources, and your rating filter. The order changes when
you reopen or refresh the feed. Liked posts and known related copies are
excluded.

The bookmark icon inside an open work saves it to the separate **Bookmarks** page
for later. Thumbnails only show the heart button.
A work can be liked, bookmarked, or both. Bookmarks do not change recommendation
preferences. **Liked** contains your heart-marked works.

On the first launch after upgrading, existing bookmarks move to **Liked** and
the new **Bookmarks** collection starts empty. A verified copy of the original
file is kept in the profile's `migration-backups` folder. This migration runs once.
Identical files from several catalogs appear once inside a grouped work. Static
images are also compared after loading to recognize copies with different
compression. Source links and distinct pages or variants remain available;
animations are not compared using their first frame.

Right-click a tag to adjust it:

- **Yellow priority** — show this tag more often.
- **Red disabled tag** — exclude it from recommendations.

These preferences persist across restarts. **Other** contains content tags;
prioritized and disabled tags stay at the top of the list.

Character tags appear with a green outline. **Copyright** tags, such as the
franchise or series, appear separately in purple. Their original spelling is
kept when searching, including punctuation. Yellow and red choices override
these category colors and remain available even if no current likes match.

Recommendations use the full available tag list. Repeated likes from one
artist contribute less than the same interest across several artists. A tag
appearing in just two liked works does not start its own search in a large
collection; you can still give it an explicit yellow priority.

For larger collections, DART compares recurring tags with a small recent,
unpersonalized sample from the selected catalogs. Common tags carry less
weight when they are also common in that sample. This is a local estimate,
not a measurement of the entire catalog. If the sample is unavailable,
recommendations continue using the likes and your explicit choices.

DART also learns recurring pairs, such as a character with an outfit or two
content tags. A pair needs several distinct liked works and evidence beyond
the frequency of each tag alone. Mirrored copies count once; repeated work
from one known artist cannot establish a pair by itself.

The feed periodically searches for both tags together, while keeping searches
for individual interests. Pair matches add a small ranking bonus of at most
5%, and yellow priorities and red exclusions still apply. Common descriptive
tags and resolution labels do not establish pairs automatically. If there is
too little evidence, recommendations continue using individual tags.

Refresh rotates through the eligible interests and favors similarly relevant
works that have not been suggested recently. This short suggestion history
persists across restarts and does not mark works as viewed or permanently
hide them. Loading more appends cards without changing the existing order.

## Following artists

Open an artist profile or a post and select **Follow**. Following a confirmed
artist tag brings together available work from supported sources. Following
an uploader is separate.

New posts in the Following tab are marked **New**. DART checks on the first
opening of the tab or when you select **Refresh**. Returning to an existing
tab keeps its loaded feed and scroll position. A pending initial check can
finish while you browse elsewhere; there are no background system notifications.
You can expand the artist list with **Manage subscriptions**, and more posts
load as you scroll.

Search, artist profiles and recommendations also retain their loaded pages
when you return. Scrolling resumes the next-page lookahead; returning to a
page that already has enough content does not start it again. Liking a work
keeps the current recommendation visit and updates subsequent suggestions.

## Content filters

In **Settings → Content**, enable **Hide furry content** to hide tagged furry
works across Danbooru, Gelbooru, Rule34 and Sankaku. The filter applies to search,
the home feed, recommendations, Following, artist profiles, related works,
Liked, Bookmarks, browsing history and open artwork pages.

It recognizes explicit tags such as `furry`, `anthro`, `anthropomorphic`,
`furry_female` and Sankaku's `muscular_anthro` and `female_anthro`.
Tags from every merged copy or version are checked. Animal ears, tails or fur
clothing alone do not trigger the filter; untagged works cannot be identified.

The switch is off by default and persists in your profile. Turning it on does
not delete likes, bookmarks or subscriptions. Turning it off restores works
that are allowed by your other filters. Manually excluded tags and AI filters
continue to apply independently.

Manually excluding `furry`, `anthro` or `anthropomorphic` also covers their
explicit equivalents across sources. Animal ears, tails and artist names
alone do not trigger this exclusion.

## Updates and your data

An installed copy checks for updates on startup and every five minutes while
open. Returning to the app also checks if at least a minute has passed;
temporary network failures retry automatically.
When a verified new release is available, a blue arrow appears at the top left,
before the navigation arrows, on every page. Click it for the release notes
and the **Install and restart** action. Opening Settings is not required.

Updates verify the signature, SHA-256 hash, version, and release history.
If a download or verification fails, the active version remains available.
If you run the portable EXE directly, download newer versions from
[Releases](https://github.com/4ek1st/DART/releases).

An existing installation keeps your personal profile at
`Documents\ArtCatalog\Profile`. The folder name remains for compatibility.
It contains liked works, bookmarks, subscriptions, tabs, history, and settings.
Bookmarks retain post details; loading the image itself still requires
internet access to the source.

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| Ctrl + K | Focus search. |
| Ctrl + click tags, then Enter | Search for the selected tag combination. |
| Esc | Close search suggestions. |
| Arrow keys when the tab bar is focused | Switch tabs. |
| Delete when the tab bar is focused | Close the selected tab. |

If something goes wrong, [open an issue](https://github.com/4ek1st/DART/issues)
with your app version, the source name, and steps to reproduce it.
Do not attach passwords, API keys, or personal profile files.

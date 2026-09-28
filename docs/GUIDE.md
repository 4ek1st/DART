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

## Following artists

Open an artist profile or a post and select **Follow**. Following a confirmed
artist tag brings together available work from supported sources. Following
an uploader is separate.

New posts in the Following tab are marked **New**. DART checks when you open
the tab or select **Refresh**; there are no background system notifications.
You can expand the artist list with **Manage subscriptions**, and more posts
load as you scroll.

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

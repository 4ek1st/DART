# DART Android 0.1.15 candidate

- Artwork actions now run from left to right: Like, Bookmark, Download original, Open source.
- Removed the Original publication row from artwork attribution. Original links remain in the saved metadata. When Original link is explicitly selected as the attribution preference, Open source uses that link; otherwise it continues to open the catalog record.
- Reduced the inner padding of the two collection buttons to keep labels readable on compact screens with larger fonts. Their touch targets and persistence behavior are retained.

This candidate is staged locally. It has not been published to the Android update feed because the reported Play Protect block of 0.1.14 remains under investigation. No change to updater permissions, package identity, signing certificate, profile format, recommendation or provider behavior is included. A changed APK hash is not evidence that Google has cleared its classification. See play-protect-appeal-0.1.14.md for the prepared review request and limits of local verification.

# DART 0.2.20

- Recommendations now learn recurring tag pairs, including character + content and content + content, from distinct liked works. A pair must add evidence beyond the popularity of its individual tags.
- Added joint tag searches alongside individual interests. The existing limit of two candidate queries per loading round stays the same, and the chosen pairs spread across different interests.
- Pair matches refine ranking with a bonus capped at 5%. Yellow priorities, red exclusions, full tag metadata, source and rating filters remain effective.
- Mirrored copies, a single known creator, incidental matches, overlapping tag phrases and automatic resolution labels cannot inflate learned pair preferences. Almost predictable pairs carry less weight; common relationships in the recent catalog sample are also reduced.
- Fixed continued loading when joint searches are the only remaining recommendation streams. Appending preserves the order of existing cards, and refresh continues to rotate the feed.
- Preserves likes, bookmarks, subscriptions, settings and saved tag choices. Pair learning runs locally and falls back to individual interests when there is not enough evidence.

This is a conservative first version of combination learning. Checks on a held-out portion of one local collection are useful for regression testing, but do not establish a general improvement in recommendation accuracy.

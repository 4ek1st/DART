# DART 0.2.19

- Improved recommendations for large collections: full tags are considered, repeated versions from one artist provide less evidence, and a few incidental likes no longer start independent searches.
- Recurring interests are compared with a bounded recent catalog sample to reduce the influence of common tags. Slow or unavailable sample requests do not block the feed.
- Yellow priorities apply to the artwork's actual tags, regardless of which search found it. Red exclusions also check full tags and grouped copies. Existing choices remain available when their matching likes disappear.
- Added separate character and Copyright tags in recommendations, with green and purple outlines. Canonical search punctuation is preserved, including tags such as `goddess_of_victory:_nikke`.
- Refresh explores more of the eligible tag pool and favors relevant works that were not suggested recently. Suggestion history persists separately from viewed history, and loading more keeps the current card order.
- Fixed manual `furry`, `anthro` and `anthropomorphic` exclusions missing equivalent explicit tags on other catalogs. Ordinary animal ears, tails and artist names remain unaffected.
- Preserves the furry filter from 0.2.18, existing likes, bookmarks, subscriptions, settings and saved tag choices.

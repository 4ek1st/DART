# DART 0.2.53 verification

## Scope

This release fixes two recommendation-feed bookkeeping/loading issues and video
startup contention shared with Following. It adds no feedback/explanation controls
and does not change personal relevance weights, content queries, grouping rules,
source authentication, video Range handling or saved-work formats.

## Recommendation publication

The existing source API is requested per source. Settled responses are coalesced
and ranked through a serialized local publication chain. Existing cards stay in
their slots. Only a successfully published response advances its captured source
page; cancellation and credential changes leave uncommitted pages retryable.

Failures dominate later successes from other queries on the same source in that
round. Query-specific errors remain local, source retries keep their backoff, and
empty-source responses count as one empty round. A changed prefix, grouping
revision or curation state during a worker await causes a fresh rank against the
current state. Optional background calibration starts after usable cards and
does not gate them. Publication promises remain local rather than entering
serializable tab snapshots.

Neutral browser fixtures held sources and individual queries while ready cards
were displayed and opened. Releasing late results retained the prefix, focus and
decoded image node. Cancellation, 503/retry and source pages 0/1/2 were exercised
without repeating successful pages or skipping unresolved ones.

## Visible recommendation history

A viewport observer records actual visible materialized cards, including rows
beyond the former first-48 prefix. It requires 35% intersection with zero
lookahead margin, a visible document, an active matching feed generation and a
closed preview. The fallback checks only materialized cards.

History is bounded to 512 works with up to 32 validated catalog aliases per work.
An optional grouped field preserves the legacy flat history for compatible older
clients. Persistence is coalesced for 750 ms and flushed by state capture. This
does not mark a proposed work as opened, liked or viewed.

On a neutral 224-work fixture, only the four initially visible works out of 44
materialized cards were first recorded. Deep scrolling recorded visible tail
cards beyond 48, excluded unseen overscan and retained history across tab return.
Smooth scrolling can legitimately expose intermediate rows; the assertions
account for that history instead of equating final visibility with all exposure.

## Video startup

Selected videos bypass image/poster preparation, which previously could delay a
navigation by 4.5 seconds. Mixed galleries pass the actual selected preview file.
Photo navigation still waits for its prepared pixels to load and decode.

An owned hidden Edge HTTP/1.1 probe held six same-origin fetches. The video
request could reach the server only after a fetch released its connection. A
separate five-held-fetch control reached and played the neutral MP4 before any
release. The initial combined probe timed out setting up that control; the
control was rerun independently and passed.

The catalog/image transport now shares at most five active tasks: ordinary work
uses up to four and background work up to two, retaining foreground adoption and
one browser lane outside this budget. Slots remain occupied through JSON/blob
body reads. Cancellation propagates between cache and transport ownership;
warming promoted to foreground does not duplicate the load. The queue holds at
most 64 tasks and stores no additional response cache.

In the actual-app Following fixture, catalog and image caches had at least six
outstanding tasks. Four physical requests remained held, including a thumbnail
body already sending bytes. Opening Space started a held foreground viewed-state
write as the fifth application request. The native MP4 request then reached the
server and played decoded frames before any application hold was released.

An additional actual normal-click check opened the main artwork video under the
same congestion and also played before any release. It observed a duplicate
native poster request despite the decoded feed thumbnail; that existing raw
poster path is outside this budget and was not changed. It did not block the
small neutral local poster used in this check.

The fixture uses a generated 12,770-byte neutral MP4. Its subsecond first-frame
observations describe loopback behavior, not provider throughput or a promise
for every remote video. Other direct short/local fetches and native HTML posters
are outside the catalog/image budget. Separate bounded upstream HEAD checks
returned HTTP 200 video/mp4 and byte-range support for four source samples; no
video bodies, private URLs or content descriptions were recorded in this report.

## Boundaries

No installed application or personal profile is changed by these tests. Browser
fixtures have RAM-only data and owned hidden processes. The quarantined native
chrome harness is not built or used. Desktop packaging and native fixtures run
only through the guarded release publisher from a reviewed, committed source.

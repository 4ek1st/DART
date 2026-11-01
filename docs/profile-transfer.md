# Portable profiles between Windows and Android

Settings → Profile transfer exports and imports one UTF-8 JSON file. Import
first shows collection counts, then requires the user's Merge profile action.
It adds data to the current profile. Likes and Bookmarks remain independent.
The content-settings checkbox is off by default. New recommendation tag choices
are added; existing choices win unless the user opts into imported settings.

The common format is `dart-profile`, version `1`. A neutral example is
`tests/fixtures/profile-transfer-v1.json`.

Fields:

- `likes`, `bookmarks`, `history`: catalog-shaped artwork records (portable history is newest first), including
  `key`, source/id, attribution, member aliases and grouped media evidence.
- `viewedIdentities`: permanent viewed tokens, independently of the bounded
  recent-work display (40 entries on Windows).
- `follows`: explicit `role: artist|uploader`; artists use `source: artist`
  and a tag; uploader subscriptions use their actual catalog and account ID.
  Optional Gelbooru alias, follow date and per-rating seen keys are retained.
- `favoriteTags`, `recommendationTags` (`priority|disabled`). Recommendation
  preference keys use NFKC, lowercase, underscores/colons and whitespace
  normalized to spaces, matching the existing desktop model.
- `preferences`: content-only AI/furry/seen/followed filters, exclusions, hidden
  authors, attribution choice and curation factors. Import applies these only
  with the checkbox enabled; exclusion/hidden-author lists are additive.
- `recommendationExposureGroups`: bounded grouped catalog aliases already shown.

API credentials, account sessions, short-lived signed media URLs, device paths,
update settings, language, theme, screen-capture choice, tabs and search history
are excluded. The file itself contains private artwork history and preferences
and should be transferred privately. Missing signed Sankaku thumbnails recover
by post ID only when their saved cards become visible, with two concurrent
requests through the existing bounded detail-recovery path.

Desktop HTTP contract:

- `GET /api/profile-transfer/export`: JSON attachment.
- `POST /api/profile-transfer/preview`: raw document → per-collection counts.
- `POST /api/profile-transfer/import?applySettings=false`: raw document →
  `{added, skipped, settingsApplied, backupCreated, changed}`.

POST requests require the actual same-origin Origin header. Bodies and portable
documents are limited to 20 MiB, JSON depth32, total artwork records100000,
viewed identities200000, follows2000, favorite tags100, recommendation preferences
and excluded tags1000, hidden authors500, exposure groups512×32. Work groups have
at most100 members, one nested member level,100 images/records and1000 member
aliases. Unsupported newer schemas and malformed fields are rejected before
writes. Legacy Android v1/v2 exports and old bookmark arrays remain importable.

The saved library, follows, viewed tokens, favorites, recommendation choices,
content settings and session history are read and merged under their existing
file locks. The library is written once for the whole import. New exact aliases
are retained; matching MD5 media is not duplicated, while genuinely new variant
media is added to the existing group. An indexed union joins every matching
local group when an imported alias bridges them; unrelated local groups stay
unchanged. Existing metadata, unknown local fields,
collection order and device-specific settings are preserved.

Before a changed import, all affected primary and backup bytes are copied to a
verified local `transfer-backups` subdirectory inside the profile. Writes use
the existing atomic file replacement. A later failure restores earlier files
under the same locks and invalidates the library's cached snapshot. Repeated
imports with no new data do not rewrite files or create new backups.

Verification during implementation used only empty temporary profiles:

- 728 safe Node tests passed, including10 profile-transfer UI/controller and
  missing-thumbnail recovery cases. The three native API-spawning tests were
  excluded from that particular run.
- The new native fixture passed schema validation, independent collections,
  artist/uploader mapping, alias and exact-file deduplication, additive new
  variant media, transitive alias bridges, opt-in settings, unknown-field retention,75 history records
  beyond the display cap, repeated and empty no-op imports, secret stripping,
  verified backups and rollback after a later write fails.
- An own loopback server passed HTTP export/preview/import, five concurrent
  repeated imports, cross-origin403, unsupported version/invalid UTF-8400 and
  oversized-body413 checks. Its process and temporary profile were cleaned up.
- Seven actual rendered desktop scenarios passed in an own hidden Edge profile:
  file selection and preview, cancellation without writes, default additive
  import, repeated no-op import, export download with byte-identical HTTP
  response hash, exported-file reimport, and English/Russian/German controls
  including an820×900 window without horizontal overflow. No unhandled JavaScript
  exceptions occurred. The in-app browser selector timed out and its inventory
  exposed only the personal Opera browser, which was left untouched.
- A neutral export generated by the actual Android codec passed the desktop
  normalizer and live HTTP import/export/repeated-import checks.

No installed desktop release or personal profile was changed by these checks.
Debug compiler verification succeeded with the preexisting WindowsBase warning.
Release staging/publication and physical-phone behavior require their separate
verification steps.

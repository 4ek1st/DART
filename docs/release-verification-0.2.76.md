# DART 0.2.76 verification

Scope: shared artwork grouping/evidence, publication boundaries and removing individual recent searches. No personal profile migration, collection deletion, installed-file replacement or Android runtime change.

## Evidence and boundaries

Regional evidence is a bounded 308-character descriptor of distributed luminance structure and RGB. Flat backgrounds and smooth gradients do not establish a match. Changed small subjects on a repeated detailed background fail the new branch. The additional compact-batch path requires a confirmed creator, confirmed matching characters, uploader, proportional media and source/time/ID evidence. Existing JS/Rust candidate ordering and ordinary thresholds are unchanged. All different image/video URLs and source member identities remain in the grouped work.

DeviantArt identities normalize artwork/deviation URLs by numeric ID. Exact file evidence remains stronger than a misattributed source URL. Parent and scene inference use the common guarded union; metadata-poor mirrors cannot bridge conflicting known publications.

Video evidence comes from the existing five-frame hover extractor with its bounded transport, cancellation and cache. Duration, aspect, creator, tags and four corresponding frames are verified; shared-poster clips require either all five matches or diverse matching frame states. Legacy poster fingerprints are excluded from still-image candidates for video-containing records. Byte-band candidate indexing preserves the matching policy while reducing 1,000 unrelated same-creator/duration videos from 5,025,000 frame-hash reads to 33,000. The measured candidate stage fell from about 1,408 ms to 46.9 ms; full cold grouping remained about 167 ms and belongs in the existing worker.

Fingerprint persistence is client state only: at most 512 image entries, 64 video entries and 480,000 estimated bytes, canonical HTTPS keys, plain validated fields, no raw pixels/blobs or credentials. Sparse provider metadata and typed native storage preserve learned evidence. Known-work aliases are learned only from a complete registered confirmed group anchored in current exact known tokens; bounded to 128 components/4,096 tokens, invalidated with owner/library changes. Old token-only history and unregistered worker groups are deliberately not guessed from visual similarity.

## Verification

Red/green regressions cover DeviantArt normalization and deceptive hosts; scene/publication bridging; clothing/layout evidence; repeated detailed backgrounds with changed small subjects; five-frame/temporal video evidence, poster bypass and callback key/blob contracts; candidate cost; native storage restart/sparse refresh; bounded cache restore; exact known aliases and individual search deletion.

Private real-record checks confirmed both reported clothing pairs now form one work each and the shared DeviantArt publication forms one work. Four related-looking videos were decoded through the existing limited proxy: their frame composition/motion differs, including all cross-phase regional comparisons, so they remain separate. No full-video equivalence or semantic-perfect matching is claimed. A known crop/aspect variant remains unmatched. These raw records and media stay outside Git.

Hidden Edge at 2560x1440 passed the existing gallery suite (270 checks across routes, gallery pages, keyboard/pointer/media/error paths). Recent-search UI passed 49 checks across EN/RU/DE and desktop/mobile-width fixtures, including mouse, Enter/Space, reload persistence, focus and unchanged favorite tags. Full publisher checks run before sealing.

Neutral performance fixture: 2,440 liked records, more than 100,000 viewed identities and 16 mixed tabs, grouped pages and dense tags. In the final sequential before/after pair, warm viewer entry was 495/488 ms, bookmark completion 132/133 ms and like completion 474/500 ms. Steady page keys were approximately 2.5–5.8 ms. Cold entry varied materially (449/959 ms) and long main-thread tasks remained (137/241 ms maximum); this work does not claim to remove the pre-existing large-library cold/render delays. Regional fingerprints measured about 0.024 ms/image in hidden Edge; no raw history iteration was added to membership checks. The existing cold known-library index remains about 125 ms; warm alias membership in its separate large fixture had p95 10.22 ms for learning/check batches.

Android offline reference regeneration changes only the frozen desktop provenance SHA, with every scenario payload unchanged. Fresh compilation of the actual Java logic and the offline JVM suite passed 4/4; desktop reference cases passed 25/25. No APK/runtime edits or release.

Native GUI harness tests/chrome remain excluded per repository instructions; browser proof and native non-GUI fixtures are distinct coverage. The installed application is left running for user-controlled updating.

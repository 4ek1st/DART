# DART visual candidate kernel

This isolated, dependency-free Rust 1.86 crate accelerates only the visual
candidate-search pass. It does not evaluate visual compatibility, join groups,
read files, use the network, alter profiles, or publish anything. JavaScript
continues to own those rules and decisions.

The algorithm follows the candidate-search reference in the repository's
`wwwroot/catalog-logic.js`. Each owner has its own BK-tree over 64-bit hashes.
Each row queries its owner's existing tree at Hamming radius 12, then inserts.
Node entries are emitted in insertion order, followed by children in insertion
order with depth-first preorder traversal. The explicit DFS stack avoids Rust
call-stack recursion. Inserting the same hash and dedupe identity retains the
first row; duplicate current rows still run their query.

## Input and output

Input is a contiguous sequence of four `u32` words per sample:

| Word | Meaning |
| --- | --- |
| 0 | Low 32 bits of the hash |
| 1 | High 32 bits of the hash |
| 2 | Owner ID, from 0 through 65,535 |
| 3 | Dedupe ID encoding `(workIndex, tags.join(' '))` without collisions |

Owner IDs and dedupe IDs are local to one invocation. Dedupe IDs are compared
only at the same hash node. Rows must preserve the original `works` / `samples`
iteration order. Several sample rows may map to the same work index.

Output is a contiguous sequence of triples:
`[queryRow, previousRow, distance]`. These are sample row indices, not work
indices. The caller resolves the rows to original samples and applies all
existing compatibility and merge rules in the returned order.

## WASM ABI version 1

| Export | Result |
| --- | --- |
| `version() -> u32` | `1` |
| `alloc_words(len: u32) -> u32` | Pointer to a zeroed boxed word slice; null on rejected request or allocation failure |
| `free_words(ptr: u32, len: u32)` | Releases an owned allocation with its exact original word length |
| `find_pairs(inputPtr: u32, rowCount: u32) -> u64` | Packed result: high 32 bits are output word count, low 32 bits are output pointer |

`find_pairs` returns zero when the caller should use its unchanged JavaScript
fallback. It never exposes partial output. Success with no matches is nonzero
with output length zero; its non-null empty-slice pointer must still be freed
with length zero. The output word count is always divisible by three.

The caller owns the input allocation throughout the call and frees it once.
On success, output ownership transfers to the caller, which must copy/read the
output and free it once with its returned length. Recreate typed memory views
after allocating or searching because Rust allocation may grow WASM memory.

The unsafe ABI wrappers check counts, alignment, integer overflow and WASM
linear-memory bounds before raw slice construction. Ownership remains a caller
obligation: do not free foreign/interior pointers, use a mismatched allocation
length, or free twice. Native 64-bit callers should use the safe
`compute(&[u32]) -> Result<Vec<u32>, SearchError>` function; the packed-pointer
ABI is intended for wasm32.

## Defensive limits

| Limit | Value |
| --- | --- |
| Input sample rows | 65,536 |
| Owner IDs | `< 65,536` |
| Candidate matches | 262,144 |
| Allocated/output words | 786,432 |
| Total visited nodes per invocation | 8,000,000 |
| WASM linear memory maximum | 128 MiB |

The visit count includes both query and insertion traversal. Malformed input,
out-of-range owners, exhausted match/visit budgets, and allocation failures
become fallback results. All temporary trees and partial output are dropped on
error. Fallible reservation precedes vector growth. The linker memory maximum
is set by `.cargo/config.toml`; traps must also trigger fallback in the host.

## Build and verify

Normal application releases use the checked-in asset and require only Node:

```powershell
node scripts/verify-visual-search.cjs
node --test tests/visual-search-assets.test.cjs
```

After changing this component or its JavaScript wrapper, explicitly rebuild
from the repository root with the existing Rust 1.86.0 toolchain and installed
`wasm32-unknown-unknown` target:

```powershell
pwsh -NoProfile -File scripts/Build-VisualSearch.ps1
pwsh -NoProfile -File scripts/Build-VisualSearch.ps1 -VerifyOnly
```

The script copies only this component to a fresh temporary build directory,
runs its offline/locked Rust tests and release WASM build, checks the real
wrapper ABI, and updates only `wwwroot/rust/visual-search.wasm` and its adjacent
manifest. `-VerifyOnly` performs the rebuild and compares bytes without writing
either shipped file. Both modes leave existing `target` directories untouched;
neither installs or updates Rust. The manifest records relative source paths,
SHA-256 hashes, the wrapper hash, the fixed compiler/Cargo versions, ABI 1, and
the declared 128 MiB WASM maximum. It contains no timestamps or local paths.

Optional component-development checks (these require Rust and PowerShell) are:

```powershell
node --test scripts/check-visual-search-build.cjs
```

For direct crate development, run these commands with this crate as the
current working directory, so Cargo loads its local WASM memory configuration:

```powershell
cargo test --offline --locked
cargo clippy --offline --locked --all-targets -- -D warnings
cargo fmt --check
cargo build --offline --locked --release --target wasm32-unknown-unknown
```

There are no third-party Cargo dependencies. The crate produces
`target/wasm32-unknown-unknown/release/dart_visual_core.wasm`; the safe `rlib`
supports native kernel tests. A manifest verifies component consistency, not
authorship or cryptographic trust: changing source, artifact, and manifest
together still requires review and the application's normal release signing.

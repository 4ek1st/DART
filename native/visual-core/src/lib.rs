//! Dependency-free, deterministic BK-tree candidate search for DART's visual
//! grouping pass. Compatibility rules and group merging remain with the caller.
//!
//! Each input row is `[hashLo, hashHi, ownerId, dedupeId]`. Output triples are
//! `[queryRow, previousRow, hammingDistance]`, in the original JavaScript DFS
//! order. Dedupe identity is scoped to a hash node; callers encode the original
//! `(workIndex, tags.join(' '))` identity without collisions.

use std::mem::{align_of, size_of};
use std::ptr;

pub const MAX_ROWS: usize = 65_536;
pub const MAX_OWNERS: usize = 65_536;
pub const MAX_MATCHES: usize = 262_144;
pub const MAX_OUTPUT_WORDS: usize = MAX_MATCHES * 3;
pub const MAX_NODE_VISITS: usize = 8_000_000;
const RADIUS: u32 = 12;
const NO_NODE: u32 = u32::MAX;

#[derive(Debug, PartialEq, Eq)]
pub enum SearchError {
    InvalidWordCount,
    TooManyRows,
    InvalidOwner,
    TooManyMatches,
    TooManyVisits,
    AllocationFailed,
}

/// Returns all candidate triples, or an error with no partial output.
/// This is the safe, native-testable implementation of the WASM ABI.
pub fn compute(words: &[u32]) -> Result<Vec<u32>, SearchError> {
    compute_limited(words, MAX_MATCHES, MAX_NODE_VISITS)
}

struct Entry {
    row: u32,
    dedupe_id: u32,
}

struct Child {
    edge: u32,
    node: u32,
}

struct Node {
    hash: u64,
    entries: Vec<Entry>,
    children: Vec<Child>,
}

impl Node {
    fn new(hash: u64, row: u32, dedupe_id: u32) -> Result<Self, SearchError> {
        let mut entries = Vec::new();
        entries
            .try_reserve_exact(1)
            .map_err(|_| SearchError::AllocationFailed)?;
        entries.push(Entry { row, dedupe_id });
        Ok(Self {
            hash,
            entries,
            children: Vec::new(),
        })
    }
}

fn visit(visits: &mut usize, max_visits: usize) -> Result<(), SearchError> {
    if *visits >= max_visits {
        return Err(SearchError::TooManyVisits);
    }
    *visits += 1;
    Ok(())
}

fn compute_limited(
    words: &[u32],
    max_matches: usize,
    max_visits: usize,
) -> Result<Vec<u32>, SearchError> {
    if words.len() % 4 != 0 {
        return Err(SearchError::InvalidWordCount);
    }
    let row_count = words.len() / 4;
    if row_count > MAX_ROWS {
        return Err(SearchError::TooManyRows);
    }
    // Validate every descriptor before allocating trees or emitting candidates.
    if words
        .chunks_exact(4)
        .any(|row| row[2] as usize >= MAX_OWNERS)
    {
        return Err(SearchError::InvalidOwner);
    }
    if row_count == 0 {
        return Ok(Vec::new());
    }

    let mut roots = Vec::new();
    roots
        .try_reserve_exact(MAX_OWNERS)
        .map_err(|_| SearchError::AllocationFailed)?;
    roots.resize(MAX_OWNERS, NO_NODE);
    let mut nodes = Vec::new();
    nodes
        .try_reserve_exact(row_count)
        .map_err(|_| SearchError::AllocationFailed)?;
    let mut stack = Vec::new();
    stack
        .try_reserve_exact(row_count)
        .map_err(|_| SearchError::AllocationFailed)?;
    let mut output = Vec::new();
    let initial_output_words = row_count
        .saturating_mul(6)
        .min(max_matches.saturating_mul(3));
    output
        .try_reserve_exact(initial_output_words)
        .map_err(|_| SearchError::AllocationFailed)?;
    let mut visits = 0;

    for (row_index, row) in words.chunks_exact(4).enumerate() {
        let hash = u64::from(row[0]) | (u64::from(row[1]) << 32);
        let owner = row[2] as usize;
        let dedupe_id = row[3];
        let row_index = row_index as u32;
        let root = roots[owner];
        if root == NO_NODE {
            roots[owner] = nodes.len() as u32;
            nodes.push(Node::new(hash, row_index, dedupe_id)?);
            continue;
        }

        // Query before insertion, including when this row will be deduplicated.
        // Reverse pushes preserve the JavaScript Map's insertion-order preorder.
        stack.push(root);
        while let Some(node_index) = stack.pop() {
            visit(&mut visits, max_visits)?;
            let node = &nodes[node_index as usize];
            let distance = (hash ^ node.hash).count_ones();
            if distance <= RADIUS {
                for entry in &node.entries {
                    if output.len() / 3 >= max_matches {
                        return Err(SearchError::TooManyMatches);
                    }
                    output
                        .try_reserve(3)
                        .map_err(|_| SearchError::AllocationFailed)?;
                    output.extend_from_slice(&[row_index, entry.row, distance]);
                }
            }
            for child in node.children.iter().rev() {
                if child.edge.abs_diff(distance) <= RADIUS {
                    stack.push(child.node);
                }
            }
        }

        let mut node_index = root;
        loop {
            // Insertion traversal also consumes budget, bounding pathological
            // BK-tree shapes even when the query has no matching entries.
            visit(&mut visits, max_visits)?;
            let node = &mut nodes[node_index as usize];
            let distance = (hash ^ node.hash).count_ones();
            if distance == 0 {
                if !node
                    .entries
                    .iter()
                    .any(|entry| entry.dedupe_id == dedupe_id)
                {
                    node.entries
                        .try_reserve(1)
                        .map_err(|_| SearchError::AllocationFailed)?;
                    node.entries.push(Entry {
                        row: row_index,
                        dedupe_id,
                    });
                }
                break;
            }
            if let Some(child) = node.children.iter().find(|child| child.edge == distance) {
                node_index = child.node;
            } else {
                node.children
                    .try_reserve(1)
                    .map_err(|_| SearchError::AllocationFailed)?;
                let new_node = Node::new(hash, row_index, dedupe_id)?;
                let new_index = nodes.len() as u32;
                nodes[node_index as usize].children.push(Child {
                    edge: distance,
                    node: new_index,
                });
                nodes.push(new_node);
                break;
            }
        }
    }
    Ok(output)
}

/// ABI version. No WASM imports are needed by this module.
#[no_mangle]
pub extern "C" fn version() -> u32 {
    1
}

/// Allocates a zeroed boxed word slice. Zero words returns a non-null, aligned
/// empty-slice pointer; requests above the output-word cap return null.
#[no_mangle]
pub extern "C" fn alloc_words(len: u32) -> *mut u32 {
    if len as usize > MAX_OUTPUT_WORDS {
        return ptr::null_mut();
    }
    let mut words = Vec::new();
    if words.try_reserve_exact(len as usize).is_err() {
        return ptr::null_mut();
    }
    words.resize(len as usize, 0);
    Box::into_raw(words.into_boxed_slice()) as *mut u32
}

fn valid_range(ptr: *const u32, len: usize) -> bool {
    let address = ptr as usize;
    if address == 0 || address % align_of::<u32>() != 0 {
        return false;
    }
    let Some(bytes) = len.checked_mul(size_of::<u32>()) else {
        return false;
    };
    let Some(end) = address.checked_add(bytes) else {
        return false;
    };
    if bytes > isize::MAX as usize {
        return false;
    }
    #[cfg(target_arch = "wasm32")]
    {
        end <= core::arch::wasm32::memory_size::<0>() * 65_536
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        // Native callers retain the documented valid-allocation obligation.
        // Numerical checks cannot establish that an arbitrary native address is
        // readable or owned. The native API for untrusted data is `compute`.
        let _ = end;
        true
    }
}

/// Releases exactly one slice returned by `alloc_words` or `find_pairs`.
/// Null is a no-op. A zero-length non-null slice must also be released.
///
/// # Safety
/// `ptr` must be an outstanding allocation returned by this module, with the
/// exact original word length. Do not free borrowed input, interior pointers,
/// foreign allocations, or an allocation more than once. Basic descriptor and
/// WASM memory checks do not establish allocation ownership.
#[no_mangle]
pub unsafe extern "C" fn free_words(ptr: *mut u32, len: u32) {
    if len as usize > MAX_OUTPUT_WORDS || !valid_range(ptr, len as usize) {
        return;
    }
    // SAFETY: the caller transfers its original boxed-slice allocation back with
    // its original length; numerical checks above precede raw reconstruction.
    unsafe {
        drop(Box::from_raw(ptr::slice_from_raw_parts_mut(
            ptr,
            len as usize,
        )));
    }
}

/// Searches sequential rows. Success packs `(outputWordCount << 32) | ptr`;
/// zero signals fallback, never a partial result. A successful empty search is
/// nonzero with a zero output length. Output ownership transfers to the caller.
/// The packed-pointer ABI targets wasm32; use `compute` for native searches.
///
/// # Safety
/// For nonzero `row_count`, `input_ptr` must point to `row_count * 4` initialized
/// words in a live allocation, readable for the duration of this call. The
/// caller keeps input ownership and must not mutate it during the search.
#[no_mangle]
pub unsafe extern "C" fn find_pairs(input_ptr: *const u32, row_count: u32) -> u64 {
    if row_count as usize > MAX_ROWS {
        return 0;
    }
    let Some(word_count) = (row_count as usize).checked_mul(4) else {
        return 0;
    };
    let words = if word_count == 0 {
        &[]
    } else {
        if !valid_range(input_ptr, word_count) {
            return 0;
        }
        // SAFETY: row and byte bounds, alignment, null and WASM memory bounds
        // are checked first; the caller guarantees the live input allocation.
        unsafe { std::slice::from_raw_parts(input_ptr, word_count) }
    };
    let Ok(output) = compute(words) else {
        return 0;
    };
    let output = output.into_boxed_slice();
    let output_len = output.len() as u32;
    let output_address = output.as_ptr() as usize;
    if output_address > u32::MAX as usize {
        // Native 64-bit allocations cannot be represented in a wasm32 pointer.
        return 0;
    }
    let output_ptr = Box::into_raw(output) as *mut u32 as usize as u32;
    (u64::from(output_len) << 32) | u64::from(output_ptr)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn query_visit_budget_falls_back_before_returning_partial_pairs() {
        assert_eq!(
            compute_limited(&[0, 0, 0, 0, 1, 0, 0, 1], 10, 0),
            Err(SearchError::TooManyVisits)
        );
    }

    #[test]
    fn insertion_visits_also_count_against_the_work_budget() {
        assert_eq!(
            compute_limited(&[0, 0, 0, 0, 1, 0, 0, 1], 10, 1),
            Err(SearchError::TooManyVisits)
        );
    }

    #[test]
    fn an_exact_visit_budget_succeeds() {
        assert_eq!(
            compute_limited(&[0, 0, 0, 0, 1, 0, 0, 1], 10, 2),
            Ok(vec![1, 0, 1])
        );
    }
}

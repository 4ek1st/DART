use dart_visual_core::{alloc_words, compute, find_pairs, free_words, version, SearchError};
use std::collections::{BTreeSet, HashSet};

fn words(rows: &[(u64, u32, u32)]) -> Vec<u32> {
    rows.iter()
        .flat_map(|&(hash, owner, dedupe)| [hash as u32, (hash >> 32) as u32, owner, dedupe])
        .collect()
}

#[test]
fn empty_input_is_a_successful_empty_search() {
    assert_eq!(compute(&[]), Ok(vec![]));
}

#[test]
fn identical_hashes_are_isolated_by_owner() {
    let input = words(&[(0, 0, 1), (0, 1, 2), (0, 0, 3), (0, 1, 4)]);
    assert_eq!(compute(&input), Ok(vec![2, 0, 0, 3, 1, 0]));
}

#[test]
fn radius_twelve_is_included_and_thirteen_is_excluded() {
    let input = words(&[(0, 0, 0), (0xfff, 0, 1), (0x1fff, 0, 2)]);
    assert_eq!(compute(&input), Ok(vec![1, 0, 12, 2, 1, 1]));
}

#[test]
fn both_hash_words_participate_in_distance() {
    let input = words(&[(0, 0, 0), (0xfff << 32, 0, 1), (0x1fff << 32, 0, 2)]);
    assert_eq!(compute(&input), Ok(vec![1, 0, 12, 2, 1, 1]));
}

#[test]
fn duplicate_hash_entry_is_not_reinserted_but_its_query_is_emitted() {
    let input = words(&[(42, 0, 7), (42, 0, 7), (42, 0, 8), (42, 0, 8)]);
    assert_eq!(
        compute(&input),
        Ok(vec![1, 0, 0, 2, 0, 0, 3, 0, 0, 3, 2, 0])
    );
}

#[test]
fn different_tag_ids_for_the_same_work_remain_distinct_entries() {
    // The caller maps (workIndex, joinedTags) to dedupeId. Two tag identities
    // from the same work must remain two previous rows at a shared hash.
    let input = words(&[(42, 0, 100), (42, 0, 101), (42, 0, 102)]);
    assert_eq!(compute(&input), Ok(vec![1, 0, 0, 2, 0, 0, 2, 1, 0]));
}

#[test]
fn dedupe_id_is_scoped_to_one_hash_node() {
    let input = words(&[(0, 0, 7), (1, 0, 7), (0, 0, 8)]);
    assert_eq!(compute(&input), Ok(vec![1, 0, 1, 2, 0, 0, 2, 1, 1]));
}

#[test]
fn children_keep_insertion_order_and_subtrees_use_preorder() {
    // Root child distance 16 is inserted before distance 8. Row 3 then becomes
    // a child of row 1. The final query must visit root, row 1, row 3, row 2.
    let input = words(&[
        (0, 0, 0),
        (0xffff, 0, 1),
        (0xff, 0, 2),
        (0xff00ff, 0, 3),
        (0xfff, 0, 4),
    ]);
    assert_eq!(
        compute(&input),
        Ok(vec![
            2, 0, 8, 2, 1, 8, 3, 2, 8, 4, 0, 12, 4, 1, 4, 4, 3, 12, 4, 2, 4,
        ])
    );
}

#[test]
fn malformed_word_count_is_rejected() {
    for input in [vec![0], vec![0, 0], vec![0, 0, 0], vec![0; 5]] {
        assert_eq!(compute(&input), Err(SearchError::InvalidWordCount));
    }
}

#[test]
fn owner_limit_is_checked_before_traversal() {
    assert_eq!(compute(&words(&[(0, 65_535, 0)])), Ok(vec![]));
    assert_eq!(
        compute(&words(&[(0, 65_536, 0)])),
        Err(SearchError::InvalidOwner)
    );
}

#[test]
fn row_limit_accepts_65536_owner_isolated_rows_then_rejects_one_more() {
    let rows: Vec<_> = (0..65_536).map(|i| (u64::from(i), i, i)).collect();
    assert_eq!(compute(&words(&rows)), Ok(vec![]));
    assert_eq!(compute(&vec![0; 65_537 * 4]), Err(SearchError::TooManyRows));
}

#[test]
fn match_limit_returns_a_fallback_error_instead_of_partial_results() {
    let rows: Vec<_> = (0..725).map(|i| (0, 0, i)).collect();
    assert_eq!(compute(&words(&rows)), Err(SearchError::TooManyMatches));
}

#[test]
fn version_and_zeroed_allocations_follow_the_abi() {
    assert_eq!(version(), 1);
    let ptr = alloc_words(8);
    assert!(!ptr.is_null());
    unsafe {
        assert_eq!(std::slice::from_raw_parts(ptr, 8), &[0; 8]);
        *ptr.add(7) = 99;
        free_words(ptr, 8);
    }
    let empty = alloc_words(0);
    assert!(!empty.is_null());
    unsafe {
        free_words(empty, 0);
    }
}

#[test]
fn oversized_allocations_and_invalid_input_descriptors_fail_safely() {
    assert!(alloc_words(u32::MAX).is_null());
    assert!(alloc_words(786_433).is_null());
    unsafe {
        assert_eq!(find_pairs(std::ptr::null(), 1), 0);
        assert_eq!(find_pairs(std::ptr::null(), u32::MAX), 0);
        assert_eq!(find_pairs(1usize as *const u32, 1), 0);
        assert_eq!(find_pairs(usize::MAX as *const u32, 1), 0);
        free_words(std::ptr::null_mut(), 0);
        free_words(std::ptr::null_mut(), u32::MAX);
    }
}

#[test]
fn zero_rows_have_a_nonzero_success_descriptor() {
    let result = unsafe { find_pairs(std::ptr::null(), 0) };
    assert_ne!(result, 0);
    assert_eq!(result >> 32, 0);
    unsafe {
        free_words(result as u32 as usize as *mut u32, 0);
    }
}

fn brute_force(rows: &[(u64, u32, u32)]) -> BTreeSet<(u32, u32, u32)> {
    let mut seen = HashSet::new();
    let mut previous: Vec<(u32, u64, u32)> = Vec::new();
    let mut result = BTreeSet::new();
    for (query, &(hash, owner, dedupe)) in rows.iter().enumerate() {
        for &(previous_row, previous_hash, previous_owner) in &previous {
            if owner == previous_owner {
                let distance = (hash ^ previous_hash).count_ones();
                if distance <= 12 {
                    result.insert((query as u32, previous_row, distance));
                }
            }
        }
        if seen.insert((hash, owner, dedupe)) {
            previous.push((query as u32, hash, owner));
        }
    }
    result
}

#[test]
fn deterministic_random_results_equal_an_independent_brute_force_set() {
    let mut seed = 0xcafe_beef_1234_5678u64;
    for round in 0..24 {
        let mut rows = Vec::new();
        for row in 0..160 {
            seed ^= seed << 13;
            seed ^= seed >> 7;
            seed ^= seed << 17;
            let hash = match round % 3 {
                0 => seed,
                1 => seed & 0xffff,
                _ => (seed & 0xff) | ((seed & 0xff00) << 32),
            };
            let next = if row % 11 == 0 && !rows.is_empty() {
                rows[rows.len() - 1]
            } else {
                (hash, ((seed >> 20) % 4) as u32, (row % 31) as u32)
            };
            rows.push(next);
        }
        let actual = compute(&words(&rows)).unwrap();
        let actual_set: BTreeSet<_> = actual.chunks_exact(3).map(|x| (x[0], x[1], x[2])).collect();
        assert_eq!(
            actual.len() / 3,
            actual_set.len(),
            "duplicate pair in round {round}"
        );
        assert_eq!(actual_set, brute_force(&rows), "round {round}");
        assert_eq!(
            actual,
            compute(&words(&rows)).unwrap(),
            "nondeterministic round {round}"
        );
    }
}

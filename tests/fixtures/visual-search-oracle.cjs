'use strict';

// Deliberately independent of the WASM wrapper and the Rust implementation.
// This preserves the original catalog BK-tree traversal and insertion rules.
function visualDistance(first, second) {
  const countBits = value => {
    value -= (value >>> 1) & 0x55555555;
    value = (value & 0x33333333) + ((value >>> 2) & 0x33333333);
    return (((value + (value >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
  };
  return countBits(parseInt(first.slice(0, 8), 16) ^ parseInt(second.slice(0, 8), 16)) +
    countBits(parseInt(first.slice(8), 16) ^ parseInt(second.slice(8), 16));
}

function referenceFindMatches(samples) {
  const entries = [];
  const trees = new Map();
  const pairs = [];
  function search(node, sample, flat) {
    const distance = visualDistance(sample.hash, node.hash);
    if (distance <= 12) for (const previous of node.entries) pairs.push(flat, previous.flat, distance);
    for (const [edge, child] of node.children)
      if (edge >= distance - 12 && edge <= distance + 12) search(child, sample, flat);
  }
  function insert(node, entry) {
    for (;;) {
      const distance = visualDistance(entry.sample.hash, node.hash);
      if (distance === 0) {
        if (!node.entries.some(previous => previous.index === entry.index &&
          previous.sample.tags.join(' ') === entry.sample.tags.join(' '))) node.entries.push(entry);
        return;
      }
      if (!node.children.has(distance)) {
        node.children.set(distance, { hash: entry.sample.hash, entries: [entry], children: new Map() });
        return;
      }
      node = node.children.get(distance);
    }
  }
  samples.forEach((workSamples, index) => {
    for (const sample of workSamples) {
      const entry = { sample, index, flat: entries.length };
      entries.push({ sample, index });
      const root = trees.get(sample.owner);
      if (!root) trees.set(sample.owner, { hash: sample.hash, entries: [entry], children: new Map() });
      else {
        search(root, sample, entry.flat);
        insert(root, entry);
      }
    }
  });
  return { entries, pairs: Uint32Array.from(pairs) };
}

module.exports = { referenceFindMatches, visualDistance };

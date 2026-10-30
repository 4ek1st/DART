'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
function load() {
  const context = vm.createContext({ module: { exports: {} }, URL, URLSearchParams, TextEncoder });
  vm.runInContext(`globalThis.normalizations = 0;
    const normalize = String.prototype.normalize;
    String.prototype.normalize = function (...args) {
      globalThis.normalizations++; return normalize.apply(this, args);
    };`, context);
  vm.runInContext(fs.readFileSync(require.resolve('../wwwroot/catalog-logic.js'), 'utf8'), context);
  return { logic: context.module.exports, calls: () => context.normalizations };
}

test('repeated filter tags reuse pure normalization, including an empty result', () => {
  const { logic, calls } = load();
  const tags = [' Ｆｕｌｌ＿width ', '#Artist-name', ' #___- '];
  assert.deepEqual(Array.from(logic.normalizeExcludedTags(tags)), ['full width', 'artist name']);
  const initial = calls();
  assert.deepEqual(Array.from(logic.normalizeExcludedTags(tags)), ['full width', 'artist name']);
  assert.equal(calls(), initial, 'unchanged tags should not repeat Unicode normalization');
});

test('filter tag memoization is bounded and oversized input is not retained', () => {
  const { logic, calls } = load();
  const tags = Array.from({ length: 4097 }, (_, index) => `neutral_${index}`);
  logic.normalizeExcludedTags(tags);
  const initial = calls();
  logic.normalizeExcludedTags([tags.at(-1)]);
  assert.equal(calls(), initial, 'most recently stored tag remains available');
  logic.normalizeExcludedTags([tags[0]]);
  assert.equal(calls(), initial + 1, 'old tags are evicted at the fixed capacity');
  const long = 'x'.repeat(201);
  logic.normalizeExcludedTags([long]); logic.normalizeExcludedTags([long]);
  assert.equal(calls(), initial + 3, 'oversized keys must not consume cache memory');
});

test('filter tag cache preserves dynamic string conversion and normalization semantics', () => {
  const { logic } = load();
  let label = 'First_Tag';
  const dynamic = { toString() { return label; } };
  assert.deepEqual(Array.from(logic.normalizeExcludedTags([dynamic, 0, false, null])), ['first tag']);
  label = 'Second-Tag';
  assert.deepEqual(Array.from(logic.normalizeExcludedTags([dynamic])), ['second tag']);
  assert.deepEqual(Array.from(logic.normalizeExcludedTags(['A:B', 'a_b', '#A-B', 'a b'])), ['a:b', 'a b']);
});

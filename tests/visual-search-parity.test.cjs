const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createAccelerator } = require('../wwwroot/visual-search.js');
const { referenceFindMatches } = require('./fixtures/visual-search-oracle.cjs');
const { makeSampleFixture, makeWorkFixture } = require('./fixtures/visual-search-fixtures.cjs');
const wasm = new WebAssembly.Module(fs.readFileSync(path.join(__dirname, '../wwwroot/rust/visual-search.wasm')));
const source = fs.readFileSync(path.join(__dirname, '../wwwroot/catalog-logic.js'), 'utf8');
const accelerator = minimum => createAccelerator(new WebAssembly.Instance(wasm), { minSamples: minimum });
function catalog(engine) {
  const context = vm.createContext({ module: { exports: {} }, DartVisualSearch: engine,
    URL, URLSearchParams, TextEncoder, TextDecoder });
  new vm.Script(source).runInContext(context);
  return context.module.exports;
}

test('bundled Rust preserves exact ordered candidate triples against an independent JS oracle', () => {
  const engine = accelerator(1);
  assert.equal(engine.ready, true);
  for (let seed = 1; seed <= 30; seed++) {
    const samples = makeSampleFixture(35 + seed * 7, { seed, owners: 3 + seed % 11 });
    const expected = referenceFindMatches(samples), actual = engine.findMatches(samples);
    assert.ok(actual);
    assert.deepEqual(Array.from(actual.pairs), Array.from(expected.pairs), 'seed ' + seed);
    assert.deepEqual(actual.entries.map(entry => entry.index), expected.entries.map(entry => entry.index));
  }
  assert.equal(engine.stats.successes, 30);
});

test('Rust grouping preserves complete work fields, publications, variants, media and order', () => {
  const baseline = catalog(), engine = accelerator(1), rust = catalog(engine);
  for (const count of [32, 96, 600]) {
    const fixture = makeWorkFixture(count);
    const expected = baseline.groupWorks(structuredClone(fixture));
    const result = rust.groupWorks(structuredClone(fixture));
    assert.equal(JSON.stringify(result), JSON.stringify(expected), 'work count ' + count);
    assert.ok(result.length < count && result.length > count / 2,
      'Fixture must contain both mergeable versions and protected distinct publications');
  }
  assert.equal(engine.stats.successes, 3);
});

test('normal large grouping actually uses Rust at the production threshold', () => {
  const engine = accelerator(undefined), rust = catalog(engine), baseline = catalog();
  const fixture = makeWorkFixture(600);
  assert.equal(JSON.stringify(rust.groupWorks(structuredClone(fixture))),
    JSON.stringify(baseline.groupWorks(structuredClone(fixture))));
  assert.equal(engine.stats.calls, 1);
  assert.equal(engine.stats.successes, 1);
  assert.equal(engine.stats.fallbacks, 0);
});

test('guaranteed dense overflow skips Rust and later ordinary batches still succeed', () => {
  const engine = accelerator(1);
  assert.equal(engine.findMatches(makeSampleFixture(800, { dense: true })), null);
  assert.equal(engine.stats.calls, 0);
  assert.equal(engine.ready, true);
  const samples = makeSampleFixture(600);
  assert.deepEqual(Array.from(engine.findMatches(samples).pairs),
    Array.from(referenceFindMatches(samples).pairs));
  assert.equal(engine.stats.successes, 1);
});

test('an execution failure falls back before joining and preserves subsequent complete results', () => {
  const instance = new WebAssembly.Instance(wasm);
  let fail = false;
  const engine = createAccelerator({ ...instance.exports, find_pairs(...args) {
    if (fail) throw new Error('Controlled optional execution failure');
    return instance.exports.find_pairs(...args);
  } }, { minSamples: 1 });
  assert.equal(engine.ready, true);
  fail = true;
  const baseline = catalog(), rust = catalog(engine), fixture = makeWorkFixture(96);
  const expected = JSON.stringify(baseline.groupWorks(structuredClone(fixture)));
  assert.equal(JSON.stringify(rust.groupWorks(structuredClone(fixture))), expected);
  assert.equal(engine.ready, false);
  assert.equal(engine.stats.failed, 1);
  assert.equal(engine.stats.successes, 0);
  assert.equal(JSON.stringify(rust.groupWorks(structuredClone(fixture))), expected);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createAccelerator } = require('../wwwroot/visual-search.js');
const source = fs.readFileSync(path.join(__dirname, '../wwwroot/visual-search.js'), 'utf8');
const SELF_ROWS = [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 2, 0, 0, 0, 0];
const SELF_PAIRS = [1, 0, 1, 3, 0, 0, 3, 1, 1];
const sample = (hash = '0000000000000000', owner = 'creator:a', tags = ['one']) => ({ hash, owner, tags });
const fixture = () => [[sample()], [sample('0000000000000001')]];

// Fake only the numeric ABI, using a real, detachable WASM memory. No matching
// implementation lives in this double; candidate fixtures are hand derived.
function abi(options = {}) {
  const memory = new WebAssembly.Memory({ initial: 1 });
  let next = 16;
  const state = { allocated: [], freed: [], inputs: [], dataCalls: 0 };
  const exports = {
    memory, version: () => 1,
    alloc_words(length) {
      const ptr = next;
      next += Math.max(length * 4, 4);
      while (next > memory.buffer.byteLength) memory.grow(1);
      state.allocated.push([ptr, length]);
      return ptr;
    },
    free_words(ptr, length) { state.freed.push([ptr, length]); },
    find_pairs(ptr, rowCount) {
      const rows = Array.from(new Uint32Array(memory.buffer, ptr, rowCount * 4));
      state.inputs.push(rows);
      if (state.inputs.length === 1) {
        assert.equal(rowCount, 4);
        assert.deepEqual(rows, SELF_ROWS);
        if (options.selfTrap) throw Error('selftest trap');
        return output(options.selfPairs || SELF_PAIRS);
      }
      state.dataCalls++;
      if (options.call) return options.call({ exports, state, rows, rowCount, output, memory });
      return output(options.pairs || [1, 0, 1]);
    }
  };
  function output(words) {
    const ptr = exports.alloc_words(words.length);
    new Uint32Array(memory.buffer, ptr, words.length).set(words);
    return BigInt(words.length) << 32n | BigInt(ptr);
  }
  return { exports, state, output };
}

function browser(extra = {}) {
  const context = { WebAssembly, Uint32Array, Map, AbortController, setTimeout, clearTimeout, ...extra };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context;
}

test('selftest gates readiness and does not count as a data call', () => {
  const fake = abi();
  const accelerator = createAccelerator({ exports: fake.exports }, { minSamples: 1 });
  assert.equal(accelerator.ready, true);
  assert.deepEqual(accelerator.stats, { calls: 0, successes: 0, fallbacks: 0, failed: 0 });
  assert.deepEqual(fake.state.freed.sort((a, b) => a[0] - b[0]), fake.state.allocated);
});

test('packs low/high hash words and compact owner/dedupe IDs without changing samples', () => {
  const fake = abi({ pairs: [1, 0, 12, 3, 0, 0] });
  const accelerator = createAccelerator(fake.exports, { minSamples: 1 });
  const a = sample('0123456789abcdef', 'owner\u0000a', ['red blue']);
  const b = sample('0123456789abcdee', 'owner\u0000a', ['red', 'blue']);
  const c = sample('FEDCBA9876543210', 'owner b', []);
  const samples = [[a, b], [], [c, a]];
  const snapshot = JSON.stringify(samples);
  const result = accelerator.findMatches(samples);
  assert.deepEqual(fake.state.inputs[1], [
    0x89abcdef, 0x01234567, 0, 0, 0x89abcdee, 0x01234567, 0, 0,
    0x76543210, 0xfedcba98, 1, 1, 0x89abcdef, 0x01234567, 0, 2
  ]);
  assert.deepEqual(result.entries, [{ sample: a, index: 0 }, { sample: b, index: 0 }, { sample: c, index: 2 }, { sample: a, index: 2 }]);
  assert.ok(result.pairs instanceof Uint32Array);
  assert.deepEqual(Array.from(result.pairs), [1, 0, 12, 3, 0, 0]);
  assert.equal(JSON.stringify(samples), snapshot);
  assert.deepEqual(accelerator.stats, { calls: 1, successes: 1, fallbacks: 0, failed: 0 });
});

test('copies output after memory growth and frees both allocations', () => {
  const fake = abi({ call({ output, memory }) { memory.grow(1); return output([1, 0, 1]); } });
  const accelerator = createAccelerator(fake.exports, { minSamples: 1 });
  const result = accelerator.findMatches(fixture());
  fake.exports.memory.grow(1);
  assert.deepEqual(Array.from(result.pairs), [1, 0, 1]);
  assert.deepEqual(fake.state.freed.sort((a, b) => a[0] - b[0]), fake.state.allocated);
});

test('nonzero pointer with zero output words means successful empty result and is freed', () => {
  const fake = abi({ pairs: [] });
  const accelerator = createAccelerator(fake.exports, { minSamples: 1 });
  const result = accelerator.findMatches(fixture());
  assert.deepEqual(Array.from(result.pairs), []);
  assert.equal(accelerator.ready, true);
  assert.deepEqual(accelerator.stats, { calls: 1, successes: 1, fallbacks: 0, failed: 0 });
  assert.deepEqual(fake.state.freed.sort((a, b) => a[0] - b[0]), fake.state.allocated);
});

test('cap sentinel returns fallback without disabling later ordinary data', () => {
  const fake = abi({ call({ state, output }) { return state.dataCalls === 1 ? 0n : output([1, 0, 1]); } });
  const accelerator = createAccelerator(fake.exports, { minSamples: 1 });
  assert.equal(accelerator.findMatches(fixture()), null);
  assert.equal(accelerator.ready, true);
  assert.deepEqual(accelerator.stats, { calls: 1, successes: 0, fallbacks: 1, failed: 0 });
  assert.deepEqual(Array.from(accelerator.findMatches(fixture()).pairs), [1, 0, 1]);
  assert.deepEqual(accelerator.stats, { calls: 2, successes: 1, fallbacks: 1, failed: 0 });
  assert.deepEqual(fake.state.freed.sort((a, b) => a[0] - b[0]), fake.state.allocated);
});

test('small/default batches skip packing, getters and WASM allocation', () => {
  const fake = abi();
  const accelerator = createAccelerator(fake.exports);
  const before = fake.state.allocated.length;
  const dangerous = Object.defineProperty({}, 'hash', { get() { throw Error('packed a small batch'); } });
  assert.equal(accelerator.findMatches([[dangerous]]), null);
  assert.equal(fake.state.allocated.length, before);
  assert.equal(fake.state.dataCalls, 0);
  assert.equal(accelerator.stats.successes, 0);
});

test('default threshold skips 511 samples before packing and runs at 512', () => {
  const fake = abi({ pairs: [] });
  const accelerator = createAccelerator(fake.exports);
  const allocated = fake.state.allocated.length;
  assert.ok(accelerator.findMatches([Array.from({ length: 511 }, () => sample())]) === null);
  assert.equal(fake.state.allocated.length, allocated);
  assert.equal(fake.state.dataCalls, 0);
  const result = accelerator.findMatches([Array.from({ length: 512 }, () => sample())]);
  assert.equal(result.entries.length, 512);
  assert.equal(result.pairs.length, 0);
  assert.deepEqual(accelerator.stats, { calls: 1, successes: 1, fallbacks: 1, failed: 0 });
});

test('minimum accepts finite numbers >= 1 and otherwise uses the default', () => {
  for (const minimum of [undefined, 0, -1, NaN, Infinity, '1']) {
    const fake = abi();
    const accelerator = createAccelerator(fake.exports, { minSamples: minimum });
    assert.equal(accelerator.findMatches(fixture()), null, String(minimum));
    assert.equal(fake.state.dataCalls, 0);
  }
  assert.ok(createAccelerator(abi().exports, { minSamples: 2 }).findMatches(fixture()));
});

test('sample cap rejects before packing/allocating', () => {
  const fake = abi();
  const accelerator = createAccelerator(fake.exports, { minSamples: 1 });
  const before = fake.state.allocated.length;
  assert.equal(accelerator.findMatches([Array(65537).fill(sample())]), null);
  assert.equal(fake.state.allocated.length, before);
  assert.equal(fake.state.dataCalls, 0);
});

test('exact sample cap is accepted and preserves the final original work index', () => {
  const fake = abi({ pairs: [] });
  const accelerator = createAccelerator(fake.exports, { minSamples: 1 });
  const samples = [[], Array(65536).fill(sample())];
  const result = accelerator.findMatches(samples);
  assert.equal(result.entries.length, 65536);
  assert.equal(result.entries[65535].index, 1);
});

test('800 identical hashes in separate works skip overflowing Rust output before WASM allocation', () => {
  const fake = abi({ pairs: [] });
  const accelerator = createAccelerator(fake.exports, { minSamples: 1 });
  const samples = Array.from({ length: 800 }, () => [sample()]);
  const before = JSON.stringify(samples);
  const allocated = fake.state.allocated.length;
  assert.equal(accelerator.findMatches(samples), null);
  assert.equal(fake.state.allocated.length, allocated);
  assert.equal(fake.state.dataCalls, 0);
  assert.equal(accelerator.ready, true);
  assert.deepEqual(accelerator.stats, { calls: 0, successes: 0, fallbacks: 1, failed: 0 });
  assert.equal(JSON.stringify(samples), before);
  assert.ok(accelerator.findMatches(fixture()));
});

test('dense guard counts a duplicate current query although its insertion is suppressed', () => {
  const fake = abi({ pairs: [] });
  const accelerator = createAccelerator(fake.exports, { minSamples: 1 });
  const samples = Array.from({ length: 724 }, () => [sample()]);
  assert.ok(accelerator.findMatches(samples)); // 724 * 723 / 2 = 261726.
  samples[723].push(sample()); // Another query sees 724 stored entries: 262450.
  assert.equal(accelerator.findMatches(samples), null);
  assert.deepEqual(accelerator.stats, { calls: 1, successes: 1, fallbacks: 1, failed: 0 });
});

test('dense guard keeps benign duplicate insertion signatures in the same work', () => {
  const fake = abi({ pairs: [] });
  const accelerator = createAccelerator(fake.exports, { minSamples: 1 });
  const samples = [Array.from({ length: 800 }, (_, index) => sample('0000000000000000', 'creator:a', index % 2 ? ['red blue'] : ['red', 'blue']))];
  assert.ok(accelerator.findMatches(samples)); // One insertion; 799 matching queries.
  assert.deepEqual(accelerator.stats, { calls: 1, successes: 1, fallbacks: 0, failed: 0 });
});

test('dense guard separates owners and normalized 64-bit hashes', () => {
  for (const makeSample of [
    index => sample('0000000000000000', `creator:${index}`),
    index => sample(index.toString(16).padStart(16, '0')),
    index => sample(index.toString(16).padStart(8, '0') + '00000000')
  ]) {
    const fake = abi({ pairs: [] });
    const accelerator = createAccelerator(fake.exports, { minSamples: 1 });
    assert.ok(accelerator.findMatches(Array.from({ length: 800 }, (_, index) => [makeSample(index)])));
    assert.equal(fake.state.dataCalls, 1);
  }
  const fake = abi({ pairs: [] });
  const accelerator = createAccelerator(fake.exports, { minSamples: 1 });
  const normalized = Array.from({ length: 800 }, (_, index) => [sample(index % 2 ? 'ABCDEF0123456789' : 'abcdef0123456789')]);
  assert.equal(accelerator.findMatches(normalized), null);
  assert.equal(fake.state.dataCalls, 0);
});

test('dense guard applies the pair cap globally and permits its exact boundary', () => {
  const fake = abi({ pairs: [] });
  const accelerator = createAccelerator(fake.exports, { minSamples: 1 });
  const boundary = [723, 48, 5, 3].flatMap((count, owner) => Array.from({ length: count }, () => [sample('0000000000000000', `creator:${owner}`)]));
  assert.ok(accelerator.findMatches(boundary)); // 261003 + 1128 + 10 + 3 = 262144.
  boundary.push([sample('0000000000000000', 'creator:3')]);
  assert.equal(accelerator.findMatches(boundary), null);
  const separateHashes = [600, 500].flatMap((count, hash) => Array.from({ length: count }, () => [sample(hash.toString(16).padStart(16, '0'))]));
  assert.equal(accelerator.findMatches(separateHashes), null); // 179700 + 124750 > 262144.
  assert.deepEqual(accelerator.stats, { calls: 1, successes: 1, fallbacks: 2, failed: 0 });
});

test('malformed nested/sample data falls back without disabling the instance', () => {
  const fake = abi();
  const accelerator = createAccelerator(fake.exports, { minSamples: 1 });
  for (const invalid of [null, {}, [null], [[null]], [[sample('abc')]], [[sample('000000000000000g')]], [[sample('0000000000000000', 3)]], [[{ hash: '0000000000000000', owner: 'a', tags: 'x' }]]]) {
    assert.equal(accelerator.findMatches(invalid), null);
  }
  assert.equal(accelerator.ready, true);
  assert.equal(fake.state.dataCalls, 0);
});

test('missing, wrong-version and trapping ABIs create safe unready fallbacks', () => {
  const cases = [null, {}, { exports: {} }, { ...abi().exports, version: () => 2 }, { ...abi().exports, version() { throw Error('version'); } }, abi({ selfTrap: true }).exports, abi({ selfPairs: [1, 0, 0] }).exports];
  for (const exports of cases) {
    const accelerator = createAccelerator(exports, { minSamples: 1 });
    assert.equal(accelerator.ready, false);
    assert.equal(accelerator.findMatches(fixture()), null);
  }
});

test('runtime trap disables the instance and frees input before JS fallback', () => {
  const fake = abi({ call() { throw Error('runtime trap'); } });
  const accelerator = createAccelerator(fake.exports, { minSamples: 1 });
  assert.equal(accelerator.findMatches(fixture()), null);
  assert.equal(accelerator.ready, false);
  assert.equal(accelerator.findMatches(fixture()), null);
  assert.equal(fake.state.dataCalls, 1);
  assert.equal(accelerator.stats.calls, 1);
  assert.equal(accelerator.stats.successes, 0);
  assert.equal(accelerator.stats.failed, 1);
  assert.deepEqual(fake.state.freed.sort((a, b) => a[0] - b[0]), fake.state.allocated);
});

test('rejects bad returned pairs and bounds before exposing a partial result', () => {
  const cases = [
    { name: 'query out of range', pairs: [2, 0, 0] },
    { name: 'previous not earlier', pairs: [1, 1, 0] },
    { name: 'distance above radius', pairs: [1, 0, 13] },
    { name: 'incomplete triple', pairs: [1, 0] },
    { name: 'queries out of order', pairs: [1, 0, 0, 0, 0, 0] },
    { name: 'wrong return type', call: () => 12 },
    { name: 'negative packed value', call: () => -1n },
    { name: 'overwide packed value', call: () => 1n << 64n },
    { name: 'unaligned output', call: () => 3n << 32n | 17n },
    { name: 'output outside memory', call: () => 3n << 32n | 65532n },
    { name: 'output above pair cap', call: () => BigInt(262145 * 3) << 32n | 16n }
  ];
  for (const entry of cases) {
    const fake = abi(entry);
    const accelerator = createAccelerator(fake.exports, { minSamples: 1 });
    assert.equal(accelerator.findMatches(fixture()), null, entry.name);
    assert.equal(accelerator.ready, false, entry.name);
    assert.equal(accelerator.stats.failed, 1, entry.name);
    assert.equal(accelerator.stats.successes, 0, entry.name);
  }
});

test('invalid input allocation falls back without calling the search', () => {
  for (const pointer of [17, 65532, NaN, -1, 1.5]) {
    const fake = abi();
    const accelerator = createAccelerator(fake.exports, { minSamples: 1 });
    fake.exports.alloc_words = () => pointer;
    assert.equal(accelerator.findMatches(fixture()), null, String(pointer));
    assert.equal(accelerator.ready, false, String(pointer));
    assert.equal(fake.state.dataCalls, 0);
  }
});

test('candidate from another owner is rejected before it reaches JS merging', () => {
  const fake = abi();
  const accelerator = createAccelerator(fake.exports, { minSamples: 1 });
  assert.equal(accelerator.findMatches([[sample()], [sample('0000000000000001', 'creator:b')]]), null);
  assert.equal(accelerator.ready, false);
  assert.equal(accelerator.stats.failed, 1);
  assert.equal(accelerator.stats.successes, 0);
});

test('output cleanup trap still frees input and disables the instance', () => {
  const fake = abi();
  const accelerator = createAccelerator(fake.exports, { minSamples: 1 });
  const freed = fake.exports.free_words;
  fake.exports.free_words = (pointer, length) => { freed(pointer, length); if (length === 3) throw Error('free trap'); };
  assert.equal(accelerator.findMatches(fixture()), null);
  assert.equal(accelerator.ready, false);
  assert.equal(accelerator.stats.failed, 1);
  assert.equal(accelerator.stats.successes, 0);
  assert.deepEqual(fake.state.freed.sort((a, b) => a[0] - b[0]), fake.state.allocated);
});

test('script load has no fetch/window/Worker side effects and publishes the UMD module', () => {
  let calls = 0;
  const context = browser({ fetch() { calls++; throw Error('unexpected fetch'); } });
  assert.equal(calls, 0);
  assert.equal(typeof context.DartVisualSearchModule.createAccelerator, 'function');
  assert.equal(context.DartVisualSearch, undefined);
});

test('optional loader is single-flight, instantiates local bytes, and assigns only a ready accelerator', async () => {
  const fake = abi();
  let fetched = 0, compiled = 0, seenUrl, fetchOptions;
  const context = browser({
    fetch: async (url, options) => { fetched++; seenUrl = url; fetchOptions = options; return { ok: true, headers: { get: () => '4' }, arrayBuffer: async () => new Uint8Array([0, 97, 115, 109]).buffer }; },
    WebAssembly: { instantiate: async bytes => { compiled++; assert.equal(bytes.byteLength, 4); return { instance: { exports: fake.exports } }; } }
  });
  const one = context.DartVisualSearchModule.load();
  const two = context.DartVisualSearchModule.load();
  assert.equal(one, two);
  const accelerator = await one;
  assert.equal(accelerator.ready, true);
  assert.equal(context.DartVisualSearch, accelerator);
  assert.equal(seenUrl, '/rust/visual-search.wasm');
  assert.equal(fetchOptions.cache, 'force-cache');
  assert.ok(fetchOptions.signal);
  assert.equal(fetched, 1);
  assert.equal(compiled, 1);
});

test('loader caches failures instead of retrying and enforces HTTP/byte/ABI boundaries', async () => {
  const cases = [
    async () => { throw Error('network'); },
    async () => ({ ok: false }),
    async () => ({ ok: true, headers: { get: () => '1048577' }, arrayBuffer() { throw Error('must not read oversized response'); } }),
    async () => ({ ok: true, headers: { get: () => null }, arrayBuffer: async () => new ArrayBuffer(1048577) }),
    async () => ({ ok: true, headers: { get: () => null }, arrayBuffer: async () => new ArrayBuffer(0) })
  ];
  for (const respond of cases) {
    let calls = 0;
    const context = browser({ fetch: (...args) => { calls++; return respond(...args); } });
    const first = context.DartVisualSearchModule.load();
    assert.equal(await first, null);
    assert.equal(await context.DartVisualSearchModule.load(), null);
    assert.equal(calls, 1);
    assert.equal(context.DartVisualSearch, undefined);
  }
  const context = browser({ fetch: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) }), WebAssembly: { instantiate: async () => ({ instance: { exports: {} } }) } });
  assert.equal(await context.DartVisualSearchModule.load(), null);
  assert.equal(context.DartVisualSearch, undefined);
});

test('loader aborts a stalled optional fetch after its bounded timeout', async () => {
  let scheduled, aborted = false;
  const context = browser({
    setTimeout(fn, delay) { assert.equal(delay, 2000); scheduled = fn; return 1; }, clearTimeout() {},
    fetch: (url, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => { aborted = true; reject(Error('aborted')); }))
  });
  const pending = context.DartVisualSearchModule.load();
  assert.equal(typeof scheduled, 'function');
  scheduled();
  assert.equal(await pending, null);
  assert.equal(aborted, true);
});

test('loader bounds streamed bytes without Content-Length before compiling', async () => {
  let reads = 0, cancelled = 0, released = 0, aborted = false, compiled = 0;
  const context = browser({
    fetch: async (url, { signal }) => {
      signal.addEventListener('abort', () => { aborted = true; });
      return { ok: true, headers: { get: () => null }, body: { getReader: () => ({
        read: async () => { reads++; return { done: false, value: new Uint8Array(reads === 1 ? 1048576 : 1) }; },
        cancel: async () => { cancelled++; }, releaseLock() { released++; }
      }) }, arrayBuffer() { assert.fail('unbounded buffered download'); } };
    },
    WebAssembly: { instantiate() { compiled++; throw Error('oversized bytes compiled'); } }
  });
  assert.equal(await context.DartVisualSearchModule.load(), null);
  assert.equal(reads, 2);
  assert.equal(cancelled, 1);
  assert.equal(released, 1);
  assert.equal(aborted, true);
  assert.equal(compiled, 0);
});

test('loader joins bounded streamed chunks and instantiates their exact bytes', async () => {
  const fake = abi();
  let reads = 0, released = 0;
  const context = browser({
    fetch: async () => ({ ok: true, headers: { get: () => null }, body: { getReader: () => ({
      read: async () => reads++ < 2 ? { done: false, value: new Uint8Array(reads === 1 ? [0, 97] : [115, 109]) } : { done: true },
      releaseLock() { released++; }
    }) }, arrayBuffer() { assert.fail('stream bypassed'); } }),
    WebAssembly: { instantiate: async bytes => { assert.deepEqual(Array.from(new Uint8Array(bytes)), [0, 97, 115, 109]); return { instance: { exports: fake.exports } }; } }
  });
  const accelerator = await context.DartVisualSearchModule.load();
  assert.equal(accelerator.ready, true);
  assert.equal(released, 1);
  assert.equal(context.DartVisualSearch, accelerator);
});

test('loader refuses remote URLs including browser-normalized backslash origins', async () => {
  for (const url of ['https://example.com/module.wasm', '//example.com/module.wasm', '/\\example.com/module.wasm']) {
    let calls = 0;
    const context = browser({ fetch() { calls++; throw Error('remote fetch'); } });
    assert.equal(await context.DartVisualSearchModule.load(url), null);
    assert.equal(calls, 0, url);
  }
});

const wasmPath = path.join(__dirname, '../wwwroot/rust/visual-search.wasm');
test('actual WASM loader stays optional during fetch then exposes a selftested accelerator', async () => {
  const contents = fs.readFileSync(wasmPath);
  let finishFetch;
  const context = browser({ fetch: () => new Promise(resolve => { finishFetch = resolve; }) });
  const pending = context.DartVisualSearchModule.load();
  assert.equal(typeof pending.then, 'function');
  assert.equal(context.DartVisualSearch, undefined);
  finishFetch({ ok: true, headers: { get: () => String(contents.byteLength) }, arrayBuffer: async () => contents.buffer.slice(contents.byteOffset, contents.byteOffset + contents.byteLength) });
  const accelerator = await pending;
  assert.equal(accelerator.ready, true);
  assert.equal(accelerator.stats.calls, 0);
  assert.equal(accelerator.stats.successes, 0);
  assert.equal(accelerator.findMatches(fixture()), null);
  const samples = Array.from({ length: 512 }, (_, index) => [sample('0000000000000000', `creator:${index}`)]);
  const result = accelerator.findMatches(samples);
  assert.equal(result.entries.length, 512);
  assert.equal(result.pairs.length, 0);
  assert.equal(accelerator.stats.calls, 1);
  assert.equal(accelerator.stats.successes, 1);
  assert.equal(context.DartVisualSearch, accelerator);
});

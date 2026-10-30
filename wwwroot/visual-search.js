(function (root, factory) {
  'use strict';
  const api = factory(root);
  root.DartVisualSearchModule = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis === 'object' ? globalThis : this, function (root) {
  'use strict';
  const MAX_SAMPLES = 65536, MAX_PAIR_WORDS = 262144 * 3, MAX_BYTES = 1048576;
  const SELF_ROWS = new Uint32Array([0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 2, 0, 0, 0, 0]);
  const SELF_PAIRS = [1, 0, 1, 3, 0, 0, 3, 1, 1];

  function createAccelerator(instanceOrExports, options = {}) {
    const stats = { calls: 0, successes: 0, fallbacks: 0, failed: 0 };
    const minimum = options?.minSamples;
    const minSamples = typeof minimum === 'number' && Number.isFinite(minimum) && minimum >= 1 ? minimum : 512;
    let ready = false, exports;
    const fallback = () => { stats.fallbacks++; return null; };

    function checkRange(pointer, words) {
      if (!Number.isInteger(pointer) || pointer <= 0 || pointer > 0xffffffff || pointer % 4 ||
          !Number.isInteger(words) || words < 0 || pointer + words * 4 > exports.memory.buffer.byteLength)
        throw Error('Invalid visual search memory range');
    }

    // Each pointer is a boxed u32 slice. Reacquire memory after calls that can
    // grow it, copy the result, then release both slices even on a trap.
    function search(words, count, dataCall) {
      let input, output, outputWords, pairs, cleanupError;
      try {
        input = exports.alloc_words(words.length);
        checkRange(input, words.length);
        new Uint32Array(exports.memory.buffer, input, words.length).set(words);
        if (dataCall) stats.calls++;
        const packed = exports.find_pairs(input, count);
        if (typeof packed !== 'bigint' || packed < 0n || packed > 0xffffffffffffffffn)
          throw Error('Invalid visual search ABI result');
        if (packed === 0n) return null;
        output = Number(packed & 0xffffffffn);
        outputWords = Number(packed >> 32n);
        checkRange(output, outputWords);
        if (outputWords > MAX_PAIR_WORDS || outputWords % 3)
          throw Error('Invalid visual search pair count');
        pairs = new Uint32Array(exports.memory.buffer, output, outputWords).slice();
        let previousQuery = 0;
        for (let i = 0; i < pairs.length; i += 3) {
          const query = pairs[i], previous = pairs[i + 1];
          if (query >= count || previous >= query || pairs[i + 2] > 12 || query < previousQuery ||
              words[query * 4 + 2] !== words[previous * 4 + 2])
            throw Error('Invalid visual search candidate');
          previousQuery = query;
        }
        return pairs;
      } finally {
        if (output !== undefined) {
          try { exports.free_words(output, outputWords); } catch (error) { cleanupError = error; }
        }
        if (Number.isInteger(input) && input > 0 && input <= 0xffffffff) {
          try { exports.free_words(input, words.length); } catch (error) { cleanupError = error; }
        }
        if (cleanupError) throw cleanupError;
      }
    }

    try {
      exports = instanceOrExports?.exports || instanceOrExports;
      if (!exports?.memory || !['version', 'alloc_words', 'free_words', 'find_pairs'].every(name => typeof exports[name] === 'function') ||
          exports.version() !== 1) throw Error('Unsupported visual search ABI');
      const actual = search(SELF_ROWS, 4, false);
      ready = !!actual && actual.length === SELF_PAIRS.length && SELF_PAIRS.every((value, i) => actual[i] === value);
    } catch { ready = false; }

    function findMatches(samples) {
      if (!ready || !Array.isArray(samples)) return fallback();
      let count = 0;
      for (const work of samples) {
        if (!Array.isArray(work)) return fallback();
        count += work.length;
        if (count > MAX_SAMPLES) return fallback();
      }
      if (count < minSamples) return fallback();
      const entries = [], owners = new Map(), dedupes = new Map(), exactEntries = new Map();
      let exactPairs = 0;
      const words = new Uint32Array(count * 4);
      // A dedupe ID represents the exact work + joined-tags part of the JS
      // tree's duplicate key; Rust separately compares hash and owner.
      try {
        for (let index = 0; index < samples.length; index++) {
          for (const sample of samples[index]) {
            if (!sample || typeof sample.hash !== 'string' || !/^[a-f0-9]{16}$/i.test(sample.hash) ||
                typeof sample.owner !== 'string' || !Array.isArray(sample.tags)) return fallback();
            if (!owners.has(sample.owner)) owners.set(sample.owner, owners.size);
            const key = index + '\u0000' + sample.tags.join(' ');
            if (!dedupes.has(key)) dedupes.set(key, dedupes.size);
            const offset = entries.length * 4;
            words[offset] = parseInt(sample.hash.slice(8), 16);
            words[offset + 1] = parseInt(sample.hash.slice(0, 8), 16);
            words[offset + 2] = owners.get(sample.owner);
            words[offset + 3] = dedupes.get(key);
            // Every query visits all prior entries at its exact hash. Count
            // suppressed duplicate queries too, but store each insertion once.
            const exactKey = words[offset + 2] + ':' + words[offset + 1] + ':' + words[offset];
            let previous = exactEntries.get(exactKey);
            if (!previous) exactEntries.set(exactKey, previous = new Set());
            exactPairs += previous.size;
            if (exactPairs > MAX_PAIR_WORDS / 3) return fallback();
            previous.add(words[offset + 3]);
            entries.push({ sample, index });
          }
        }
      } catch { return fallback(); }
      try {
        const pairs = search(words, count, true);
        if (pairs === null) return fallback();
        stats.successes++;
        return { entries, pairs };
      } catch {
        ready = false;
        stats.failed++;
        return fallback();
      }
    }
    return { findMatches, get ready() { return ready; }, stats };
  }

  let pending;
  function load(url = '/rust/visual-search.wasm') {
    if (pending) return pending;
    pending = (async () => {
      let timer;
      try {
        if (typeof root.fetch !== 'function' || typeof root.WebAssembly?.instantiate !== 'function' ||
            typeof root.AbortController !== 'function') return null;
        // This accelerator is a bundled local asset, never a remote provider.
        if (typeof url !== 'string' || !url.startsWith('/') || url.startsWith('//') || url.includes('\\')) return null;
        const controller = new root.AbortController();
        timer = root.setTimeout(() => controller.abort(), 2000);
        const response = await root.fetch(url, { cache: 'force-cache', signal: controller.signal });
        if (!response.ok || Number(response.headers?.get('content-length')) > MAX_BYTES) return null;
        let bytes;
        if (response.body?.getReader) {
          const reader = response.body.getReader(), chunks = [];
          let length = 0;
          try {
            for (;;) {
              const { done, value } = await reader.read();
              if (done) break;
              length += value.byteLength;
              if (length > MAX_BYTES) {
                controller.abort();
                await reader.cancel();
                return null;
              }
              chunks.push(value);
            }
          } finally { reader.releaseLock(); }
          const combined = new Uint8Array(length);
          let offset = 0;
          for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.byteLength; }
          bytes = combined.buffer;
        } else bytes = await response.arrayBuffer();
        if (!bytes.byteLength || bytes.byteLength > MAX_BYTES) return null;
        const result = await root.WebAssembly.instantiate(bytes);
        const accelerator = createAccelerator(result.instance || result);
        if (!accelerator.ready) return null;
        root.DartVisualSearch = accelerator;
        return accelerator;
      } catch { return null; }
      finally { if (timer !== undefined) root.clearTimeout(timer); }
    })();
    return pending;
  }
  return { createAccelerator, load };
});

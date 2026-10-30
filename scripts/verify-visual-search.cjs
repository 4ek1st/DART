#!/usr/bin/env node
'use strict';

// Ordinary release verification deliberately needs only Node, never Cargo.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const { isDeepStrictEqual } = require('node:util');

const CRATE_PATH = 'native/visual-core';
const ARTIFACT_PATH = 'wwwroot/rust/visual-search.wasm';
const MANIFEST_PATH = 'wwwroot/rust/visual-search.manifest.json';
const WRAPPER_PATH = 'wwwroot/visual-search.js';
const MAX_ARTIFACT_BYTES = 1048576;
const BUILD = Object.freeze({
  rustcVersion: 'rustc 1.86.0 (05f9846f8 2025-03-31)',
  cargoVersion: 'cargo 1.86.0 (adf9b6ad1 2025-02-28)',
  target: 'wasm32-unknown-unknown',
  profile: 'release',
  maxMemoryBytes: 134217728
});
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';

function readFile(root, relative) {
  try { return fs.readFileSync(path.join(root, relative)); }
  catch (error) { throw Error(`Cannot read ${relative}: ${error.code || 'read failed'}`); }
}

function sourceSnapshot(projectRoot) {
  const root = path.resolve(projectRoot);
  const sourceFiles = [];
  function walk(relative) {
    const absolute = path.join(root, relative);
    const info = fs.lstatSync(absolute);
    if (info.isSymbolicLink()) throw Error(`Rust source path must not be a symbolic link: ${relative}`);
    if (info.isDirectory()) {
      for (const entry of fs.readdirSync(absolute).sort()) {
        if (relative === CRATE_PATH && (entry === 'target' || entry === '.git')) continue;
        walk(`${relative}/${entry}`);
      }
    } else if (info.isFile()) sourceFiles.push({ path: relative, sha256: sha256(fs.readFileSync(absolute)) });
    else throw Error(`Unsupported Rust source path: ${relative}`);
  }
  try { walk(CRATE_PATH); }
  catch (error) { throw Error(`Rust source inventory cannot be read: ${error.message}`); }
  for (const required of ['Cargo.toml', 'Cargo.lock', '.cargo/config.toml', 'src/lib.rs', 'tests/search.rs', 'README.md'])
    if (!sourceFiles.some(entry => entry.path === `${CRATE_PATH}/${required}`))
      throw Error(`Rust source inventory is missing ${required}`);
  return { sourceFiles, wrapper: { path: WRAPPER_PATH, sha256: sha256(readFile(root, WRAPPER_PATH)) } };
}

function assertSourceSnapshot(actual, expected) {
  if (!expected || !isDeepStrictEqual(actual.sourceFiles, expected.sourceFiles))
    throw Error('Rust source inventory or source hash changed; explicitly rebuild visual-search assets.');
  if (!isDeepStrictEqual(actual.wrapper, expected.wrapper))
    throw Error('Visual-search wrapper hash does not match; explicitly rebuild visual-search assets.');
}

// WebAssembly's JavaScript API does not expose declared memory maxima. Read the
// bounded section descriptors, after V8 has validated the complete module.
function inspectMemory(bytes) {
  let offset = 8;
  function uint(end = bytes.length) {
    let value = 0;
    for (let index = 0; index < 5 && offset < end; index++) {
      const byte = bytes[offset++];
      value += (byte & 127) * 2 ** (index * 7);
      if (!(byte & 128)) {
        if (value > 0xffffffff) break;
        return value;
      }
    }
    throw Error('Invalid WASM section length');
  }
  let memory;
  while (offset < bytes.length) {
    const kind = bytes[offset++], size = uint();
    const end = offset + size;
    if (end > bytes.length) throw Error('Invalid WASM section boundary');
    if (kind === 8) throw Error('Visual-search WASM must not declare a start function');
    if (kind === 5) {
      const count = uint(end), flags = uint(end), minimum = uint(end), maximum = uint(end);
      if (count !== 1 || flags !== 1 || minimum > maximum || maximum * 65536 !== BUILD.maxMemoryBytes || offset !== end)
        throw Error('Visual-search WASM memory maximum must be exactly 128 MiB');
      memory = { minimum, maximum };
    }
    offset = end;
  }
  if (!memory) throw Error('Visual-search WASM must declare one memory with a 128 MiB maximum');
}

function verifyWasm(root, bytes) {
  if (!bytes.length || bytes.length > MAX_ARTIFACT_BYTES) throw Error('Visual-search WASM artifact size is invalid');
  const compiled = new WebAssembly.Module(bytes);
  if (WebAssembly.Module.imports(compiled).length) throw Error('Visual-search WASM imports are forbidden');
  inspectMemory(bytes);
  const exports = WebAssembly.Module.exports(compiled);
  for (const [name, kind] of [['memory', 'memory'], ['version', 'function'], ['alloc_words', 'function'], ['free_words', 'function'], ['find_pairs', 'function']])
    if (!exports.some(entry => entry.name === name && entry.kind === kind)) throw Error(`Missing visual-search WASM ABI export: ${name}`);

  const context = vm.createContext({ module: { exports: {} }, WebAssembly });
  vm.runInContext(readFile(root, WRAPPER_PATH).toString('utf8'), context, { timeout: 2000, filename: WRAPPER_PATH });
  context.compiledWasm = compiled;
  vm.runInContext(`
    const instance = new WebAssembly.Instance(compiledWasm, {});
    if (instance.exports.version() !== 1) throw Error('Visual-search ABI version must be 1');
    const create = module.exports.createAccelerator;
    if (typeof create !== 'function') throw Error('Missing visual-search wrapper factory');
    const accelerator = create(instance, { minSamples: 1 });
    if (!accelerator.ready) throw Error('Visual-search wrapper ABI selftest failed');
    const sample = (hash, owner) => ({ hash, owner, tags: ['neutral-fixture'] });
    const result = accelerator.findMatches([
      [sample('0000000000000000', 'fixture:a')],
      [sample('0000000000000001', 'fixture:a')],
      [sample('0000000000000000', 'fixture:b')]
    ]);
    if (!result || result.entries.length !== 3 || result.pairs.length !== 3 ||
        result.pairs[0] !== 1 || result.pairs[1] !== 0 || result.pairs[2] !== 1 ||
        accelerator.stats.successes !== 1)
      throw Error('Visual-search wrapper neutral pair selftest failed');
  `, context, { timeout: 2000, filename: 'visual-search-abi-check' });
}

function createManifest(projectRoot, bytes, options = {}) {
  if (options.rustcVersion !== BUILD.rustcVersion || options.cargoVersion !== BUILD.cargoVersion)
    throw Error('Visual-search compiler/toolchain must match the pinned Rust 1.86.0 build contract');
  const snapshot = sourceSnapshot(projectRoot);
  if (options.snapshot) assertSourceSnapshot(snapshot, options.snapshot);
  verifyWasm(projectRoot, bytes);
  return {
    schemaVersion: 1,
    abiVersion: 1,
    build: { ...BUILD },
    artifact: { path: ARTIFACT_PATH, sha256: sha256(bytes), bytes: bytes.length },
    ...snapshot
  };
}

function verifyVisualSearch(projectRoot) {
  const root = path.resolve(projectRoot);
  let manifest;
  try { manifest = JSON.parse(readFile(root, MANIFEST_PATH).toString('utf8')); }
  catch (error) { throw Error(`Invalid visual-search manifest: ${error.message}`); }
  if (manifest.schemaVersion !== 1 || manifest.abiVersion !== 1) throw Error('Unsupported visual-search manifest schema or ABI version');
  if (!isDeepStrictEqual(manifest.build, BUILD)) throw Error('Visual-search manifest compiler/toolchain contract does not match');
  if (manifest.artifact?.path !== ARTIFACT_PATH || manifest.wrapper?.path !== WRAPPER_PATH)
    throw Error('Visual-search manifest artifact or wrapper path does not match');
  assertSourceSnapshot(sourceSnapshot(root), manifest);
  const bytes = readFile(root, ARTIFACT_PATH);
  if (manifest.artifact.bytes !== bytes.length || manifest.artifact.sha256 !== sha256(bytes))
    throw Error('Visual-search artifact size or SHA-256 hash does not match the manifest');
  verifyWasm(root, bytes);
  return { abiVersion: 1, artifactBytes: bytes.length, artifactSha256: manifest.artifact.sha256, sourceFileCount: manifest.sourceFiles.length };
}

function cli(args) {
  const values = {};
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (flag === '--snapshot' || flag === '--prepare') values[flag] = true;
    else if (['--root', '--output', '--artifact', '--source-snapshot', '--rustc-version', '--cargo-version'].includes(flag) && index + 1 < args.length)
      values[flag] = args[++index];
    else throw Error(`Unknown or incomplete visual-search verification argument: ${flag}`);
  }
  const root = path.resolve(values['--root'] || path.join(__dirname, '..'));
  if (values['--snapshot'] && values['--prepare']) throw Error('Choose either snapshot or manifest preparation');
  if (values['--snapshot'] || values['--prepare']) {
    if (!values['--output']) throw Error('Explicit --output is required for preparation');
    let result;
    if (values['--snapshot']) result = sourceSnapshot(root);
    else {
      if (!values['--artifact'] || !values['--source-snapshot']) throw Error('Manifest preparation requires artifact and source snapshot');
      result = createManifest(root, fs.readFileSync(values['--artifact']), {
        rustcVersion: values['--rustc-version'], cargoVersion: values['--cargo-version'],
        snapshot: JSON.parse(fs.readFileSync(values['--source-snapshot'], 'utf8'))
      });
    }
    fs.writeFileSync(values['--output'], json(result), 'utf8');
  } else {
    const result = verifyVisualSearch(root);
    process.stdout.write(`Visual-search assets verified: ABI ${result.abiVersion}, ${result.artifactBytes} bytes, SHA-256 ${result.artifactSha256}\n`);
  }
}

module.exports = { verifyVisualSearch, createManifest, sourceSnapshot };
if (require.main === module) {
  try { cli(process.argv.slice(2)); }
  catch (error) { process.stderr.write(`Visual-search verification failed: ${error.message}\n`); process.exitCode = 1; }
}

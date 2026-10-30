'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const verifierPath = path.join(projectRoot, 'scripts/verify-visual-search.cjs');
const artifactPath = 'wwwroot/rust/visual-search.wasm';
const manifestPath = 'wwwroot/rust/visual-search.manifest.json';
const rustcVersion = 'rustc 1.86.0 (05f9846f8 2025-03-31)';
const cargoVersion = 'cargo 1.86.0 (adf9b6ad1 2025-02-28)';
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

// These fixtures contain only the shipped, neutral component files. No target
// directory, private catalog, profile, or production application is touched.
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dart-visual-assets-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.cpSync(path.join(projectRoot, 'native/visual-core'), path.join(root, 'native/visual-core'), {
    recursive: true,
    filter: entry => path.basename(entry) !== 'target'
  });
  fs.mkdirSync(path.join(root, 'wwwroot/rust'), { recursive: true });
  for (const relative of [artifactPath, 'wwwroot/visual-search.js'])
    fs.copyFileSync(path.join(projectRoot, relative), path.join(root, relative));
  const verifier = require(verifierPath);
  const bytes = fs.readFileSync(path.join(root, artifactPath));
  const manifest = verifier.createManifest(root, bytes, { rustcVersion, cargoVersion });
  fs.writeFileSync(path.join(root, manifestPath), JSON.stringify(manifest, null, 2) + '\n');
  return { root, verifier, manifest };
}

function rewriteManifest(root, change) {
  const filename = path.join(root, manifestPath);
  const manifest = JSON.parse(fs.readFileSync(filename, 'utf8'));
  change(manifest);
  fs.writeFileSync(filename, JSON.stringify(manifest, null, 2) + '\n');
}

function replaceWasm(root, bytes) {
  fs.writeFileSync(path.join(root, artifactPath), bytes);
  rewriteManifest(root, manifest => {
    manifest.artifact.sha256 = sha256(bytes);
    manifest.artifact.bytes = bytes.length;
  });
}

function u32(value) {
  const bytes = [];
  do { const byte = value & 127; value >>>= 7; bytes.push(byte | (value ? 128 : 0)); } while (value);
  return bytes;
}
const text = value => [...u32(Buffer.byteLength(value)), ...Buffer.from(value)];
const section = (kind, bytes) => [kind, ...u32(bytes.length), ...bytes];

// Small real WASM modules for rejected public boundaries, not ABI mocks.
function minimalWasm({ version = 1, maxPages = 2048, imported = false } = {}) {
  const header = [0, 97, 115, 109, 1, 0, 0, 0];
  if (imported) return Buffer.from([...header,
    ...section(2, [1, ...text('env'), ...text('memory'), 2, 1, 1, ...u32(maxPages)]),
    ...section(7, [1, ...text('memory'), 2, 0])]);
  const types = [4, 0x60, 0, 1, 0x7f, 0x60, 1, 0x7f, 1, 0x7f,
    0x60, 2, 0x7f, 0x7f, 0, 0x60, 2, 0x7f, 0x7f, 1, 0x7e];
  const exports = [5, ...text('memory'), 2, 0, ...text('version'), 0, 0,
    ...text('alloc_words'), 0, 1, ...text('free_words'), 0, 2, ...text('find_pairs'), 0, 3];
  const bodies = [[0, 0x41, version, 0x0b], [0, 0x41, 16, 0x0b], [0, 0x0b], [0, 0x42, 0, 0x0b]];
  return Buffer.from([...header, ...section(1, types), ...section(3, [4, 0, 1, 2, 3]),
    ...section(5, [1, 1, 1, ...u32(maxPages)]), ...section(7, exports),
    ...section(10, [4, ...bodies.flatMap(body => [...u32(body.length), ...body])])]);
}

test('release verification executes the packaged real WASM and leaves all input files unchanged', t => {
  const { root, verifier } = fixture(t);
  const before = fs.readFileSync(path.join(root, manifestPath));
  const shippedWasm = fs.readFileSync(path.join(root, artifactPath));
  const result = verifier.verifyVisualSearch(root);
  assert.equal(result.abiVersion, 1);
  assert.equal(result.artifactBytes, shippedWasm.length);
  assert.equal(result.artifactSha256, sha256(shippedWasm));
  assert.deepEqual(fs.readFileSync(path.join(root, manifestPath)), before);
  assert.deepEqual(fs.readFileSync(path.join(root, artifactPath)), shippedWasm);
  assert.equal(fs.existsSync(path.join(root, 'native/visual-core/target')), false);
});

for (const relative of ['native/visual-core/src/lib.rs', 'native/visual-core/.cargo/config.toml', 'native/visual-core/Cargo.lock']) {
  test(`release verification rejects changed ${relative}`, t => {
    const { root, verifier } = fixture(t);
    fs.appendFileSync(path.join(root, relative), '\n// changed after component build\n');
    assert.throws(() => verifier.verifyVisualSearch(root), /source.*(hash|changed|match)/i);
  });
}

test('release verification rejects added Rust sources omitted from the manifest', t => {
  const { root, verifier } = fixture(t);
  fs.writeFileSync(path.join(root, 'native/visual-core/src/extra.rs'), '// new source\n');
  assert.throws(() => verifier.verifyVisualSearch(root), /source.*(inventory|match|changed)/i);
});

test('release verification rejects a missing source instead of accepting a stale artifact', t => {
  const { root, verifier } = fixture(t);
  fs.unlinkSync(path.join(root, 'native/visual-core/tests/search.rs'));
  assert.throws(() => verifier.verifyVisualSearch(root), /source.*(inventory|match|changed)/i);
});

test('release verification rejects altered WASM bytes before instantiation', t => {
  const { root, verifier } = fixture(t);
  const filename = path.join(root, artifactPath);
  const bytes = fs.readFileSync(filename);
  bytes[bytes.length - 1] ^= 1;
  fs.writeFileSync(filename, bytes);
  assert.throws(() => verifier.verifyVisualSearch(root), /artifact.*(hash|match)/i);
});

test('release verification rejects changed wrapper bytes', t => {
  const { root, verifier } = fixture(t);
  fs.appendFileSync(path.join(root, 'wwwroot/visual-search.js'), '\n// edited\n');
  assert.throws(() => verifier.verifyVisualSearch(root), /wrapper.*(hash|match)/i);
});

test('release verification rejects imports even when artifact hash was refreshed', t => {
  const { root, verifier } = fixture(t);
  replaceWasm(root, minimalWasm({ imported: true }));
  assert.throws(() => verifier.verifyVisualSearch(root), /imports/i);
});

test('release verification enforces the declared 128 MiB WASM maximum independently of manifest hash', t => {
  const { root, verifier } = fixture(t);
  replaceWasm(root, minimalWasm({ maxPages: 4096 }));
  assert.throws(() => verifier.verifyVisualSearch(root), /memory.*(maximum|128|limit)/i);
});

test('release verification rejects a wrong ABI version independently of artifact hash', t => {
  const { root, verifier } = fixture(t);
  replaceWasm(root, minimalWasm({ version: 2 }));
  assert.throws(() => verifier.verifyVisualSearch(root), /ABI.*version/i);
});

test('release verification requires the actual wrapper ABI selftest to pass', t => {
  const { root, verifier } = fixture(t);
  replaceWasm(root, minimalWasm());
  assert.throws(() => verifier.verifyVisualSearch(root), /selftest|self.test/i);
});

test('release verification rejects source paths outside the component', t => {
  const { root, verifier } = fixture(t);
  rewriteManifest(root, manifest => { manifest.sourceFiles[0].path = '../private.json'; });
  assert.throws(() => verifier.verifyVisualSearch(root), /source.*(inventory|path|match)/i);
});

test('release verification rejects a manifest with a different compiler contract', t => {
  const { root, verifier } = fixture(t);
  rewriteManifest(root, manifest => { manifest.build.rustcVersion = 'rustc 9.99.0'; });
  assert.throws(() => verifier.verifyVisualSearch(root), /toolchain|rustc|compiler/i);
});

test('CLI release verification succeeds with no Cargo/Rust compiler on PATH', t => {
  const { root } = fixture(t);
  const result = spawnSync(process.execPath, [verifierPath, '--root', root], {
    env: { ...process.env, PATH: '' }, encoding: 'utf8', windowsHide: true
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /verified/i);
});

test('CLI returns nonzero for missing artifacts and preserves the failing files', t => {
  const { root } = fixture(t);
  fs.unlinkSync(path.join(root, manifestPath));
  const before = fs.readFileSync(path.join(root, artifactPath));
  const result = spawnSync(process.execPath, [verifierPath, '--root', root], { encoding: 'utf8', windowsHide: true });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /manifest/i);
  assert.deepEqual(fs.readFileSync(path.join(root, artifactPath)), before);
  assert.equal(fs.existsSync(path.join(root, manifestPath)), false);
});

test('manifest preparation is deterministic and records relative component paths only', t => {
  const { root, verifier, manifest } = fixture(t);
  const again = verifier.createManifest(root, fs.readFileSync(path.join(root, artifactPath)), { rustcVersion, cargoVersion });
  assert.deepEqual(again, manifest);
  assert.equal(JSON.stringify(manifest).includes(root), false);
  assert.ok(manifest.sourceFiles.every(entry => entry.path.startsWith('native/visual-core/') && !entry.path.includes('target/')));
});

test('manifest preparation refuses sources changed while the explicit component build was running', t => {
  const { root, verifier } = fixture(t);
  const snapshot = verifier.sourceSnapshot(root);
  fs.appendFileSync(path.join(root, 'native/visual-core/src/lib.rs'), '\n// concurrently edited\n');
  assert.throws(() => verifier.createManifest(root, fs.readFileSync(path.join(root, artifactPath)), {
    rustcVersion, cargoVersion, snapshot
  }), /source.*(changed|snapshot|match)/i);
});

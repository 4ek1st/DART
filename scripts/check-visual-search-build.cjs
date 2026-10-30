'use strict';

// Explicit component-development checks. These invoke Cargo and intentionally
// live outside the ordinary release tests, whose verifier needs only Node.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const builder = path.join(projectRoot, 'scripts/Build-VisualSearch.ps1');
const verifier = require('./verify-visual-search.cjs');
const artifact = 'wwwroot/rust/visual-search.wasm';
const manifest = 'wwwroot/rust/visual-search.manifest.json';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dart-visual-build-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.cpSync(path.join(projectRoot, 'native/visual-core'), path.join(root, 'native/visual-core'), {
    recursive: true, filter: entry => path.basename(entry) !== 'target'
  });
  fs.mkdirSync(path.join(root, 'wwwroot/rust'), { recursive: true });
  for (const file of [artifact, 'wwwroot/visual-search.js']) fs.copyFileSync(path.join(projectRoot, file), path.join(root, file));
  const metadata = verifier.createManifest(root, fs.readFileSync(path.join(root, artifact)), {
    rustcVersion: 'rustc 1.86.0 (05f9846f8 2025-03-31)', cargoVersion: 'cargo 1.86.0 (adf9b6ad1 2025-02-28)'
  });
  fs.writeFileSync(path.join(root, manifest), JSON.stringify(metadata, null, 2) + '\n');
  return root;
}

function run(root, flags = [], extraEnv = {}) {
  return spawnSync('pwsh', ['-NoProfile', '-NonInteractive', '-File', builder, '-ProjectRoot', root, ...flags], {
    env: { ...process.env, ...extraEnv }, encoding: 'utf8', timeout: 60000, windowsHide: true
  });
}

function snapshot(root) {
  return [artifact, manifest, 'native/visual-core/src/lib.rs', 'native/visual-core/Cargo.lock']
    .map(file => [file, sha(fs.readFileSync(path.join(root, file)))]);
}

test('explicit VerifyOnly rebuilds identical WASM without changing shipped files or creating a source target directory', t => {
  const root = fixture(t), before = snapshot(root);
  const result = run(root, ['-VerifyOnly']);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /reproducib|identical/i);
  assert.deepEqual(snapshot(root), before);
  assert.equal(fs.existsSync(path.join(root, 'native/visual-core/target')), false);
});

test('explicit VerifyOnly rejects a hash-consistent binary that differs from a fresh Rust rebuild and never rewrites it', t => {
  const root = fixture(t);
  // A valid inert custom section preserves the ABI but changes the artifact.
  const bytes = Buffer.concat([fs.readFileSync(path.join(root, artifact)), Buffer.from([0, 2, 1, 120])]);
  fs.writeFileSync(path.join(root, artifact), bytes);
  const metadata = JSON.parse(fs.readFileSync(path.join(root, manifest), 'utf8'));
  metadata.artifact.sha256 = sha(bytes);
  metadata.artifact.bytes = bytes.length;
  fs.writeFileSync(path.join(root, manifest), JSON.stringify(metadata, null, 2) + '\n');
  assert.doesNotThrow(() => verifier.verifyVisualSearch(root));
  const before = snapshot(root), result = run(root, ['-VerifyOnly']);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /rebuild.*(differ|match)|reproducib/i);
  assert.deepEqual(snapshot(root), before);
});

test('explicit build refreshes only component WASM and manifest after source edits, then passes normal release verification', t => {
  const root = fixture(t), source = path.join(root, 'native/visual-core/src/lib.rs');
  fs.appendFileSync(source, '\n// neutral source edit for builder regression\n');
  const sourceHash = sha(fs.readFileSync(source));
  fs.writeFileSync(path.join(root, artifact), 'stale artifact');
  const result = run(root);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.doesNotThrow(() => verifier.verifyVisualSearch(root));
  assert.equal(sha(fs.readFileSync(source)), sourceHash);
  assert.equal(fs.existsSync(path.join(root, 'native/visual-core/target')), false);
});

test('explicit builder rejects Rust flag overrides before creating or replacing component files', t => {
  const root = fixture(t), before = snapshot(root);
  const result = run(root, [], { RUSTFLAGS: '-C opt-level=0' });
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /RUSTFLAGS|override/i);
  assert.deepEqual(snapshot(root), before);
});

test('a directory-specific compiler change is rejected before compilation or output writes', t => {
  const root = fixture(t), before = snapshot(root), bin = path.join(root, 'neutral-proxies');
  fs.mkdirSync(bin);
  const marker = path.join(root, 'compilation-started');
  fs.writeFileSync(path.join(bin, 'rustc.cmd'), '@echo off\r\nif exist Cargo.toml (echo rustc 9.99.0) else (echo rustc 1.86.0 ^(05f9846f8 2025-03-31^))\r\n');
  fs.writeFileSync(path.join(bin, 'cargo.cmd'), '@echo off\r\nif "%~1"=="--version" (echo cargo 1.86.0 ^(adf9b6ad1 2025-02-28^)) else (type nul > "%DART_VISUAL_COMPILE_MARKER%" & exit /b 99)\r\n');
  const result = run(root, [], { PATH: bin + path.delimiter + process.env.PATH, DART_VISUAL_COMPILE_MARKER: marker });
  assert.notEqual(result.status, 0);
  assert.equal(fs.existsSync(marker), false, 'The changed toolchain must be detected before Cargo test/build');
  assert.match(result.stdout + result.stderr, /toolchain.*changed|temporary.*toolchain/i);
  assert.deepEqual(snapshot(root), before);
});

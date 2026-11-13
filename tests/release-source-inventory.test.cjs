'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const projectRoot = path.resolve(__dirname, '..');
const project = fs.readFileSync(path.join(projectRoot, 'ArtCatalog.csproj'), 'utf8');
const compileIncludes = [...project.matchAll(/<Compile\s+Include="([^"]+)"[^>]*\/>/g)]
  .map(match => match[1].replaceAll('\\', '/'));

function committedDesktopSources() {
  const result = spawnSync('git', ['ls-files', '-z', '--', '*.cs'], {
    cwd: projectRoot,
    encoding: 'buffer'
  });
  assert.equal(result.status, 0, result.stderr.toString());
  return result.stdout.toString().split('\0').filter(Boolean)
    .filter(name => !name.startsWith('tests/') &&
      !name.startsWith('Updates/Launcher/') &&
      !name.startsWith('Updates/ReleaseTool/'))
    .sort();
}

test('desktop compilation is an exact committed source inventory', () => {
  assert.match(project, /<EnableDefaultCompileItems>false<\/EnableDefaultCompileItems>/);
  assert.equal(compileIncludes.some(name => /[*?]/.test(name)), false,
    'Compile entries must name reviewed files rather than recursive source globs');
  assert.deepEqual([...compileIncludes].sort(), committedDesktopSources());
});

test('an ignored nested module initializer has no main-project compile route', () => {
  const ignoredAttackSource = 'docs/superpowers/Injected.cs';
  assert.equal(compileIncludes.includes(ignoredAttackSource), false);
  assert.equal(compileIncludes.some(name => /[*?]/.test(name)), false,
    'No wildcard may admit an ignored C# file outside the reviewed inventory');
});

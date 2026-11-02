'use strict';
// Offline CPU benchmark only. No profile, provider requests, image downloads,
// application startup or product writes. Each variant runs in fresh Node
// processes so recommendation caches and JIT state do not cross variants.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const Module = require('node:module');
const { performance } = require('node:perf_hooks');
const repository = path.resolve(__dirname, '..');
const baseline = '2435a62e6670abf1a86d4f95079c0f3cb89b2af2';
const files = ['wwwroot/catalog-logic.js', 'wwwroot/favorites.js'];
const sha = value => crypto.createHash('sha256').update(value.replace(/\r\n/g, '\n')).digest('hex');
function source(file, version) {
  return version === 'before'
    ? cp.execFileSync('git', ['show', `${baseline}:${file}`], { cwd: repository, encoding: 'utf8' })
    : fs.readFileSync(path.join(repository, file), 'utf8');
}
function compile(file, code) {
  const filename = path.join(repository, file);
  const instance = new Module(filename, module);
  instance.filename = filename;
  instance.paths = Module._nodeModulePaths(path.dirname(filename));
  instance._compile(code, filename);
  return instance.exports;
}
function measure(version) {
  const sources = Object.fromEntries(files.map(file => [file, source(file, version)]));
  global.CatalogLogic = compile(files[0], sources[files[0]]);
  const favorites = compile(files[1], sources[files[1]]);
  const likes = Array.from({ length: 2000 }, (_, index) => ({
    key: 'danbooru:' + index, source: 'danbooru', id: String(index), title: 'Artwork ' + index,
    creatorTag: 'artist_' + (index % 200), rating: index % 3 ? 'e' : 'g',
    thumbnail: 'https://cdn.donmai.us/' + index + '.jpg',
    characterTags: ['character_' + (index % 50)],
    tags: Array.from({ length: 70 }, (_, tag) => 'content_' + ((index + tag) % 120))
  }));
  const recent = likes.slice(0, 300);
  const tags = Array.from({ length: 50 }, (_, index) => 'character_' + index);
  const tab = { favoriteOrigin: 'mine', favoriteType: 'character', rating: 'explicit' };
  let visibilityRevision = 0;
  const controller = favorites.create({
    request: async () => [], getTags: () => tags, getRecent: () => recent,
    getKnown: () => likes, getLiked: () => likes, visibilityRevision: () => visibilityRevision
  });
  const measurements = [];
  for (const origin of ['mine', 'system']) {
    tab.favoriteOrigin = origin;
    for (let render = 0; render < 3; render++) {
      visibilityRevision++; // invalidate display cards, but do not change likes
      const start = performance.now();
      const rows = controller.cards(tab);
      measurements.push({ origin, render, milliseconds: performance.now() - start,
        cards: rows.length, covers: rows.filter(card => card.cover).length });
    }
  }
  return { version, sourceHashes: Object.fromEntries(files.map(file => [file, sha(sources[file])])), measurements };
}
if (process.argv[2] === '--case') {
  process.stdout.write(JSON.stringify(measure(process.argv[3])));
} else {
  const runs = [];
  for (let repetition = 0; repetition < 3; repetition++) {
    for (const version of ['before', 'after']) {
      const child = cp.spawnSync(process.execPath, [__filename, '--case', version], { cwd: repository, encoding: 'utf8' });
      if (child.status !== 0) throw new Error(child.stderr || `Benchmark ${version} failed`);
      runs.push({ repetition, ...JSON.parse(child.stdout) });
    }
  }
  const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  const medians = Object.fromEntries(['before', 'after'].map(version => [version,
    Object.fromEntries(['mine', 'system'].map(origin => [origin,
      [0, 1, 2].map(render => median(runs.filter(run => run.version === version)
        .map(run => run.measurements.find(row => row.origin === origin && row.render === render).milliseconds)))
    ]))
  ]));
  const result = {
    generatedAt: new Date().toISOString(), baseline,
    currentHead: cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repository, encoding: 'utf8' }).trim(),
    node: process.version, scriptSha256: sha(fs.readFileSync(__filename, 'utf8')),
    scenario: {
      likes: 2000, contentTagsPerLike: 70, distinctCharacters: 50, distinctArtists: 200,
      recentWorks: 300, manualCharacters: 50, rating: 'explicit',
      ratingDistribution: 'index % 3 ? explicit : general',
      sequence: 'Mine first + 2 forced-display recalculations, then System + 2 recalculations',
      isolation: '3 fresh Node processes per version, before/after alternated',
      boundary: 'cards() CPU calculation only; excludes DOM, image decoding, native/network/disk loads'
    }, medians, runs
  };
  const directory = path.join(repository, '.superpowers', 'benchmarks', 'favorites');
  fs.mkdirSync(directory, { recursive: true });
  const json = path.join(directory, 'favorites-benchmark-results.json');
  const text = path.join(directory, 'favorites-benchmark-results.txt');
  fs.writeFileSync(json, JSON.stringify(result, null, 2) + '\n');
  const lines = [
    `Offline Favorites benchmark: ${baseline} vs frozen current source (hashes in JSON)`,
    '2,000 likes; 70 content tags each; 50 characters; 200 artists; 300 recent works; explicit rating.',
    'Three fresh processes per version, alternating before/after. Values are medians in milliseconds.',
    'Each row: first calculation, second calculation, third calculation. Display invalidation between calculations.',
    ...['before', 'after'].flatMap(version => ['mine', 'system'].map(origin =>
      `${version} ${origin}: ${medians[version][origin].map(value => value.toFixed(2)).join(', ')} ms`)),
    'CPU cards() only. Does not measure full UI load, native endpoints, network or image decode.',
    `Raw measurements and source SHA-256: ${json}`
  ];
  fs.writeFileSync(text, lines.join('\n') + '\n');
  process.stdout.write(lines.join('\n') + '\n');
}

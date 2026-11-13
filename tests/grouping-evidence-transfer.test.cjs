'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const logicSource = fs.readFileSync(require.resolve('../wwwroot/catalog-logic.js'), 'utf8');
const jobsSource = fs.readFileSync(require.resolve('../wwwroot/catalog-jobs.js'), 'utf8');
const workerSource = fs.readFileSync(require.resolve('../wwwroot/catalog-worker.js'), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const work = (id, more = {}) => ({ key: `danbooru:${id}`, source: 'danbooru', id: String(id),
  title: `Neutral landscape ${id}`, rating: 'g', creatorTag: `fixture_artist_${id}`,
  tags: Array.from({ length: 24 }, (_, i) => `neutral_tag_${i}`),
  images: [`https://example.test/${id}.jpg`], ...more });
function realm() {
  const context = vm.createContext({ URL, TextEncoder, shaCalls: 0 });
  const instrumented = logicSource.replace('function sha256Text(value) {',
    'function sha256Text(value) { globalThis.shaCalls++;');
  assert.notEqual(instrumented, logicSource, 'The real media-identity owner must be instrumented');
  vm.runInContext(instrumented, context);
  return context;
}
function bridge({ evidence = true, workers = true } = {}) {
  const ui = realm(), background = realm(), replies = [];
  class Worker {
    constructor() {
      this.handlers = {}; let receive;
      background.importScripts = () => {};
      background.structuredClone = structuredClone;
      background.self = { addEventListener(_, handler) { receive = handler; }, postMessage: data => {
        const reply = structuredClone(data);
        if (!evidence) delete reply.groupingEvidence;
        replies.push(reply); queueMicrotask(() => this.handlers.message({ data: reply }));
      } };
      vm.runInContext(workerSource, background); this.receive = receive;
    }
    addEventListener(type, handler) { this.handlers[type] = handler; }
    postMessage(data) { queueMicrotask(() => this.receive({ data: structuredClone(data) })); }
    terminate() {}
  }
  ui.setTimeout = setTimeout; ui.clearTimeout = clearTimeout;
  if (workers) ui.Worker = Worker;
  vm.runInContext(jobsSource, ui);
  const group = async (items, previousInput) => {
    const grouped = await ui.DartCatalogJobs.run('groupWorks', [items], () => ui.CatalogLogic.groupWorks(items), { cacheKey: 'likes', previousInput });
    ui.CatalogLogic.cacheGroupedWorks(items, grouped);
    return grouped;
  };
  return { ui, background, replies, group };
}

test('first saved-viewer detail uses worker-owned evidence without rehashing all 4690 cold saved works', async t => {
  const f = bridge(), input = Array.from({ length: 4690 }, (_, i) => work(i + 1));
  const previous = await f.group(input);
  assert(f.replies[0].groupingEvidence);
  assert(f.background.shaCalls > 0, 'Worker evidence must derive the actual media identities');
  f.ui.shaCalls = 0;
  const changed = { ...previous[3], title: 'Learned title', tags: [...previous[3].tags, 'learned_detail'] };
  const actual = f.ui.CatalogLogic.mergeGroupedWorks(previous, [changed]);
  const transferredHashes = f.ui.shaCalls;
  assert(transferredHashes < 30, `one detail caused ${transferredHashes} media identity hashes on the UI thread`);
  assert.equal(actual.find(item => item.key === changed.key).title, 'Learned title');
  const expected = f.background.CatalogLogic.groupWorks(structuredClone([...previous, changed]));
  assert.deepEqual(plain(actual), plain(expected));
  const cold = realm(), coldPrevious = structuredClone(previous);
  cold.CatalogLogic.cacheGroupedWorks(input, coldPrevious);
  cold.CatalogLogic.mergeGroupedWorks(coldPrevious, [structuredClone(changed)]);
  assert(cold.shaCalls >= input.length, 'The same cold interaction must exercise the archived media-identity path');
  t.diagnostic(`Media-identity hashes for one detail: untransferred ${cold.shaCalls}; worker-warmed ${transferredHashes}`);
});

test('Following result envelopes warm their actual items without changing new-work membership', async () => {
  const f = bridge(), groups = [{ follow: { followedAt: '2026-01-01' }, items: [
    work(1, { published: '2026-11-13' }), work(2, { published: '2025-01-01' })] }];
  const result = await f.ui.DartCatalogJobs.run('followFeed', [groups, 'general'],
    () => f.ui.CatalogLogic.groupFollowFeed(groups, 'general'));
  assert.deepEqual([...result.newKeys], ['danbooru:1']);
  f.ui.CatalogLogic.cacheGroupedWorks(result.items, result.items);
  f.ui.shaCalls = 0;
  const merged = f.ui.CatalogLogic.mergeGroupedWorks(result.items, [work(3)]);
  assert.equal(merged.length, 3);
  assert(f.ui.shaCalls < 10, `Following rehashed ${f.ui.shaCalls} media identities`);
});

test('old workers without optional evidence preserve ordinary exact grouping', async () => {
  const f = bridge({ evidence: false }), input = [work(1), work(2)];
  const previous = await f.group(input);
  const mirror = work(10, { key: 'gelbooru:10', source: 'gelbooru', images: input[0].images });
  const actual = f.ui.CatalogLogic.mergeGroupedWorks(previous, [mirror]);
  assert.equal(actual.length, 2);
  assert(actual.some(item => item.memberKeys.includes(mirror.key) && item.memberKeys.includes(input[0].key)));
});

test('worker absence uses the existing grouping fallback without an extra evidence collection pass', async () => {
  const f = bridge({ workers: false });
  f.ui.CatalogLogic.groupingEvidenceSnapshot = () => { throw new Error('A synchronous fallback must not warm the entire archive'); };
  const input = [work(1), work(2)];
  assert.equal((await f.group(input)).length, 2);
});

test('the producer bounds optional metadata before traversing oversized arrays or transferring oversized rows', () => {
  const ui = realm(), excessive = new Array(100001);
  Object.defineProperty(excessive, 0, { get() { assert.fail('oversized evidence must be rejected before its first row'); } });
  assert.throws(() => ui.CatalogLogic.groupingEvidenceSnapshot(excessive), /Grouping evidence limit/);
  assert.throws(() => ui.CatalogLogic.groupingEvidenceSnapshot([work(1, {
    identityKeys: Array.from({ length: 8193 }, (_, index) => `group:fixture:${index}`)
  })]), /Grouping evidence limit/);
  assert.throws(() => ui.CatalogLogic.groupingEvidenceSnapshot([work(2, {
    identityKeys: ['x'.repeat(4097)]
  })]), /Grouping evidence limit/);
});

test('an optional producer limit leaves the complete worker result usable without warm metadata', async () => {
  const f = bridge(), original = f.background.CatalogLogic.groupingEvidenceSnapshot;
  f.background.CatalogLogic.groupingEvidenceSnapshot = () => { throw new Error('Grouping evidence limit exceeded'); };
  const result = await f.group([work(1), work(2)]);
  assert.equal(result.length, 2);
  assert.equal(f.replies[0].groupingEvidence, undefined);
  f.background.CatalogLogic.groupingEvidenceSnapshot = original;
});

test('provider-supplied identity keys and nested warm data never replace worker-derived media evidence', async () => {
  const f = bridge(), input = [work(1, { identityKeys: [], groupingEvidence: { version: 1, rows: [['danbooru:1', ['key:danbooru:1']]] } })];
  const previous = await f.group(input);
  const tokens = f.replies[0].groupingEvidence.rows[0][1];
  assert(tokens.some(token => token.startsWith('group:media:')), 'the owner must calculate the current URL identity');
  const actual = f.ui.CatalogLogic.mergeGroupedWorks(previous, [work(2, { images: input[0].images })]);
  assert.equal(actual.length, 1);
});

test('learned identity invalidation clears transferred evidence before exact aliases are merged', async () => {
  const f = bridge(), previous = await f.group([work(1), work(2)]);
  previous[0].originalUrl = previous[1].originalUrl = 'https://www.pixiv.net/artworks/999999';
  f.ui.CatalogLogic.invalidateGrouping([previous[0]]);
  f.ui.CatalogLogic.invalidateGrouping([previous[1]]);
  const actual = f.ui.CatalogLogic.mergeGroupedWorks(previous, previous.slice());
  assert.equal(actual.length, 1);
  assert.deepEqual(plain(actual), plain(f.background.CatalogLogic.groupWorks(structuredClone(previous))));
});

test('worker prefix hydration preserves existing rows while warming only fresh returned records', async () => {
  const f = bridge(), input = [work(1), work(2)], previous = await f.group(input);
  const next = await f.group([...input, work(3)], input);
  assert.equal(next[0], previous[0]);
  assert.equal(next[1], previous[1]);
  assert.equal(f.replies[1].reusedPrefix.length, 2);
  f.ui.shaCalls = 0;
  const actual = f.ui.CatalogLogic.mergeGroupedWorks(next, [work(4, { images: input[0].images })]);
  assert.equal(actual.length, 3);
  assert(f.ui.shaCalls < 20);
  assert(actual.some(item => item.memberKeys.includes('danbooru:1') && item.memberKeys.includes('danbooru:4')));
});

test('sparse reply references cannot attach old evidence to current mutated prefix records', () => {
  const ui = realm(), background = realm(), original = work(1);
  const old = background.CatalogLogic.groupWorks([original]);
  const evidence = structuredClone(background.CatalogLogic.groupingEvidenceSnapshot(old));
  const current = structuredClone(old);
  current[0].originalUrl = 'https://www.pixiv.net/artworks/999999';
  ui.CatalogLogic.invalidateGrouping(current);
  assert(ui.CatalogLogic.restoreGroupingEvidence(current, evidence, new Set([0])));
  const actual = ui.CatalogLogic.groupingEvidenceSnapshot(current).rows[0][1];
  assert(actual.includes('group:pixiv:999999'));
});

for (const [name, corrupt] of [
  ['wrong row key', value => { value.rows[0][0] = 'danbooru:other'; }],
  ['missing own key', value => { value.rows[0][1] = ['hash:' + 'a'.repeat(32)]; }],
  ['non-string token', value => { value.rows[0][1].push({ bad: true }); }],
  ['oversized token', value => { value.rows[0][1].push('x'.repeat(4097)); }],
  ['too many tokens', value => { value.rows[0][1] = Array(8193).fill('key:danbooru:1'); }],
  ['different version', value => { value.version = 2; }]
]) test(`malformed ${name} is ignored atomically and ordinary evidence still identifies media`, () => {
  const ui = realm(), background = realm(), items = [work(1)];
  const evidence = structuredClone(background.CatalogLogic.groupingEvidenceSnapshot(items));
  corrupt(evidence);
  assert.equal(ui.CatalogLogic.restoreGroupingEvidence(items, evidence), false);
  const actual = ui.CatalogLogic.groupingEvidenceSnapshot(items).rows[0][1];
  assert(actual.some(token => token.startsWith('group:media:')));
});

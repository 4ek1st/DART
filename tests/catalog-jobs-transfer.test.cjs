'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const Logic = require('../wwwroot/catalog-logic.js');
const client = fs.readFileSync(process.env.DART_TRANSFER_JOBS || require.resolve('../wwwroot/catalog-jobs.js'), 'utf8');
const worker = fs.readFileSync(process.env.DART_TRANSFER_WORKER || require.resolve('../wwwroot/catalog-worker.js'), 'utf8');
const tick = () => new Promise(setImmediate);
const plain = value => JSON.parse(JSON.stringify(value));
const work = (id, more = {}) => ({ key: `danbooru:${id}`, source: 'danbooru', id: String(id),
  rating: 'g', title: `Neutral landscape ${id}`, tags: ['watercolor', 'forest'], creatorTag: `fixture_artist_${id}`,
  images: [`https://example.test/neutral-${id}.jpg`], contentHash: id.toString(16).padStart(32, '0'), ...more });
function fixture({ automatic = true } = {}) {
  const sent = [], replies = [], instances = [];
  class Worker {
    constructor() {
      this.handlers = {}; instances.push(this); let receive;
      this.context = vm.createContext({ CatalogLogic: Logic, importScripts() {}, structuredClone,
        self: { addEventListener(_, handler) { receive = handler; }, postMessage: value => {
          const reply = structuredClone(value); replies.push(reply);
          if (automatic) queueMicrotask(() => this.emit(reply));
        } } });
      vm.runInContext(worker, this.context); this.receive = receive;
    }
    addEventListener(name, handler) { this.handlers[name] = handler; }
    postMessage(value) { const message = structuredClone(value); sent.push(message); this.receive({ data: message }); }
    emit(data) { this.handlers.message({ data: structuredClone(data) }); }
    terminate() { this.terminated = true; }
  }
  const context = vm.createContext({ Worker, CatalogLogic: Logic, setTimeout, clearTimeout });
  vm.runInContext(client, context);
  let fallbacks = 0;
  const group = (items, previousInput, cacheKey = 'likes') => context.DartCatalogJobs.run('groupWorks', [items], () => {
    fallbacks++; return Logic.groupWorks(structuredClone(items));
  }, { cacheKey, previousInput });
  const analysis = (items, options = {}) => context.DartCatalogJobs.run('workAnalysis', [items, {}, [], options], () => {
    fallbacks++; return { fallback: true };
  });
  return { context, sent, replies, instances, group, analysis, get fallbacks() { return fallbacks; },
    deliver(index, transform = value => value) { instances[0].emit(transform(structuredClone(replies[index]))); } };
}

test('saved grouping transfers unchanged rows by exact prior reply and preserves their object identity', async () => {
  const f = fixture(), firstInput = [work(1), work(2)], first = await f.group(firstInput);
  const nextInput = [work(3), ...firstInput], next = await f.group(nextInput, firstInput);
  assert.equal(next[1], first[0]); assert.equal(next[2], first[1]);
  assert.equal(f.sent[1].baseReplyId, f.sent[0].id);
  assert.equal(f.sent[1].args.length, 1, 'no extra complete library prefix belongs in the request');
  assert.equal(f.sent[1].previousInput, undefined, 'the ownership guard is local, never cloned to the worker');
  assert.equal(f.replies[1].value.filter(Boolean).length, 1);
  assert.deepEqual(f.replies[1].reusedPrefix, [[1, 0], [2, 1]]);
  assert.deepEqual(plain(next), plain(Logic.groupWorks(structuredClone(nextInput))));
});

test('every changed nested media, attribution, tag or identity field gets its complete exact replacement', async () => {
  const f = fixture(), input = [work(11, { imageRecords: [{ url: 'https://example.test/11.jpg', hash: 'b'.repeat(32) }] }), work(12)];
  const first = await f.group(input), nextInput = [{ ...input[0], title: 'Learned neutral metadata',
    tags: ['forest', 'learned_tag'], characterTags: ['fixture_hero'], originalUrl: 'https://example.test/source/11',
    participants: [{ tag: 'fixture_artist_11', name: 'New creator', role: 'artist' }],
    imageRecords: [{ url: 'https://example.test/11.jpg', hash: 'c'.repeat(32) }] }, input[1]];
  const next = await f.group(nextInput, input);
  assert.notEqual(next[0], first[0]); assert.equal(next[1], first[1]);
  assert(f.replies[1].value[0]); assert.deepEqual(plain(next), plain(Logic.groupWorks(structuredClone(nextInput))));
});

test('different saved collections never borrow each other\'s complete reply', async () => {
  const f = fixture(), input = [work(20)];
  const liked = await f.group(input, undefined, 'likes'), saved = await f.group(input, undefined, 'bookmarks');
  assert.notEqual(liked[0], saved[0]); assert.equal(f.sent[1].baseReplyId, undefined);
  const next = await f.group([...input, work(21)], input, 'likes');
  assert.equal(next[0], liked[0]); assert.equal(f.sent[2].baseReplyId, f.sent[0].id);
});

test('replacing the base owner or invalidating its grouping requests a complete reply', async () => {
  const f = fixture(), input = [work(30)]; await f.group(input);
  const replacement = structuredClone(input); await f.group(replacement, replacement);
  assert.equal(f.sent[1].baseReplyId, undefined);
  Logic.invalidateGrouping(replacement); await f.group([...replacement, work(31)], replacement);
  assert.equal(f.sent[2].baseReplyId, undefined);
});

test('plain in-place enrichment of a returned row cannot be mistaken for the worker\'s previous data', async () => {
  const f = fixture(), input = [work(40)], first = await f.group(input);
  first[0].visualPHash = 'a'.repeat(16); first[0].thumbnail = 'https://example.test/renewed-40.jpg';
  const next = await f.group([...input, work(41)], input);
  assert.equal(f.sent[1].baseReplyId, undefined);
  assert.notEqual(next[0], first[0]); assert.equal(next[0].visualPHash, undefined);
});

for (const corruption of ['base id', 'namespace', 'duplicate reference', 'out of range', 'unfilled row'])
  test(`a sparse reply with ${corruption} retries once with complete worker data`, async () => {
    const f = fixture({ automatic: false }), input = [work(50), work(51)];
    const cold = f.group(input); f.deliver(0); await cold;
    const nextInput = [...input, work(52)], pending = f.group(nextInput, input);
    f.deliver(1, data => {
      if (corruption === 'base id') data.baseReplyId++;
      if (corruption === 'namespace') data.groupingCacheKey = 'bookmarks';
      if (corruption === 'duplicate reference') data.reusedPrefix.push(data.reusedPrefix[0]);
      if (corruption === 'out of range') data.reusedPrefix[0][1] = 999;
      if (corruption === 'unfilled row') data.reusedPrefix.pop();
      return data;
    });
    await tick(); assert.equal(f.sent.length, 3); assert.equal(f.sent[2].baseReplyId, undefined);
    assert.equal(f.replies[2].reusedPrefix, undefined); f.deliver(2);
    assert.deepEqual(plain(await pending), plain(Logic.groupWorks(structuredClone(nextInput)))); assert.equal(f.fallbacks, 0);
  });

test('a base mutated while its sparse reply is pending receives fresh complete worker data', async () => {
  const f = fixture({ automatic: false }), input = [work(60)];
  const cold = f.group(input); f.deliver(0); const first = await cold;
  const nextInput = [...input, work(61)], pending = f.group(nextInput, input);
  first[0].images = ['https://example.test/changed-60.jpg'];
  f.deliver(1); await tick(); assert.equal(f.sent.length, 3); assert.equal(f.sent[2].baseReplyId, undefined);
  f.deliver(2); assert.deepEqual(plain(await pending), plain(Logic.groupWorks(structuredClone(nextInput))));
});

test('overlapping out-of-order replies never roll the newest complete cache backward', async () => {
  const f = fixture({ automatic: false }), input = [work(70)];
  const cold = f.group(input); f.deliver(0); const initial = await cold;
  const secondInput = [...input, work(71)], thirdInput = [...input, work(72)];
  const second = f.group(secondInput, input), third = f.group(thirdInput, input);
  f.deliver(2); const newest = await third; f.deliver(1); const older = await second;
  assert.equal(older[0], initial[0]);
  const fourth = f.group([...thirdInput, work(73)], thirdInput);
  assert.equal(f.sent[3].baseReplyId, f.sent[2].id); f.deliver(3);
  assert.equal((await fourth)[0], newest[0]);
});

test('both main and worker collection caches evict old entries and retain complete fallback behavior', async () => {
  const f = fixture(), inputs = Array.from({ length: 5 }, (_, index) => [work(80 + index)]);
  for (let index = 0; index < inputs.length; index++) await f.group(inputs[index], undefined, `collection_${index}`);
  await f.group([...inputs[0], work(90)], inputs[0], 'collection_0');
  assert.equal(f.sent[5].baseReplyId, undefined, 'the main cache is bounded to four collection owners');
  const g = fixture(), input = [work(91)]; await g.group(input);
  for (let index = 0; index < 4; index++) g.instances[0].receive({ data: { id: 900 + index,
    operation: 'groupWorks', args: [[work(100 + index)]], groupingCacheKey: `other_${index}` } });
  const next = await g.group([...input, work(92)], input);
  assert.equal(g.sent[1].baseReplyId, g.sent[0].id);
  assert.equal(g.replies.at(-1).reusedPrefix, undefined, 'worker eviction returns a complete array, never stale indices');
  assert.deepEqual(plain(next), plain(Logic.groupWorks(structuredClone([...input, work(92)]))));
});

test('a failed sparse job retries complete once and a worker failure clears caches and uses the ordinary fallback', async () => {
  const f = fixture({ automatic: false }), input = [work(110)];
  const cold = f.group(input); f.deliver(0); await cold;
  const next = f.group([...input, work(111)], input); f.deliver(1, data => ({ id: data.id, error: 'Neutral failure' }));
  await tick(); assert.equal(f.sent.length, 3); f.deliver(2); await next;
  const pendingInput = [...input, work(112)], pending = f.group(pendingInput);
  f.instances[0].handlers.error({ preventDefault() {} });
  assert.deepEqual(plain(await pending), plain(Logic.groupWorks(structuredClone(pendingInput))));
  const count = f.sent.length; await f.group(input); assert.equal(f.sent.length, count); assert.equal(f.fallbacks, 2);
});

test('staged analysis sends the saved library once and preserves background, preferences and options on reuse', async () => {
  const f = fixture(), input = [work(120)];
  const partial = await f.analysis(input, { includeCombinations: false }), full = await f.analysis(input, { includeCombinations: true });
  assert(Array.isArray(partial.queryGroups.combinations)); assert(Array.isArray(full.queryGroups.combinations));
  assert(Array.isArray(f.sent[0].args[0])); assert.equal(f.sent[1].args[0], null);
  assert.equal(f.sent[1].profileId, f.sent[0].profileId);
  assert.equal(f.sent[1].args[3].includeCombinations, true);
});

test('analysis profile replacement and same-owner invalidation send complete current evidence', async () => {
  const f = fixture(), input = [work(130)], other = [work(131)];
  await f.analysis(input); Logic.invalidateGrouping(input); await f.analysis(input);
  assert(Array.isArray(f.sent[1].args[0])); assert.notEqual(f.sent[1].profileId, f.sent[0].profileId);
  await f.analysis(other); await f.analysis(input);
  assert(Array.isArray(f.sent[2].args[0])); assert(Array.isArray(f.sent[3].args[0]));
  assert.notEqual(f.sent[3].profileId, f.sent[1].profileId, 'only the current library owner is retained');
});

test('concurrent analysis stages reuse the FIFO-dispatched profile even when replies are delivered out of order', async () => {
  const f = fixture({ automatic: false }), input = [work(140)];
  const partial = f.analysis(input, { includeCombinations: false }), full = f.analysis(input, { includeCombinations: true });
  assert.equal(f.sent[1].args[0], null); assert.equal(f.sent[1].profileId, f.sent[0].profileId);
  f.deliver(1); const fullValue = await full; f.deliver(0); const partialValue = await partial;
  assert.deepEqual(plain(fullValue.tags), plain(partialValue.tags));
});

test('an evicted analysis profile retries complete once while an older error cannot discard a newer owner', async () => {
  const f = fixture({ automatic: false }), input = [work(150)];
  const first = f.analysis(input); f.deliver(0); await first;
  vm.runInContext('recommendationProfile = null;', f.instances[0].context);
  const pending = f.analysis(input); f.deliver(1); await tick();
  assert.equal(f.sent[1].args[0], null); assert(Array.isArray(f.sent[2].args[0]));
  assert.notEqual(f.sent[2].profileId, f.sent[1].profileId); f.deliver(2); await pending;
  const old = f.analysis([work(151)]), newerInput = [work(152)], newer = f.analysis(newerInput);
  f.deliver(3, data => ({ id: data.id, error: 'Neutral old failure' })); await old;
  f.deliver(4); await newer;
  const reuse = f.analysis(newerInput); assert.equal(f.sent[5].args[0], null); f.deliver(5); await reuse;
});

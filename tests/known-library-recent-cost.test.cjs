'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const Logic = require('../wwwroot/catalog-logic.js');
const source = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
const block = source.slice(source.indexOf('function knownWorkTokens('), source.indexOf('\nfunction scheduleRelatedKnownRefresh('));
const work = id => ({ key: `danbooru:${id}`, source: 'danbooru', id: String(id),
  images: [`https://fixture.test/${id}.jpg`], memberKeys: [`danbooru:${id}`, `gelbooru:${id + 100000}`] });

test('6690 saved works stay indexed without full saved-token iteration after recent-only visits', () => {
  let constructions = [], tokenReads = 0, indexIterations = 0;
  class CountedSet extends Set {
    constructor(input) { super(input); constructions.push(this.size); }
    *[Symbol.iterator]() { indexIterations++; yield* super[Symbol.iterator](); }
  }
  const context = vm.createContext({ Set: CountedSet,
    CatalogLogic: { ...Logic, workHistoryTokens(item) { tokenReads++; return Logic.workHistoryTokens(item); } },
    likes: Array.from({ length: 4690 }, (_, i) => work(i + 1)),
    bookmarks: Array.from({ length: 2000 }, (_, i) => work(i + 10000)),
    recent: Array.from({ length: 40 }, (_, i) => work(i + 30000)), viewedTokens: new Set(), viewedPending: new Set() });
  vm.runInContext(block, context);
  assert(context.knownWorkTokens().has('key:danbooru:1'));
  assert.equal(tokenReads, 6730);
  for (let i = 0; i < 20; i++) {
    tokenReads = 0; constructions = []; indexIterations = 0;
    context.recent = [work(i + 40000), ...context.recent.slice(0, 39)];
    const tokens = context.knownWorkTokens();
    assert(tokens.has(`key:danbooru:${i + 40000}`));
    assert(tokens.has('key:gelbooru:100001'));
    assert(tokens.has('key:danbooru:11999'));
    assert.equal(tokenReads, 40, 'only the bounded recent collection needs new token evidence');
    assert(constructions.every(size => size <= 240), `a recent visit rebuilt a saved-token Set of size ${constructions}`);
    assert.equal(indexIterations, 0, 'membership must not iterate any unchanged saved index');
  }
});

test('library view iteration preserves exact union order/count and invalidation observes same-size changes', () => {
  const recent = [work(1)], likes = [work(1), work(2)], bookmarks = [work(2), work(3)];
  const context = vm.createContext({ CatalogLogic: Logic, recent, likes, bookmarks,
    viewedTokens: new Set(), viewedPending: new Set() });
  vm.runInContext(block, context);
  const first = context.knownLibraryWorkTokens(), expected = [...new Set([...recent, ...likes, ...bookmarks].flatMap(Logic.workHistoryTokens))];
  assert.deepEqual(Array.from(first), expected);
  assert.deepEqual(Array.from(first.keys()), expected); assert.equal(first.size, expected.length);
  assert.equal(context.knownLibraryWorkTokens(), first);
  context.likes[1] = work(4); Logic.invalidateGrouping(context.likes);
  const next = context.knownLibraryWorkTokens();
  assert.notEqual(next, first); assert(next.has('key:danbooru:4'));
  context.bookmarks = [work(5)];
  assert.equal(context.knownLibraryWorkTokens().has('key:danbooru:2'), false);
  assert(context.knownLibraryWorkTokens().has('key:danbooru:5'));
});

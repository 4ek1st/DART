'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Preview = require('../wwwroot/tag-preview.js');

const work = (id, tags = ['forest'], more = {}) => ({
  key: `danbooru:${id}`, source: 'danbooru', id: String(id), rating: 'g', tags,
  thumbnail: `https://example.test/neutral-${id}.jpg`, ...more
});
const scope = (key = 'all:four-catalogs') => ({ key, rating: 'all' });
test('a large viewed library normalizes repeated tag text once instead of blocking on every artwork', () => {
  const tags = Array.from({ length: 120 }, (_, index) => 'preview_cost_fixture_' + index);
  const items = Array.from({ length: 4000 }, (_, index) => work(index, tags));
  const normalize = String.prototype.normalize;
  let calls = 0;
  String.prototype.normalize = function (...args) { calls++; return normalize.apply(this, args); };
  try {
    assert.equal(items.some(item => Preview.matchesTag(item, 'preview_cost_fixture_missing')), false);
    assert(calls <= tags.length + 2, `repeated library metadata performed ${calls} Unicode normalizations`);
  } finally { String.prototype.normalize = normalize; }
});
function fixture(more = {}) {
  const calls = { viewed: [], search: [] };
  const options = {
    getViewed(tag, context, signal) { calls.viewed.push({ tag, context, signal }); return []; },
    async search(tag, context, signal) { calls.search.push({ tag, context, signal }); return [work(1, [tag])]; },
    allowed: item => !!item.thumbnail,
    ...more
  };
  return { resolver: Preview.createResolver(options), calls };
}
const abort = error => error?.name === 'AbortError';

test('tag previews canonicalize whole tag IDs while preserving real punctuation', () => {
  for (const [input, expected] of [
    ['  #Mixed Tag  ', 'mixed_tag'], ['＃ＦＥＲＮ', 'fern'],
    ['Weißes Haar', 'weißes_haar'], ['see-through_clothes', 'see-through_clothes'],
    ['goddess_of_victory:_nikke', 'goddess_of_victory:_nikke'],
    ['character_(sample_series)', 'character_(sample_series)']
  ]) assert.equal(Preview.normalizeTag(input), expected, input);
  for (const input of [null, undefined, '', '   ', '#', '-forest', '*', 'forest*', 'forest?',
    'forest\u0000rain', 'forest\nrain', 'forest\train', '\nforest', 'forest\t', 'x'.repeat(101),
    ...['order', 'sort', 'rating', 'source', 'id', 'date', 'score', 'user', 'fav']
      .map(command => command + ':anything')])
    assert.equal(Preview.normalizeTag(input), '', String(input));
});

test('tag matching uses exact typed and ordinary metadata, never titles or substrings', () => {
  const item = work(1, ['latex_gloves', 'blue eyes'], {
    title: 'forest', allTags: ['Rain'], characterTags: ['Fern'],
    copyrightTags: ['sample_series'], groupMembers: [work(2, ['watercolor'])]
  });
  for (const tag of ['latex_gloves', 'blue_eyes', 'rain', 'fern', 'sample_series', 'watercolor'])
    assert.equal(Preview.matchesTag(item, tag), true, tag);
  for (const tag of ['latex', 'forest', 'blue', 'series', 'water', ''])
    assert.equal(Preview.matchesTag(item, tag), false, tag);
  assert.equal(Preview.matchesTag(null, 'forest'), false);
});

test('the first matching eligible viewed artwork wins without any search', async () => {
  let searches = 0;
  const seen = [work(1, ['forest_path']), work(2), work(3), work(4)];
  const { resolver } = fixture({ getViewed: () => seen,
    allowed: item => item.id !== '2', search: async () => { searches++; return [work(9)]; } });
  const result = await resolver.resolve('forest', scope());
  assert.equal(result.item.key, 'danbooru:3'); assert.equal(result.origin, 'viewed');
  assert.equal(searches, 0);
});

test('asynchronously recovered viewing history has priority over a catalog search', async () => {
  let release, searches = 0;
  const { resolver } = fixture({ getViewed: () => new Promise(resolve => { release = resolve; }),
    search: async () => { searches++; return [work(9)]; } });
  const pending = resolver.resolve('forest', scope());
  await Promise.resolve(); assert.equal(searches, 0);
  release([work(5)]);
  const result = await pending;
  assert.equal(result.item.key, 'danbooru:5'); assert.equal(result.origin, 'viewed');
  assert.equal(searches, 0);
});

test('unseen or unavailable viewing history falls back to the first exact eligible search result', async () => {
  const response = [work(1, ['forest_path']), work(2, ['forest'], { thumbnail: '' }),
    work(3, ['forest'], { rating: 'e' }), work(4, ['forest'], { published: '2000-01-01' }),
    work(5, ['forest'], { published: '2026-11-05' })];
  const { resolver, calls } = fixture({ getViewed: () => [],
    search: async (tag, context, signal) => { calls.search.push({ tag, context, signal }); return response; },
    allowed: item => !!item.thumbnail && item.rating === 'g' });
  const result = await resolver.resolve('FOREST', scope('general'));
  assert.equal(result.item.key, 'danbooru:4', 'the result follows provider order rather than a new date sort');
  assert.equal(result.origin, 'search'); assert.equal(calls.search.length, 1);
  assert.equal(calls.search[0].tag, 'forest');
});

test('invalid tags and an empty NSFW selection perform no viewing-history or search I/O', async () => {
  const { resolver, calls } = fixture();
  for (const tag of ['', '-forest', 'rating:explicit', 'forest*'])
    assert.equal(await resolver.resolve(tag, scope()), null);
  assert.equal(await resolver.resolve('forest', { key: 'none', rating: 'none' }), null);
  assert.equal(calls.viewed.length, 0); assert.equal(calls.search.length, 0);
});

test('search previews cache by canonical tag and filter/source scope, with a fresh history scan on every hover', async () => {
  const { resolver, calls } = fixture();
  const first = await resolver.resolve('Forest', scope());
  assert.deepEqual(await resolver.resolve('#forest', scope()), first);
  assert.equal(calls.search.length, 1); assert.equal(calls.viewed.length, 2);
  await resolver.resolve('forest', scope('general:danbooru'));
  await resolver.resolve('forest', scope('explicit-only:rule34'));
  assert.equal(calls.search.length, 3, 'separate ratings and source choices cannot reuse another scope');
});

test('a newly viewed work takes priority over both an existing search preview and a cached miss', async () => {
  let viewed = [];
  const { resolver } = fixture({ getViewed: () => viewed,
    search: async tag => tag === 'forest' ? [work(1)] : [] });
  assert.equal((await resolver.resolve('forest', scope())).origin, 'search');
  assert.equal(await resolver.resolve('rain', scope()), null);
  viewed = [work(8), work(9, ['rain'])];
  assert.equal((await resolver.resolve('forest', scope())).item.key, 'danbooru:8');
  assert.equal((await resolver.resolve('rain', scope())).item.key, 'danbooru:9');
});

test('positive and empty search caches expire independently and failed requests remain retryable', async () => {
  let now = 0, searches = 0;
  const { resolver } = fixture({ clock: () => now, ttl: 100, emptyTtl: 10,
    search: async tag => { searches++; return tag === 'forest' ? [work(1)] : []; } });
  await resolver.resolve('forest', scope()); await resolver.resolve('rain', scope());
  now = 9; await resolver.resolve('rain', scope()); assert.equal(searches, 2);
  now = 10; await resolver.resolve('rain', scope()); assert.equal(searches, 3);
  now = 99; await resolver.resolve('forest', scope()); assert.equal(searches, 3);
  now = 100; await resolver.resolve('forest', scope()); assert.equal(searches, 4);
  let attempts = 0;
  const retry = fixture({ search: async () => { if (++attempts === 1) throw Error('Temporarily offline'); return [work(7)]; } }).resolver;
  await assert.rejects(retry.resolve('forest', scope()), /Temporarily offline/);
  assert.equal((await retry.resolve('forest', scope())).item.key, 'danbooru:7');
  assert.equal(attempts, 2);
});

test('preview metadata has a bounded LRU cache and clear removes successful previews and misses', async () => {
  const searches = [];
  const { resolver } = fixture({ maxEntries: 2,
    search: async tag => { searches.push(tag); return tag === 'empty' ? [] : [work(tag, [tag])]; } });
  for (const tag of ['forest', 'rain', 'forest', 'sunset', 'rain']) await resolver.resolve(tag, scope());
  assert.deepEqual(searches, ['forest', 'rain', 'sunset', 'rain']);
  await resolver.resolve('empty', scope()); await resolver.resolve('empty', scope());
  const before = searches.length; resolver.clear();
  await resolver.resolve('rain', scope()); await resolver.resolve('empty', scope());
  assert.equal(searches.length, before + 2);
});

test('cached results are checked against current eligibility rather than exposing newly blocked content', async () => {
  let blocked = false, searches = 0;
  const { resolver } = fixture({ allowed: item => !blocked || item.id !== '1',
    search: async () => { searches++; return [work(1), work(2)]; } });
  assert.equal((await resolver.resolve('forest', scope())).item.key, 'danbooru:1');
  blocked = true;
  assert.equal((await resolver.resolve('forest', scope())).item.key, 'danbooru:2');
  assert.equal(searches, 2);
});

test('an already aborted consumer starts no I/O', async () => {
  const controller = new AbortController(); controller.abort();
  const { resolver, calls } = fixture();
  await assert.rejects(resolver.resolve('forest', scope(), controller.signal), abort);
  assert.equal(calls.viewed.length, 0); assert.equal(calls.search.length, 0);
});

test('aborted late viewing history cannot start a search or leak into another hover', async () => {
  let release, histories = 0, searches = 0;
  const { resolver } = fixture({ getViewed: () => ++histories === 1
    ? new Promise(resolve => { release = resolve; }) : [],
    search: async () => { searches++; return [work(2)]; } });
  const controller = new AbortController(), pending = resolver.resolve('forest', scope(), controller.signal);
  await Promise.resolve(); controller.abort(); release([work(1)]);
  await assert.rejects(pending, abort); assert.equal(searches, 0);
  assert.equal((await resolver.resolve('forest', scope())).item.key, 'danbooru:2');
});

test('an aborted late search reply cannot populate the cache for a subsequent hover', async () => {
  let release, searches = 0, started;
  const searching = new Promise(resolve => { started = resolve; });
  const { resolver } = fixture({ search: async () => {
    if (++searches !== 1) return [work(2)];
    started(); return new Promise(resolve => { release = resolve; });
  } });
  const controller = new AbortController(), pending = resolver.resolve('forest', scope(), controller.signal);
  await searching; controller.abort(); release([work(1)]);
  await assert.rejects(pending, abort);
  assert.equal((await resolver.resolve('forest', scope())).item.key, 'danbooru:2');
  assert.equal(searches, 2);
});

test('clearing previews while an old search is pending prevents that reply from refilling the cache', async () => {
  let release, searches = 0, started;
  const searching = new Promise(resolve => { started = resolve; });
  const { resolver } = fixture({ search: async () => {
    if (++searches !== 1) return [work(2)];
    started(); return new Promise(resolve => { release = resolve; });
  } });
  const old = resolver.resolve('forest', scope());
  await searching; resolver.clear(); release([work(1)]);
  assert.equal((await old).item.key, 'danbooru:1');
  assert.equal((await resolver.resolve('forest', scope())).item.key, 'danbooru:2');
  assert.equal(searches, 2, 'a cleared source snapshot must not be resurrected by an older reply');
});

test('viewed and searched preview selection preserves source artwork arrays, order and context', async () => {
  const response = [work(1, ['forest_path']), work(2)], viewed = [work(3, ['rain'])], context = scope();
  const before = JSON.stringify({ response, viewed, context });
  Object.freeze(context); response.forEach(item => { Object.freeze(item.tags); Object.freeze(item); });
  Object.freeze(response); viewed.forEach(Object.freeze); Object.freeze(viewed);
  const { resolver } = fixture({ getViewed: () => viewed, search: async () => response });
  const result = await resolver.resolve('forest', context);
  assert.equal(result.item.key, 'danbooru:2'); assert.equal(result.origin, 'search');
  assert.equal(JSON.stringify({ response, viewed, context }), before);
});

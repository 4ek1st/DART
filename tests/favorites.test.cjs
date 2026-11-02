const { test } = require('node:test');
const assert = require('node:assert/strict');
const F = require('../wwwroot/favorites.js');
const Logic = require('../wwwroot/catalog-logic.js');
const work = (id, character = 'fern', tags = ['rain']) => ({ key: `danbooru:${id}`, source: 'danbooru', id: String(id),
  title: character, thumbnail: `https://cdn.donmai.us/${id}.jpg`, rating: 'g', characterTags: [character], tags });
const snapshot = { totalWorks: 10, trackedSince: '2026-11-01T12:00:00Z', kinds: { cloud: 'tag' },
  entries: [{ tag: 'fern', kind: 'character', count: 4, activeDays: 3, lastWorkKey: 'danbooru:1', lastViewedAt: '2026-11-02T12:00:00Z' },
    { tag: 'rain', kind: 'tag', count: 3, lastWorkKey: 'danbooru:1' },
    { tag: 'solo', kind: 'tag', count: 9, lastWorkKey: 'danbooru:1' },
    { tag: 'one_off', kind: 'character', count: 2, lastWorkKey: 'danbooru:1' }], works: [work(1)] };
function entries(type, origin, more = {}) { return F.collections({ summary: snapshot, tags: ['fern', 'cloud'], recent: [],
  known: [], type, origin, rating: 'all', allowed: () => true, ...more }); }
test('type and origin independently select four collections', () => {
  assert.deepEqual(entries('character', 'mine').map(x => x.tag), ['fern']);
  assert.deepEqual(entries('tag', 'mine').map(x => x.tag), ['cloud']);
  assert.deepEqual(entries('character', 'system').map(x => x.tag), ['fern']);
  assert.deepEqual(entries('tag', 'system').map(x => x.tag), ['rain']);
  assert.equal(entries('character', 'system')[0].share, 40);
});
test('legacy manual stars classify from confirmed metadata and only recent supplies covers', () => {
  const data = { summary: { entries: [], works: [], kinds: {} }, tags: ['fern', 'rain'],
    known: [work(99)], recent: [work(2), work(1)], type: 'character' };
  const card = F.collections(data)[0];
  assert.equal(card.cover.key, 'danbooru:2'); assert.equal(card.count, null);
  assert.equal(F.collections({ ...data, recent: [] })[0].cover, null);
  assert.equal(F.collections({ ...data, type: 'tag', recent: [{ ...work(2), allTags: [] }] })[0].cover?.key, 'danbooru:2');
});
test('explicit manual kind wins and new/unknown characters can be saved', () => {
  assert.equal(entries('character', 'mine', { summary: { ...snapshot, kinds: { cloud: 'character' } } }).length, 2);
});
test('rating and content exclusions cannot leak covers', () => {
  assert.equal(entries('character', 'mine', { allowed: () => false })[0].cover, null);
  assert.equal(entries('character', 'mine', { summary: { ...snapshot, works: [{ ...work(1), rating: 'e' }] }, rating: 'general' })[0].cover, null);
});
test('normalization accepts one canonical tag and rejects search commands', () => {
  assert.equal(F.normalize(' Fern '), 'fern');
  for (const value of ['-fern', 'order:score', 'fern rain', 'a'.repeat(101)]) assert.equal(F.normalize(value), '');
});
test('slim activity retains strong identities and filter metadata without copying original media', () => {
  const input = { ...work(1), contentHash: 'a'.repeat(32), memberKeys: ['gelbooru:2'], originalUrl: 'https://www.pixiv.net/artworks/1234',
    creatorTag: 'artist', participants: [{ tag: 'artist', role: 'artist' }], images: Array(100).fill('https://cdn.donmai.us/large.jpg') };
  const slim = F.slim(input); assert.equal(slim.contentHash, input.contentHash);
  assert.deepEqual(slim.memberKeys, ['gelbooru:2']); assert.equal(slim.images.length, 1);
  assert.equal(slim.creatorTag, 'artist');
});
function controller(request, overrides = {}) {
  let tags = ['cloud']; let renders = 0; const notices = [];
  const c = F.create({ request, getTags: () => tags, setTags: value => { tags = value; },
    changed: () => { renders++; }, toast: value => notices.push(value), getRecent: () => [], getKnown: () => [], ...overrides });
  return { c, tags: () => tags, notices, renders: () => renders };
}
test('manual save is optimistic and rolls back only its own choice after failure', async () => {
  let reject; const env = controller(() => new Promise((resolve, fail) => { reject = fail; }));
  const pending = env.c.toggle('fern', 'character'); assert.deepEqual(env.tags(), ['cloud', 'fern']);
  await Promise.resolve(); reject(new Error('offline')); await pending;
  assert.deepEqual(env.tags(), ['cloud']); assert.ok(env.notices.length);
});
test('manual saves serialize and authoritative replies retain concurrent choices', async () => {
  let server = ['cloud']; const calls = [];
  const env = controller(async (url, options) => { const v = JSON.parse(options.body); calls.push(v);
    server = v.favorite ? [...server, v.tag] : server.filter(x => x !== v.tag); return server; });
  await Promise.all([env.c.toggle('fern', 'character'), env.c.toggle('rain', 'tag')]);
  assert.deepEqual(env.tags(), ['cloud', 'fern', 'rain']); assert.equal(calls[0].kind, 'character');
});
test('actual opens batch off the interaction path and metadata never creates an open', async () => {
  const calls = []; const env = controller(async (url, options) => { calls.push(JSON.parse(options.body)); return {}; },
    { schedule: () => 1, unschedule: () => {} });
  env.c.metadata(work(99)); env.c.record(work(1)); env.c.metadata({ ...work(1), tags: ['rain', 'cloud'] });
  assert.equal(calls.length, 0); await env.c.flush();
  assert.equal(calls.length, 1); assert.equal(calls[0].filter(x => !x.metadataOnly).length, 1);
  assert.equal(calls[0].at(-1).metadataOnly, true);
});
test('failed activity remains queued for retry without blocking another open', async () => {
  let offline = true; const bodies = []; const env = controller(async (url, options) => {
    if (offline) throw Error('offline'); bodies.push(JSON.parse(options.body)); return {};
  }, { schedule: () => 1, unschedule: () => {} });
  env.c.record(work(1)); await env.c.flush(); env.c.record(work(2)); offline = false; await env.c.flush();
  assert.equal(bodies.flat().filter(x => !x.metadataOnly).length, 2);
});
test('failed load exposes retry and successful refresh clears the error', async () => {
  let offline = true; const env = controller(async url => { if (offline) throw Error('offline'); return url.includes('favorite-tags') ? [] : snapshot; });
  const tab = { rating: 'all' }; await env.c.load(tab); assert.ok(tab.favoriteError); assert.equal(tab.favoriteLoading, false);
  offline = false; await env.c.load(tab, true); assert.equal(tab.favoriteError, ''); assert.equal(tab.favoriteSummary.totalWorks, 10);
});
test('Favorites tabs retain both independent choices through session cleaning', () => {
  const clean = Logic.cleanClientState({ session: { savedWorksVersion: 1, activeIndex: 1, tabs: [
    { kind: 'home' }, { kind: 'favorites', title: 'Favorites', favoriteType: 'tag', favoriteOrigin: 'system', rating: 'all' }] } });
  assert.equal(clean.session.tabs.length, 2); assert.equal(clean.session.activeIndex, 1);
  assert.equal(clean.session.tabs[1].favoriteType, 'tag'); assert.equal(clean.session.tabs[1].favoriteOrigin, 'system');
});
test('large multilingual activity fits one unload request and retains character identity', () => {
  const item = work(1); item.allTags = Array.from({ length: 256 }, (_, i) => `${'語'.repeat(90)}_${i}`);
  const value = F.slim(item); assert.ok(new TextEncoder().encode(JSON.stringify(value)).length < 32000);
  assert.deepEqual(value.characterTags, ['fern']);
});
test('artwork Favorites are a separate collection with optimistic save and rollback', async () => {
  let works = [], fail = false;
  const env = controller(async (url, options) => {
    if (!options) return works;
    if (fail) throw Error('offline');
    const body = JSON.parse(options.body); works = body.favorite ? [body.item] : []; return works;
  });
  await env.c.loadArtworks(); await env.c.toggleArtwork(work(1));
  assert.equal(env.c.isArtworkFavorite(work(1)), true); assert.deepEqual(env.tags(), ['cloud']);
  fail = true; const removing = env.c.toggleArtwork(work(1));
  assert.equal(env.c.isArtworkFavorite(work(1)), false); await removing;
  assert.equal(env.c.isArtworkFavorite(work(1)), true);
});
test('artwork Favorites render only rating/content-eligible works and keep tag choices', async () => {
  const env = controller(async url => url.includes('favorite-artworks') ? [work(1), { ...work(2), rating: 'e' }] : url.includes('favorite-tags') ? ['cloud'] : snapshot);
  await env.c.loadArtworks();
  const tab = { favoriteType: 'artwork', favoriteOrigin: 'system', rating: 'general', favoriteSummary: snapshot };
  env.c.render(tab); assert.deepEqual(tab.items.map(item => item.key), ['danbooru:1']);
  assert.equal(tab.favoriteOrigin, 'system'); assert.deepEqual(env.tags(), ['cloud']);
});

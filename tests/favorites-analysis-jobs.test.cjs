'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const F = require(process.env.DART_FAVORITES_ANALYSIS_MODULE || '../wwwroot/favorites.js');
const Logic = require('../wwwroot/catalog-logic.js');
const tick = () => new Promise(resolve => setImmediate(resolve));
const work = (id, character = 'fern', rating = 'g') => ({ key: 'danbooru:' + id,
  source: 'danbooru', id: String(id), title: 'Neutral geometric artwork ' + id, rating,
  creatorTag: 'fixture_artist_' + id, characterTags: [character], tags: [character, 'rain'],
  thumbnail: 'https://example.test/thumb-' + id + '.svg', images: ['https://example.test/full-' + id + '.svg'] });
const library = character => Array.from({ length: 24 }, (_, index) => work(index + 1, character, index % 2 ? 'e' : 'g'));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function analysis(items, preferences = {}) {
  return { queryGroups: Logic.recommendationQueryGroups(items, preferences, [], { includeCombinations: false }) };
}
function fixture(more = {}) {
  const state = { liked: library('fern'), preferences: {}, inputVersion: 0,
    tags: ['fern', 'rain'], known: null, recent: [], blocked: new Set(), changes: 0,
    jobs: [], requests: [], renderOnChange: false, ...more };
  const tab = { kind: 'favorites', rating: 'all', favoriteType: 'character', favoriteOrigin: 'mine' };
  state.active = tab;
  const summary = { totalWorks: 3, kinds: { fern: 'character', rain: 'tag' },
    entries: [{ tag: 'fern', kind: 'character', count: 3, lastWorkKey: 'danbooru:1' }], works: [work(1)] };
  const original = global.CatalogLogic;
  global.CatalogLogic = { ...Logic, recommendationInputVersion: () => state.inputVersion,
    recommendationQueryGroups() { throw new Error('Synchronous Favorites query generation is forbidden in async mode'); } };
  const controller = F.create({
    getTags: () => state.tags, setTags: tags => { state.tags = tags; },
    getLiked: () => state.liked, getKnown: () => state.known || state.liked, getRecent: () => state.recent,
    getTagPreferences: () => state.preferences, getActiveTab: () => state.active,
    allowed: item => !state.blocked.has(item.key),
    analyze: (items, preferences, options) => {
      const job = { ...deferred(), items, preferences, options }; state.jobs.push(job); return job.promise;
    },
    request: async (url, options) => {
      state.requests.push({ url, method: options?.method || 'GET' });
      if (more.request) return more.request(url, options, state, summary);
      if (url === '/api/favorite-artworks') return [];
      if (url === '/api/favorite-tags' && options?.method === 'POST') return [...state.tags];
      if (url === '/api/favorite-tags') return [...state.tags];
      if (url.startsWith('/api/favorites?')) return summary;
      throw new Error('Unexpected neutral request');
    },
    changed() { state.changes++; if (state.renderOnChange && state.active === tab) controller.render(tab); }
  });
  const finish = (index, value) => {
    const job = state.jobs[index]; assert(job, 'analysis job must have started');
    job.resolve(value || analysis(job.items, job.preferences));
  };
  return { state, tab, controller, summary, finish, restore() { controller.dispose(); global.CatalogLogic = original; } };
}
function scenario(name, run) {
  test(name, async () => { const f = fixture(); try { await run(f); } finally { f.restore(); } });
}

scenario('cold Mine/System rendering stays responsive and coalesces the same rated analysis across tabs and modes', async f => {
  const first = f.controller.render(f.tab);
  assert.match(first, /Loading Favorites/); assert.doesNotMatch(first, /Your Favorites start here|Keep exploring/);
  f.tab.favoriteOrigin = 'system'; f.controller.render(f.tab);
  const second = { ...f.tab }; f.controller.cards(second);
  await tick(); assert.equal(f.state.jobs.length, 1);
  const input = JSON.stringify(f.state.liked); f.finish(0); await tick();
  const selected = F.systemSuggestions(f.state.liked, {}, Logic, analysis(f.state.liked).queryGroups);
  for (const origin of ['mine', 'system']) {
    f.tab.favoriteOrigin = origin;
    assert.deepEqual(f.controller.cards(f.tab), F.collections({ liked: f.state.liked, known: f.state.liked,
      tags: f.state.tags, suggestions: selected, type: 'character', origin, rating: 'all' }));
    assert.equal(f.controller.cards(f.tab)[0].likedCount, 24);
  }
  f.tab.favoriteType = 'tag'; assert(f.controller.cards(f.tab).some(card => card.tag === 'rain'));
  assert.equal(f.state.jobs.length, 1); assert.equal(JSON.stringify(f.state.liked), input);
});

scenario('Favorites requests shared evidence without unused recommendation combinations', async f => {
  f.controller.render(f.tab); await tick();
  assert.equal(f.state.jobs.length, 1); assert.equal(f.state.jobs[0].options?.includeCombinations, false);
  f.finish(0); await tick(); assert(f.controller.cards(f.tab).length > 0);
});

scenario('load runs analysis alongside data reads and its loading render never starts synchronous query work', async f => {
  f.state.renderOnChange = true;
  const loading = f.controller.load(f.tab);
  assert.equal(f.tab.favoriteLoading, true);
  assert(f.state.requests.some(request => request.url.startsWith('/api/favorites?')));
  await tick(); assert.equal(f.state.jobs.length, 1); assert.equal(f.tab.favoriteSummary, undefined);
  assert.match(f.controller.render(f.tab), /Loading Favorites/);
  f.finish(0); await loading;
  assert.equal(f.tab.favoriteLoading, false); assert.equal(f.tab.favoriteError, '');
  assert.equal(f.tab.favoriteSummary.totalWorks, 3);
  const [card] = f.controller.cards(f.tab); assert.equal(card.count, 3); assert.equal(card.likedCount, 24);
  assert.equal(f.state.requests.filter(request => request.url.startsWith('/api/favorites?')).length, 1);
});

scenario('rating changes use a distinct compatible analysis and returning to a rating reuses its completed evidence', async f => {
  f.controller.cards(f.tab); await tick(); f.finish(0); await tick();
  f.tab.rating = 'general';
  assert.deepEqual(f.controller.cards(f.tab), []);
  assert.match(f.controller.render(f.tab), /Loading Favorites/);
  await tick(); assert.equal(f.state.jobs.length, 2);
  assert(f.state.jobs[1].items.every(item => item.rating === 'g'));
  f.finish(1); await tick(); assert.equal(f.controller.cards(f.tab)[0].likedCount, 12);
  f.tab.rating = 'all'; assert.equal(f.controller.cards(f.tab)[0].likedCount, 24);
  assert.equal(f.state.jobs.length, 2);
});

scenario('a late old liked-library result cannot publish over a new library, and load awaits only current evidence', async f => {
  f.state.tags = ['fern', 'spruce'];
  const loading = f.controller.load(f.tab); await tick(); assert.equal(f.state.jobs.length, 1);
  f.state.liked = library('spruce');
  f.finish(0); await tick(); assert.equal(f.state.jobs.length, 2);
  assert.equal(f.tab.favoriteSummary, undefined, 'the summary must not publish with an obsolete analysis');
  assert.deepEqual(f.controller.cards(f.tab), []);
  f.finish(1); await loading;
  const cards = f.controller.cards(f.tab);
  assert.equal(cards.find(card => card.tag === 'spruce').likedCount, 24);
  assert.equal(cards.find(card => card.tag === 'fern').likedCount, null);
  assert.equal(f.state.requests.filter(request => request.url.startsWith('/api/favorites?')).length, 1,
    'changing local evidence must not refetch an otherwise current summary');
});

scenario('in-place tag preferences are captured for the job and invalidate an older pending selection', async f => {
  f.tab.favoriteOrigin = 'system'; f.controller.cards(f.tab); await tick();
  f.state.preferences.fern = 'disabled'; f.controller.cards(f.tab); await tick();
  assert.equal(f.state.jobs.length, 2); assert.equal(f.state.jobs[0].preferences.fern, undefined);
  assert.equal(f.state.jobs[1].preferences.fern, 'disabled');
  f.finish(0); await tick(); assert.deepEqual(f.controller.cards(f.tab), []);
  f.finish(1); await tick(); assert(!f.controller.cards(f.tab).some(card => card.tag === 'fern'));
});

scenario('shared input-version changes invalidate same-reference evidence without changing user choices', async f => {
  f.controller.cards(f.tab); await tick(); f.finish(0); await tick();
  const choices = [...f.state.tags]; f.state.inputVersion++;
  f.controller.cards(f.tab); await tick(); assert.equal(f.state.jobs.length, 2);
  f.finish(1); await tick(); assert.equal(f.controller.cards(f.tab)[0].likedCount, 24);
  assert.deepEqual(f.state.tags, choices);
});

scenario('last good suggestions keep current covers and choices usable while updated likes are analysed', async f => {
  f.controller.cards(f.tab); await tick(); f.finish(0); await tick();
  f.tab.favoriteSummary = f.summary;
  f.state.liked = [{ ...work(1), characterTags: ['fern', 'spruce'] }, ...f.state.liked.slice(1), work(25)];
  f.state.blocked.add('danbooru:2');
  const pending = f.controller.cards(f.tab);
  assert.equal(pending[0].likedCount, 24, 'keep the previously confirmed count while updating');
  assert.equal(pending[0].cover.key, 'danbooru:3', 'current metadata and hidden-work filters still decide the cover');
  assert.equal(f.tab.favoriteEvidenceLoading, true);
  await f.controller.toggle('fern', 'character', false);
  assert.deepEqual(f.controller.cards(f.tab), [], 'a manual removal remains immediate while analysis is pending');
  await tick(); assert.equal(f.state.jobs.length, 2); f.finish(1); await tick();
  assert.deepEqual(f.controller.cards(f.tab), []); assert.equal(f.tab.favoriteEvidenceLoading, false);
});

scenario('analysis failure exposes retry, remains bounded under repeated renders, and refresh recovers', async f => {
  const loading = f.controller.load(f.tab); await tick();
  f.state.jobs[0].reject(new Error('Neutral worker failure')); await loading;
  assert(f.tab.favoriteError); assert.match(f.controller.render(f.tab), /Try again/);
  f.controller.render(f.tab); f.controller.cards(f.tab); await tick(); assert.equal(f.state.jobs.length, 1);
  const refreshing = f.controller.load(f.tab, true); await tick(); assert.equal(f.state.jobs.length, 2);
  f.finish(1); await refreshing;
  assert.equal(f.tab.favoriteError, ''); assert.equal(f.controller.cards(f.tab)[0].likedCount, 24);
  assert.doesNotMatch(f.controller.render(f.tab), /role="alert"/);
});

scenario('changing rating during a load cannot publish the old rating or erase newer loading state', async f => {
  const loading = f.controller.load(f.tab); await tick();
  f.tab.rating = 'general'; f.finish(0); await tick();
  assert.equal(f.tab.favoriteLoading, true); assert.equal(f.state.jobs.length, 2);
  f.finish(1); await loading;
  assert.equal(f.tab.favoriteLoading, false); assert.equal(f.controller.cards(f.tab)[0].likedCount, 12);
  assert.equal(f.state.requests.filter(request => request.url.startsWith('/api/favorites?')).length, 2);
});

test('an older summary and analysis cannot erase a manual favorite or its explicit kind', async () => {
  const oldTags = deferred(); let tagReads = 0, saved = false;
  const f = fixture({ request: async (url, options, state, summary) => {
    if (url === '/api/favorite-artworks') return [];
    if (url === '/api/favorite-tags' && options?.method === 'POST') { saved = true; return [...state.tags]; }
    if (url === '/api/favorite-tags') return ++tagReads === 1 ? oldTags.promise : [...state.tags];
    return { ...summary, kinds: { ...summary.kinds, spruce: saved ? 'character' : 'tag' } };
  } });
  try {
    const loading = f.controller.load(f.tab); await tick();
    assert.equal(f.state.jobs.length, 1);
    await f.controller.toggle('spruce', 'character', true);
    oldTags.resolve(['fern', 'rain']); f.finish(0); await loading; await tick();
    assert(f.state.tags.includes('spruce'));
    assert(f.controller.cards(f.tab).some(card => card.tag === 'spruce' && card.kind === 'character'));
    assert.equal(f.state.jobs.length, 1, 'a manual choice does not invalidate unchanged liked evidence');
  } finally { f.restore(); }
});

scenario('completed offscreen or disposed analysis cannot repaint another screen or publish a stale error', async f => {
  f.controller.cards(f.tab); await tick(); const before = f.state.changes;
  f.state.active = { kind: 'home' }; f.finish(0); await tick();
  assert.equal(f.state.changes, before); assert.equal(f.tab.favoriteError, undefined);
  f.state.inputVersion++; f.controller.cards(f.tab); await tick();
  const jobs = f.state.jobs.length; f.controller.dispose();
  f.state.jobs.at(-1).reject(new Error('Late disposed failure')); await tick();
  await f.controller.load(f.tab, true);
  assert.equal(f.state.changes, before); assert.equal(f.state.jobs.length, jobs);
});

scenario('artwork and empty-rating views do not schedule tag analysis', async f => {
  f.tab.favoriteType = 'artwork'; await f.controller.load(f.tab);
  f.controller.render(f.tab); assert.equal(f.state.jobs.length, 0);
  f.tab.favoriteType = 'character'; f.tab.rating = 'none'; await f.controller.load(f.tab, true);
  assert.match(f.controller.render(f.tab), /No NSFW ratings selected/); assert.equal(f.state.jobs.length, 0);
});

test('precomputed selections preserve synchronous Favorites classifications, counts and priorities', () => {
  const liked = library('fern'), preferences = { rain: 'priority' };
  const selected = Logic.recommendationQueryGroups(liked, preferences, [], { includeCombinations: false });
  assert.deepEqual(F.systemSuggestions(liked, preferences, Logic, selected), F.systemSuggestions(liked, preferences, Logic));
});

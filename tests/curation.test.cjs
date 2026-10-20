const test = require('node:test');
const assert = require('node:assert/strict');
const logic = require('../wwwroot/catalog-logic.js');

const now = Date.parse('2026-10-20T12:00:00Z');
const work = (key, extra = {}) => ({ key, source: key.split(':')[0], id: key.split(':')[1],
  title: 'Artwork', rating: 'g', tags: ['watercolor'], ...extra });
const factor = name => ({ enabled: true, popularity: false, personal: false,
  freshness: false, resolution: false, [name]: true });
const keys = items => items.map(item => item.key);

test('curation is opt-in and disabling it preserves the input order', () => {
  const items = [work('danbooru:1', { popularityCount: 0 }), work('danbooru:2', { popularityCount: 90 })];
  assert.equal(logic.normalizeCurationPreferences().enabled, false);
  assert.equal(logic.rankCuratedWorks(items, {}, { now }), items);
  assert.deepEqual(keys(logic.rankCuratedWorks(items, factor('none'), { now })), ['danbooru:1', 'danbooru:2']);
});

test('session cleanup migrates legacy curated search to its normal source ordering', () => {
  const state = logic.cleanClientState({ session: { savedWorksVersion: 1, activeIndex: 0,
    tabs: [{ kind: 'search', sort: 'curated', curationBaseSort: 'popular', selectedSources: ['sankaku'] }] } });
  assert.equal(state.session.tabs[0].sort, 'popular');
  assert.equal('curationBaseSort' in state.session.tabs[0], false);
});

test('community ratings compare relative standing within each source and rating', () => {
  const items = [work('rule34:1', { popularityCount: 1000 }),
    work('danbooru:1', { popularityCount: 10 }),
    work('rule34:2', { popularityCount: 2000 }),
    work('danbooru:2', { popularityCount: 20 }),
    work('sankaku:1', { popularityCount: 50000, rating: 'e' })];
  const boosts = logic.curationBoosts(items, factor('popularity'), { now });
  assert.equal(boosts.get('rule34:2'), boosts.get('danbooru:2'));
  assert.equal(boosts.get('rule34:1'), boosts.get('danbooru:1'));
  assert.ok(boosts.get('danbooru:2') > boosts.get('rule34:1'));
  assert.equal(boosts.get('sankaku:1'), 1, 'a source without comparison evidence is neutral');
});

test('absent or malformed source metadata is neutral instead of low quality', () => {
  const items = [work('gelbooru:1'), work('gelbooru:2', { popularityCount: null,
    width: NaN, height: -1, published: 'unknown' })];
  const boosts = logic.curationBoosts(items, { enabled: true }, { now });
  assert.deepEqual([...boosts.values()], [1, 1]);
});

test('local likes can boost a relevant work without network or image analysis', () => {
  const items = [work('rule34:1', { tags: ['landscape'] }), work('rule34:2', { tags: ['watercolor'] })];
  const liked = [1, 2, 3, 4].map(i => work(`danbooru:liked${i}`, { tags: ['watercolor'] }));
  assert.deepEqual(keys(logic.rankCuratedWorks(items, factor('personal'), { now, liked })),
    ['rule34:2', 'rule34:1']);
  assert.deepEqual(keys(logic.rankCuratedWorks(items, factor('personal'), { now, liked: [] })),
    ['rule34:1', 'rule34:2']);
});

test('the first personal ranking fits an interactive budget with a large local profile', () => {
  const tags = Array.from({ length: 96 }, (_, index) => `pattern_${index}`);
  const liked = Array.from({ length: 800 }, (_, index) => work(`danbooru:liked${index}`,
    { tags, creatorTag: `maker_${index % 80}` }));
  const items = [work('rule34:unrelated', { tags: ['landscape'] }), work('rule34:matched', { tags: ['pattern_7'] })];
  const start = performance.now();
  assert.equal(logic.rankCuratedWorks(items, factor('personal'), { now, liked })[0].key, 'rule34:matched');
  const elapsed = performance.now() - start;
  assert.ok(elapsed < 750, `First personal ranking blocked for ${elapsed.toFixed(1)} ms`);
});

test('freshness gives recent uploads a chance while future or unknown dates stay neutral', () => {
  const items = [work('danbooru:old', { published: '2023-01-01T00:00:00Z' }),
    work('danbooru:new', { published: '2026-10-20T10:00:00Z' }),
    work('danbooru:future', { published: '2099-01-01T00:00:00Z' }), work('danbooru:unknown')];
  const boosts = logic.curationBoosts(items, factor('freshness'), { now });
  assert.ok(boosts.get('danbooru:new') > boosts.get('danbooru:old'));
  assert.equal(boosts.get('danbooru:future'), 1);
  assert.equal(boosts.get('danbooru:unknown'), 1);
});

test('resolution uses original dimensions and leaves deliberate low-detail styles neutral', () => {
  const items = [work('sankaku:small', { width: 300, height: 450 }),
    work('sankaku:large', { width: 1800, height: 2400 }),
    work('sankaku:pixel', { width: 64, height: 64, tags: ['pixel_art'] }),
    work('sankaku:sketch', { width: 300, height: 450, tags: ['sketch'] }),
    work('sankaku:preview', { previewWidth: 150, previewHeight: 150 })];
  const boosts = logic.curationBoosts(items, factor('resolution'), { now });
  assert.ok(boosts.get('sankaku:large') > boosts.get('sankaku:small'));
  for (const key of ['sankaku:pixel', 'sankaku:sketch', 'sankaku:preview']) assert.equal(boosts.get(key), 1);
});

test('mirror counts and repeated member records never inflate curation', () => {
  const first = work('danbooru:1', { popularityCount: 20 });
  const peer = work('danbooru:2', { popularityCount: 10 });
  const mirror = work('gelbooru:99', { popularityCount: 9999 });
  const grouped = { ...first, memberKeys: [first.key, mirror.key], groupMembers: [first, mirror, first, mirror] };
  const plain = logic.curationBoosts([first, peer], factor('popularity'), { now });
  const merged = logic.curationBoosts([grouped, peer], factor('popularity'), { now });
  assert.equal(merged.get(first.key), plain.get(first.key));
  assert.equal(merged.get(peer.key), plain.get(peer.key));
});

test('curated append keeps existing cards and puts newly ranked cards after them', () => {
  const existing = [work('rule34:1', { popularityCount: 0 }), work('rule34:2', { popularityCount: 2 })];
  const incoming = [work('rule34:3', { popularityCount: 3 }), work('rule34:4', { popularityCount: 9 })];
  assert.deepEqual(keys(logic.mergeCuratedWorks(existing, incoming, factor('popularity'), { now })),
    ['rule34:1', 'rule34:2', 'rule34:4', 'rule34:3']);
  assert.deepEqual(keys(existing), ['rule34:1', 'rule34:2']);
});

test('curation refines recommendations but keeps explicit priorities and stable append', () => {
  const liked = [1, 2, 3].map(i => work(`danbooru:liked${i}`));
  const items = [work('rule34:low', { popularityCount: 0 }), work('rule34:high', { popularityCount: 10 }),
    work('rule34:priority', { tags: ['watercolor', 'painting_(medium)'], popularityCount: -10 })];
  const context = { now, curation: factor('popularity') };
  assert.equal(logic.rankRecommendations(liked, items, 'general', 10, {}, 0, context)[0].key, 'rule34:high');
  assert.equal(logic.rankRecommendations(liked, items, 'general', 10,
    { 'painting (medium)': 'priority' }, 0, context)[0].key, 'rule34:priority');
  const existing = [work('rule34:existing')];
  const merged = logic.mergeRecommendations(liked, existing, [{ items }], 'general', {}, 0, context);
  assert.equal(merged[0].key, 'rule34:existing');
});

test('curation refines related results while preserving relevance and the current-work exclusion', () => {
  const reference = work('danbooru:reference', { tags: ['watercolor', 'landscape'] });
  const items = [work('rule34:low', { tags: ['watercolor', 'landscape'], popularityCount: 0 }),
    work('rule34:high', { tags: ['watercolor', 'landscape'], popularityCount: 10 }),
    work('rule34:irrelevant', { tags: ['car'], popularityCount: 900 })];
  assert.deepEqual(keys(logic.rankRelated(reference, items, 10,
    { now, curation: factor('popularity') })), ['rule34:high', 'rule34:low']);
});

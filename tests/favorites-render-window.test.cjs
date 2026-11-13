'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const vm = require('node:vm'), fs = require('node:fs'), path = require('node:path');
const Favorites = require('../wwwroot/favorites.js');
const app = fs.readFileSync(path.join(__dirname, '../wwwroot/app.js'), 'utf8');
function gridFixture() {
  const tab = { id: 1, kind: 'favorites', favoriteType: 'character', items: [] };
  const main = { dataset: { tabId: '1' }, scrollTop: 0, clientHeight: 1300 };
  const context = vm.createContext({ currentTab: () => tab, main, escapeHtml: String });
  const from = app.indexOf('function renderVirtualGrid('), end = app.indexOf('\nfunction renderFeedCard(', from);
  vm.runInContext(app.slice(from, end), context);
  return { tab, main, draw: context.renderFavoriteEntityGrid };
}
const work = id => ({ key: `danbooru:${id}`, source: 'danbooru', id: String(id),
  title: `Neutral landscape ${id}`, rating: 'g', characterTags: [`character_${id}`],
  thumbnail: `https://example.test/${id}.svg`, tags: [] });

test('180 Favorite entities build only the measured viewport while retaining the complete viewer source', () => {
  const f = gridFixture();
  const cards = Array.from({ length: 180 }, (_, index) => ({ tag: `character_${index}`,
    cover: index % 3 ? work(index) : null }));
  f.tab.items = cards.filter(card => card.cover).map(card => card.cover);
  let calls = 0;
  const entity = card => { calls++; return `<article data-tag="${card.tag}"></article>`; };
  const initial = f.draw(cards, entity);
  assert.match(initial, /virtual-grid/); assert.match(initial, /favorites-entity-grid/);
  assert(calls <= 60, `1300px viewport constructed ${calls} of 180 entities`);
  assert.equal(f.tab.artworkLists.get('favorites'), f.tab.items);
  assert.equal(f.tab.artworkLists.get('favorites').length, 120);
  assert.equal(f.tab.virtualState.favorites.itemIndexes.get('danbooru:179'), 179,
    'empty previews do not shift the source-card index used when returning from Space');
  const before = calls;
  f.draw(cards, entity);
  assert(calls - before <= 60, 'unrelated repaint is bounded by viewport size');
  f.main.scrollTop = 25 * 340;
  const tail = f.draw(cards, entity);
  assert.match(tail, /character_179/); assert.doesNotMatch(tail, /data-tag="character_0"/);
  f.main.scrollTop = 0;
  assert.match(f.draw(cards, entity), /data-tag="character_0"/);
});

test('Favorite viewport recovers after a same-tab collection shrinks or changes responsive columns', () => {
  const f = gridFixture(), entity = card => `<article>${card.tag}</article>`;
  let cards = Array.from({ length: 600 }, (_, i) => ({ tag: `entity_${i}` }));
  f.draw(cards, entity); f.main.scrollTop = 70 * 340; f.draw(cards, entity);
  f.main.scrollTop = 0;
  cards = cards.slice(0, 90);
  assert.match(f.draw(cards, entity), /entity_0/);
  const state = f.tab.virtualState.favorites;
  state.cols = 2; state.pitch = 440;
  f.main.scrollTop = 43 * 440;
  const tail = f.draw(cards, entity);
  assert.match(tail, /entity_89/); assert(state.endRow <= 45);
});

test('Favorite entities preserve unchanged complete source reference and publish real cover replacements', () => {
  const f = gridFixture(), works = Array.from({ length: 180 }, (_, i) => work(i));
  const tags = works.map(item => item.characterTags[0]);
  const recent = [], known = [], liked = [];
  const summary = { totalWorks: 180,
    entries: works.map((item, i) => ({ tag: tags[i], kind: 'character', count: 1, lastWorkKey: item.key })), works };
  f.tab.favoriteSummary = summary;
  let rendered = 0;
  const c = Favorites.create({ request: async () => [], getTags: () => tags,
    getLiked: () => liked, getRecent: () => recent, getKnown: () => known,
    renderEntities: f.draw, renderEntityCard: card => { rendered++; return `<article>${card.cover.key}</article>`; } });
  try {
    c.render(f.tab);
    assert.equal(f.tab.items.length, 180); assert(rendered <= 60);
    const source = f.tab.items;
    for (let i = 0; i < 8; i++) c.render(f.tab);
    assert.equal(f.tab.items, source, 'warm render must not invalidate viewer grouping/read caches');
    assert(rendered <= 540, `bounded paint work must not rebuild all 180 cards: ${rendered}`);
    const replacement = { ...works[0], thumbnail: 'https://example.test/updated.svg' };
    f.tab.favoriteSummary = { ...summary, works: [replacement, ...works.slice(1)] };
    c.render(f.tab);
    assert.notEqual(f.tab.items, source);
    assert.equal(f.tab.items.find(item => item.key === replacement.key).thumbnail, replacement.thumbnail);
  } finally { c.dispose(); }
});

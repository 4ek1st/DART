const test = require('node:test');
const assert = require('node:assert/strict');
const CatalogLogic = require('../wwwroot/catalog-logic.js');

test('obsolete session entries are removed while the active supported tab and preferences survive', () => {
  const supported = { key: 'rule34:123', source: 'rule34', creatorTag: 'artist' };
  const input = { searchHistory: ['latex'], recent: [{ source: 'retired' }, supported],
    session: { activeIndex: 4, tabPreferences: { artworkTabs: 'new' }, tabs: [
      { kind: 'home', title: 'Home', selectedSources: ['danbooru', 'retired', 'rule34'] },
      { kind: 'search', title: 'Retired feed', feed: 'retired-images' },
      { kind: 'detail', item: { key: 'retired:1', source: 'retired' } },
      { kind: 'profile', profileRef: { source: 'retired', artist: '123' } },
      { kind: 'detail', title: 'Selected', item: supported, scrollTop: 456, pinned: true },
      { kind: 'profile', profileRef: { source: 'artist', artist: 'artist' } }
    ] } };
  const result = CatalogLogic.cleanClientState(input);
  assert.equal(result.session.tabs.length, 3);
  assert.equal(result.session.activeIndex, 1);
  assert.equal(result.session.tabs[1].item, supported);
  assert.equal(result.session.tabs[1].scrollTop, 456);
  assert.equal(result.session.tabs[1].pinned, true);
  assert.deepEqual(result.session.tabs[0].selectedSources, ['danbooru', 'rule34']);
  assert.deepEqual(result.recent, [supported]);
  assert.deepEqual(result.searchHistory, ['latex']);
  assert.deepEqual(result.session.tabPreferences, { artworkTabs: 'new' });
  assert.equal(input.session.tabs.length, 6);
});

test('the catalog exposes four supported sources including Sankaku', () => {
  assert.deepEqual(CatalogLogic.supportedSources, ['danbooru', 'gelbooru', 'rule34', 'sankaku']);
});

test('obsolete bookmarks cannot seed recommendations or author profiles', () => {
  const obsolete = { key: 'retired:1', source: 'retired', creatorId: 'someone',
    title: 'Old work', tags: ['latex', 'catsuit'], rating: 'g' };
  assert.equal(CatalogLogic.creatorProfileRef(obsolete), null);
  assert.deepEqual(CatalogLogic.filterCatalogItems([obsolete]), []);
});

test('supported works keep their character names, creator profiles and media', () => {
  const items = ['danbooru', 'gelbooru', 'rule34'].map(source => ({
    key: source + ':1', id: '1', source, title: 'Character', creatorTag: 'real_artist',
    creatorName: 'Real Artist', characterTags: ['character'], tags: ['character'],
    images: ['https://example.test/video.webm'], rating: 'q' }));
  assert.deepEqual(CatalogLogic.filterCatalogItems(items), items);
  for (const item of items) {
    assert.equal(CatalogLogic.creatorProfileRef(item).artist, 'real_artist');
    assert.equal(CatalogLogic.videoMimeType(item.images[0]), 'video/webm');
  }
});

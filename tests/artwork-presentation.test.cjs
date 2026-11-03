'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), Logic = require('../wwwroot/catalog-logic.js');
const Navigation = require('../wwwroot/artwork-navigation.js');
const app = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
function fixture(snapshot) {
  const context = vm.createContext({ CatalogLogic: Logic, detailImageDeduper: { unique: values => values } });
  const start = app.indexOf('function artworkRouteMedia(');
  if (start >= 0) vm.runInContext(app.slice(start, app.indexOf('\nfunction artworkSourceHasMore(', start)), context);
  vm.runInContext(app.slice(app.indexOf('function galleryImages('), app.indexOf('\nfunction syncGalleryImageCounts(')), context);
  vm.runInContext(app.slice(app.indexOf('function quickPreviewArtworkAt('), app.indexOf('\nfunction quickPreviewFitSize(')), context);
  const route = { presentation: new Map() };
  for (const item of snapshot) for (const key of [item.key, ...(item.memberKeys || [])]) route.presentation.set(key, item);
  return { context, route, media(item, selected) {
    assert.equal(typeof context.artworkRouteMedia, 'function', 'the route must share one original-media presentation helper');
    return context.artworkRouteMedia(route, item, selected);
  } };
}
const old = { key: 'gelbooru:1', source: 'gelbooru', id: '1', title: 'Original slot',
  thumbnail: 'https://example.test/thumb-old.jpg', images: ['https://example.test/old.jpg', 'https://example.test/page-2.jpg'],
  imageRecords: [{ url: 'https://example.test/old.jpg', hash: 'a'.repeat(32), owner: 'gelbooru:1' },
    { url: 'https://example.test/page-2.jpg', hash: 'b'.repeat(32), owner: 'gelbooru:1' }] };
function enriched() {
  return { key: 'danbooru:9', source: 'danbooru', id: '9', title: 'Enriched metadata', creatorName: 'New creator',
    thumbnail: 'https://example.test/thumb-new.jpg', memberKeys: ['danbooru:9', old.key],
    images: ['https://example.test/new.jpg', ...old.images],
    imageRecords: [{ url: 'https://example.test/new.jpg', hash: 'c'.repeat(32), owner: 'danbooru:9' }, ...old.imageRecords],
    groupMembers: [{ key: 'danbooru:9', thumbnail: 'https://example.test/thumb-new.jpg', images: ['https://example.test/new.jpg'] }, old] };
}

test('a late preferred source preserves the displayed slot gallery order and appends all new original media', () => {
  const f = fixture([old]), incoming = enriched(), before = plain(incoming);
  assert.deepEqual(plain(f.context.galleryImages(incoming, f.route)), [...old.images, incoming.images[0]]);
  const shown = f.media(incoming);
  assert.equal(shown.preview, old.images[0]); assert.equal(shown.thumbnail, old.thumbnail);
  assert.deepEqual(plain(incoming), before, 'presentation must retain all current members, metadata and originals without rewriting the work');
});

test('matching known file hashes uses a currently owned replacement URL rather than an old provider file', () => {
  const f = fixture([old]), incoming = enriched();
  incoming.images = ['https://example.test/new.jpg', 'https://another.test/renewed-original.jpg', old.images[1]];
  incoming.imageRecords = [incoming.imageRecords[0], { url: incoming.images[1], hash: 'a'.repeat(32) }, old.imageRecords[1]];
  assert.deepEqual(plain(f.context.galleryImages(incoming, f.route)), [incoming.images[1], old.images[1], incoming.images[0]]);
  assert.equal(f.media(incoming).preview, incoming.images[1]);
});

test('a repaired group cannot reintroduce a removed version or its thumbnail', () => {
  const f = fixture([old]), incoming = { ...enriched(), memberKeys: ['danbooru:9', old.key],
    images: ['https://example.test/new.jpg'], imageRecords: [{ url: 'https://example.test/new.jpg', hash: 'c'.repeat(32) }],
    groupMembers: [{ key: 'danbooru:9', thumbnail: 'https://example.test/thumb-new.jpg', images: ['https://example.test/new.jpg'] }] };
  assert.deepEqual(plain(f.context.galleryImages(incoming, f.route)), incoming.images);
  assert.equal(f.media(incoming).preview, incoming.images[0]);
  assert.equal(f.media(incoming).thumbnail, incoming.thumbnail);
});

test('a renewed signature replaces the old URL even when both remain in the owned image array', () => {
  const stale = 'https://s.sankakucomplex.com/data/neutral.jpg?e=1&m=old', fresh = stale.replace('e=1&m=old', 'e=4102444800&m=fresh');
  const original = { ...old, images: [stale], imageRecords: [{ url: stale, hash: 'a'.repeat(32) }] };
  const f = fixture([original]), incoming = { ...original, images: [stale, fresh], imageRecords: [{ url: stale, hash: 'a'.repeat(32) }, { url: fresh, hash: 'a'.repeat(32) }] };
  assert.deepEqual(plain(f.context.galleryImages(incoming, f.route)), [fresh]); assert.equal(f.media(incoming).preview, fresh);
});

test('an unrelated current first thumbnail is never used while preparing a retained older version', () => {
  const f = fixture([old]), incoming = enriched(); delete incoming.groupMembers;
  const shown = f.media(incoming);
  assert.equal(shown.preview, old.images[0]);
  assert.equal(shown.thumbnail, old.images[0], 'use its original when its old thumbnail is no longer explicitly owned');
});

test('explicit fullscreen selection of a second gallery page stays on that original', () => {
  const f = fixture([old]), incoming = enriched();
  assert.equal(f.media(incoming, old.images[1]).preview, old.images[1]);
  assert.equal(f.media(incoming, old.images[1]).thumbnail, old.images[1]);
});

test('new and repaired work slots capture their own media without borrowing another alias group', () => {
  const f = fixture([old]), incoming = { ...enriched(), key: 'danbooru:20', memberKeys: ['danbooru:20'] };
  assert.deepEqual(plain(f.context.galleryImages(incoming, f.route)), incoming.images);
  assert.equal(f.media(incoming).preview, incoming.images[0]);
});

test('Space resolves the still-displayed card snapshot even when the item index already has newer media', () => {
  const f = fixture([old]), incoming = { ...old, ...enriched(), key: old.key };
  const image = { dataset: { imageUrl: old.thumbnail } }, opener = { dataset: { key: old.key }, querySelector: () => image };
  const choice = f.context.quickPreviewArtworkAt({ closest: () => opener }, { kind: 'recommendations', artworkLists: new Map([['recommendations', [old]]]) }, new Map([[old.key, incoming]]));
  assert.equal(choice.url, old.images[0]); assert.equal(choice.item, incoming, 'the selected work keeps fresh metadata');
});

test('a retained original does not hide an appended video or reorder the user-selected gallery', () => {
  const f = fixture([old]), incoming = enriched(); incoming.images.push('https://example.test/new.webm');
  assert.deepEqual(plain(f.context.galleryImages(incoming, f.route)), [...old.images, incoming.images[0], incoming.images.at(-1)]);
  assert.equal(f.media(incoming).preview, old.images[0]);
});

test('Home, Related and author-strip routes capture the actual rendered slots rather than a newer source pool', () => {
  for (const kind of ['home', 'related', 'creator']) {
    const incoming = enriched(), other = { key: 'gelbooru:20', source: 'gelbooru', images: ['https://example.test/20.jpg'] };
    const source = { id: 1, kind: kind === 'home' ? 'home' : 'detail', rating: 'all', item: other,
      items: [incoming, other], related: [incoming, other], creatorCandidates: [incoming, other],
      artworkLists: new Map(kind === 'home' ? [['home', [old]], ['home-rest', [other]]] :
        [[kind === 'creator' ? 'creator' : 'related', [old, other]]]) };
    const context = vm.createContext({ CatalogLogic: Logic, DartArtworkNavigation: Navigation, structuredClone,
      nextArtworkSourceId: -1, artworkRoutes: new Set(), favoriteGroupFor: () => null, contentPreferences: {},
      filterFeedWorks: items => items, selectCreatorWorks: () => [incoming, other], defaultSources: [],
      ratingFilterFor: () => 'all', findTab: () => source });
    vm.runInContext(app.slice(app.indexOf('function artworkSourceSignature('), app.indexOf('\nfunction pruneArtworkRoutes(')), context);
    const origin = { closest: selector => kind === 'creator' && selector === '.author-strip' ? {} : null };
    const route = context.createArtworkRoute(source, incoming, origin);
    assert.equal(route.presentation.get(old.key), old, kind + ' must retain the actual displayed item reference');
    assert.deepEqual(plain(route.engine.items.map(item => item.key)), [old.key, other.key], kind + ' keeps visible order without inserting a canonical alias twice');
  }
});

test('the first detail image uses the same retained version thumbnail as Space before the original is ready', () => {
  const f = fixture([old]), incoming = enriched();
  Object.assign(f.context, { imageLoader: { cached: url => ({ [old.thumbnail]: { blobUrl: 'blob:old-thumb' },
    [incoming.thumbnail]: { blobUrl: 'blob:wrong-new-thumb' } })[url] }, longDetailImageSize: () => null,
    escapeHtml: value => String(value || ''), viewerPreferences: {} });
  vm.runInContext(app.slice(app.indexOf('function renderDetailImage('), app.indexOf('\nfunction longDetailImageSize(')), f.context);
  const html = f.context.renderDetailImage(incoming, old.images[0], 0, f.route);
  assert.match(html, /data-preview-url="https:\/\/example.test\/thumb-old.jpg"/);
  assert.match(html, /src="blob:old-thumb"/); assert.doesNotMatch(html, /wrong-new-thumb/);
});

test('a full 100-image gallery normalizes file identities in bounded work while retaining display order', () => {
  const images = Array.from({ length: 100 }, (_, index) => `https://example.test/gallery-${index}.jpg`);
  const original = { ...old, images, imageRecords: [] }, f = fixture([original]);
  let normalizations = 0;
  f.context.CatalogLogic = { ...Logic, mediaCacheKey(url) { normalizations++; return Logic.mediaCacheKey(url); } };
  const incoming = { ...original, images: [...images].reverse() };
  assert.deepEqual(plain(f.context.galleryImages(incoming, f.route)), images);
  assert(normalizations <= images.length * 8,
    `100-image route presentation performed ${normalizations} URL normalizations`);
});

test('late evidence merging two rendered slots preserves the earlier slot even when the later source becomes canonical', () => {
  const later = { key: 'danbooru:9', source: 'danbooru', id: '9', thumbnail: 'https://example.test/later-thumb.jpg',
    images: ['https://example.test/later.jpg'] };
  const f = fixture([old, later]), joined = Logic.groupWorks([{ ...old, groupKey: 'gelbooru:parent:1' },
    { ...later, groupKey: 'gelbooru:parent:1' }])[0];
  const engine = Navigation.create({ items: [old, later], current: old, same: Logic.sameWork, merge: Logic.mergeGroupedWorks });
  engine.update(joined);
  assert.equal(engine.items.length, 1); assert.equal(engine.state.index, 0);
  assert.equal(engine.items[0].key, later.key, 'grouping really chose the later Danbooru member');
  assert.deepEqual(plain(f.context.galleryImages(engine.items[0], f.route)), [...old.images, ...later.images]);
  assert.equal(f.media(engine.items[0]).preview, old.images[0]);
});

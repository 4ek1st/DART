const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const CatalogLogic = require('../wwwroot/catalog-logic.js');

const source = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
const start = source.indexOf('function quickPreviewShortcutAllowed(');
const end = source.indexOf('\nfunction openQuickPreview(', start);
assert(start >= 0 && end > start, 'quick preview shortcut and artwork helpers are missing');
const context = vm.createContext({ CatalogLogic });
vm.runInContext(source.slice(start, end), context);

test('Space opens the hovered artwork after clicking a filter without stealing typing', () => {
  const space = { code: 'Space', key: ' ', repeat: false };
  const focus = tag => ({ closest: selector => tag && selector.includes(tag) ? { tagName: tag.toUpperCase() } : null });
  assert.equal(context.quickPreviewShortcutAllowed(space, focus(null)), true);
  assert.equal(context.quickPreviewShortcutAllowed(space, focus('input')), false);
  assert.equal(context.quickPreviewShortcutAllowed(space, focus('button')), true);
  assert.equal(context.quickPreviewShortcutAllowed(space, { closest: () => null, isContentEditable: true }), false);
  assert.equal(context.quickPreviewShortcutAllowed({ ...space, repeat: true }, focus(null)), false);
  assert.equal(context.quickPreviewShortcutAllowed({ ...space, ctrlKey: true }, focus(null)), false);
});

test('hovered card opens its image, while its save button and empty cards do not', () => {
  const item = { key: 'danbooru:12', thumbnail: 'https://example.test/thumb.jpg',
    images: ['https://example.test/full.jpg'] };
  const image = { dataset: { imageUrl: item.thumbnail }, currentSrc: 'blob:thumbnail' };
  const opener = { dataset: { key: item.key }, querySelector: () => image };
  const hovered = { closest: selector => selector.startsWith('button.card-art') ? opener : null,
    matches: () => false };
  const choice = context.quickPreviewArtworkAt(hovered, { kind: 'search' }, new Map([[item.key, item]]));
  assert.equal(choice.item, item);
  assert.equal(choice.url, item.images[0]);
  assert.equal(choice.image, image);
  assert.equal(context.quickPreviewArtworkAt({ closest: () => null, matches: () => false },
    { kind: 'search' }, new Map([[item.key, item]])), null);
  opener.querySelector = () => null;
  assert.equal(context.quickPreviewArtworkAt(hovered, { kind: 'search' }, new Map([[item.key, item]])), null);
});

test('hovering a detail image opens that specific page; video cards use their still thumbnail', () => {
  const item = { key: 'rule34:7', thumbnail: 'https://example.test/still.jpg',
    images: ['https://example.test/movie.mp4'] };
  const cardImage = { dataset: { imageUrl: item.thumbnail } };
  const opener = { dataset: { key: item.key }, querySelector: () => cardImage };
  const hoveredCard = { closest: () => opener, matches: () => false };
  assert.equal(context.quickPreviewArtworkAt(hoveredCard, { kind: 'search' },
    new Map([[item.key, item]])).url, item.thumbnail);
  const detailImage = { dataset: { imageUrl: 'https://example.test/page-2.jpg' },
    matches: selector => selector === '.detail-image img[data-image-url]', closest: () => null };
  const choice = context.quickPreviewArtworkAt(detailImage, { kind: 'detail', item }, new Map());
  assert.equal(choice.url, detailImage.dataset.imageUrl);
  assert.equal(choice.item, item);
});

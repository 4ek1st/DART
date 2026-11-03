const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const app = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
const start = app.indexOf("document.addEventListener('keydown', event => {", app.indexOf('const shortcutFocus'));
const end = app.indexOf("document.addEventListener('keydown', event => {", start + 1);
assert(start >= 0 && end > start, 'Space keyboard handlers must exist');
const pointerStart = app.indexOf("document.addEventListener('pointermove', event => {");
const pointerEnd = app.indexOf('\nlet artworkLikeFeedback', pointerStart);
assert(pointerStart >= 0 && pointerEnd > pointerStart, 'Document pointer handlers must exist');

function fixture() {
  const handlers = {}, actions = [];
  const element = kind => ({ kind,
    matches: selector => kind === 'artwork' && selector.includes('button.card-art'),
    closest: selector => selector.split(',').some(part => part.trim() === kind) ? {} : null });
  const card = element('artwork'), otherCard = element('artwork'), button = element('button'), video = element('video');
  const doc = { activeElement: card, addEventListener: (type, callback) => { handlers[type] = callback; },
    querySelector: () => null, elementFromPoint: () => doc.pointerTarget };
  const context = vm.createContext({ document: doc, window: { addEventListener() {} },
    quickPreview: { open: false }, quickPreviewPointer: null, quickPreviewSpaceHeld: false,
    recommendationTagMenu: { hidden: true }, tabListPanel: { hidden: true }, tabContextMenu: { hidden: true },
    quickPreviewView: { scale: 1 }, currentTab: () => ({ kind: 'search' }), itemIndex: new Map(),
    quickPreviewArtworkAt: target => target === card || target === otherCard ?
      { item: { key: target === card ? 'danbooru:1' : 'gelbooru:2' }, url: 'https://fixture.test/1.png' } : null,
    main: { contains: () => true, addEventListener: (type, callback) => { handlers[type] = callback; } }, zoomQuickPreviewFromCenter() {},
    closeQuickPreview: () => { actions.push('close'); context.quickPreview.open = false; },
    openQuickPreview: (artwork, mode) => { context.openedKey = artwork.item.key; actions.push(mode || 'window'); context.quickPreview.open = true; } });
  vm.runInContext(app.slice(app.indexOf('function quickPreviewShortcutAllowed('),
    app.indexOf('\nfunction quickPreviewArtworkAt(')), context);
  vm.runInContext(app.slice(pointerStart, pointerEnd), context);
  vm.runInContext(app.slice(start, end), context);
  for (const type of ['pointermove', 'pointerleave', 'keydown', 'keyup'])
    assert.equal(typeof handlers[type], 'function', `The production ${type} handler must be registered`);
  const press = (type = 'keydown', target = doc.activeElement, extra = {}) => {
    doc.activeElement = target;
    const event = { code: 'Space', key: ' ', target, repeat: false,
      preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; }, ...extra };
    handlers[type](event);
    return event;
  };
  return { context, doc, card, otherCard, button, video, element, actions, press };
}

test('Space follows the current pointer artwork instead of the card focused by preview closing', () => {
  const f = fixture();
  f.context.quickPreviewPointer = { x: 200, y: 100 }; f.doc.pointerTarget = f.otherCard;
  assert.equal(f.press().prevented, true);
  assert.equal(f.context.openedKey, 'gelbooru:2');
});

test('a pointer over empty space cannot reopen or natively activate the stale focused card', () => {
  const f = fixture();
  f.context.quickPreviewPointer = { x: 200, y: 100 }; f.doc.pointerTarget = f.element('div');
  assert.equal(f.press().prevented, true);
  assert.deepEqual(f.actions, []);
});

test('Tab hands Space back to keyboard focus until another pointer movement', () => {
  const f = fixture();
  f.context.quickPreviewPointer = { x: 200, y: 100 }; f.doc.pointerTarget = f.otherCard;
  f.press('keydown', f.card, { key: 'Tab', code: 'Tab' });
  assert.equal(f.context.quickPreviewPointer, null);
  assert.equal(f.press().prevented, true);
  assert.equal(f.context.openedKey, 'danbooru:1');
});

test('moving into the surrounding interface cannot reactivate the old focused artwork', () => {
  const f = fixture();
  f.press('pointermove', f.card, { pointerType: 'mouse', clientX: 10, clientY: 80 });
  f.doc.pointerTarget = f.button;
  assert.equal(f.press().prevented, true);
  assert.deepEqual(f.actions, []);
});

test('mouse movement while the modal is open selects its current position after closing', () => {
  const f = fixture();
  f.context.quickPreview.open = true;
  f.press('pointermove', f.element('dialog'), { pointerType: 'mouse', clientX: 250, clientY: 150 });
  f.press('keydown', f.element('dialog'));
  f.press('keyup', f.card);
  f.doc.pointerTarget = f.otherCard;
  assert.equal(f.press('keydown', f.card).prevented, true);
  assert.equal(f.context.openedKey, 'gelbooru:2');
});

test('leaving the document retains mouse ownership rather than reviving old artwork focus', () => {
  const f = fixture();
  f.press('pointerleave', f.card, { pointerType: 'mouse', clientX: -20, clientY: -20 });
  f.doc.pointerTarget = null;
  assert.equal(f.press().prevented, true);
  assert.deepEqual(f.actions, []);
});

test('a focused artwork reopens its Space preview without requiring another pointer movement', () => {
  const f = fixture();
  assert.equal(f.press().prevented, true);
  assert.deepEqual(f.actions, ['window']);
});

test('a preview-owned Space closes once and consumes repeats and release after focus changes', () => {
  const f = fixture(); f.context.quickPreview.open = true;
  assert.equal(f.press('keydown', f.element('dialog')).prevented, true);
  assert.deepEqual(f.actions, ['close']);
  assert.equal(f.press('keydown', f.button, { repeat: true }).prevented, true);
  assert.equal(f.press('keyup', f.button).prevented, true);
  assert.deepEqual(f.actions, ['close']);
  assert.equal(f.press('keydown', f.button).prevented, undefined,
    'A fresh key cycle on an ordinary button retains its native action');
});

test('native video, editable fields and modal buttons retain their Space action', () => {
  for (const kind of ['video', 'input', 'textarea', 'select', 'button', '[contenteditable]', '[role="slider"]']) {
    const f = fixture(); f.context.quickPreview.open = true;
    assert.equal(f.press('keydown', f.element(kind)).prevented, undefined, kind);
    assert.deepEqual(f.actions, [], kind);
  }
});

test('ordinary buttons outside a preview and modified Space do not become preview shortcuts', () => {
  const f = fixture();
  assert.equal(f.press('keydown', f.button).prevented, undefined);
  assert.equal(f.press('keydown', f.card, { ctrlKey: true }).prevented, undefined);
  assert.deepEqual(f.actions, []);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const app = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
const start = app.indexOf("document.addEventListener('keydown', event => {", app.indexOf('const shortcutFocus'));
const end = app.indexOf("document.addEventListener('keydown', event => {", start + 1);

function fixture() {
  const handlers = {}, actions = [];
  const element = kind => ({ kind,
    matches: selector => kind === 'artwork' && selector.includes('button.card-art'),
    closest: selector => selector.split(',').some(part => part.trim() === kind) ? {} : null });
  const card = element('artwork'), button = element('button'), video = element('video');
  const doc = { activeElement: card, addEventListener: (type, callback) => { handlers[type] = callback; },
    querySelector: () => null };
  const context = vm.createContext({ document: doc, window: { addEventListener() {} },
    quickPreview: { open: false }, quickPreviewPointer: null, quickPreviewSpaceHeld: false,
    recommendationTagMenu: { hidden: true }, tabListPanel: { hidden: true }, tabContextMenu: { hidden: true },
    quickPreviewView: { scale: 1 }, currentTab: () => ({ kind: 'search' }), itemIndex: new Map(),
    quickPreviewArtworkAt: target => target === card ? { item: { key: 'danbooru:1' }, url: 'https://fixture.test/1.png' } : null,
    main: { contains: () => true }, zoomQuickPreviewFromCenter() {},
    closeQuickPreview: () => { actions.push('close'); context.quickPreview.open = false; },
    openQuickPreview: (_artwork, mode) => { actions.push(mode || 'window'); context.quickPreview.open = true; } });
  vm.runInContext(app.slice(app.indexOf('function quickPreviewShortcutAllowed('),
    app.indexOf('\nfunction quickPreviewArtworkAt(')), context);
  vm.runInContext(app.slice(start, end), context);
  const press = (type = 'keydown', target = doc.activeElement, extra = {}) => {
    doc.activeElement = target;
    const event = { code: 'Space', key: ' ', target, repeat: false,
      preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; }, ...extra };
    handlers[type]?.(event);
    return event;
  };
  return { context, card, button, video, element, actions, press };
}

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

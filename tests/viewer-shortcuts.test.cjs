const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Navigation = require('../wwwroot/artwork-navigation.js');
const app = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8').replace(/\r\n/g, '\n');
const start = app.indexOf("document.addEventListener('keydown', event => {\n  const tab = currentTab();\n  if (!quickPreview.open");
const end = app.indexOf('\n}, true);', start) + '\n}, true);'.length;
assert(start >= 0 && end > start, 'viewer keyboard handler must exist');

function fixture({ preview = false, focused = null, route = true, kind = 'detail' } = {}) {
  const calls = [], engine = { state: { busy: false } };
  const tab = { kind, item: { key: 'danbooru:detail' }, artworkRoute: route ? { engine } : null };
  const work = { key: 'rule34:preview' };
  const quickPreview = { open: preview, contains: element => element === focused };
  let handler;
  const context = { DartArtworkNavigation: Navigation, currentTab: () => tab, quickPreview,
    quickPreviewRoute: route ? { engine } : null, quickPreviewWork: work,
    tabListPanel: { hidden: true }, tabContextMenu: { hidden: true },
    recommendationTagMenu: { hidden: true }, popover: { hidden: true },
    document: { activeElement: focused, querySelector: () => preview ? quickPreview : null,
      addEventListener: (name, callback) => { handler = callback; } },
    toggleSavedWork: (item, collection) => { calls.push([item.key, collection]); },
    moveArtwork: direction => { calls.push(['move', direction]); } };
  vm.runInNewContext(app.slice(start, end), context);
  return { calls, context, engine, press(properties) {
    const event = { preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; }, ...properties };
    handler(event); return event;
  } };
}

test('B toggles only bookmarks for the active detail or Space-preview artwork', () => {
  for (const preview of [false, true]) {
    const f = fixture({ preview });
    const event = f.press({ code: 'KeyB', key: 'и' });
    assert.deepEqual(f.calls, [[preview ? 'rule34:preview' : 'danbooru:detail', 'bookmarks']]);
    assert.equal(event.prevented, true); assert.equal(event.stopped, true);
    f.press({ code: 'KeyB', repeat: true }); assert.equal(f.calls.length, 1);
  }
});

test('focused quick-preview video can browse both directions and save without closing', () => {
  const video = { tagName: 'VIDEO', closest: selector => selector.includes('video') ? {} : null };
  const f = fixture({ preview: true, focused: video });
  for (const properties of [{ key: 'ArrowRight' }, { code: 'KeyA' }, { code: 'KeyD' }, { key: 'ArrowLeft' }, { code: 'KeyB' }, { code: 'KeyF' }])
    assert.equal(f.press(properties).prevented, true);
  assert.deepEqual(f.calls, [['move', 1], ['move', -1], ['move', 1], ['move', -1],
    ['rule34:preview', 'bookmarks'], ['rule34:preview', 'likes']]);
  const space = f.press({ code: 'Space', key: ' ' });
  assert.equal(space.prevented, undefined, 'native video playback still owns Space');
  assert.equal(f.context.quickPreview.open, true);
});

test('preview menus, text entry, sliders and the regular focused player retain their controls', () => {
  const input = { tagName: 'INPUT', closest: selector => selector.includes('input') ? {} : null };
  const slider = { tagName: 'DIV', closest: selector => selector.includes('slider') ? {} : null };
  const video = { tagName: 'VIDEO', closest: selector => selector.includes('video') ? {} : null };
  for (const f of [fixture({ preview: true, focused: input }), fixture({ preview: true, focused: slider }), fixture({ focused: video })]) {
    f.press({ code: 'KeyB' }); f.press({ code: 'KeyD' });
    assert.deepEqual(f.calls, []);
  }
  const f = fixture({ preview: true }); f.context.tabContextMenu.hidden = false;
  f.press({ key: 'ArrowRight' }); f.press({ code: 'KeyB' });
  assert.deepEqual(f.calls, []);
});

test('held browsing waits while loading and viewer shortcuts do nothing on a closed grid', () => {
  const f = fixture(); f.engine.state.busy = true;
  f.press({ code: 'KeyD', repeat: true }); assert.deepEqual(f.calls, []);
  f.engine.state.busy = false; f.press({ code: 'KeyD', repeat: true });
  assert.deepEqual(f.calls, [['move', 1]]);
  const grid = fixture({ kind: 'search' });
  grid.press({ code: 'KeyB' }); grid.press({ code: 'KeyA' });
  assert.deepEqual(grid.calls, []);
});

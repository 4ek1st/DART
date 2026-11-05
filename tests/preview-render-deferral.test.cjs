const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('./helpers/viewer-vm.cjs');
const app = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
const block = (start, end) => app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start)));

function fixture() {
  const painted = [], media = [], focus = [];
  const tagTooltip = { visible: true, valid: true, reconciles: 0, hides: 0,
    hide() { this.visible = false; this.hides++; },
    reconcile() { this.reconciles++; if (!this.valid) this.hide(); } };
  const tab = { id: 1, kind: 'search', items: ['old'], scrollTop: 270 };
  const main = { dataset: { tabId: 'old' }, scrollTop: 270, innerHTML: 'old', querySelectorAll: () => [],
    getBoundingClientRect: () => ({ top: 0 }) };
  const preview = { open: true, contains: () => false, close() { this.open = false; }, replaceChildren() {} };
  const context = vm.createContext({ main, quickPreview: preview, quickPreviewRenderPending: false,
    tagPreviewController: { instance: tagTooltip },
    currentTab: () => tab, renderChrome() {}, renderSearch: current => { painted.push([...current.items]); return current.items.join(','); },
    renderHome: current => { painted.push([...current.items]); return current.items.join(','); },
    pauseDetailVideos() {}, imageLoader: { adopt() {}, mount: () => media.push('mount'), refresh: () => media.push('refresh') },
    nsfwFilterSelector: '[data-nsfw]', captureGridAnchor() {}, restoreGridAnchor() {}, measureVirtualGrids() {},
    autoFeed: { mount() {} }, reconcileChildren: (root, content) => { root.innerHTML = content.markup; },
    document: { createElement: () => ({ content: {}, set innerHTML(markup) { this.content.markup = markup; } }),
      getElementById: () => ({ focus: () => focus.push('main') }) },
    quickPreviewGeneration: 0, quickPreviewZoomTimer: null, quickPreviewDrag: { pointerId: 1 },
    quickPreviewRoute: null, quickPreviewWork: {}, stopQuickPreviewMedia() {}, clearTimeout });
  vm.runInContext(block('function render() {', '\nfunction workMemberKeys('), context);
  vm.runInContext(block('function closeQuickPreview(', '\nasync function toggleSavedWork('), context);
  return { context, tab, main, preview, painted, media, focus, tagTooltip };
}

test('background publications retain the visible feed and media while a preview owns interaction', () => {
  const f = fixture();
  f.tab.items = ['first']; f.context.render();
  f.tab.items = ['latest', 'new']; f.context.render();
  assert.equal(f.main.innerHTML, 'old');
  assert.deepEqual(f.painted, []);
  assert.deepEqual(f.media, []);
  assert.equal(f.tagTooltip.visible, true, 'Background publication preserves a tooltip whose anchor and scope remain valid');
  assert.equal(f.tagTooltip.reconciles, 2, 'Each publication validates the existing tooltip scope without dismissing it');
  assert.equal(f.tagTooltip.hides, 0);
  assert.equal(f.context.quickPreviewRenderPending, true);
  assert.deepEqual(f.tab.items, ['latest', 'new'], 'Publication state remains current while DOM work waits');
});

test('closing or cancelling a drag flushes the newest snapshot once and preserves scroll', () => {
  const f = fixture();
  f.tab.items = ['first']; f.context.render();
  f.tab.items = ['latest', 'new']; f.context.render();
  f.tagTooltip.valid = false;
  f.context.closeQuickPreview();
  assert.deepEqual(f.painted, [['latest', 'new']]);
  assert.equal(f.main.innerHTML, 'latest,new');
  assert.equal(f.main.scrollTop, 270);
  assert.equal(f.context.quickPreviewRenderPending, false);
  assert.equal(f.context.quickPreviewDrag, null);
  assert.equal(f.tagTooltip.visible, false, 'Flushing the latest page snapshot dismisses a tooltip whose scope became invalid');
  assert.equal(f.tagTooltip.reconciles, 3);
  assert.equal(f.tagTooltip.hides, 1);
  f.context.closeQuickPreview();
  assert.equal(f.painted.length, 1);
});

test('a deferred paint reads the current view instead of retaining a stale navigation callback', () => {
  const f = fixture();
  f.tab.items = ['superseded']; f.context.render();
  Object.assign(f.tab, { id: 2, kind: 'home', items: ['destination'], scrollTop: 0 });
  f.tagTooltip.valid = false;
  f.context.closeQuickPreview();
  assert.deepEqual(f.painted, [['destination']]);
  assert.equal(f.main.dataset.tabId, '2');
  assert.equal(f.main.scrollTop, 0);
  assert.equal(f.tagTooltip.reconciles, 2);
  assert.equal(f.tagTooltip.visible, false, 'A different current view invalidates the old tooltip scope');
});

test('closing an unchanged preview performs no feed render or media remount', () => {
  const f = fixture();
  f.context.closeQuickPreview();
  assert.deepEqual(f.painted, []);
  assert.deepEqual(f.media, []);
  assert.equal(f.tagTooltip.reconciles, 0, 'An unchanged close does not request a feed paint or tooltip reconciliation');
});

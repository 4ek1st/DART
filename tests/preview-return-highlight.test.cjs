'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('./helpers/viewer-vm.cjs');
const app = fs.readFileSync(process.env.DART_PREVIEW_RETURN_APP || require.resolve('../wwwroot/app.js'), 'utf8');
const block = (start, end) => app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start)));
const work = (id, extra = {}) => ({ key: 'danbooru:' + id, source: 'danbooru', id: String(id), ...extra });
function fixture({ virtual = false, size = 8, reduced = false } = {}) {
  const items = Array.from({ length: size }, (_, index) => work(index + 1));
  const preferences = {}, tab = { id: 1, kind: 'search', query: 'forest', rating: 'all',
    selectedSources: ['danbooru'], artworkGeneration: 1, artworkLists: new Map([['search', items]]),
    items, virtualState: virtual ? { search: { cols: 1, pitch: 100, startRow: 0, endRow: 12, visibleRows: 6, totalRows: size } } : {}, gridTops: { search: 0 } };
  let active = tab, clock = 1000, nextTimer = 0, renders = 0, suppressCards = false;
  const scrolls = [], focused = [], animations = [], timers = new Map(), frames = new Map(), nodes = new Map();
  const list = () => tab.artworkLists.get('search') || [];
  const rendered = () => list().filter((_, index) => !suppressCards && (!virtual ||
    index >= tab.virtualState.search.startRow && index < tab.virtualState.search.endRow)).map(card);
  const main = { dataset: { tabId: '1' }, scrollTop: 0, clientHeight: 600,
    getBoundingClientRect: () => ({ top: 100, bottom: 700, height: 600 }),
    querySelector: () => null,
    querySelectorAll(selector) { return selector === '[data-grid-key]' ? [wrapper] : selector === '.artwork-return-highlight'
      ? [...nodes.values()].filter(node => node.classes.has('artwork-return-highlight')) : rendered(); },
    scrollTo(options) { scrolls.push(options); this.scrollTop = options.top; } };
  const wrapper = { dataset: { gridKey: 'search' }, classList: { contains: name => virtual && name === 'virtual-grid' }, querySelectorAll: () => rendered() };
  function card(item) {
    if (nodes.has(item.key)) return nodes.get(item.key);
    const classes = new Set(), node = { classes, dataset: { workKey: item.key, workMembers: JSON.stringify(item.memberKeys || [item.key]) },
      classList: { add: value => classes.add(value), remove: value => classes.delete(value) },
      get isConnected() { return list().some(entry => entry.key === item.key); },
      getBoundingClientRect: () => ({ top: 100 + list().findIndex(entry => entry.key === item.key) * 100 - main.scrollTop, height: 80 }),
      querySelector: () => ({ focus: options => focused.push({ key: item.key, options }) }),
      animate(keyframes, options) { const value = { keyframes, options, canceled: false, cancel() { this.canceled = true; } }; animations.push(value); return value; } };
    nodes.set(item.key, node); return node;
  }
  const preview = { open: true, contains: () => false, close() { this.open = false; }, replaceChildren() {} };
  const context = vm.createContext({ main, quickPreview: preview, currentTab: () => active, contentPreferences: preferences,
    quickPreviewReturnFocus: { isConnected: true, focus: options => focused.push({ key: 'original', options }) },
    quickPreviewGeneration: 1, quickPreviewZoomTimer: null, quickPreviewDrag: null, quickPreviewRenderPending: false,
    quickPreviewWork: items[3] || items[0], quickPreviewRoute: null, stopQuickPreviewMedia() {},
    document: { getElementById: () => ({ focus: options => focused.push({ key: 'main', options }) }) },
    workMemberKeys: node => JSON.parse(node.dataset.workMembers),
    Date: { now: () => clock }, matchMedia: () => ({ matches: reduced }),
    setTimeout: (fn, ms) => { const id = ++nextTimer; timers.set(id, { fn, ms }); return id; }, clearTimeout: id => timers.delete(id),
    requestAnimationFrame: fn => { const id = ++nextTimer; frames.set(id, fn); return id; }, cancelAnimationFrame: id => frames.delete(id),
    render: () => { renders++; rendered(); } });
  vm.runInContext(block('function artworkSourceSignature(', '\nfunction copyArtworkSource('), context);
  vm.runInContext(block('function closeQuickPreview(', '\nasync function toggleSavedWork('), context);
  const origin = { source: tab, signature: context.artworkSourceSignature(tab), generation: 1,
    detailKey: '', preferences, gridKey: 'search', groupId: '' };
  const route = context.quickPreviewRoute = { returnOrigin: origin, engine: { cancel() {} }, navigationController: new AbortController(), warmController: new AbortController() };
  return { context, tab, items, route, main, nodes, scrolls, focused, animations, timers, frames, preview, origin,
    card, close: () => context.closeQuickPreview(), renders: () => renders,
    suppress: value => { suppressCards = value; }, activate: value => { active = value; },
    advance: value => { clock += value; }, flushTimers: () => { for (const timer of [...timers.values()]) timer.fn(); },
    reopen(item) { preview.open = true; context.quickPreviewWork = item; context.quickPreviewRoute = route; } };
}

test('closing Space returns to the last actually displayed artwork and highlights it once for one second', () => {
  const f = fixture(); f.context.quickPreviewWork = f.items[6]; f.close();
  assert.equal(f.scrolls.length, 1); assert.equal(f.scrolls[0].behavior, 'instant'); assert(f.main.scrollTop > 0);
  assert.equal(f.focused.at(-1).key, f.items[6].key); assert.equal(f.focused.at(-1).options.preventScroll, true);
  assert(f.card(f.items[6]).classes.has('artwork-return-highlight')); assert.equal(f.animations.length, 1);
  assert.equal(f.animations[0].options.duration, 1000); assert.equal(f.timers.size, 1);
  assert.equal(f.context.quickPreviewReturnHighlighted(f.items[6], f.tab), true);
  f.advance(1000); f.flushTimers();
  assert(!f.card(f.items[6]).classes.has('artwork-return-highlight')); assert.equal(f.context.quickPreviewReturnHighlighted(f.items[6], f.tab), false);
});
test('a virtualized deep target is rendered from its existing publication before scrolling to it', () => {
  const f = fixture({ virtual: true, size: 600 }); f.context.quickPreviewWork = f.items[470]; f.close();
  assert.equal(f.renders(), 1); assert(f.tab.virtualState.search.startRow >= 466);
  assert.equal(f.focused.at(-1).key, f.items[470].key); assert(f.main.scrollTop > 45000);
  assert(f.card(f.items[470]).classes.has('artwork-return-highlight'));
});
test('a grouped source alias returns to its existing canonical card', () => {
  const f = fixture(), grouped = work(100, { memberKeys: ['danbooru:100', 'rule34:9'] });
  f.tab.artworkLists.set('search', [grouped]); f.context.quickPreviewWork = work(9, { key: 'rule34:9', source: 'rule34' }); f.close();
  assert.equal(f.focused.at(-1).key, grouped.key); assert(f.card(grouped).classes.has('artwork-return-highlight'));
});
test('removing a saved/hidden target never restores it from the viewer buffer', () => {
  const f = fixture(); const target = f.context.quickPreviewWork;
  f.tab.artworkLists.set('search', f.items.filter(item => item !== target)); f.close();
  assert.equal(f.scrolls.length, 0); assert.equal(f.timers.size, 0); assert.equal(f.renders(), 0);
});
for (const kind of ['tab', 'generation', 'query', 'preferences']) test(`a changed ${kind} prevents scrolling or highlighting an unrelated visit`, () => {
  const f = fixture();
  if (kind === 'tab') f.activate({ ...f.tab, id: 2 });
  if (kind === 'generation') f.tab.artworkGeneration++;
  if (kind === 'query') f.tab.query = 'new_search';
  if (kind === 'preferences') f.context.contentPreferences = { hideFurry: true };
  f.close(); assert.equal(f.scrolls.length, 0); assert.equal(f.timers.size, 0);
});
test('reduced motion keeps a static blue outline for the same one-second duration', () => {
  const f = fixture({ reduced: true }); f.close();
  assert.equal(f.animations.length, 0); assert.equal([...f.timers.values()][0].ms, 1000);
  assert(f.card(f.items[3]).classes.has('artwork-return-highlight'));
  f.advance(1000); f.flushTimers(); assert(!f.card(f.items[3]).classes.has('artwork-return-highlight'));
});
test('rapid close/reopen cancels the old effect and restarts a single owned highlight', () => {
  const f = fixture(); f.close(); const older = [...f.timers.values()][0];
  f.reopen(f.items[5]); f.close();
  assert.equal(f.timers.size, 1); assert.equal(f.animations[0].canceled, true);
  assert(!f.card(f.items[3]).classes.has('artwork-return-highlight')); assert(f.card(f.items[5]).classes.has('artwork-return-highlight'));
  older.fn(); assert(f.card(f.items[5]).classes.has('artwork-return-highlight'), 'a stale timeout cannot clear the newer highlight');
});
test('a deferred virtual render cannot jump after another tab or preview takes ownership', () => {
  const f = fixture({ virtual: true, size: 600 }); f.suppress(true); f.context.quickPreviewWork = f.items[400]; f.close();
  assert.equal(f.frames.size, 1); const callback = [...f.frames.values()][0]; const count = f.scrolls.length;
  f.activate({ id: 2 }); f.suppress(false); callback();
  assert.equal(f.scrolls.length, count); assert.equal(f.timers.size, 0);
});
test('route transfer into a detail view does not teleport the old underlying source', () => {
  const f = fixture(); f.context.closeQuickPreview(f.route); assert.equal(f.scrolls.length, 0); assert.equal(f.timers.size, 0);
});

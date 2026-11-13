const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
const block = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));

function fixture() {
  const events = {}, tabs = [{ id: 1, kind: 'search', query: 'forest', title: 'forest' }, { id: 2, kind: 'detail', title: 'Art' }];
  let value = '', writes = 0, tab = tabs[0];
  const input = { addEventListener: (name, handler) => { events[name] = handler; },
    get value() { return value; }, set value(next) { writes++; value = next; } };
  const context = vm.createContext({
    tabs, activeId: 1, currentTab: () => tab, searchInput: input, renderedTabsMarkup: '',
    escapeHtml: String, svg: () => '', tabHasCatalogTitle: () => false, alignTabStrip() {}, renderTabList() {},
    navigationTarget: () => -1, showPopover() {},
    document: { getElementById: () => ({ setAttribute() {} }), querySelectorAll: () => [] },
    tabsNode: { querySelector: () => null, getBoundingClientRect: () => ({ left: 0, right: 900 }) }
  });
  vm.runInContext(block('function renderChrome()', '\nfunction pauseDetailVideos()'), context);
  vm.runInContext(block("searchInput.addEventListener('input'", '\n// Mouse ownership'), context);
  return { context, tabs, input, writes: () => writes,
    render: () => vm.runInContext('renderChrome()', context),
    type(next) { value = next; events.input(); },
    select(next) { tab = next; context.activeId = next.id; } };
}

test('background publications retain unsent input without resetting the caret', () => {
  const f = fixture(); f.render();
  assert.equal(f.input.value, 'forest');
  f.type('new unfinished query'); const writes = f.writes();
  for (let i = 0; i < 10; i++) f.render();
  assert.equal(f.input.value, 'new unfinished query');
  assert.equal(f.writes(), writes, 'Even assigning the same input value may disturb composition/caret');
});

test('drafts follow their owning tab and expire when its committed query changes', () => {
  const f = fixture(); f.render(); f.type('forest draft');
  f.select(f.tabs[1]); f.render(); assert.equal(f.input.value, '');
  f.type('detail draft'); f.select(f.tabs[0]); f.render(); assert.equal(f.input.value, 'forest draft');
  f.tabs[0].query = 'watercolor'; f.render(); assert.equal(f.input.value, 'watercolor');
});

test('submitting normalizes and clears an existing target draft; background search leaves current input alone', () => {
  const f = fixture(), stored = new Map(); f.render(); f.type('draft');
  Object.assign(f.context, { CatalogLogic: { normalizeSearch: value => value.trim() },
    getSearchHistory: () => [], localStorage: { setItem: (key, value) => stored.set(key, value) }, hidePopover() {},
    createTab: () => f.tabs[0], openTemporaryTab: () => f.tabs[1] });
  vm.runInContext(block('function openSearch(', '\nfunction getSearchHistory('), f.context);
  vm.runInContext("openSearch(' forest ')", f.context); f.render();
  assert.equal(f.input.value, 'forest'); assert.equal(f.tabs[0].searchDraft, undefined);
  f.type('keep typing'); vm.runInContext("openSearch('other', {background:true})", f.context);
  assert.equal(f.input.value, 'keep typing');
});

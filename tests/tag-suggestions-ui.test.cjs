const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const CatalogLogic = require('../wwwroot/catalog-logic.js');
const source = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8').replace(/\r\n/g, '\n');

function fixture(history = []) {
  const input = { value: 'fixture_tag', focus() { document.activeElement = input; } };
  const popover = { hidden: true, children: [], _html: '',
    set innerHTML(value) { this._html = value; this.children = value.trim() ? [{}] : []; },
    get innerHTML() { return this._html; } };
  const events = {}, requests = [], timers = new Map(); let timerId = 0;
  const document = { activeElement: input,
    addEventListener(type, handler) { (events[type] ||= []).push(handler); },
    getElementById() { return { focus() {} }; } };
  const context = { CatalogLogic, AbortController, searchInput: input, popover, document,
    favoriteTags: [], getSearchHistory: () => history, escapeHtml: String,
    names: { rule34: 'Rule34', sankaku: 'Sankaku' },
    tabListPanel: { hidden: true }, tabContextMenu: { hidden: true },
    handleSelectedTagEnter: () => false, hideTabPanels() {},
    setTimeout(callback) { timers.set(++timerId, callback); return timerId; },
    clearTimeout(id) { timers.delete(id); },
    request(url, options) { return new Promise((resolve, reject) => requests.push({ url, options, resolve, reject })); } };
  const begin = source.indexOf('function activeTagTerm()');
  const end = source.indexOf("\npopover.addEventListener('click'", begin);
  const keyBegin = source.indexOf("document.addEventListener('keydown', event => {\n  if (event.key === 'Escape' && (!tabListPanel.hidden");
  const keyEnd = source.indexOf('\nfunction currentSearchOptions()', keyBegin);
  assert.ok(begin >= 0 && end > begin && keyBegin >= 0 && keyEnd > keyBegin);
  const controls = vm.runInNewContext(`let tagSuggestions = [], tagSuggestionTerm = '', tagSuggestionController, tagSuggestionTimer;\n` +
    source.slice(begin, end) + '\n' + source.slice(keyBegin, keyEnd) +
    '\n({ show: showPopover, hide: hidePopover })', context);
  return { input, popover, document, requests, events, ...controls,
    fire() { const [id, callback] = [...timers].at(-1); timers.delete(id); return callback(); },
    escape() { for (const callback of events.keydown || []) callback({ key: 'Escape', preventDefault() {} }); } };
}

const suggestion = name => [{ name, count: 42, sources: ['rule34', 'sankaku'] }];

test('a focused search shows delayed suggestions without matching history or favorites', async () => {
  const f = fixture(); f.show(); assert.equal(f.popover.hidden, true);
  const pending = f.fire(); f.requests[0].resolve(suggestion('fixture_tag')); await pending;
  assert.equal(f.popover.hidden, false);
  assert.match(f.popover.innerHTML, /data-tag="fixture_tag"/);
  assert.match(f.popover.innerHTML, /Rule34 · Sankaku/);
});

test('blur does not reopen the search popover when a delayed response arrives', async () => {
  const f = fixture(['fixture_tag']); f.show(); const pending = f.fire();
  f.document.activeElement = {}; f.popover.hidden = true;
  f.requests[0].resolve(suggestion('fixture_tag')); await pending;
  assert.equal(f.popover.hidden, true);
  assert.doesNotMatch(f.popover.innerHTML, /tag-suggestion/);
});

test('returning focus to the unchanged term shows suggestions received while blurred', async () => {
  const f = fixture(); f.show(); const pending = f.fire(); f.document.activeElement = {};
  f.requests[0].resolve(suggestion('fixture_tag')); await pending;
  assert.equal(f.popover.hidden, true);
  f.document.activeElement = f.input; f.show();
  assert.equal(f.popover.hidden, false);
  assert.match(f.popover.innerHTML, /data-tag="fixture_tag"/);
  assert.equal(f.requests.length, 1);
});

test('Escape cancels suggestions while an initially empty popover is still pending', async () => {
  const f = fixture(); f.show(); const pending = f.fire(); f.escape();
  f.requests[0].resolve(suggestion('fixture_tag')); await pending;
  assert.equal(f.requests[0].options.signal.aborted, true);
  assert.equal(f.popover.hidden, true);
});

test('Escape on another control does not focus an invisible abandoned search', () => {
  const f = fixture(); f.input.value = 'f'; f.show();
  const otherControl = {}; f.document.activeElement = otherControl; f.escape();
  assert.equal(f.document.activeElement, otherControl);
});

test('a stale response cannot replace the suggestions for a newer search term', async () => {
  const f = fixture(['fixture_tag', 'new_tag']); f.show(); const first = f.fire();
  f.input.value = 'new_tag'; f.show(); const second = f.fire();
  f.requests[1].resolve(suggestion('new_tag')); await second;
  f.requests[0].resolve(suggestion('fixture_tag')); await first;
  assert.match(f.popover.innerHTML, /data-tag="new_tag"/);
  assert.doesNotMatch(f.popover.innerHTML, /data-tag="fixture_tag"/);
});

test('a suggestion API failure preserves usable matching search history', async () => {
  const f = fixture(['fixture_tag']); f.show(); const pending = f.fire();
  f.requests[0].reject(new Error('Controlled provider failure')); await pending;
  assert.equal(f.popover.hidden, false);
  assert.match(f.popover.innerHTML, /data-query="fixture_tag"/);
  assert.doesNotMatch(f.popover.innerHTML, /tag-suggestion/);
});

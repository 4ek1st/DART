const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const CatalogLogic = require('../wwwroot/catalog-logic.js');

const source = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
const start = source.indexOf('function isHideableFeed(') >= 0
  ? source.indexOf('function isHideableFeed(')
  : source.indexOf('function filterFeedWorks(');
const end = source.indexOf('\nfunction emptyFeedMessage(', start);
assert(start >= 0 && end > start);

function fixture() {
  const item = { key: 'danbooru:visible', source: 'danbooru',
    contentHash: 'a'.repeat(32) };
  const other = { key: 'gelbooru:other', source: 'gelbooru' };
  const tab = { id: 1, kind: 'search', retainedFeedWorks: new Map() };
  const bounds = { top: 0, bottom: 500 };
  const rect = { top: 120, bottom: 380 };
  const card = { dataset: { workKey: item.key }, getBoundingClientRect: () => rect };
  const context = vm.createContext({
    CatalogLogic, Set, Map, contentPreferences: { hideViewedAndSaved: true },
    viewedTokens: new Set(), likes: [], bookmarks: [], itemIndex: new Map([[item.key, item]]),
    main: { clientHeight: 500, dataset: { tabId: '1' }, getBoundingClientRect: () => bounds,
      querySelectorAll: () => [card] }
  });
  vm.runInContext(source.slice(start, end), context);
  return { context, item, other, tab, rect, card };
}

test('opened visible work survives a feed rerender, then hides after leaving the loaded range', () => {
  const { context, item, other, tab, rect } = fixture();
  assert.equal(context.filterFeedWorks([item, other], tab).length, 2);
  context.retainFeedWork(tab, item);
  context.viewedTokens.add(`key:${item.key}`);
  assert.equal(context.filterFeedWorks([item, other], tab).length, 2);
  assert.equal(context.expireRetainedFeedWorks(tab), false);
  rect.top = -1900;
  rect.bottom = -1640;
  assert.equal(context.expireRetainedFeedWorks(tab), true);
  assert.equal(context.filterFeedWorks([item, other], tab).length, 1);
  assert.equal(context.filterFeedWorks([item, other], tab)[0].key, other.key);
});

test('saved visible group stays until unload, but its source copy is hidden afterwards', () => {
  const { context, item, tab, rect } = fixture();
  const group = { ...item, memberKeys: [item.key, 'gelbooru:copy'] };
  context.retainFeedWork(tab, item);
  context.bookmarks.push({ key: 'gelbooru:copy', source: 'gelbooru',
    contentHash: item.contentHash });
  assert.equal(context.filterFeedWorks([group], tab, true).length, 1);
  rect.top = 1700;
  rect.bottom = 1960;
  assert.equal(context.expireRetainedFeedWorks(tab), true);
  assert.equal(context.filterFeedWorks([group], tab, true).length, 0);
});

test('a work outside the viewport does not gain a display hold', () => {
  const { context, item, tab, rect } = fixture();
  rect.top = 900;
  rect.bottom = 1160;
  context.retainFeedWork(tab, item);
  context.viewedTokens.add(`key:${item.key}`);
  assert.equal(context.filterFeedWorks([item], tab).length, 0);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const CatalogLogic = require('../wwwroot/catalog-logic.js');

const source = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
const start = source.indexOf('function knownWorkTokens(') >= 0
  ? source.indexOf('function knownWorkTokens(')
  : source.indexOf('function filterFeedWorks(');
const end = source.indexOf('\nfunction emptyFeedMessage(', start);
assert(start >= 0 && end > start);

function fixture() {
  const item = { key: 'danbooru:visible', source: 'danbooru',
    contentHash: 'a'.repeat(32) };
  const other = { key: 'gelbooru:other', source: 'gelbooru' };
  const tab = { id: 1, kind: 'search', retainedFeedWorks: new Map() };
  const bounds = { top: 0, bottom: 500 };
  const rect = { top: 120, bottom: 380, height: 260 };
  const card = { dataset: { workKey: item.key }, classList: { contains: () => false },
    getBoundingClientRect: () => rect };
  const context = vm.createContext({
    CatalogLogic, Set, Map, contentPreferences: { hideViewedAndSaved: true },
    viewedTokens: new Set(), viewedPending: new Set(), recent: [], likes: [], bookmarks: [], itemIndex: new Map([[item.key, item]]),
    main: { clientHeight: 500, dataset: { tabId: '1' }, getBoundingClientRect: () => bounds,
      querySelectorAll: () => [card] }
  });
  vm.runInContext(source.slice(start, end), context);
  return { context, item, other, tab, rect, card };
}

test('opened visible work keeps its feed slot after unloading, without showing its image', () => {
  const { context, item, other, tab, rect } = fixture();
  assert.equal(context.filterFeedWorks([item, other], tab).length, 2);
  context.retainFeedWork(tab, item);
  context.viewedTokens.add(`key:${item.key}`);
  assert.equal(context.filterFeedWorks([item, other], tab).length, 2);
  assert.equal(context.expireRetainedFeedWorks(tab), false);
  rect.top = -1900;
  rect.bottom = -1640;
  assert.equal(context.expireRetainedFeedWorks(tab), true);
  assert.equal(context.filterFeedWorks([item, other], tab).length, 2);
  assert.equal(context.isExpiredFeedWork(tab, item), true);
  assert.equal(context.isExpiredFeedWork(tab, other), false);
});

test('saved visible group keeps its slot after unloading, including grouped source copies', () => {
  const { context, item, tab, rect } = fixture();
  const group = { ...item, memberKeys: [item.key, 'gelbooru:copy'] };
  context.retainFeedWork(tab, item);
  context.bookmarks.push({ key: 'gelbooru:copy', source: 'gelbooru',
    contentHash: item.contentHash });
  assert.equal(context.filterFeedWorks([group], tab, true).length, 1);
  rect.top = 1700;
  rect.bottom = 1960;
  assert.equal(context.expireRetainedFeedWorks(tab), true);
  assert.equal(context.filterFeedWorks([group], tab, true).length, 1);
  assert.equal(context.isExpiredFeedWork(tab, group), true);
});

test('a work outside the viewport does not gain a display hold', () => {
  const { context, item, tab, rect } = fixture();
  rect.top = 900;
  rect.bottom = 1160;
  context.retainFeedWork(tab, item);
  context.viewedTokens.add(`key:${item.key}`);
  assert.equal(context.filterFeedWorks([item], tab).length, 0);
});

test('a display hold belongs to its original card, not a later copy in another slot', () => {
  const { context, item, tab } = fixture();
  context.retainFeedWork(tab, item);
  context.viewedTokens.add(`hash:${item.contentHash}`);
  const copy = { ...item, key: 'rule34:late-copy', source: 'rule34' };
  assert.equal(context.isRetainedFeedWork(tab, copy), false);
  assert.deepEqual(Array.from(context.filterFeedWorks([item, copy], tab, true), x => x.key), [item.key]);
});

test('an unloaded card keeps one placeholder without granting a later copy another slot', () => {
  const { context, item, tab, rect } = fixture();
  context.retainFeedWork(tab, item);
  context.viewedTokens.add(`hash:${item.contentHash}`);
  rect.top = -1900; rect.bottom = -1640;
  context.expireRetainedFeedWorks(tab);
  const copy = { ...item, key: 'sankaku:late-copy', source: 'sankaku' };
  assert.equal(context.isExpiredFeedWork(tab, copy), false);
  const enriched = { ...item, key: copy.key, memberKeys: [item.key, copy.key] };
  assert.equal(context.isExpiredFeedWork(tab, enriched), true);
  assert.deepEqual(Array.from(context.filterFeedWorks([item, copy], tab, true), x => x.key), [item.key]);
});

'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), vm = require('node:vm'), fs = require('node:fs');
const Preview = require('../wwwroot/tag-preview.js'), Logic = require('../wwwroot/catalog-logic.js');
const app = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
const work = (id, more = {}) => ({ key: 'danbooru:' + id, source: 'danbooru', id: String(id),
  rating: 'g', tags: ['forest'], thumbnail: `https://example.test/${id}.jpg`, images: [`https://example.test/original-${id}.jpg`], ...more });
function fixture() {
  const tab = { kind: 'detail', item: work(1), selectedSources: ['danbooru'] };
  const context = vm.createContext({ DartTagPreview: Preview, CatalogLogic: Logic, DOMException, performance, setTimeout,
    currentTab: () => tab, artworkActionsController: () => ({ revision: 0, isHidden: item => !!item.hidden }),
    contentContextTarget: () => ({ tag: 'forest' }), quickPreview: { open: false }, quickPreviewWork: null,
    selectedRating: () => 'general', defaultSources: ['danbooru', 'rule34'], contentPreferences: {},
    follows: [], isFollowedArtistFeed: () => false, isFollowedArtistHidden: () => false,
    imageLoader: { cached: () => false }, recent: [], tabs: [tab], likes: [], bookmarks: [], itemIndex: new Map(),
    viewedTokens: new Set(), viewedPending: new Set(), tagPreviewHistory: async () => [] });
  const start = app.indexOf('function tagPreviewScope(');
  vm.runInContext(app.slice(start, app.indexOf('\nasync function tagPreviewHistory(', start)), context);
  const viewed = app.indexOf('async function tagPreviewViewed(');
  vm.runInContext(app.slice(viewed, app.indexOf('\nasync function loadTagPreviewImage(', viewed)), context);
  return { tab, context, scope: () => context.tagPreviewScope({}) };
}
test('detail and active quick viewer exclusions change the real hover cache scope without using background tabs', async () => {
  const f = fixture(), first = work(1), second = work(2);
  f.context.tabs.push({ kind: 'detail', item: second });
  let calls = 0;
  const resolver = Preview.createResolver({ search: async () => { calls++; return [first, second]; },
    allowed: (item, scope) => f.context.tagPreviewAllowed(item, scope) });
  const initial = f.scope();
  assert.equal((await resolver.resolve('forest', initial)).item.key, second.key, 'background detail must remain a valid example');
  f.tab.item = second;
  const changed = f.scope(); assert.notEqual(changed.key, initial.key);
  assert.equal((await resolver.resolve('forest', changed)).item.key, first.key);
  assert.equal(calls, 2, 'a new current work cannot reuse its own old cached thumbnail');
  f.context.quickPreview.open = true; f.context.quickPreviewWork = first;
  assert.equal(f.context.tagPreviewAllowed(first, f.scope()), false);
  assert.equal(f.context.tagPreviewAllowed(second, f.scope()), true);
  f.context.quickPreview.open = false; f.tab.kind = 'favorites';
  f.context.contentContextTarget = () => ({ tag: 'forest', item: second });
  assert.equal(f.scope().excluded.size, 0, 'a Favorites cover is not an opened artwork');
  assert.equal(f.context.tagPreviewAllowed(second, f.scope()), true);
});
test('the real viewed pool skips the current group and keeps multiple other seen examples for clarity ranking', async () => {
  const f = fixture(), version = work(2), single = work(4, { tags: ['forest', 'solo'], characterTags: ['forest'] });
  f.tab.item = { ...f.tab.item, memberKeys: ['danbooru:1', version.key], groupMembers: [f.tab.item, version] };
  f.context.recent = [f.tab.item, version, work(3, { characterTags: ['forest', 'other_character'] }), single];
  const items = await f.context.tagPreviewViewed('forest', f.scope(), new AbortController().signal);
  assert.deepEqual(Array.from(items, item => item.key), ['danbooru:3', single.key]);
  const resolver = Preview.createResolver({ getViewed: async () => items, search: async () => { throw Error('Unexpected search'); }, score: Preview.exampleScore });
  assert.equal((await resolver.resolve('forest', f.scope())).item.key, single.key);
});
test('loaded but unviewed artworks cannot masquerade as viewed; matching dated member metadata remains usable', async () => {
  const f = fixture(), unseen = work(8), seen = work(9), cover = work(10, { tags: ['rain'] });
  f.context.itemIndex.set(unseen.key, unseen); f.context.likes.push(unseen);
  f.context.tagPreviewHistory = async () => [{ ...cover, tags: ['rain', 'forest'], groupMembers: [cover, seen] }];
  const items = await f.context.tagPreviewViewed('forest', f.scope(), new AbortController().signal);
  assert.deepEqual(Array.from(items, item => item.key), [seen.key]);
});
test('a shared parent cannot promote a loaded different scene into the viewed tier', async () => {
  const f = fixture(), unseen = work(8, { groupKey: 'danbooru:parent:7', contentHash: 'b'.repeat(32) });
  f.context.itemIndex.set(unseen.key, unseen);
  f.context.viewedTokens.add('group:danbooru:parent:7');
  assert.deepEqual(Array.from(await f.context.tagPreviewViewed('forest', f.scope(), new AbortController().signal)), []);
  f.context.viewedTokens.add('hash:' + unseen.contentHash);
  assert.deepEqual(Array.from(await f.context.tagPreviewViewed('forest', f.scope(), new AbortController().signal), item => item.key), [unseen.key]);
});
test('physical mirrors cannot fill the candidate limit and displace a clearer different viewed work', async () => {
  const f = fixture(), copies = Array.from({ length: 60 }, (_, index) => work(100 + index,
    { contentHash: 'a'.repeat(32), characterTags: ['forest', 'other_character'] }));
  const single = work(200, { tags: ['forest', 'solo'], characterTags: ['forest'], contentHash: 'b'.repeat(32) });
  f.context.recent = [{ ...copies[0], groupMembers: copies }, single];
  const items = await f.context.tagPreviewViewed('forest', f.scope(), new AbortController().signal);
  assert.equal(items.length, 2); assert.equal(items[1].key, single.key);
  const resolver = Preview.createResolver({ getViewed: async () => items, score: Preview.exampleScore,
    search: async () => { throw Error('Unexpected search'); } });
  assert.equal((await resolver.resolve('forest', f.scope())).item.key, single.key);
});
test('a large known-library scan yields and honours cancellation before starting an optional history request', async () => {
  const f = fixture(), controller = new AbortController(); let ticks = 0, histories = 0;
  f.context.likes = Array.from({ length: 500 }, (_, index) => work(100 + index, { tags: ['rain'] }));
  f.context.performance = { now: () => ++ticks * 2 };
  f.context.setTimeout = callback => { controller.abort(); setTimeout(callback, 0); };
  f.context.tagPreviewHistory = async () => { histories++; return []; };
  await assert.rejects(f.context.tagPreviewViewed('forest', f.scope(), controller.signal), { name: 'AbortError' });
  assert.equal(histories, 0);
});

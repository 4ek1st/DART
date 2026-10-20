const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const CatalogLogic = require('../wwwroot/catalog-logic.js');
const source = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));

function fixture({ count = 1, save = async () => ({}) } = {}) {
  let now = 1000, timerId = 0, remembered = 0;
  const timers = new Map(), posts = [], renders = [];
  const follows = Array.from({ length: count }, (_, index) => ({
    key: `gelbooru::${index}`, source: 'gelbooru', service: '', artistId: String(index),
    name: `Artist ${index}`, followedAt: '2024-01-01T00:00:00Z'
  }));
  const groups = follows.map((follow, index) => ({ follow, items: [{
    key: `gelbooru:${index}`, source: 'gelbooru', title: 'Artwork', rating: 'g',
    tags: ['sample_tag'], images: [`https://example.org/${index}.jpg`],
    published: '2025-01-01T00:00:00Z'
  }] }));
  const tab = { id: 1, kind: 'follows', rating: 'all', followVersion: 1,
    followUpdateRevision: 1, followGroups: groups, followStreams: [], items: [],
    newKeys: new Set(), loading: true, followErrors: [], followSourceNotices: {} };
  const context = vm.createContext({
    CatalogLogic, AbortController, URLSearchParams,
    Date: class extends Date { static now() { return now; } },
    setTimeout: (callback, delay) => { timers.set(++timerId, { callback, delay }); return timerId; },
    clearTimeout: id => timers.delete(id),
    follows, followedKeys: new Set(), contentPreferences: { excludedTags: [] }, activeId: 1,
    settings: {}, findTab: id => id === tab.id ? tab : null,
    refreshFollows: async () => true,
    rememberItems() { remembered++; },
    render() { renders.push({ loading: tab.loading, revision: tab.followUpdateRevision,
      keys: tab.items.map(item => item.key), hasMore: tab.hasMore }); },
    request: async (url, options = {}) => {
      if (url.startsWith('/api/follows/cache?')) {
        if (options.method !== 'POST') return { groups: [] };
        const post = { rating: new URL(url, 'http://fixture').searchParams.get('rating'),
          body: options.body };
        posts.push(post);
        return save(post, posts.length);
      }
      if (url === '/api/follows/seen') return follows;
      const artist = new URL(url, 'http://fixture').searchParams.get('artist');
      return { items: groups.find(group => group.follow.artistId === artist)?.items || [], hasMore: false };
    }
  });
  const start = source.indexOf('function decorateFollowItems(');
  const end = source.indexOf('\nasync function loadBookmarks(', start);
  assert.ok(start >= 0 && end > start);
  vm.runInContext(source.slice(start, end), context);
  return { context, tab, groups, posts, renders, timers,
    flush: () => context.flushFollowUpdate(tab),
    save: () => context.saveFollowPreview(tab, tab.followVersion),
    advance: milliseconds => { now += milliseconds; },
    get remembered() { return remembered; } };
}

test('an identical follow publication does not refilter or render the final feed twice', async () => {
  const f = fixture();
  await f.flush();
  await f.flush();
  assert.equal(f.renders.length, 1, 'The regular-worker and final flush should publish one unchanged result');
  assert.equal(f.remembered, 1, 'An already published computation should avoid repeated filter/remember work');
});

test('same-revision follow metadata, cursors, and retry readiness still publish changes', async () => {
  const f = fixture();
  const stream = { follow: f.groups[0].follow, source: 'gelbooru', group: f.groups[0],
    buffer: [], nextPage: 1, retryAt: 1100, error: 'Temporarily unavailable' };
  f.tab.followStreams = [stream];
  await f.flush();
  assert.equal(f.tab.hasMore, false);

  f.advance(101);
  await f.flush();
  assert.equal(f.tab.hasMore, true, 'Crossing the retry deadline must refresh continuation eligibility');
  assert.equal(f.renders.length, 2);

  stream.error = 'Source needs sign-in';
  await f.flush();
  assert.equal(f.tab.followSourceErrors.gelbooru, 'Source needs sign-in');
  assert.equal(f.renders.length, 3);

  f.tab.followSourceNotices.sankaku = 'Some works need sign-in';
  await f.flush();
  assert.equal(f.renders.length, 4, 'A source notice can change without new artwork');

  stream.nextPage = 2;
  await f.flush();
  assert.equal(f.renders.length, 5, 'Changed stream cursors must not reuse an older publication');
  await f.flush();
  assert.equal(f.renders.length, 5, 'Unchanged metadata remains coalesced');
});

test('changed content filters invalidate an otherwise identical follow publication', async () => {
  const f = fixture();
  await f.flush();
  assert.equal(f.tab.items.length, 1);
  f.context.contentPreferences.excludedTags.push('sample_tag');
  await f.flush();
  assert.equal(f.tab.items.length, 0, 'Preferences must be applied even without a new source revision');
  assert.equal(f.renders.length, 2);
  await f.flush();
  assert.equal(f.renders.length, 2);

  f.tab.followVersion++;
  await f.flush();
  assert.equal(f.renders.length, 3, 'A new loading generation must publish independently');
  f.tab.followUpdateRevision++;
  await f.flush();
  assert.equal(f.renders.length, 4, 'A new source revision must publish independently');
});

test('follow completion publishes each final result once and still clears loading', async () => {
  const f = fixture({ count: 20 });
  f.tab.items = [];
  f.tab.followGroups = [];
  await f.context.loadFollowFeed(f.tab);
  await f.tab.followCacheSaveTail;
  const complete = f.renders.filter(render => render.loading && render.keys.length === 20);
  assert.equal(complete.length, 1, 'Ready regular sources should not be published again by the unchanged final flush');
  assert.equal(f.posts.length, 1, 'The unchanged final preview should only be written once');
  assert.equal(f.renders.at(-1).loading, false, 'Completion must still remove the loading status');
  assert.equal(f.tab.items.length, 20);
});

test('identical pending and successful follow previews share one cache write', async () => {
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const f = fixture({ save: () => pending });
  f.save();
  f.save();
  await settle();
  assert.equal(f.posts.length, 1);
  finish({});
  await f.tab.followCacheSaveTail;
  f.save();
  await f.tab.followCacheSaveTail;
  assert.equal(f.posts.length, 1, 'The same completed preview must not be posted again');
});

test('a failed follow preview write can retry the same body', async () => {
  const f = fixture({ save: async (_, attempt) => {
    if (attempt === 1) throw new Error('Temporary failure');
    return {};
  } });
  f.save();
  await f.tab.followCacheSaveTail;
  f.save();
  await f.tab.followCacheSaveTail;
  assert.equal(f.posts.length, 2, 'Only successful or pending writes may suppress an identical body');
  assert.equal(f.posts[0].body, f.posts[1].body);
});

test('preview deduplication is independent per rating and changes when the body changes', async () => {
  const f = fixture();
  f.save();
  await f.tab.followCacheSaveTail;
  f.tab.rating = 'general';
  f.save();
  await f.tab.followCacheSaveTail;
  f.tab.rating = 'all';
  f.save();
  await f.tab.followCacheSaveTail;
  assert.deepEqual(f.posts.map(post => post.rating), ['all', 'general']);
  f.groups[0].items[0].title = 'Updated artwork';
  f.save();
  await f.tab.followCacheSaveTail;
  assert.equal(f.posts.length, 3);
  assert.notEqual(f.posts[0].body, f.posts[2].body);
});

test('a queued changed preview is followed by a requested return to the older body', async () => {
  let finish;
  const changed = new Promise(resolve => { finish = resolve; });
  const f = fixture({ save: (_, attempt) => attempt === 2 ? changed : {} });
  f.save();
  await f.tab.followCacheSaveTail;
  const originalBody = f.posts[0].body;
  f.groups[0].items[0].title = 'Intermediate artwork';
  f.save();
  f.groups[0].items[0].title = 'Artwork';
  f.save();
  await settle();
  finish({});
  await f.tab.followCacheSaveTail;
  assert.equal(f.posts.length, 3, 'A past success cannot suppress a write queued after a different body');
  assert.equal(f.posts[2].body, originalBody, 'The newest requested preview must be the final stored state');
});

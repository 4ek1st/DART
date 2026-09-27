const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const logic = require('../wwwroot/catalog-logic.js');

test('Sankaku artwork, session tabs and signed videos remain supported', () => {
  const item = { key: 'sankaku:AbC123', source: 'sankaku', id: 'AbC123', tags: ['landscape'] };
  const state = logic.cleanClientState({ recent: [item], session: { activeIndex: 0,
    tabs: [{ kind: 'detail', item, pinned: true }] } });
  assert.equal(state.recent[0], item);
  assert.equal(state.session.tabs[0].item, item);
  assert.equal(logic.videoMimeType('https://v.sankakucomplex.com/a.webm?e=123&m=sig'), 'video/webm');
});

test('Sankaku uploader stays separate from the confirmed artist', () => {
  const item = { source: 'sankaku', creatorTag: 'real_artist', creatorName: 'Real Artist',
    uploaderId: 'uploader', uploaderName: 'Upload User' };
  const attribution = logic.workAttribution(item);
  assert.equal(attribution.creator.follow.artistId, 'real_artist');
  assert.equal(attribution.uploader.name, 'Upload User');
  assert.equal(attribution.uploader.action, 'uploader-profile');
  assert.equal(logic.creatorProfileRef(item).source, 'artist');
});

test('signed URL refresh replaces the expired version and preserves other grouped pages', () => {
  const old = 'https://s.sankakucomplex.com/a.jpg?e=1&m=old';
  const fresh = 'https://s.sankakucomplex.com/a.jpg?e=2&m=new';
  const second = 'https://s.sankakucomplex.com/b.jpg?e=2&m=other';
  const item = { key: 'sankaku:123', source: 'sankaku', images: [old, second],
    imageRecords: [{ url: old, hash: 'a' }, { url: second, hash: 'b' }],
    memberKeys: ['sankaku:123', 'sankaku:124'] };
  const merged = logic.mergeDetailPages(item, { key: item.key, source: item.source, images: [fresh] });
  assert.deepEqual(merged.images, [fresh, second]);
  assert.equal(merged.imageRecords[0].url, fresh);
});

test('Sankaku joins the same artist follow without a duplicate subscription', () => {
  const requests = logic.followFeedRequests({ source: 'danbooru', artistId: 'real_artist' },
    'all', true, true, 3, true);
  assert.deepEqual(requests.map(request => request.source), logic.supportedSources);
  const url = new URL(requests[3].path, 'http://fixture');
  assert.equal(url.searchParams.get('q'), 'real_artist');
  assert.equal(url.searchParams.get('page'), '3');
});

test('public Sankaku follow works without login and keeps the restricted access notice', async () => {
  const source = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
  const start = source.indexOf('function decorateFollowItems(');
  const end = source.indexOf('\nasync function loadBookmarks(', start);
  const follow = { key: 'danbooru::artist', source: 'danbooru', artistId: 'artist', name: 'Artist' };
  const tab = { id: 1, kind: 'follows', rating: 'all', items: [] };
  const requested = [];
  const context = vm.createContext({ CatalogLogic: logic, URLSearchParams, AbortController,
    setTimeout, clearTimeout, contentPreferences: {}, activeId: 1, follows: [follow], followedKeys: new Set(),
    settings: { hasApiKey: false, hasRule34ApiKey: false, sankakuAvailable: true, hasSankakuSession: false },
    findTab: () => tab, refreshFollows: async () => true, rememberItems() {}, render() {},
    request: async path => {
      if (path === '/api/follows/seen') return [follow];
      const url = new URL(path, 'http://fixture');
      const provider = url.searchParams.get('sources') || url.searchParams.get('source');
      requested.push(provider);
      return { items: provider === 'sankaku' ? [{ key: 'sankaku:123', source: provider, rating: 'g',
        tags: ['artist'], creatorTag: 'artist', published: '2025-01-01', images: ['image.jpg'] }] : [],
        errors: {}, hasMore: false, hasMoreSources: [],
        notices: provider === 'sankaku' ? { sankaku: 'Авторизуйтесь для закрытых работ.' } : {} };
    } });
  vm.runInContext(source.slice(start, end), context);
  await context.loadFollowFeed(tab);
  assert.deepEqual(requested, ['danbooru', 'sankaku']);
  assert.equal(tab.items[0].source, 'sankaku');
  assert.match(tab.followSourceNotices.sankaku, /Авторизуйтесь/);
});

test('restricted Sankaku search offers the login settings action', () => {
  const source = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
  const start = source.indexOf('function renderErrors(');
  const end = source.indexOf('\nfunction renderFeedTail(', start);
  const render = vm.runInNewContext(source.slice(start, end) + '\nrenderErrors', {
    names: { sankaku: 'Sankaku' }, escapeHtml: String
  });
  assert.match(render({ sankaku: 'Авторизуйтесь в Sankaku в настройках.' }), /data-action="sankaku-auth"/);
  assert.match(render({ sankaku: 'Авторизуйтесь в Sankaku в настройках.' }), /Авторизуйтесь<\/button>/);
  assert.doesNotMatch(render({ sankaku: 'Сайт ограничил частоту запросов (HTTP 429).' }), /sankaku-auth/);
});

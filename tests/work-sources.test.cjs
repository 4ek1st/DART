const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const logic = require('../wwwroot/catalog-logic.js');
const app = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
const names = { danbooru: 'Danbooru', gelbooru: 'Gelbooru', rule34: 'Rule34', sankaku: 'Sankaku' };
const work = { key: 'rule34:18529241', source: 'rule34', id: '18529241',
  title: 'Artwork', creatorTag: 'lmsk', creatorName: 'lmsk', rating: 'e',
  contentHash: 'a'.repeat(32), images: ['https://example.test/art.jpg'] };
const sankaku = { ...work, key: 'sankaku:AbC123', source: 'sankaku', id: 'AbC123' };
const escapeHtml = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;')
  .replaceAll('<', '&lt;').replaceAll('>', '&gt;');
function renderer(start, end, extra = {}) {
  return vm.runInNewContext(app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start))) +
    '\n' + start.match(/function (\w+)/)[1], { CatalogLogic: logic, names, escapeHtml,
      followedKeys: new Set(), settings: { hasApiKey: true, hasRule34ApiKey: true },
      authorContextData: () => '', ...extra });
}

test('confirmed grouped sources produce real post links including Sankaku', () => {
  const [grouped] = logic.groupWorks([work, sankaku]);
  assert.deepEqual(logic.workSources(grouped).map(record => [record.source, record.url]), [
    ['rule34', 'https://rule34.xxx/index.php?page=post&s=view&id=18529241'],
    ['sankaku', 'https://sankaku.app/posts/AbC123']
  ]);
});

test('source links are not inferred from artist tags, configured providers or untrusted text', () => {
  assert.deepEqual(logic.workSources({ ...work, tags: ['sankaku'],
    memberKeys: [work.key, 'sankaku:', 'rule34:bad/id', 'kemono:1', 'sankaku:<script>'] })
    .map(record => record.source), ['rule34']);
});

test('partial search and detail responses preserve the confirmed mirrors', () => {
  const [grouped] = logic.groupWorks([work, sankaku]);
  const refreshed = logic.mergeWorkMetadata(grouped, { ...work, memberKeys: [] });
  assert.equal(logic.workSources(refreshed).length, 2);
  const detailed = logic.mergeDetailPages(refreshed, { ...work, memberKeys: [] });
  assert.deepEqual(logic.workSources(detailed).map(record => record.source), ['rule34', 'sankaku']);
});

test('more mirrors learned later are retained without duplicating known sources', () => {
  const refreshed = logic.mergeWorkMetadata({ ...work, memberKeys: [work.key, sankaku.key] },
    { ...work, memberKeys: [work.key, 'gelbooru:123'] });
  assert.deepEqual(logic.workSources(refreshed).map(record => record.source), ['rule34', 'sankaku', 'gelbooru']);
  assert.deepEqual(logic.workSources(logic.mergeWorkMetadata(refreshed, { ...work,
    key: 'rule34:other', id: 'other' })), []);
});

test('subscription labels stay short with all providers connected and keep participant roles', () => {
  const follow = renderer('function followButton(', '\nfunction renderFollowArtist(');
  const artist = follow({ source: 'danbooru', artistId: 'lmsk' });
  assert.match(artist, />Подписаться на художника<\/button>/);
  assert.doesNotMatch(artist, /Danbooru|Gelbooru|Rule34|Sankaku/);
  assert.match(follow({ source: 'danbooru', artistId: 'helper_(voice_actor)' }), /Подписаться на актёра озвучки/);
  assert.match(follow({ source: 'sankaku', artistId: 'uploader' }), /Подписаться на загрузчика/);
});

test('catalog names are plain links to confirmed providers with no extra source buttons', () => {
  const renderSources = renderer('function renderWorkSources(', '\nfunction renderParticipantProfiles(');
  const [grouped] = logic.groupWorks([work, sankaku]);
  const html = renderSources(grouped);
  assert.match(html, /Sankaku/);
  assert.match(html, /href="https:\/\/sankaku\.app\/posts\/AbC123"/);
  assert.doesNotMatch(html, /<button|secondary-button|work-source/);
  assert.doesNotMatch(html, /Danbooru|Gelbooru/);
  const single = renderSources(sankaku);
  assert.match(single, /Sankaku/);
  assert.doesNotMatch(single, /Danbooru|Gelbooru|Rule34/);
});

test('artist profile lists sites with loaded works rather than all configured providers', () => {
  const renderProfile = renderer('function renderProfile(', '\nfunction renderList(', {
    followButton: () => '', renderErrors: () => '', renderGrid: () => '', renderFeedTail: () => ''
  });
  const html = renderProfile({ title: 'lmsk', profileRef: { source: 'artist', artist: 'lmsk' },
    rating: 'all', items: [sankaku], errors: {} });
  assert.match(html, /Художник · Sankaku/);
  assert.doesNotMatch(html, /Danbooru|Gelbooru|Rule34/);
});

test('reopening an existing artwork tab adds newly confirmed mirrors', () => {
  const [grouped] = logic.groupWorks([work, sankaku]);
  const existing = { id: 1, kind: 'detail', title: work.title, item: work };
  let saved = 0;
  const context = vm.createContext({ CatalogLogic: logic, tabs: [existing], itemIndex: new Map(),
    rememberItem: item => item, currentTab: () => existing, retainFeedWork() {},
    activate() {}, saveSession() { saved++; } });
  vm.runInContext(app.slice(app.indexOf('function openDetail('), app.indexOf('\nfunction isSavedWork(')), context);
  context.openDetail(grouped);
  assert.equal(logic.workSources(existing.item).length, 2);
  assert.equal(saved, 1);
});

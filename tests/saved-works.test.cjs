const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const CatalogLogic = require('../wwwroot/catalog-logic.js');
const I18n = require('../wwwroot/i18n.js');
const source = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
const between = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));

test('old bookmark tabs migrate once while new bookmarks retain their independent route', () => {
  const state = { session: { activeIndex: 1, tabs: [{ kind: 'home' },
    { kind: 'bookmarks', title: 'Закладки', pinned: true, scrollTop: 640 }] } };
  const migrated = CatalogLogic.cleanClientState(state);
  assert.equal(migrated.session.tabs[1].kind, 'likes');
  assert.equal(migrated.session.tabs[1].scrollTop, 640);
  assert.equal(migrated.session.activeIndex, 1);
  migrated.session.tabs.push({ kind: 'bookmarks', title: 'Bookmarks' });
  assert.equal(CatalogLogic.cleanClientState(migrated).session.tabs[2].kind, 'bookmarks');
});

test('recommendation preferences come from likes and never from bookmark-only tags', () => {
  const context = { CatalogLogic, likes: [{ key: 'danbooru:1', source: 'danbooru',
    characterTags: ['liked_character'], tags: ['liked_character', 'liked_theme'] }],
    bookmarks: [{ key: 'danbooru:2', source: 'danbooru',
      characterTags: ['bookmark_only'], tags: ['bookmark_only'] }],
    recommendationVisitCount: 0, localStorage: { setItem() {} },
    contentPreferences: {}, recommendationTagPreferences: {} };
  const prepare = vm.runInNewContext(between('function createRecommendationPools(',
    '\nasync function loadRecommendations(') + '\nprepareRecommendationProfile', context);
  const tab = { selectedSources: ['danbooru'] };
  prepare(tab);
  assert.ok(tab.recommendationTags.some(entry => entry.tag === 'liked character'));
  assert.ok(tab.recommendationTags.every(entry => entry.tag !== 'bookmark only'));
});

test('detail and card actions have distinct icon buttons and reflect grouped source membership', () => {
  const item = { key: 'sankaku:mirror', memberKeys: ['danbooru:1', 'sankaku:mirror'] };
  const context = { likedKeys: new Set(['danbooru:1']), savedKeys: new Set(),
    savedWorkPending: new Set(), escapeHtml: String, svg: name => `<svg data-icon="${name}"></svg>` };
  const button = vm.runInNewContext(between('function isSavedWork(', '\nasync function toggleSavedWork(')
    + '\nsavedWorkButton', context);
  const like = button(item, 'likes', true), bookmark = button(item, 'bookmarks', true);
  assert.match(like, /aria-pressed="true"/);
  assert.match(like, /data-action="like"/);
  assert.match(bookmark, /aria-pressed="false"/);
  assert.match(bookmark, /data-icon="bookmark"/);
  assert.doesNotMatch(like + bookmark, />Add bookmark<|>Like</);
  for (const language of ['en', 'ru', 'de']) {
    I18n.setLanguage(language);
    for (const label of ['Liked', 'Like', 'Unlike', 'Add bookmark', 'Remove bookmark']) {
      assert.ok(I18n.translate(label));
      if (language !== 'en') assert.notEqual(I18n.translate(label), label);
    }
  }
  I18n.setLanguage('en');
});

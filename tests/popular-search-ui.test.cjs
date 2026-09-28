const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const CatalogLogic = require('../wwwroot/catalog-logic.js');

function renderSearchFor(tab) {
  const source = fs.readFileSync(path.join(__dirname, '..', 'wwwroot', 'app.js'), 'utf8');
  const start = source.indexOf('function renderSearch(tab)');
  const end = source.indexOf('\nfunction renderRecommendationTagChips(', start);
  assert.ok(start >= 0 && end > start);
  const grids = [];
  const context = {
    CatalogLogic,
    favoriteTags: [],
    viewedTokens: new Set(), likes: [], bookmarks: [], contentPreferences: {},
    names: { danbooru: 'Danbooru', gelbooru: 'Gelbooru',
      rule34: 'Rule34', gelbooru: 'Gelbooru' },
    sourceKeyHint: () => '', escapeHtml: value => String(value),
    queryBlockedByFilters: () => false,
    renderErrors: () => '', renderFeedTail: () => '',
    hasResultError: () => false, skeletons: () => '<skeletons>',
    renderGrid: items => { grids.push(items.map(item => item.source)); return '<grid>'; }
  };
  const render = vm.runInNewContext(source.slice(start, end) + '\nrenderSearch', context);
  return { html: render(tab), grids };
}

test('popular tag search keeps all three ranked sources in the same grid', () => {
  const sources = ['danbooru', 'gelbooru', 'rule34'];
  const result = renderSearchFor({ feed: 'illustrations', query: 'latex', rating: 'all',
    sort: 'popular', selectedSources: sources, errors: {}, loading: false,
    items: sources.map(source => ({ key: source + ':1', source, tags: ['latex'] })) });
  assert.match(result.html, /по оценкам за всё время/);
  assert.deepEqual(result.grids, [sources]);
});

test('a Rule34 rate limit is a source notice, not a blocking search error', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'wwwroot', 'app.js'), 'utf8');
  const start = source.indexOf('function renderErrors(');
  const end = source.indexOf('\nfunction renderFeedTail(', start);
  assert.ok(start >= 0 && end > start);
  const render = vm.runInNewContext(source.slice(start, end) + '\nrenderErrors', {
    names: { rule34: 'Rule34' }, escapeHtml: value => String(value)
  });
  const html = render({ rule34: 'Сайт ограничил частоту запросов (HTTP 429).' });
  assert.match(html, /source-notice/);
  assert.doesNotMatch(html, /error-box/);
});

test('an unavailable catalog uses a short notice with a retry and the reason in a tooltip', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'wwwroot', 'app.js'), 'utf8');
  const start = source.indexOf('function renderErrors(');
  const end = source.indexOf('\nfunction renderFeedTail(', start);
  const render = vm.runInNewContext(source.slice(start, end) + '\nrenderErrors', {
    names: { rule34: 'Rule34', gelbooru: 'Gelbooru' },
    escapeHtml: value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;')
  });
  const message = 'Источник сейчас недоступен. Повторите запрос позже.';
  const html = render({ rule34: message }, 'creator-retry');
  assert.match(html, /source-notice source-warning/);
  assert.match(html, /Rule34 недоступен/);
  assert.match(html, /title="Источник сейчас недоступен\. Повторите запрос позже\."/);
  assert.match(html, /data-action="creator-retry"/);
  assert.doesNotMatch(html, /error-box|<p>|Повторить загрузку/);
  assert.match(render({ rule34: 'Укажите user ID и API key Rule34 в настройках.' }),
    /data-action="settings"/);
  assert.match(render({ network: 'Локальный сервер не ответил.' }), /error-box/);
});





test('popular cards expose the source vote count', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'wwwroot', 'app.js'), 'utf8');
  const start = source.indexOf('function renderCard(item,');
  const end = source.indexOf('\nfunction skeletons(', start);
  assert.ok(start >= 0 && end > start);
  let sort = 'popular';
  const context = { itemIndex: new Map(), currentTab: () => ({ sort }),
    CatalogLogic, names: { danbooru: 'Danbooru', gelbooru: 'Gelbooru' },
    contentPreferences: { attributionPriority: 'creator' },
    savedWorkButton: () => '', escapeHtml: value => String(value),
    isAdultRating: () => false, svg: () => '' };
  const helpersStart = source.indexOf('function rememberItem(');
  const helpersEnd = source.indexOf('\nfunction saveSession(', helpersStart);
  const render = vm.runInNewContext(source.slice(helpersStart, helpersEnd) + '\n' +
    source.slice(start, end) + '\nrenderCard', context);
  const base = { key: 'danbooru:1', source: 'danbooru', title: 'work',
    artist: 'artist', images: [], popularityCount: 27 };
  assert.match(render(base), /Голоса: 27/);
  assert.match(render({ ...base, key: 'gelbooru:2', source: 'gelbooru',
    popularityCount: 8 }), /Голоса: 8/);
  sort = 'recent';
  assert.doesNotMatch(render(base), /Голоса: 27/);
});

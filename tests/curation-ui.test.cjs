const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const CatalogLogic = require('../wwwroot/catalog-logic.js');
const I18n = require('../wwwroot/i18n.js');
const source = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
const section = (start, end) => {
  const first = source.indexOf(start), last = source.indexOf(end, first);
  assert.ok(first >= 0 && last > first, `missing ${start}`);
  return source.slice(first, last);
};

test('settings expose a master and four independent factors with honest disabled states', () => {
  const context = { CatalogLogic, currentTab: () => ({ kind: 'settings', settingsSection: 'curation' }),
    contentPreferences: { curation: { enabled: false, popularity: false } },
    contentPreferencesSaving: false, globalThis: {}, tabPreferences: {}, settings: {}, escapeHtml: value => value };
  const helper = source.includes('function renderCurationSettings(')
    ? section('function renderCurationSettings(', '\nfunction renderSettings()') : '';
  const render = vm.runInNewContext(helper + section('function renderSettings()', '\nconst sankakuMediaRecovery =') +
    '\nrenderSettings', context);
  const disabled = render();
  assert.match(disabled, /name="curation-enabled"/);
  assert.match(disabled, /<fieldset[^>]*disabled/);
  for (const factor of ['popularity', 'personal', 'freshness', 'resolution'])
    assert.match(disabled, new RegExp(`name="curation-${factor}"`));
  context.contentPreferences.curation.enabled = true;
  const enabled = render();
  assert.doesNotMatch(enabled, /<fieldset[^>]*disabled/);
  assert.doesNotMatch(enabled, /name="curation-popularity"[^>]*checked/);
  assert.match(enabled, /name="curation-personal"[^>]*checked/);
});

test('curation changes use a dedicated patch and keep local settings unchanged on failure', async () => {
  let fail = false, applied = 0;
  const writes = [];
  const context = { CatalogLogic, contentPreferencesSaving: false, contentPreferencesRevision: 0,
    contentPreferences: { curation: { enabled: false } },
    main: { querySelectorAll: () => [] }, render() {}, toast() {},
    applyContentPreferences: () => { applied++; },
    request: async (url, options) => {
      writes.push({ url, body: JSON.parse(options.body) });
      if (fail) throw new Error('Unavailable');
      return { curation: { enabled: true } };
    } };
  const save = vm.runInNewContext(section('async function saveCurationPreferences(',
    '\nasync function setAuthorHidden(') + '\nsaveCurationPreferences', context);
  await save({ enabled: true });
  assert.deepEqual(writes[0], { url: '/api/curation-preferences', body: { enabled: true } });
  assert.equal(applied, 1);
  fail = true;
  await save({ popularity: false });
  assert.equal(applied, 1);
  assert.equal(context.contentPreferencesSaving, false);
});

test('all new curation labels translate to Russian and German', () => {
  I18n.setLanguage('ru');
  assert.equal(I18n.translate('Curation'), 'Отбор');
  assert.equal(I18n.translate('Community ratings'), 'Оценки сообщества');
  I18n.setLanguage('de');
  assert.equal(I18n.translate('Curation'), 'Auswahl');
  assert.equal(I18n.translate('Original resolution'), 'Originalauflösung');
  I18n.setLanguage('en');
});

test('cached recommendation reranking stays asynchronous and discards older preference results', async () => {
  const liked = [1, 2, 3].map(id => ({ key: `danbooru:liked${id}`, source: 'danbooru', rating: 'g', tags: ['watercolor'] }));
  const items = [1, 2].map(id => ({ key: `rule34:${id}`, source: 'rule34', rating: 'g',
    tags: ['watercolor'], popularityCount: id }));
  const tab = { kind: 'recommendations', items, rating: 'general', recommendationVersion: 1, recommendationSeed: 0 };
  const jobs = [];
  const context = { CatalogLogic, contentPreferences: { language: 'en', hideFurry: false,
      hiddenAuthors: [], curation: CatalogLogic.normalizeCurationPreferences() },
    tabs: [tab], recommendationTagPreferences: {}, saveSession() {}, currentTab: () => null,
    render() {}, mergeRecommendationsAsync: (...args) => new Promise(resolve => jobs.push(() =>
      resolve(CatalogLogic.mergeRecommendations(...args)))) };
  context.curationContext = () => ({ liked, curation: context.contentPreferences.curation });
  const apply = vm.runInNewContext(section('function applyContentPreferences(',
    '\nasync function saveCurationPreferences(') + '\napplyContentPreferences', context);
  apply({ ...context.contentPreferences, curation: { enabled: true } });
  assert.equal(tab.items, items, 'the preference handler must leave ranking to the worker');
  apply({ ...context.contentPreferences, curation: { enabled: true, resolution: false } });
  jobs[1](); await new Promise(resolve => setImmediate(resolve));
  const latest = tab.items;
  assert.equal(latest[0].key, 'rule34:2');
  jobs[0](); await new Promise(resolve => setImmediate(resolve));
  assert.equal(tab.items, latest, 'an older worker result must not restore an obsolete order');
});

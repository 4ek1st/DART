const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const logic = require('../wwwroot/catalog-logic.js');
const I18n = require('../wwwroot/i18n.js');
const source = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');

function appFunction(start, end, name, context) {
  const from = source.indexOf(start), to = source.indexOf(end, from);
  assert.ok(from >= 0 && to > from);
  return vm.runInNewContext(source.slice(from, to) + '\n' + name, context);
}

test('the independent furry switch recognizes explicit tags from every catalog', () => {
  for (const catalog of logic.supportedSources) {
    for (const tag of ['furry', '#ＦＵＲＲＹ', ' Anthro ', 'anthropomorphic',
      'furry_female', 'furry_with_non-furry', 'Furry with non-furry', 'furrification',
      'furry_(japanese)', 'human_on_furry', 'anthropomorphic_animal',
      'female_anthro', 'Human on anthro', 'muscular_anthro', 'semi-anthro']) {
      const item = { key: `${catalog}:1`, source: catalog, tags: [tag] };
      assert.equal(logic.isWorkHidden(item, { hideFurry: true }), true, `${catalog}: ${tag}`);
      assert.deepEqual(logic.filterWorks([item], { aiMode: 'all', hideFurry: true }), []);
      assert.equal(logic.isWorkHidden(item, { hideFurry: false }), false);
    }
  }
});

test('ears, tails, fur clothing, unrelated anthro names and missing tags stay visible', () => {
  const tags = ['animal_ears', 'tail', 'cat_girl', 'fox_girl', 'monster_girl',
    'kemonomimi', 'fur_coat', 'fur_trim', 'fluffy', 'scales', 'anthropomorphism',
    'not_furry', 'not_furry_wearing_fursuit', 'furry_(fandom)', 'furry_kitty',
    'j5furry', 'furry_artist', 'anthro_artist', 'anthropomorphic_hilt',
    'ultra_monsters_anthropomorphic_project'];
  const human = { source: 'sankaku', tags, creatorTag: 'furry', creatorName: 'Anthro', title: 'Furry' };
  assert.equal(logic.isWorkHidden(human, { hideFurry: true }), false);
  for (const item of [human, { source: 'rule34' }, { source: 'gelbooru', tags: [], allTags: [] }])
    assert.equal(logic.filterWorks([item], { hideFurry: true }).length, 1);
  for (const hideFurry of [undefined, false, 'true', 1])
    assert.equal(logic.filterWorks([{ tags: ['furry'] }], { hideFurry }).length, 1);
});

test('a marker from any merged copy hides the whole group and switching off restores it', () => {
  const items = logic.supportedSources.map((source, index) => ({
    source, key: `${source}:${index}`, id: String(index), contentHash: 'a'.repeat(32),
    images: [`https://fixture.test/${index}.jpg`], tags: [index === 3 ? 'female_anthro' : 'scenery']
  }));
  const saved = JSON.stringify(items), grouped = logic.groupWorks(items);
  assert.equal(grouped.length, 1);
  assert.deepEqual(logic.filterWorks(grouped, { hideFurry: true }), []);
  assert.equal(logic.filterWorks(grouped, { hideFurry: false }).length, 1);
  assert.equal(JSON.stringify(items), saved, 'Filtering must not delete or rewrite saved source data');
  const detail = logic.mergeDetailPages(grouped[0], { ...items[0], tags: ['scenery'] });
  assert.equal(logic.isWorkHidden(detail, { hideFurry: true }), true,
    'A detail response without the marker must retain evidence from its mirrors');
});

test('furry filtering composes with AI, authors, manual tags and search counts', () => {
  const items = [
    { source: 'danbooru', key: 'danbooru:1', tags: ['furry'] },
    { source: 'gelbooru', key: 'gelbooru:2', tags: ['ai_generated'] },
    { source: 'rule34', key: 'rule34:3', tags: ['landscape'], creatorTag: 'blocked_artist' },
    { source: 'sankaku', key: 'sankaku:4', tags: ['blocked_tag'] },
    { source: 'sankaku', key: 'sankaku:5', tags: ['cat_girl', 'animal_ears'] }
  ];
  const preferences = { hideFurry: true, aiMode: 'generated', excludedTags: ['blocked_tag'],
    hiddenAuthors: [{ source: 'artist', artistId: 'blocked_artist' }] };
  assert.deepEqual(logic.filterWorks(items, preferences).map(item => item.key), ['sankaku:5']);
  assert.equal(logic.searchResultCounts(items, preferences).hiddenContent, 4);
  assert.equal(logic.filterWorks(items, { ...preferences, hideFurry: false }).length, 2);
  assert.equal(logic.isWorkHidden(items[0], { hideFurry: false, excludedTags: ['furry'] }), true,
    'The switch must not erase independent manually excluded tags');
});

test('a negative search tag does not block browsing when the furry switch is on', () => {
  const queryBlocked = appFunction('function queryBlockedByFilters(', '\nfunction renderRelatedTail(',
    'queryBlockedByFilters', { CatalogLogic: logic, contentPreferences: { hideFurry: true } });
  for (const query of ['furry', 'character furry_female', 'muscular_anthro']) assert.equal(queryBlocked(query), true);
  for (const query of ['', '-furry', 'character -anthro', '-furry_with_non-furry']) assert.equal(queryBlocked(query), false);
});

test('changing the switch invalidates recommendation seeds and retained feed state', () => {
  let aborts = 0;
  const recommendations = { kind: 'recommendations', started: true, items: [{ tags: ['furry'] }],
    recommendationTags: ['furry'], recommendationVersion: 4, recommendationController: { abort() { aborts++; } } };
  const following = { kind: 'follows', followGroups: [], followStreams: {},
    retainedFeedWorks: new Map([['old', {}]]), expiredFeedTokens: new Set(['old']) };
  let feedUpdates = 0;
  const context = { contentPreferences: { hideFurry: false }, tabs: [following, recommendations],
    updateFollowFeed() { feedUpdates++; } };
  const apply = appFunction('function applyContentPreferences(', '\nasync function setAuthorHidden(',
    'applyContentPreferences', context);
  apply({ hideFurry: true, language: 'en' });
  assert.equal(aborts, 1); assert.equal(feedUpdates, 1);
  assert.equal(recommendations.started, false); assert.equal(recommendations.items.length, 0);
  assert.equal(recommendations.recommendationVersion, 5);
  assert.equal(following.retainedFeedWorks.size, 0); assert.equal(following.expiredFeedTokens, undefined);
  apply({ hideFurry: true, language: 'de' });
  assert.equal(aborts, 1, 'Changing language alone must not reset the feeds');
});

test('saving sends the furry flag and a failed save retains the previous value', async () => {
  const inputs = [{ disabled: false }], payloads = [];
  let fail = false, renders = 0;
  const context = { CatalogLogic: logic, contentPreferencesSaving: false, contentPreferencesRevision: 0,
    contentPreferences: { hideFurry: false }, main: { querySelectorAll: () => inputs },
    async request(url, options) {
      assert.equal(url, '/api/content-preferences');
      assert.equal(inputs[0].disabled, true, 'The control must be disabled during a pending save');
      const body = JSON.parse(options.body); payloads.push(body);
      if (fail) throw new Error('fixture failure');
      return body;
    }, applyContentPreferences(saved) { context.contentPreferences = saved; },
    toast() {}, render() { renders++; inputs[0].disabled = false; } };
  const save = appFunction('async function saveContentPreferences(', '\nasync function loadDetail(',
    'saveContentPreferences', context);
  const preferences = { language: 'en', aiMode: 'all', hideFurry: true,
    excludedTags: ['latex'], attributionPriority: 'creator', hideViewedAndSaved: true };
  await save(preferences);
  assert.deepEqual(payloads[0], preferences);
  assert.equal(context.contentPreferences.hideFurry, true);
  fail = true;
  await save({ ...preferences, hideFurry: false });
  assert.equal(context.contentPreferences.hideFurry, true);
  assert.equal(context.contentPreferencesSaving, false); assert.equal(renders, 2);
  assert.equal(inputs[0].disabled, false);
});

test('Content settings render an accessible switch, pending state and translations', () => {
  const context = { currentTab: () => ({ kind: 'settings', settingsSection: 'content' }),
    contentPreferences: { aiMode: 'all', hideFurry: true }, contentPreferencesSaving: true,
    escapeHtml: String };
  const render = appFunction('function renderSettings()', '\nconst sankakuMediaRecovery =', 'renderSettings', context);
  const html = render();
  assert.match(html, /name="hideFurry"[^>]*aria-describedby="furry-filter-hint"[^>]*checked[^>]*disabled/);
  assert.match(html, /id="furry-filter-hint"/);
  context.contentPreferencesSaving = false; context.contentPreferences.hideFurry = false;
  assert.doesNotMatch(render(), /name="hideFurry"[^>]*(checked|disabled)/);
  for (const [language, label] of [['en', 'Hide furry content'], ['ru', 'Скрывать фурри-контент'], ['de', 'Furry-Inhalte ausblenden']]) {
    I18n.setLanguage(language);
    assert.equal(I18n.translate('Hide furry content'), label);
    assert.ok(I18n.translate('Furry content'));
  }
  I18n.setLanguage('en');
});

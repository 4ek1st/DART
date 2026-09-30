const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const logic = require('../wwwroot/catalog-logic.js');
const app = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
const work = (key, tags, extra = {}) => ({ key, source: 'danbooru', rating: 'e', tags, ...extra });

test('manual furry exclusions also block explicit aliases on mirrored works', () => {
  for (const excluded of ['furry', 'anthro', 'anthropomorphic']) {
    for (const tag of ['furry', 'anthro', 'anthropomorphic', 'female_anthro'])
      assert.equal(logic.isWorkHidden(work('r:1', [], { allTags: [tag] }),
        { excludedTags: [excluded] }), true, `${excluded} must cover ${tag}`);
    assert.equal(logic.isWorkHidden(work('d:human', ['animal_ears', 'tail', 'anthro_artist']),
      { excludedTags: [excluded] }), false);
  }
});

test('character metadata from every source and Copyright never enter Other', () => {
  const likes = logic.supportedSources.flatMap(source => [1,2].map(index => work(`${source}:${index}`,
    ['test_character', 'goddess_of_victory:_nikke', 'latex'], { source,
      title: 'Artwork', characterTags: ['test_character'], copyrightTags: ['goddess_of_victory:_nikke'] })));
  const groups = logic.recommendationTagGroups(likes);
  assert.deepEqual(groups.names.map(x => x.tag), ['test character']);
  assert.deepEqual(groups.copyright.map(x => x.tag), ['goddess of victory nikke']);
  assert.deepEqual(groups.other.map(x => x.tag), ['latex']);
  const streams = logic.recommendationQueryGroups(likes, { 'goddess of victory nikke': 'priority' });
  assert.equal(streams.priority[0].query, 'goddess_of_victory:_nikke');
});

test('the loader sends punctuation from the original canonical tag', async () => {
  const likes = [1,2].map(i => work(`d:${i}`, ['goddess_of_victory:_nikke'],
    { copyrightTags: ['goddess_of_victory:_nikke'] }));
  const tab = { id: 7, selectedSources: ['danbooru'], items: [], rating: 'explicit' };
  const queries = [];
  const context = { CatalogLogic: logic, likes,
    recommendationTagPreferences: { 'goddess of victory nikke': 'priority' },
    recommendationVisitCount: 0, localStorage: { setItem() {} }, contentPreferences: {},
    findTab: id => id === 7 ? tab : null, activeId: -1, render() {}, rememberItems() {},
    AbortController, URLSearchParams, request: async url => {
      const q = new URL(url, 'http://fixture').searchParams.get('q'); queries.push(q);
      return { items: [], errors: {}, hasMoreSources: [] };
    } };
  const start = app.indexOf('function createRecommendationPools(');
  const end = app.indexOf('\nfunction decorateFollowItems(', start);
  const load = vm.runInNewContext(app.slice(start,end) + '\nloadRecommendations', context);
  await load(tab);
  assert.ok(queries.includes('goddess_of_victory:_nikke'));
  assert.equal(queries.includes('goddess_of_victory_nikke'), false);
});

test('two incidental matches in a large profile cannot become independent search streams', () => {
  const likes = Array.from({ length: 400 }, (_, i) => work(`d:${i}`,
    ['latex', ...(i < 2 ? ['incidental_detail', 'passing_character'] : [])],
    { characterTags: i < 2 ? ['passing_character'] : [] }));
  const groups = logic.recommendationQueryGroups(likes);
  assert.equal(groups.other.some(x => x.tag === 'incidental detail'), false);
  assert.equal(groups.names.some(x => x.tag === 'passing character'), false);
  assert.ok(logic.recommendationTagGroups(likes).other.some(x => x.tag === 'incidental detail'),
    'The chip remains available for an explicit choice');
  assert.ok(logic.recommendationQueryGroups(likes, { 'incidental detail': 'priority' })
    .priority.some(x => x.tag === 'incidental detail'));
});

test('full tags carry priority and disabled choices even when the abbreviated list omits them', () => {
  const likes = [1,2,3].map(i => work(`d:${i}`, ['latex'], { allTags: ['latex', 'enema'] }));
  const candidates = [work('d:new', ['latex']), work('d:preferred', ['latex'], { allTags: ['enema'] })];
  assert.equal(logic.rankRecommendations(likes,candidates,'explicit',20,{ enema:'priority' })[0].key,'d:preferred');
  assert.deepEqual(logic.rankRecommendations(likes,candidates,'explicit',20,{ enema:'disabled' })
    .map(x=>x.key), ['d:new']);
});

test('legacy disabled keys still exclude canonical punctuation and category tags', () => {
  const likes = [1,2,3].map(i=>work(`liked:${i}`,['latex','goddess_of_victory:_nikke']));
  const result = logic.rankRecommendations(likes,[work('new',['latex'],
    {copyrightTags:['goddess_of_victory:_nikke']})],'explicit',20,
    {'goddess of victory nikke':'disabled'});
  assert.deepEqual(result,[]);
});

test('manual choices remain visible and effective after their matching likes disappear', () => {
  const likes = [work('liked',['latex'])], preferences={enema:'priority',gag:'disabled'};
  const groups=logic.recommendationTagGroups(likes,2,preferences);
  assert.ok(groups.other.some(x=>x.tag==='enema' && x.count===0));
  assert.ok(groups.other.some(x=>x.tag==='gag' && x.count===0));
  assert.equal(logic.rankRecommendations(likes,[work('new',['enema'])],'explicit',20,preferences)[0].key,'new');
});

test('manual choices remain accessible in the feed when there are no current likes', () => {
  const start = app.indexOf('function renderRecommendations(');
  const end = app.indexOf('\nfunction followButton(', start);
  const render = vm.runInNewContext(app.slice(start,end) + '\nrenderRecommendations', {
    CatalogLogic: logic, likes: [], contentPreferences: {}, recommendationTagPreferences: { latex: 'priority' },
    names: { danbooru: 'Danbooru' }, sourceKeyHint: () => '', renderErrors: () => '',
    renderRecommendationTagChips: () => '', escapeHtml: x => x,
    filteredRecommendationOtherTags: tab => tab.recommendationTagGroups.other,
    renderRecommendationOtherList: () => '<button>latex</button>'
  });
  const html = render({ id:1, items:[], errors:{}, selectedSources:['danbooru'], otherTagsOpen:true,
    recommendationTagGroups:logic.recommendationTagGroups([],2,{latex:'priority'}) });
  assert.ok(html.includes('recommendation-other-panel'));
  assert.ok(html.includes('recommendation-refresh'));
  assert.ok(html.includes('<button>latex</button>'));
});

test('unavailable ordinary sample yields to the feed and a fresh sample is reused', async () => {
  const start = app.indexOf('async function loadRecommendationBackground(');
  const end = app.indexOf('\nfunction rememberRecommendationExposure(', start);
  let requests = 0;
  const sample = [work('ordinary',['latex'])];
  const context = { AbortController, URLSearchParams, Date,
    setTimeout(callback) { queueMicrotask(callback); return 1; }, clearTimeout() {},
    request: (_, {signal}) => {
      requests++;
      return new Promise((resolve,reject) => signal.addEventListener('abort', () =>
        reject(Object.assign(new Error('Unavailable sample'),{name:'AbortError'})), {once:true}));
    }
  };
  const load = vm.runInNewContext(app.slice(start,end) + '\nloadRecommendationBackground', context);
  const tab = { rating:'explicit',selectedSources:['danbooru'] };
  assert.equal((await load(tab,new AbortController().signal)).length,0);
  assert.equal(requests,1);
  tab.recommendationBackgroundKey='explicit:danbooru';
  tab.recommendationBackgroundAt=Date.now();
  tab.recommendationBackground=sample;
  assert.equal(await load(tab,new AbortController().signal),sample);
  assert.equal(requests,1);
});

test('measured ordinary prevalence reduces common matches relative to a distinctive recurring interest', () => {
  const likes = Array.from({ length: 50 }, (_, i) => work(`d:${i}`,
    [...(i < 30 ? ['cum'] : []), ...(i < 10 ? ['latex'] : [])]));
  const background = Array.from({ length: 50 }, (_, i) => work(`background:${i}`, i < 45 ? ['cum'] : ['scenery']));
  const ranked = logic.rankRecommendations(likes, [work('common',['cum']),work('distinctive',['latex'])],
    'explicit',20,{},0,{ background });
  assert.equal(ranked[0].key,'distinctive');
});

test('recently suggested works yield to similarly relevant new works without becoming permanently hidden', () => {
  const likes = [1,2,3].map(i=>work(`liked:${i}`,['latex']));
  const candidates = Array.from({length:80},(_,i)=>work(`d:${i}`,['latex']));
  const recentKeys = candidates.slice(0,24).map(x=>x.key);
  const result = logic.rankRecommendations(likes,candidates,'explicit',24,{},11,{ recentKeys });
  assert.ok(result.filter(x=>recentKeys.includes(x.key)).length <= 3);
  assert.equal(logic.rankRecommendations(likes,candidates.slice(0,24),'explicit',24,{},11,{ recentKeys }).length,24);
});

test('actual preferred tags matter even if their artwork arrived through an Other query', () => {
  const likes = [1,2,3,4].map(i=>work(`liked:${i}`,['latex','bdsm']));
  const group = Array.from({length:16},(_,i)=>work(`d:${i}`,i < 8 ? ['latex','bdsm'] : ['latex']));
  const result = logic.mergeRecommendations(likes,[],[
    {kind:'priority',items:group.slice(8)}, {kind:'other',items:group.slice(0,8)}],
    'explicit',{bdsm:'priority'},41);
  assert.ok(result[0].tags.includes('bdsm'));
  assert.ok(result.slice(0,8).filter(x=>x.tags.includes('bdsm')).length >= 5);
});

test('repeat works by one known artist yield to comparable interests supported by different artists', () => {
  const likes = [
    ...Array.from({length:25},(_,i)=>work(`same:${i}`,['catsuit'],{creatorTag:'same_artist'})),
    ...Array.from({length:8},(_,i)=>work(`different:${i}`,['latex'],{creatorTag:`artist_${i}`}))
  ];
  const ranked = logic.rankRecommendations(likes,[work('a',['catsuit']),work('b',['latex'])],'explicit');
  assert.equal(ranked[0].key,'b');
});

test('different visits change the selected set while retaining strong matches and stable appended cards', () => {
  const likes = Array.from({length:20},(_,i)=>work(`liked:${i}`,i < 10 ? ['latex','catsuit'] : ['latex']));
  const candidates = Array.from({length:100},(_,i)=>work(`new:${i}`,i < 45 ? ['latex','catsuit'] : ['latex']));
  const a = logic.rankRecommendations(likes,candidates,'explicit',24,{},101);
  const b = logic.rankRecommendations(likes,candidates,'explicit',24,{},202);
  assert.notDeepEqual([...a.map(x=>x.key)].sort(), [...b.map(x=>x.key)].sort());
  assert.ok(a.filter(x=>x.tags.includes('catsuit')).length >= 12);
  const savedOrder = a.map(x=>x.key);
  const appended = logic.mergeRecommendations(likes,a,[{kind:'other',items:candidates}],'explicit',{},202);
  assert.deepEqual(appended.slice(0,24).map(x=>x.key),savedOrder);
  assert.equal(new Set(appended.map(x=>x.key)).size,appended.length);
});

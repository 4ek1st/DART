'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const logic = require('../wwwroot/catalog-logic.js');

const preview = 'https://s.sankakucomplex.com/preview/neutral.jpg?e=4102444800&m=fresh';
const image = 'https://s.sankakucomplex.com/data/neutral.png?e=4102444800&m=fresh';
const hash = '112233445566778899aabbccddeeff00';
const post = (source, id) => ({ source, id, key: `${source}:${id}`, title: 'Retained title',
  thumbnail: '', images: [], contentHash: hash, tags: ['retained_tag'], rating: 's' });
const turn = () => new Promise(resolve => setImmediate(resolve));

function fixture(items, responseFor) {
  const source = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
  const section = (start, end) => {
    const first = source.indexOf(start);assert.ok(first >= 0, start);
    const last = source.indexOf(end, first);assert.ok(last > first, end);return source.slice(first, last);
  };
  let html = '', renders = 0, nextTimer = 0, context;
  const calls = [], timers = new Map(), tab = { id: 1, kind: 'likes', items };
  const main = {
    getBoundingClientRect: () => ({ top: 0, bottom: 1000 }),
    querySelectorAll: () => [...html.matchAll(/<article class="card" data-work-key="([^"]+)"/g)]
      .map(match => ({ dataset: { workKey: match[1] }, getBoundingClientRect: () => ({ top: 0, bottom: 200 }) }))
  };
  context = vm.createContext({ CatalogLogic: logic, URL, Date, AbortController, AbortSignal,
    currentTab: () => tab, tabs: [tab], likes: items, bookmarks: [], recent: [], quickPreviewWork: null,
    itemIndex: new Map(), main, contentPreferences: { attributionPriority: 'creator' },
    names: { danbooru: 'Danbooru', sankaku: 'Sankaku' },
    imageLoader: { cached: () => false },
    detailImageDeduper: { unique: values => values, isCountConfirmed: () => true },
    savedWorkButton: () => '', creatorActionData: () => '', workAuthorContextData: () => '',
    isAdultRating: () => false, ratingLabel: () => '',
    escapeHtml: value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('"', '&quot;'),
    request: async url => { calls.push(url);return responseFor(new URL(url, 'http://127.0.0.1').searchParams.get('id')); },
    render: () => {
      // Fail closed in the test rather than starve Node's event loop on a cached-response loop.
      if (++renders > 16) throw new Error('Hydration repeatedly lost its rendered media');
      html = context.draw();context.hydration.scan();
    },
    setTimeout: callback => { const id = ++nextTimer;timers.set(id, callback);return id; },
    clearTimeout: id => timers.delete(id)
  });
  const program = section('const rememberedInputs = new WeakMap();', '\nfunction creatorActionData') + '\n' +
    section('function renderCard(', '\nfunction skeletons(') + '\n' +
    section('function galleryImages(', '\nfunction syncGalleryImageCounts(') + '\n' +
    section('const sankakuMediaRecovery = {', '\nglobalThis.DartVideoPreview?.attach(') + '\n' +
    'this.hydration=transferredMediaHydration;this.draw=()=>CatalogLogic.groupWorks(currentTab().items).map(item=>renderCard(item)).join("");rememberItems(currentTab().items);';
  vm.runInContext(program, context);html = context.draw();
  return { scan: () => context.hydration.scan(), calls, timers, get html() { return html; },
    get renders() { return renders; }, metadata: () => JSON.parse(JSON.stringify(tab.items)) };
}

test('real hydration application and regrouping render a standalone imported Sankaku card', async () => {
  const item = post('sankaku', 'Neutral1');
  const f = fixture([item], id => ({ ...post('sankaku', id), thumbnail: preview, images: [image] }));
  assert.match(f.html, /class="text-preview"/);f.scan();await turn();
  assert.match(f.html, /data-image-url="https:\/\/s\.sankakucomplex\.com\/preview\/neutral\.jpg/);
  assert.doesNotMatch(f.html, /class="text-preview"/);assert.equal(f.calls.length, 1);assert.equal(f.renders, 1);
});

test('a missing primary preview survives real Sankaku recovery, group cache invalidation and card rendering', async () => {
  const primary = post('danbooru', '1'), member = post('sankaku', 'Neutral1');
  const group = { ...primary, groupingVersion: 2, memberKeys: [primary.key, member.key], groupMembers: [primary, member] };
  const f = fixture([group], id => ({ ...post('sankaku', id), thumbnail: preview, images: [image] }));
  assert.match(f.html, /class="text-preview"/);f.scan();await turn();
  assert.match(f.html, /data-image-url="https:\/\/s\.sankakucomplex\.com\/preview\/neutral\.jpg/);
  assert.doesNotMatch(f.html, /class="text-preview"/);assert.equal(f.calls.length, 1);assert.ok(f.renders <= 2);
  assert.equal(f.metadata()[0].title, 'Retained title');assert.equal(f.metadata()[0].key, 'danbooru:1');
  assert.equal(f.metadata()[0].groupMembers.find(item => item.key === primary.key).thumbnail, '',
    'a Sankaku mirror preview must not be attributed to the raw Danbooru member');
});

test('an unavailable Sankaku primary uses its available saved mirror without a cached-success render loop', async () => {
  const primary = post('sankaku', 'Unavailable1'), member = post('sankaku', 'Neutral1');
  const group = { ...primary, groupingVersion: 2, memberKeys: [primary.key, member.key], groupMembers: [primary, member] };
  const f = fixture([group], id => id === primary.id ? null : ({ ...post('sankaku', id), thumbnail: preview, images: [image] }));
  f.scan();await turn();
  assert.match(f.html, /data-image-url="https:\/\/s\.sankakucomplex\.com\/preview\/neutral\.jpg/);
  assert.doesNotMatch(f.html, /class="text-preview"/);assert.equal(f.calls.length, 2);assert.ok(f.renders <= 2);
});

test('an expired unavailable primary does not displace a usable renewed mirror after regrouping', async () => {
  const primary = { ...post('sankaku', 'Unavailable1'), thumbnail: preview.replace('4102444800', '1') };
  const member = post('sankaku', 'Neutral1');
  const group = { ...primary, groupingVersion: 2, memberKeys: [primary.key, member.key], groupMembers: [primary, member] };
  const f = fixture([group], id => id === primary.id ? null : ({ ...post('sankaku', id), thumbnail: preview, images: [image] }));
  f.scan();await turn();
  assert.match(f.html, /data-image-url="https:\/\/s\.sankakucomplex\.com\/preview\/neutral\.jpg\?e=4102444800/);
  assert.equal(f.calls.length, 2);assert.ok(f.renders <= 2);
});

test('a detail for an unrelated artwork is not false recovery progress and does not reset attempts', async () => {
  const item = post('sankaku', 'Neutral1');
  const f = fixture([item], () => ({ ...post('sankaku', 'Other1'), thumbnail: preview, images: [image] }));
  f.scan();await turn();
  assert.match(f.html, /class="text-preview"/);assert.equal(f.calls.length, 1);assert.equal(f.renders, 0);assert.equal(f.timers.size, 1);
});

test('legacy numeric Sankaku recovery accepts retained requested identity without inventing another catalog member', async () => {
  const item = post('sankaku', '1234567');
  const f = fixture([item], id => ({ ...post('sankaku', id), thumbnail: preview, images: [image],
    sourceUrl: 'https://sankaku.app/posts/ModernOpaque1' }));
  f.scan();await turn();
  assert.doesNotMatch(f.html, /class="text-preview"/);assert.match(f.html, /data-image-url=/);
  assert.equal(f.calls.length, 1);assert.equal(f.metadata()[0].id, '1234567');assert.equal(f.metadata()[0].key, 'sankaku:1234567');
  assert.doesNotMatch(f.html, /Sankaku \+1|sankaku:ModernOpaque1/);
});

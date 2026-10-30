'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const app = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
function exposureHarness() {
  const timers = new Map(), writes = [], saved = [];
  const start = app.indexOf('function rememberRecommendationExposure(');
  const end = app.indexOf('\nfunction nextRecommendationGroup(', start);
  const context = { recommendationExposure: [], recommendationExposureGroups: [],
    recommendationExposureSaveTimer: undefined, recommendationExposureDirty: false,
    cleanRecommendationExposure: value => value.slice(-512),
    localStorage: { setItem(key, value) { writes.push([key, value]); } },
    viewedTokens: new Set(), saveSession() { saved.push(true); },
    setTimeout(callback, delay) { const id = timers.size + 1; timers.set(id, { callback, delay }); return id; },
    clearTimeout(id) { timers.delete(id); } };
  const file = require.resolve('../wwwroot/app.js').replace(/app\.js$/, 'recommendation-exposure.js');
  if (fs.existsSync(file)) context.DartRecommendationExposure = require(file);
  vm.createContext(context);
  vm.runInContext(app.slice(start, end), context);
  return { context, timers, writes, saved, remember: context.rememberRecommendationExposure };
}

test('exposure records supplied on-screen cards beyond the old first-48 prefix', () => {
  const f = exposureHarness();
  const items = Array.from({ length: 100 }, (_, index) => ({ key: `danbooru:${index + 1}` }));
  const tab = { id: 1, kind: 'recommendations', items };
  f.remember(tab, [items[98], items[99]]);
  assert.deepEqual(Array.from(f.context.recommendationExposure), ['danbooru:99', 'danbooru:100']);
  assert.equal(f.context.recommendationExposure.includes('danbooru:1'), false, 'offscreen data is not an impression');
});

test('aliases consume one bounded exposure-work slot instead of evicting the first shown work', () => {
  const f = exposureHarness();
  const items = Array.from({ length: 48 }, (_, index) => ({ key: `danbooru:${index + 1}`,
    memberKeys: Array.from({ length: 12 }, (_, alias) => `danbooru:${index * 12 + alias + 1000}`) }));
  f.remember({ id: 1, kind: 'recommendations', items }, items);
  assert.equal(f.context.recommendationExposureGroups.length, 48);
  assert.ok(f.context.recommendationExposureGroups[0].includes('danbooru:1'));
  assert.ok(f.context.recommendationExposureGroups.at(-1).includes('danbooru:48'));
});

const exposure = require('../wwwroot/recommendation-exposure.js');
test('legacy history imports, aliases merge by work and invalid or oversized keys are discarded', () => {
  const legacy = ['danbooru:1', 'rule34:2', 'removed:3', 'sankaku:' + 'a'.repeat(65), null, {}];
  assert.deepEqual(exposure.cleanGroups(legacy), [['danbooru:1'], ['rule34:2']]);
  const merged = exposure.append(exposure.cleanGroups(legacy), [['gelbooru:4', 'danbooru:1', 'rule34:2']]);
  assert.equal(merged.length, 1);
  assert.deepEqual(new Set(exposure.keys(merged)), new Set(['danbooru:1', 'rule34:2', 'gelbooru:4']));
  assert.deepEqual(exposure.cleanGroups(null), []);
});

test('history limits artworks independently from their bounded aliases', () => {
  const groups = Array.from({ length: 512 }, (_, work) =>
    Array.from({ length: 40 }, (_, alias) => `danbooru:${work * 100 + alias}`));
  const cleaned = exposure.cleanGroups(groups);
  assert.equal(cleaned.length, 512);
  assert.ok(cleaned.every(group => group.length === 32));
  assert.ok(cleaned[0].includes('danbooru:0'), 'aliases in newer works do not consume the first work slot');
  const appended = exposure.append(cleaned, [['sankaku:next']]);
  assert.equal(appended.length, 512);
  assert.equal(exposure.keys(appended).includes('danbooru:0'), false);
  assert.ok(appended.at(-1).includes('sankaku:next'));
});

test('exposure persistence is debounced and never marks works viewed', () => {
  const f = exposureHarness(), tab = { id: 1, kind: 'recommendations' };
  f.remember(tab, [{ key: 'danbooru:1' }]);
  f.remember(tab, [{ key: 'danbooru:2' }]);
  assert.equal(f.timers.size, 1);
  assert.equal([...f.timers.values()][0].delay, 750);
  assert.equal(f.writes.length, 0);
  assert.equal(f.saved.length, 0);
  [...f.timers.values()][0].callback();
  assert.equal(f.saved.length, 1);
  assert.equal(f.writes.length, 2);
  assert.equal(f.timers.size, 0);
  assert.equal(f.context.viewedTokens.size, 0);
  f.context.flushRecommendationExposure();
  assert.equal(f.saved.length, 1, 'an unchanged flush does not write the session again');
});

function trackerFixture({ native = true } = {}) {
  const cards = [], observers = [], seen = [];
  let session = { id: 1, generation: 1 }, visible = true, time = 10;
  const viewport = { querySelectorAll: () => cards,
    getBoundingClientRect: () => ({ top: 0, bottom: 600, left: 0, right: 800 }) };
  class Observer {
    constructor(callback, options) { this.callback = callback; this.options = options; this.observed = []; this.unobserved = []; this.disconnects = 0; observers.push(this); }
    observe(card) { this.observed.push(card); }
    unobserve(card) { this.unobserved.push(card); }
    disconnect() { this.disconnects++; }
  }
  const tracker = exposure.createTracker({ root: viewport, getSession: () => session,
    getGeneration: value => value.generation, getKeys: card => card.keys,
    isVisible: () => visible, now: () => time, Observer: native ? Observer : null,
    onExpose(owner, groups) { seen.push({ owner, groups }); } });
  const card = (key, top = 0) => ({ keys: [key], isConnected: true,
    getBoundingClientRect: () => ({ left: 0, right: 200, top, bottom: top + 200, width: 200, height: 200 }) });
  return { tracker, cards, observers, seen, card,
    get session() { return session; }, setSession(value) { session = value; },
    setVisible(value) { visible = value; }, setTime(value) { time = value; },
    intersect(target, ratio = 1, index = observers.length - 1, at = time) {
      observers[index].callback([{ target, isIntersecting: ratio > 0, intersectionRatio: ratio, time: at }]);
    } };
}

test('viewport observer records only visible cards, including materialized cards beyond 48', () => {
  const f = trackerFixture();
  const offscreen = f.card('danbooru:1'), tail = f.card('danbooru:100');
  f.cards.push(offscreen, tail); f.tracker.refresh();
  assert.equal(f.observers[0].options.rootMargin, '0px');
  f.intersect(offscreen, .1); f.intersect(tail, .6);
  assert.equal(f.seen.length, 1);
  assert.deepEqual(f.seen[0].groups, [['danbooru:100']]);
  f.intersect(tail, .8);
  assert.equal(f.seen.length, 1, 'unchanged subscriptions do not save duplicate impressions');
});

test('virtualization subscriptions preserve retained cards, release removals and learn updated aliases', () => {
  const f = trackerFixture(), a = f.card('danbooru:1'), b = f.card('danbooru:2');
  f.cards.push(a, b); f.tracker.refresh(); f.intersect(a);
  f.tracker.refresh();
  assert.equal(f.observers[0].observed.length, 2);
  f.cards.shift(); const c = f.card('danbooru:99'); f.cards.push(c);
  f.tracker.refresh();
  assert.deepEqual(f.observers[0].unobserved, [a]);
  assert.equal(f.observers[0].observed.length, 3);
  b.keys.push('gelbooru:3'); f.setTime(20); f.tracker.refresh();
  f.intersect(b, 1, 0, 19);
  assert.equal(f.seen.length, 1, 'a queued old subscription cannot mark new metadata exposed');
  f.intersect(b, 1, 0, 21);
  assert.deepEqual(f.seen.at(-1).groups, [['danbooru:2', 'gelbooru:3']]);
});

test('hidden pages, old generations, tab changes and detached cards cannot record impressions', () => {
  const f = trackerFixture(), a = f.card('danbooru:1');
  f.cards.push(a); f.tracker.refresh();
  f.setVisible(false); f.intersect(a); assert.equal(f.seen.length, 0);
  f.setVisible(true); f.session.generation++; f.tracker.refresh();
  f.intersect(a, 1, 0); assert.equal(f.seen.length, 0, 'old observer callback is discarded');
  f.setSession({ id: 2, generation: 1 }); f.intersect(a); assert.equal(f.seen.length, 0);
  f.tracker.refresh(); a.isConnected = false; f.intersect(a); assert.equal(f.seen.length, 0);
  a.isConnected = true; f.intersect(a); assert.equal(f.seen.length, 1);
  f.setSession(null); f.tracker.refresh();
  f.intersect(a); assert.equal(f.seen.length, 1);
});

test('fallback viewport checks remain bounded to materialized cards and actual intersection', () => {
  const f = trackerFixture({ native: false });
  f.cards.push(f.card('danbooru:1', -180), f.card('danbooru:2', 50), f.card('danbooru:100', 1000));
  f.tracker.refresh();
  assert.deepEqual(f.seen[0].groups, [['danbooru:2']]);
  assert.equal(f.tracker.observerSupported, false);
});

test('client-state capture/load and visible rendering wire the grouped history without prefix publication', () => {
  assert.match(app, /recent, searchHistory: getSearchHistory\(\), recommendationExposure, recommendationExposureGroups/);
  assert.match(app, /Array\.isArray\(state\.recommendationExposureGroups\)/);
  assert.match(app, /measureVirtualGrids\(tab\);\s+if \(typeof recommendationExposureTracker/);
  assert.match(app, /isVisible: \(\) => !document\.hidden && !quickPreview\.open/);
  assert.match(app, /tab\.recommendationRecentKeys = recommendationRecentExposureKeys\(tab\)/);
});

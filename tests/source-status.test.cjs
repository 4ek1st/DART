'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { create } = require('../wwwroot/source-status.js');
const I18n = require('../wwwroot/i18n.js');
function fixture(options = {}) {
  const nodes = ['danbooru', 'gelbooru', 'rule34', 'sankaku'].map(source => ({
    dataset: { sourceStatus: source }, attrs: {}, classes: new Set(),
    setAttribute(key, value) { this.attrs[key] = value; }, removeAttribute(key) { delete this.attrs[key]; },
    addEventListener() {}, removeEventListener() {},
    classList: { toggle() {} }
  }));
  for (const node of nodes) node.classList.toggle = (name, enabled) => enabled ? node.classes.add(name) : node.classes.delete(name);
  const document = { hidden: false, addEventListener() {}, removeEventListener() {} };
  const timers = [], canceled = [];
  const value = create({ nodes, document, setTimeout: (fn, delay) => { const id = timers.length; timers.push({ fn, delay }); return id; },
    clearTimeout: id => canceled.push(id), ...options });
  return { value, nodes, document, timers, canceled };
}
for (const source of ['danbooru', 'gelbooru', 'rule34', 'sankaku']) test(`only the confirmed ${source} website outage turns grey and labels its source`, () => {
  const f = fixture();
  f.value.apply([{ source, websiteUnavailable: true, statusCode: 503, retryAt: Date.now() + 30000 }]);
  const failed = f.nodes.find(node => node.dataset.sourceStatus === source);
  assert(failed.classes.has('source-unavailable'));
  assert.match(failed.attrs.title, /Problems on the website side/); assert.equal(failed.attrs['aria-label'], failed.attrs.title);
  assert(f.nodes.filter(node => node !== failed).every(node => !node.classes.has('source-unavailable')));
  f.value.apply([{ source, websiteUnavailable: false, statusCode: 200 }]);
  assert(!failed.classes.has('source-unavailable')); assert(!failed.attrs.title.includes('Problems'));
});
test('auth/network-like/malformed statuses cannot falsely mark the website unavailable', () => {
  const f = fixture();
  for (const statusCode of [401, 403, 429, undefined, '503', 200]) {
    f.value.apply([{ source: 'danbooru', websiteUnavailable: true, statusCode }]);
    assert(!f.nodes[0].classes.has('source-unavailable'));
  }
  f.value.apply([{ source: 'unknown', websiteUnavailable: true, statusCode: 503 }]);
  assert(f.nodes.every(node => !node.classes.has('source-unavailable')));
});
test('retry expiry or a failed local read never pretends the site recovered', async () => {
  const f = fixture({ fetchStatus: async () => { throw Error('Local endpoint unavailable'); } });
  f.value.apply([{ source: 'danbooru', websiteUnavailable: true, statusCode: 503, retryAt: 1 }]);
  await f.value.refresh();
  assert(f.nodes[0].classes.has('source-unavailable'));
  f.value.apply({}); assert(f.nodes[0].classes.has('source-unavailable'));
});
test('concurrent status readers coalesce and later reads can refresh', async () => {
  let calls = 0, resolve;
  const f = fixture({ fetchStatus: () => { calls++; return new Promise(yes => { resolve = yes; }); } });
  const a = f.value.refresh(), b = f.value.refresh(); await Promise.resolve();
  assert.equal(calls, 1); resolve([]); await Promise.all([a, b]);
  const next = f.value.refresh(); await Promise.resolve(); assert.equal(calls, 2); resolve([]); await next;
});
test('a synchronous endpoint failure releases the pending request for retry', async () => {
  let calls = 0;
  const f = fixture({ fetchStatus: () => { if (++calls === 1) throw Error('Neutral failure'); return []; } });
  await f.value.refresh(); await f.value.refresh(); assert.equal(calls, 2);
});
test('status refresh is bounded and paused while the document is hidden', async () => {
  let calls = 0;
  const f = fixture({ now: () => 1000, fetchStatus: async () => { calls++; return []; } });
  f.document.hidden = true; await f.value.refresh(); f.value.schedule(); assert.equal(calls, 0); assert.equal(f.timers.length, 0);
  f.document.hidden = false; await f.value.refresh(); f.value.schedule(); f.value.schedule();
  assert.equal(calls, 1); assert.equal(f.timers.filter(row => row.delay === 1500).length, 1);
  f.value.dispose(); assert(f.canceled.length >= 2);
});
test('website-side labels are available in English, Russian and German', () => {
  global.DartI18n = I18n;
  try {
    for (const [language, expected] of [['en', 'Problems on the website side.'], ['ru', 'Проблемы на стороне сайта.'], ['de', 'Probleme aufseiten der Website.']]) {
      I18n.setLanguage(language, false); const f = fixture();
      f.value.apply([{ source: 'danbooru', websiteUnavailable: true, statusCode: 503 }]);
      assert.equal(f.nodes[0].attrs.title, 'Danbooru — ' + expected);
    }
  } finally { I18n.setLanguage('en', false); delete global.DartI18n; }
});

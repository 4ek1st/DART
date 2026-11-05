'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const app = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
function history() {
  let now = 1000, calls = 0, failure = true;
  const item = { key: 'danbooru:1', thumbnail: 'https://example.test/viewed.jpg', tags: ['forest'] };
  const context = vm.createContext({ Date: { now: () => now }, DOMException });
  const start = app.indexOf('async function tagPreviewHistory(');
  vm.runInContext(app.slice(start, app.indexOf('\nasync function tagPreviewViewed(', start)), context);
  context.tagPreviewHistory.cache = { async get(_, signal) {
    calls++;
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    if (failure) throw Error('History unavailable');
    return [item];
  } };
  return { run: signal => context.tagPreviewHistory(signal), calls: () => calls,
    recover() { failure = false; }, advance() { now += 15001; }, item, context };
}
test('optional history failures briefly back off while preserving catalog fallback and later recovery', async () => {
  const f = history(), signal = new AbortController().signal;
  assert.deepEqual(Array.from(await f.run(signal)), []);
  assert.deepEqual(Array.from(await f.run(signal)), []); assert.equal(f.calls(), 1);
  f.recover(); f.advance(); assert.equal((await f.run(signal))[0], f.item); assert.equal(f.calls(), 2);
});
test('a cancelled hover does not poison optional history for the next hover', async () => {
  const f = history(), cancelled = new AbortController(); cancelled.abort();
  await assert.rejects(f.run(cancelled.signal), { name: 'AbortError' });
  f.recover(); assert.equal((await f.run(new AbortController().signal))[0], f.item);
  assert.equal(f.context.tagPreviewHistory.retryAt || 0, 0);
});

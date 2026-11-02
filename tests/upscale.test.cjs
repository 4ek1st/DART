const { test } = require('node:test');
const assert = require('node:assert/strict');
const worker = require('../wwwroot/upscale-worker.js');
const upscale = require('../wwwroot/upscale.js');
const media = require('../wwwroot/upscale-media.js');
const vm = require('node:vm'), fs = require('node:fs'), path = require('node:path');

test('upscale is available for a selected still image, never a video or thumbnail-only record', () => {
  assert.equal(upscale.canUpscaleImage({}, 'https://example.test/a.jpg'), true);
  assert.equal(upscale.canUpscaleImage({}, 'https://example.test/a.WEBM?e=1'), false);
  assert.equal(upscale.canUpscaleImage({ thumbnail: 'https://example.test/thumbnail.jpg' }, ''), false);
});

test('normalization checks image signatures, dimensions, animation and scale limits', () => {
  assert.equal(worker.inspect(Buffer.from([255, 216, 255, 0])), 'image/jpeg');
  assert.throws(() => worker.inspect(Buffer.from('<html>failure</html>')), /image/);
  assert.throws(() => worker.inspect(Buffer.from('GIF89a')), /animated/);
  assert.throws(() => worker.inspect(Buffer.concat([Buffer.from('RIFF0000WEBPANIM'), Buffer.alloc(4)])), /animated/);
  assert.deepEqual(worker.dimensions(1000, 1500, 4), { width: 1000, height: 1500 });
  assert.throws(() => worker.dimensions(100_000, 2000, 2), /too-large/);
  assert.throws(() => worker.dimensions(8000, 6000, 4), /too-large/);
  assert.throws(() => worker.dimensions(100, 100, 3), /scale/);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==','base64');
  png.writeUInt32BE(100_000,16); png.writeUInt32BE(100_000,20);
  assert.throws(() => worker.preflight(png,4), /too-large/, 'oversized image must be rejected before bitmap allocation');
});

test('a stale upload response cancels the accepted job without replacing the newer dialog', async () => {
  let resolveUpload; const calls = [], changes = [];
  const response = data => ({ ok: true, json: async () => data });
  const controller = upscale.createJobController({
    readImage: async () => new Blob(['pixels']), normalize: async blob => ({ blob, width: 10, height: 20 }),
    fetch: async (url, options) => {
      calls.push(url);
      if (url.endsWith('/jobs?scale=2')) return new Promise(resolve => { resolveUpload = resolve; });
      return response({});
    }, onChange: state => changes.push(state)
  });
  const run = controller.start({ item: {}, url: 'https://example.test/a.png', scale: 2 });
  await new Promise(resolve => setImmediate(resolve));
  controller.cancel();
  resolveUpload(response({ id: 'old', state: 'queued' })); await run;
  assert(calls.includes('/api/upscale/jobs/old/cancel'));
  assert.equal(changes.at(-1).state, 'cancelled');
  assert.equal(changes.some(change => change.state === 'completed'), false);
});

test('a completed job keeps result dimensions and uses the service result once', async () => {
  const changes = [], calls = [];
  const controller = upscale.createJobController({
    readImage: async () => new Blob(['pixels']), normalize: async blob => ({ blob, width: 80, height: 60 }),
    fetch: async url => { calls.push(url); return { ok: true, json: async () =>
      url.includes('?scale=4') ? { id: 'done', state: 'completed', scale: 4, resultUrl: '/result.png', cached: true } : {} }; },
    onChange: state => changes.push(state)
  });
  await controller.start({ item: {}, url: 'https://example.test/a.png', scale: 4 });
  assert.equal(changes.at(-1).state, 'completed');
  assert.equal(changes.at(-1).width, 80);
  assert.equal(changes.at(-1).resultUrl, '/result.png');
  assert.equal(changes.at(-1).cached, true);
  assert.equal(calls.length, 1);
});

test('missing module and malformed input leave an actionable failure instead of an eternal spinner', async () => {
  const changes = [];
  const controller = upscale.createJobController({
    readImage: async () => { throw new Error('image'); }, normalize: async () => assert.fail(),
    onChange: state => changes.push(state)
  });
  await controller.start({ item: {}, url: 'https://example.test/a.png', scale: 2 });
  assert.equal(changes.at(-1).state, 'error');
  assert.equal(changes.at(-1).error, 'image');
  assert.equal(upscale.messages.ru['not-installed'].length > 0, true);
  assert.equal(upscale.messages.de['too-large'].length > 0, true);
});

test('upscale reuses cached original pixels without another source request', async () => {
  const blob = new Blob(['cached original']);
  const read = media.create({ logic: { videoMimeType: () => false }, cached: () => ({ blob }),
    read: () => assert.fail('cached original must not be downloaded again') });
  assert.equal(await read({}, 'https://example.test/original.png', new AbortController().signal), blob);
});

test('expired signed media is renewed as the same original, never its preview', async () => {
  const calls = [], blob = new Blob(['original']);
  const logic = { videoMimeType: () => false, mediaCacheKey: url => url.split('?')[0],
    workSources: () => [{ source: 'sankaku', id: 'fixture' }], signedMediaExpired: url => url.includes('expired') };
  const read = media.create({ logic, cached: () => null, read: async url => { calls.push(url); return blob; },
    renew: async () => ({ thumbnail: 'https://s.test/preview.jpg?fresh', images: ['https://s.test/original.jpg?fresh'] }) });
  assert.equal(await read({}, 'https://s.test/original.jpg?expired', new AbortController().signal), blob);
  assert.deepEqual(calls, ['https://s.test/original.jpg?fresh']);
});

test('a missing original cannot be replaced by a renewed thumbnail', async () => {
  const read = media.create({ logic: { videoMimeType: () => false, mediaCacheKey: url => url.split('?')[0],
    workSources: () => [{ source: 'sankaku', id: 'fixture' }], signedMediaExpired: () => true }, cached: () => null,
    read: async () => { throw new Error('image'); },
    renew: async () => ({ thumbnail: 'https://s.test/original.jpg?fresh', images: [] }) });
  await assert.rejects(read({}, 'https://s.test/original.jpg?expired', new AbortController().signal), /image/);
});

test('one action uses the saved default with no extra interface or per-image question', async () => {
  const calls = [], notices = [];
  const document = { querySelector: () => null, querySelectorAll: () => [], addEventListener: () => {},
    createElement: () => assert.fail('upscaling must not create a separate dialog or ask another question') };
  class Worker {
    postMessage({ blob }) { queueMicrotask(() => this.onmessage({ data: { result: { blob, width: 80, height: 60 } } })); }
    terminate() {}
  }
  const window = { document, Worker, addEventListener: () => {}, fetch: async (url, options = {}) => {
    calls.push({ url, method: options.method });
    return { ok: true, json: async () => url === '/api/upscale' ?
      { component: { installed: true, state: 'ready' }, preferences: { scale: 4 }, cacheBytes: 0 } :
      { id: 'fixture', state: 'completed', scale: 4, resultUrl: '/api/upscale/jobs/fixture/image' } };
  } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../wwwroot/upscale.js'),'utf8'),
    { window, Blob, AbortController, AbortSignal, DOMException, setTimeout, clearTimeout, URL });
  window.DartUpscale.configure({ readImage: async () => new Blob(['pixels']), toast: value => notices.push(value),
    openSettings: () => assert.fail('installed module must not reopen settings') });
  const item = { key: 'danbooru:fixture' }, url = 'https://example.test/original.png';
  assert.equal(await window.DartUpscale.open({ item, url }), true);
  assert(calls.some(call => call.url === '/api/upscale/jobs?scale=4' && call.method === 'POST'));
  assert.equal(window.DartUpscale.resultFor(item,url).scale, 4);
  assert.equal(notices.some(value => value.includes('4×')), true);
  const before = calls.length;
  assert.equal(await window.DartUpscale.open({ item, url }), true);
  assert.equal(calls.length, before, 'a ready result must be reused immediately');
  window.DartUpscale.restore(item,url);
  assert.equal(window.DartUpscale.resultFor(item,url).visible, false);
  window.DartUpscale.dispose();
});

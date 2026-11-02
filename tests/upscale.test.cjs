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
  window.DartUpscale.show(item,url);
  assert.equal(window.DartUpscale.resultFor(item,url).visible, true);
  assert.equal(calls.length, before, 'showing the previous result must not start processing again');
  window.DartUpscale.dispose();
});

test('fast browsing is bounded before original downloads and decoding workers start', async () => {
  const waiting = [], notices = []; let workers = 0, uploads = 0;
  class Worker {
    constructor() { workers++; }
    postMessage({ blob }) { queueMicrotask(() => this.onmessage({ data: { result: { blob, width: 80, height: 60 } } })); }
    terminate() {}
  }
  const window = { document: { querySelector: () => null, querySelectorAll: () => [], addEventListener: () => {} },
    Worker, addEventListener: () => {}, fetch: async (url, options = {}) => ({ ok: true, json: async () => {
      if (url === '/api/upscale') return { component: { installed: true, state: 'ready' }, preferences: { scale: 2 }, cacheBytes: 0 };
      if (url.includes('/jobs?')) uploads++;
      return { id: 'job' + uploads, state: 'completed', scale: 2, resultUrl: '/result' + uploads + '.png' };
    } }) };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../wwwroot/upscale.js'),'utf8'),
    { window, Blob, AbortController, AbortSignal, DOMException, setTimeout, clearTimeout, URL });
  window.DartUpscale.configure({ readImage: () => new Promise(resolve => waiting.push(resolve)), toast: value => notices.push(value) });
  const attempts = Array.from({ length: 10 }, (_, id) => window.DartUpscale.open({ item: { key: 'danbooru:' + id }, url: 'https://example.test/' + id + '.png' }));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(waiting.length, 4, 'only four original reads may be in flight');
  assert.equal(workers, 0, 'blocked originals must not start decoding');
  for (const resolve of waiting) resolve(new Blob(['pixels']));
  const values = await Promise.all(attempts);
  assert.equal(workers, 4); assert.equal(uploads, 4);
  assert.equal(values.filter(Boolean).length, 4);
  assert.equal(notices.filter(value => value.includes('queue is full')).length, 6);
  window.DartUpscale.dispose();
});

test('starting immediately after choosing a default waits for that choice to save', async () => {
  let click, completeSave, uploaded = '', reads = 0;
  class Worker {
    postMessage({ blob }) { queueMicrotask(() => this.onmessage({ data: { result: { blob, width: 80, height: 60 } } })); }
    terminate() {}
  }
  const response = value => ({ ok: true, json: async () => value });
  const window = { Worker, addEventListener: () => {}, document: { querySelector: () => null, querySelectorAll: () => [],
    addEventListener: (type, handler) => { if (type === 'click') click = handler; } }, fetch: async url => {
      if (url === '/api/upscale') return response({ component: { installed: true, state: 'ready' }, preferences: { scale: 4 }, cacheBytes: 0 });
      if (url.endsWith('/preferences')) return new Promise(resolve => { completeSave = () => resolve(response({ scale: 2 })); });
      uploaded = url; return response({ id: 'saved-choice', state: 'completed', scale: 2, resultUrl: '/result.png' });
    } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../wwwroot/upscale.js'),'utf8'),
    { window, Blob, AbortController, AbortSignal, DOMException, setTimeout, clearTimeout, URL });
  window.DartUpscale.configure({ readImage: async () => { reads++; return new Blob(['pixels']); } });
  await window.DartUpscale.refresh();
  click({ target: { closest: () => ({ dataset: { upscaleScale: '2' } }) }, preventDefault() {} });
  const running = window.DartUpscale.open({ item: { key: 'danbooru:fixture' }, url: 'https://example.test/original.png' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(reads, 0); assert.equal(uploaded, '', 'previous 4x default must not start while 2x is saving');
  completeSave(); await running;
  assert.equal(uploaded, '/api/upscale/jobs?scale=2');
  window.DartUpscale.dispose();
});

function keyboardViewer({ readImage = async () => new Blob(['pixels']), auto = false, installed = true } = {}) {
  const calls = [], handlers = new Map();
  let selected = { item: { key: 'danbooru:first' }, url: 'https://example.test/first.png' }, scale = 4, modal = false;
  let preferenceSave = async patch => ({ scale, auto, ...patch });
  class Worker {
    postMessage({ blob }) { queueMicrotask(() => this.onmessage({ data: { result: { blob, width: 80, height: 60 } } })); }
    terminate() {}
  }
  const window = { Worker, addEventListener() {}, CatalogLogic: { videoMimeType: () => false, mediaCacheKey: url => url.split('?')[0] },
    document: { querySelector: selector => selector.startsWith('dialog[open]') && modal ? {} : null,
      querySelectorAll: () => [], addEventListener: (type, handler) => handlers.set(type, handler),
      removeEventListener: (type, handler) => { if (handlers.get(type) === handler) handlers.delete(type); } },
    fetch: async (url, options = {}) => {
      calls.push({ url, method: options.method, body: options.body });
      if (url === '/api/upscale/preferences') {
        const value = await preferenceSave(JSON.parse(options.body)); scale = value.scale; auto = value.auto;
        return { ok: true, json: async () => value };
      }
      return { ok: true, json: async () => url === '/api/upscale' ?
        { component: { installed, state: 'ready' }, preferences: { scale, auto }, cacheBytes: 0 } :
        { id: 'result-' + calls.length, state: 'completed', scale,
          resultUrl: '/api/upscale/jobs/result-' + calls.length + '/image' } };
    } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../wwwroot/upscale.js'),'utf8'),
    { window, Blob, AbortController, AbortSignal, DOMException, setTimeout, clearTimeout, URL });
  const api = window.DartUpscale;
  api.configure({ readImage, currentImage: () => selected,
    openSettings: () => assert.fail('a ready module or result must not open settings') });
  return { api, calls, window, handlers, get selected() { return selected; }, select: value => { selected = value; },
    scale: value => { scale = value; }, modal: value => { modal = value; },
    saveWith: handler => { preferenceSave = handler; },
    press(options = {}) {
      const event = { code: 'KeyU', repeat: false, ctrlKey: false, metaKey: false, altKey: false,
        target: { closest: () => null }, prevented: false, preventDefault() { this.prevented = true; }, ...options };
      handlers.get('keydown')(event); return event.prevented;
    }, settle: () => new Promise(resolve => setImmediate(resolve)) };
}

test('U starts with the saved default, then toggles the cached result and original without new processing', async t => {
  const viewer = keyboardViewer(); t.after(() => viewer.api.dispose());
  const { item, url } = viewer.selected;
  assert.equal(viewer.press(), true);
  await viewer.settle();
  assert.equal(viewer.api.resultFor(item,url).scale, 4);
  assert.equal(viewer.api.resultFor(item,url).visible, true);
  assert.equal(viewer.calls.filter(call => call.url === '/api/upscale/jobs?scale=4').length, 1);
  const before = viewer.calls.length;
  assert.equal(viewer.press(), true);
  assert.equal(viewer.api.resultFor(item,url).visible, false, 'second U must show the original');
  assert.equal(viewer.press(), true);
  assert.equal(viewer.api.resultFor(item,url).visible, true, 'third U must restore the cached result');
  assert.equal(viewer.press({ repeat: true }), false);
  assert.equal(viewer.api.resultFor(item,url).visible, true, 'holding U must not flicker between images');
  await viewer.settle();
  assert.equal(viewer.calls.length, before, 'comparison must not re-read, normalize or upload the original');
});

test('U restores a hidden result at its completed scale even after the default changes', async t => {
  const viewer = keyboardViewer(); t.after(() => viewer.api.dispose());
  const { item, url } = viewer.selected;
  await viewer.api.open({ item, url });
  viewer.api.restore(item,url);
  viewer.scale(2); await viewer.api.refresh();
  const before = viewer.calls.length;
  viewer.press(); await viewer.settle();
  assert.equal(viewer.api.resultFor(item,url).visible, true);
  assert.equal(viewer.api.resultFor(item,url).scale, 4, 'comparison preserves the completed result');
  assert.equal(viewer.calls.length, before, 'U must not replace an existing result using the new default');
});

test('U keeps hidden results independent and follows the selected original across renewed media URLs', async t => {
  const viewer = keyboardViewer(); t.after(() => viewer.api.dispose());
  const first = viewer.selected;
  await viewer.api.open(first);
  viewer.press();
  const second = { item: first.item, url: 'https://example.test/second.png' };
  viewer.select(second); viewer.press(); await viewer.settle();
  assert.equal(viewer.api.resultFor(first.item,first.url).visible, false);
  assert.equal(viewer.api.resultFor(second.item,second.url).visible, true);
  viewer.press();
  assert.equal(viewer.api.resultFor(second.item,second.url).visible, false);
  viewer.select({ ...first, url: first.url + '?renewed=1' });
  const before = viewer.calls.length;
  viewer.press(); await viewer.settle();
  assert.equal(viewer.api.resultFor(first.item,first.url).visible, true);
  assert.equal(viewer.api.resultFor(second.item,second.url).visible, false);
  assert.equal(viewer.calls.length, before);
});

test('U does not restart a pending upscale or steal typing, menu, modal and Space keys', async t => {
  let completeRead, reads = 0;
  const viewer = keyboardViewer({ readImage: () => { reads++; return new Promise(resolve => { completeRead = resolve; }); } });
  t.after(() => viewer.api.dispose());
  for (const options of [{ repeat: true }, { ctrlKey: true }, { metaKey: true }, { altKey: true }, { code: 'Space' },
    { target: { closest: () => ({ tagName: 'INPUT' }) } }, { target: { closest: () => ({ role: 'menu' }) } }])
    assert.equal(viewer.press(options), false);
  viewer.modal(true); assert.equal(viewer.press(), false); viewer.modal(false);
  assert.equal(viewer.calls.length, 0, 'guarded keys must not start work');
  viewer.press(); viewer.press(); viewer.press({ repeat: true });
  await viewer.settle();
  assert.equal(reads, 1, 'rapid U presses must share the pending original read');
  viewer.press(); await viewer.settle();
  assert.equal(reads, 1, 'a pending upscale must keep running without duplicate work');
  completeRead(new Blob(['pixels'])); await viewer.settle();
  assert.equal(viewer.api.resultFor(viewer.selected.item,viewer.selected.url).visible, true);
  assert.equal(viewer.calls.filter(call => call.url.includes('/jobs?')).length, 1);
});

function autoViewer(options) {
  const viewer = keyboardViewer(options), images = [], observers = [], notices = [];
  let preview = false;
  const checkbox = { checked: false, disabled: false, matches: selector => selector === '[data-upscale-auto]' };
  viewer.window.Image = class {
    constructor() { this.style = {}; }
    setAttribute() {}
    removeAttribute() {}
    decode() { return Promise.resolve(); }
    remove() { this.parentElement = null; }
  };
  viewer.window.IntersectionObserver = class {
    constructor(callback) { this.callback = callback; this.targets = new Set(); observers.push(this); }
    observe(target) { this.targets.add(target); }
    unobserve(target) { this.targets.delete(target); }
    disconnect() { this.targets.clear(); }
  };
  viewer.window.document.querySelector = selector => selector === '.quick-preview[open]' && preview ? {} : null;
  viewer.window.document.querySelectorAll = selector => {
    if (selector === '[data-upscale-auto]') return [checkbox];
    if (selector.startsWith('img.upscale-original-suppressed')) return images.filter(image => image.suppressed);
    if (selector.includes('.detail-image')) return images.filter(image => image.kind !== 'feed');
    return [];
  };
  viewer.api.configure({ toast: value => notices.push(value) });
  return { ...viewer, images, observers, notices, checkbox,
    preview: value => { preview = value; },
    image(url, { kind = 'detail', hidden = false, loaded = true } = {}) {
      const classes = new Set();
      const image = { kind, hidden, complete: loaded, naturalWidth: loaded ? 80 : 0, isConnected: true,
        dataset: { imageUrl: url }, style: {},
        classList: { add: value => classes.add(value), remove: value => classes.delete(value) },
        get suppressed() { return classes.has('upscale-original-suppressed'); },
        parentElement: { append(child) { child.parentElement = this; } },
        closest(selector) {
          if (selector.includes('[hidden]') && this.hidden) return {};
          if (selector.includes('dialog:not([open])') && kind === 'preview' && !preview) return {};
          if (selector === '.quick-preview[open]') return kind === 'preview' && preview ? {} : null;
          if (selector === '.quick-preview') return kind === 'preview' ? {} : null;
          if (selector === '#main') return kind === 'detail' ? {} : null;
          return null;
        } };
      images.push(image); return image;
    },
    intersect(target, visible = true) {
      for (const observer of observers) if (observer.targets.has(target))
        observer.callback([{ target, isIntersecting: visible, intersectionRatio: visible ? 1 : 0 }]);
    },
    loaded(target) { target.complete = true; target.naturalWidth = 80; viewer.handlers.get('load')?.({ target }); },
    changeAuto(value) { checkbox.checked = value; viewer.handlers.get('change')?.({ target: checkbox }); }
  };
}

test('automatic upscale discovers the saved setting once and stays idle when off or the module is absent', async t => {
  for (const options of [{ auto: false }, { auto: true, installed: false }]) {
    let reads = 0;
    const viewer = autoViewer({ ...options, readImage: async () => { reads++; return new Blob(['pixels']); } });
    t.after(() => viewer.api.dispose());
    const image = viewer.image(viewer.selected.url);
    for (let i = 0; i < 5; i++) viewer.api.mounted();
    await viewer.settle();
    viewer.intersect(image); viewer.api.applyVisible(); await viewer.settle();
    assert.equal(viewer.calls.filter(call => call.url === '/api/upscale').length, 1);
    assert.equal(reads, 0);
    assert.equal(viewer.observers.length, 0, 'unused automatic upscale creates no observer');
    assert.equal(viewer.notices.length, 0);
    assert.equal(viewer.checkbox.disabled, !options.auto ? false : true);
  }
});

test('persisted automatic upscale starts only loaded, intersecting images in the current viewer', async t => {
  const read = [];
  const viewer = autoViewer({ auto: true, readImage: async (item,url) => { read.push(url); return new Blob(['pixels']); } });
  t.after(() => viewer.api.dispose());
  const current = viewer.image(viewer.selected.url), offscreen = viewer.image('https://example.test/offscreen.png');
  const unloaded = viewer.image('https://example.test/loading.png', { loaded: false });
  const hidden = viewer.image('https://example.test/hidden.png', { hidden: true });
  const feed = viewer.image('https://example.test/thumb.png', { kind: 'feed' });
  viewer.api.mounted(); await viewer.settle();
  assert.equal(viewer.checkbox.checked, true);
  assert.equal(viewer.observers.length, 1);
  assert.equal(viewer.observers[0].targets.has(hidden), false);
  assert.equal(viewer.observers[0].targets.has(feed), false);
  viewer.intersect(offscreen,false); viewer.intersect(hidden); viewer.intersect(feed); viewer.intersect(unloaded);
  await viewer.settle(); assert.deepEqual(read, []);
  viewer.intersect(current); viewer.intersect(current); viewer.api.applyVisible();
  await viewer.settle();
  assert.deepEqual(read, ['https://example.test/first.png']);
  assert.equal(current.suppressed, true, 'automatic result appears in the existing viewer');
  viewer.loaded(unloaded); await viewer.settle();
  assert.deepEqual(read, ['https://example.test/first.png', 'https://example.test/loading.png']);
  assert.equal(viewer.calls.filter(call => call.url === '/api/upscale/jobs?scale=4').length, 2);
  assert.equal(viewer.notices.length, 0, 'automatic jobs do not produce per-image notifications');
});

test('automatic upscale follows Space preview and preserves U original overrides through visibility changes', async t => {
  const viewer = autoViewer({ auto: true }); t.after(() => viewer.api.dispose());
  const detail = viewer.image(viewer.selected.url), preview = viewer.image(viewer.selected.url, { kind: 'preview' });
  viewer.api.mounted(); await viewer.settle(); viewer.intersect(detail); await viewer.settle();
  assert.equal(detail.suppressed, true);
  viewer.press(); viewer.api.applyVisible(); viewer.intersect(detail); await viewer.settle();
  assert.equal(detail.suppressed, false);
  assert.equal(viewer.api.resultFor(viewer.selected.item,viewer.selected.url).visible, false);
  viewer.preview(true); viewer.api.applyVisible(); viewer.intersect(preview); await viewer.settle();
  assert.equal(viewer.observers[0].targets.has(detail), false, 'the covered detail is not an automatic target');
  assert.equal(preview.suppressed, false, 'Space keeps the manually selected original');
  viewer.press(); await viewer.settle();
  assert.equal(preview.suppressed, true);
  assert.equal(viewer.calls.filter(call => call.url.includes('/jobs?')).length, 1);
});

test('leaving an automatic target cancels its job while a manually claimed pending job keeps running', async t => {
  const signals = [];
  const viewer = autoViewer({ auto: true, readImage: (item,url,signal) => {
    signals.push(signal); return new Promise((resolve,reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted','AbortError')), { once: true }));
  } }); t.after(() => viewer.api.dispose());
  const first = viewer.image(viewer.selected.url);
  viewer.api.mounted(); await viewer.settle(); viewer.intersect(first); await viewer.settle();
  assert.equal(signals.length, 1);
  viewer.intersect(first,false); await viewer.settle();
  assert.equal(signals[0].aborted, true);
  viewer.intersect(first); viewer.api.applyVisible(); await viewer.settle();
  assert.equal(signals.length, 1, 'a cancelled target must not start a retry loop');
  const second = viewer.image('https://example.test/second.png');
  viewer.select({ item: viewer.selected.item, url: second.dataset.imageUrl });
  viewer.api.applyVisible(); viewer.intersect(second); await viewer.settle();
  assert.equal(signals.length, 2);
  viewer.press(); await viewer.settle();
  viewer.intersect(second,false); viewer.changeAuto(false); await viewer.settle();
  assert.equal(signals[1].aborted, false, 'manual U claims the existing job without restarting it');
});

test('a pending automatic job follows the same image from detail into Space without a duplicate or cancellation', async t => {
  let signal, completeRead, reads = 0;
  const viewer = autoViewer({ auto: true, readImage: (item,url,readSignal) => {
    reads++; signal = readSignal; return new Promise(resolve => { completeRead = resolve; });
  } }); t.after(() => viewer.api.dispose());
  const detail = viewer.image(viewer.selected.url), preview = viewer.image(viewer.selected.url, { kind: 'preview' });
  viewer.api.mounted(); await viewer.settle(); viewer.intersect(detail); await viewer.settle();
  viewer.preview(true); viewer.api.applyVisible();
  assert.equal(signal.aborted, false, 'the same visible media keeps its pending job while its new node is observed');
  viewer.intersect(preview); await viewer.settle();
  assert.equal(reads, 1);
  completeRead(new Blob(['pixels'])); await viewer.settle();
  assert.equal(preview.suppressed, true);
  assert.equal(viewer.calls.filter(call => call.url.includes('/jobs?')).length, 1);
});

test('turning automatic upscale off cancels its pending work and disconnects targets', async t => {
  let signal;
  const viewer = autoViewer({ auto: true, readImage: (item,url,readSignal) => {
    signal = readSignal; return new Promise((resolve,reject) => readSignal.addEventListener('abort', () => reject(new DOMException('Aborted','AbortError')), { once: true }));
  } }); t.after(() => viewer.api.dispose());
  const image = viewer.image(viewer.selected.url);
  viewer.api.mounted(); await viewer.settle(); viewer.intersect(image); await viewer.settle();
  viewer.changeAuto(false); await viewer.settle();
  assert.equal(signal.aborted, true);
  assert.equal(viewer.observers[0].targets.size, 0);
  assert.equal(viewer.checkbox.checked, false);
  assert.equal(viewer.api.stateFor(viewer.selected.item,viewer.selected.url).state, 'cancelled');
});

test('a hidden document stops automatic work without starting background processing', async t => {
  let signal;
  const viewer = autoViewer({ auto: true, readImage: (item,url,readSignal) => {
    signal = readSignal; return new Promise((resolve,reject) => readSignal.addEventListener('abort', () => reject(new DOMException('Aborted','AbortError')), { once: true }));
  } }); t.after(() => viewer.api.dispose());
  const image = viewer.image(viewer.selected.url);
  viewer.api.mounted(); await viewer.settle(); viewer.intersect(image); await viewer.settle();
  viewer.window.document.hidden = true;
  viewer.handlers.get('visibilitychange')?.(); await viewer.settle();
  assert.equal(signal.aborted, true);
  assert.equal(viewer.observers[0].targets.size, 0);
  assert.equal(viewer.calls.filter(call => call.url.includes('/jobs?')).length, 0);
});

test('automatic failures are attempted once without notifications or repeated processing', async t => {
  let reads = 0;
  const viewer = autoViewer({ auto: true, readImage: async () => { reads++; throw new Error('image'); } });
  t.after(() => viewer.api.dispose());
  const image = viewer.image(viewer.selected.url);
  viewer.api.mounted(); await viewer.settle(); viewer.intersect(image); await viewer.settle();
  for (let i = 0; i < 5; i++) { viewer.api.applyVisible(); viewer.intersect(image); }
  await viewer.settle();
  assert.equal(reads, 1);
  assert.equal(viewer.api.stateFor(viewer.selected.item,viewer.selected.url).state, 'error');
  assert.equal(viewer.notices.length, 0);
});

test('automatic failures stay bounded even after more than the recent-attempt cache of visible targets', async t => {
  let reads = 0;
  const viewer = autoViewer({ auto: true, readImage: async () => {
    reads++;
    if (reads <= 129) throw new Error('image');
    return new Promise(() => {});
  } }); t.after(() => viewer.api.dispose());
  const images = Array.from({ length: 129 }, (_, index) => viewer.image('https://example.test/' + index + '.png'));
  viewer.api.mounted(); await viewer.settle();
  for (const image of images) viewer.intersect(image);
  await viewer.settle();
  assert.equal(reads, 129, 'each connected target may be attempted once; evicting recent metadata must not restart failures');
});

test('automatic preference saves disable the control, roll back failures and preserve scale and auto independently', async t => {
  const viewer = autoViewer({ auto: true }); t.after(() => viewer.api.dispose());
  viewer.api.mounted(); await viewer.settle();
  let rejectSave;
  viewer.saveWith(() => new Promise((resolve,reject) => { rejectSave = reject; }));
  viewer.changeAuto(false);
  assert.equal(viewer.checkbox.disabled, true);
  assert.equal(viewer.checkbox.checked, false);
  rejectSave(new Error('storage')); await viewer.settle();
  assert.equal(viewer.checkbox.disabled, false);
  assert.equal(viewer.checkbox.checked, true, 'a failed write restores the persisted setting');
  viewer.saveWith(async patch => ({ scale: 2, auto: true, ...patch }));
  viewer.handlers.get('click')({ target: { closest: () => ({ dataset: { upscaleScale: '2' } }) }, preventDefault() {} });
  await viewer.settle();
  assert.equal(viewer.checkbox.checked, true);
  assert.deepEqual(JSON.parse(viewer.calls.at(-1).body), { scale: 2 });
  viewer.changeAuto(false); await viewer.settle();
  assert.equal(viewer.checkbox.checked, false);
  assert.deepEqual(JSON.parse(viewer.calls.at(-1).body), { auto: false });
  await viewer.api.open(viewer.selected);
  assert.equal(viewer.calls.filter(call => call.url.includes('/jobs?')).at(-1).url, '/api/upscale/jobs?scale=2');
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const lab = path.resolve(__dirname, '..');
const workerPath = path.join(lab, 'wwwroot/catalog-worker.js');

function fixture({ missing = false } = {}) {
  let release;
  const pending = new Promise(resolve => release = resolve);
  const messages = [], handlers = new Map(), imports = [];
  const context = vm.createContext({
    CatalogLogic: { groupFollowFeed: (...args) => ({ args }), mergeRecommendations: (...args) => ({ args }) },
    DartVisualSearchModule: { calls: 0, load() { this.calls++; return pending; } },
    self: { addEventListener(name, callback) { handlers.set(name, callback); }, postMessage(value) { messages.push(value); } },
    importScripts(...urls) {
      for (const url of urls) {
        imports.push(url);
        if (url === '/visual-search.js' && missing) throw new Error('Controlled missing optional script');
        if (url === '/visual-search-loader.js')
          vm.runInContext(fs.readFileSync(path.join(lab, 'wwwroot/visual-search-loader.js'), 'utf8'), context);
      }
    },
  });
  vm.runInContext(fs.readFileSync(workerPath, 'utf8'), context);
  return { context, messages, handlers, imports, release, send(data) { handlers.get('message')({ data }); } };
}

test('cold worker loads the optional Rust core without delaying its first result', async () => {
  const f = fixture();
  assert.equal(f.context.DartVisualSearchModule.calls, 1);
  f.send({ id: 1, operation: 'followFeed', args: [[{ items: [] }], 'all'] });
  assert.equal(f.messages.length, 1, 'A pending WASM download cannot hold the worker response');
  assert.equal(f.messages[0].id, 1);
  assert.ok(f.messages[0].value);
  f.release(null);
});

test('an optional script failure preserves the worker message protocol', () => {
  const f = fixture({ missing: true });
  f.send({ id: 2, operation: 'followFeed', args: [[], 'general'] });
  assert.equal(f.messages[0].id, 2);
  assert.ok(f.messages[0].value);
  assert.equal(f.context.DartVisualSearchModule.calls, 0);
});

test('recommendation profile reuse and overlapping job identities stay intact', () => {
  const f = fixture();
  f.send({ id: 3, profileId: 7, args: [[{ key: 'neutral:1' }], ['first']] });
  f.send({ id: 4, profileId: 7, args: [null, ['second']] });
  f.send({ id: 5, operation: 'followFeed', args: [[], 'all'] });
  assert.deepEqual(f.messages.map(message => message.id), [3, 4, 5]);
  assert.equal(f.messages[1].value.args[0][0].key, 'neutral:1');
  assert.equal(f.messages[1].value.args[1][0], 'second');
  assert.equal(f.context.DartVisualSearchModule.calls, 1);
  f.release(null);
});

test('main-page bootstrap tolerates missing and rejected optional modules', async () => {
  const source = fs.readFileSync(path.join(lab, 'wwwroot/visual-search-loader.js'), 'utf8');
  vm.runInNewContext(source, {});
  let observed = false;
  vm.runInNewContext(source, { DartVisualSearchModule: { load() {
    return { catch(callback) { observed = true; callback(new Error('Controlled optional failure')); } };
  } } });
  assert.equal(observed, true);
  vm.runInNewContext(source, { DartVisualSearchModule: { load() { throw new Error('Optional failed'); } } });
});

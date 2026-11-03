'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
const start = source.indexOf('async function loadBookmarks('), end = source.indexOf('\nasync function loadSettings(', start);

function fixture(collection, loaded) {
  const item = { key: 'danbooru:1', source: 'danbooru', title: 'Neutral landscape' };
  const initial = [item], tab = { id: 1, kind: collection, items: [], started: true };
  const paints = []; let reads = 0, resolveRead;
  const context = vm.createContext({ likes: collection === 'likes' ? initial : [], bookmarks: collection === 'bookmarks' ? initial : [], activeId: tab.id,
    refreshSavedWorks: { states: { [collection]: { loaded } } },
    render() { paints.push({ items: tab.items, loading: tab.loading }); },
    [collection === 'likes' ? 'refreshLikes' : 'refreshBookmarks']: () => {
      reads++;
      return new Promise(resolve => { resolveRead = resolve; });
    }
  });
  vm.runInContext(source.slice(start, end), context);
  return { context, tab, initial, paints, reads: () => reads,
    load: () => context[collection === 'likes' ? 'loadLikes' : 'loadBookmarks'](tab),
    finish(ok = true, items = initial) { context[collection] = items; resolveRead(ok); }
  };
}

for (const collection of ['likes', 'bookmarks']) {
  test(`opening cached ${collection} paints the completed list once without another collection read`, async () => {
    const f = fixture(collection, true);
    await f.load();
    assert.equal(f.reads(), 0);
    assert.equal(f.paints.length, 1, 'A cached list must not do two identical synchronous full feed paints');
    assert.strictEqual(f.paints[0].items, f.initial);
    assert.equal(f.paints[0].loading, false);
  });

  test(`cached empty ${collection} paints its final empty state once`, async () => {
    const f = fixture(collection, true), empty = [];
    f.context[collection] = empty;
    await f.load();
    assert.equal(f.reads(), 0);
    assert.equal(f.paints.length, 1);
    assert.strictEqual(f.paints[0].items, empty);
    assert.equal(f.paints[0].loading, false);
  });

  test(`uncached ${collection} paints its loading state and the fresh result in order`, async () => {
    const f = fixture(collection, false), pending = f.load();
    assert.equal(f.reads(), 1);
    assert.equal(f.paints.length, 1);
    assert.equal(f.paints[0].loading, true);
    const fresh = [{ key: 'danbooru:2', source: 'danbooru', title: 'Neutral river' }];
    f.finish(true, fresh); await pending;
    assert.equal(f.paints.length, 2);
    assert.equal(f.paints[1].loading, false);
    assert.strictEqual(f.paints[1].items, fresh);
  });

  test(`a failed ${collection} load clears loading and remains retryable with existing works`, async () => {
    const f = fixture(collection, false), pending = f.load();
    f.finish(false); await pending;
    assert.equal(f.tab.started, false);
    assert.equal(f.tab.loading, false);
    assert.strictEqual(f.tab.items, f.initial);
    assert.equal(f.paints.length, 2);
    assert.equal(f.paints[1].loading, false);
  });

  test(`a ${collection} reply after switching tabs updates data without painting the other tab`, async () => {
    const f = fixture(collection, false), pending = f.load();
    f.context.activeId = 2;
    const fresh = [{ key: 'danbooru:3', source: 'danbooru', title: 'Neutral forest' }];
    f.finish(true, fresh); await pending;
    assert.strictEqual(f.tab.items, fresh);
    assert.equal(f.tab.loading, false);
    assert.equal(f.paints.length, 1);
  });
}

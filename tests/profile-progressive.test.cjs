const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const CatalogLogic = require('../wwwroot/catalog-logic.js');

const source = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
const start = source.indexOf('async function loadSearch(');
const end = source.indexOf('\nfunction setSavedWorks(', start);

test('artist profile displays ready sources while another source is pending', async () => {
  assert(start >= 0 && end > start);
  let releaseRule34;
  const slow = new Promise(resolve => { releaseRule34 = resolve; });
  const tab = { id: 1, kind: 'profile', profileRef: { source: 'artist', artist: 'sample' },
    query: 'sample', rating: 'all', sort: 'recent', feed: 'illustrations',
    selectedSources: ['danbooru', 'rule34'], items: [] };
  const rendered = [];
  const requests = [];
  const context = vm.createContext({ CatalogLogic, AbortController, URLSearchParams,
    activeId: 1, findTab: id => id === 1 ? tab : null,
    render: () => rendered.push(tab.items.map(item => item.key)),
    rememberItems() {},
    request: async url => {
      const sources = new URL(url, 'http://fixture').searchParams.get('sources');
      requests.push(sources);
      if (sources === 'rule34') await slow;
      return { items: [{ key: `${sources}:1`, source: sources, rating: 'e',
        published: '2026-01-01T00:00:00Z' }],
        sourceStats: { [sources]: { received: 1, returned: 1 } },
        hasMoreSources: [], errors: {} };
    }
  });
  const loadSearch = vm.runInContext(source.slice(start, end) + '\nloadSearch', context);
  const loading = loadSearch(tab);
  await new Promise(resolve => setImmediate(resolve));
  assert(requests.includes('danbooru'));
  assert(requests.includes('rule34'));
  assert.deepEqual(Array.from(tab.items, item => item.key), ['danbooru:1']);
  assert(rendered.some(keys => keys.includes('danbooru:1')));
  releaseRule34();
  await loading;
  assert.deepEqual(Array.from(tab.items, item => item.key), ['danbooru:1', 'rule34:1']);
});

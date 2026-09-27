const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const CatalogLogic = require('../wwwroot/catalog-logic.js');
const source = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
function getFunction(name, next, context = {}) {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf(`\nfunction ${next}(`, start);
  assert(start >= 0 && end > start);
  return vm.runInNewContext(source.slice(start, end) + `\n${name}`, context);
}

test('MP4 and WebM autoplay muted and loop while GIF remains an image', () => {
  const render = getFunction('renderDetailImage', 'ratingLabel', {
    CatalogLogic, escapeHtml: value => String(value).replaceAll('"', '&quot;'),
    imageLoader: { cached: () => undefined }
  });
  const item = { title: 'animation', thumbnail: 'https://cdn.donmai.us/preview/a.jpg' };
  for (const extension of ['mp4', 'webm']) {
    const html = render(item, `https://cdn.donmai.us/original/a.${extension}?v=1`, 0);
    assert.match(html, /<video\b/);
    assert.match(html, /\bcontrols\b/);
    assert.match(html, /\bautoplay\b/);
    assert.match(html, /\bmuted\b/);
    assert.match(html, /\bloop\b/);
    assert.match(html, /preload="metadata"/);
    assert.match(html, /\/api\/video\?url=/);
    assert.doesNotMatch(html, /data-image-url/);
  }
  assert.match(render(item, 'https://cdn.donmai.us/original/a.gif', 0), /<img\b/);
});

test('bookmark and pagination renders preserve the same player but replace a different video', () => {
  const canReconcile = getFunction('canReconcileNode', 'reconcileChildren', {
    Node: { ELEMENT_NODE: 1 }
  });
  const player = url => ({ nodeType: 1, tagName: 'VIDEO', dataset: { videoUrl: url } });
  assert.equal(canReconcile(player('one.mp4'), player('one.mp4')), true);
  assert.equal(canReconcile(player('one.mp4'), player('two.mp4')), false);
});

test('leaving the artwork pauses playing media', () => {
  let paused = 0;
  const pause = getFunction('pauseDetailVideos', 'render', {
    main: { querySelectorAll: () => [{ pause: () => paused++ }, { pause: () => paused++ }] }
  });
  pause();
  assert.equal(paused, 2);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const CatalogLogic = require('../wwwroot/catalog-logic.js');
const source = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');

function extract(startMarker, endMarker, result, context = {}) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `${result} source is available`);
  return vm.runInNewContext(source.slice(start, end) + `\n${result}`, context);
}

// Only the DOM operations used by reconciliation and image subscriptions are
// needed here; media reads and native browser layout stay outside these tests.
class Element {
  constructor(tagName, attributes = {}) {
    this.nodeType = 1;
    this.tagName = tagName.toUpperCase();
    this.attrs = { ...attributes };
    this.childNodes = [];
    this.parentNode = null;
    this.isConnected = true;
    this.dataset = new Proxy({}, {
      get: (_, name) => this.getAttribute('data-' + String(name).replace(/[A-Z]/g, c => '-' + c.toLowerCase())) || undefined,
      set: (_, name, value) => {
        this.setAttribute('data-' + String(name).replace(/[A-Z]/g, c => '-' + c.toLowerCase()), String(value));
        return true;
      }
    });
    this.classList = {
      contains: name => (this.attrs.class || '').split(/\s+/).includes(name),
      add: name => { if (!this.classList.contains(name)) this.attrs.class = `${this.attrs.class || ''} ${name}`.trim(); },
      remove: name => { this.attrs.class = (this.attrs.class || '').split(/\s+/).filter(value => value !== name).join(' '); }
    };
  }
  get attributes() { return Object.entries(this.attrs).map(([name, value]) => ({ name, value })); }
  get firstChild() { return this.childNodes[0] || null; }
  get nextSibling() {
    const siblings = this.parentNode?.childNodes || [];
    return siblings[siblings.indexOf(this) + 1] || null;
  }
  get src() { return this.getAttribute('src') || ''; }
  set src(value) { this.setAttribute('src', value); }
  getAttribute(name) { return this.attrs[name] ?? null; }
  hasAttribute(name) { return Object.hasOwn(this.attrs, name); }
  setAttribute(name, value) { this.attrs[name] = String(value); }
  removeAttribute(name) { delete this.attrs[name]; }
  matches(selector) {
    return selector.split(',').some(part => {
      const tag = part.trim().match(/^[a-z]+/i)?.[0];
      const classes = [...part.matchAll(/\.([\w-]+)/g)].map(match => match[1]);
      const attrs = [...part.matchAll(/\[([\w-]+)\]/g)].map(match => match[1]);
      return (!tag || this.tagName === tag.toUpperCase()) &&
        classes.every(name => this.classList.contains(name)) && attrs.every(name => this.hasAttribute(name));
    });
  }
  closest(selector) { return this.matches(selector) ? this : this.parentNode?.closest(selector) || null; }
  querySelectorAll(selector) {
    return this.childNodes.flatMap(child => [
      ...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)
    ]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  getBoundingClientRect() { return { top: 100, bottom: 300, left: 0, right: 200 }; }
  insertBefore(node, cursor) {
    node.remove();
    const index = cursor ? this.childNodes.indexOf(cursor) : this.childNodes.length;
    assert.ok(index >= 0, 'Insertion cursor belongs to this parent');
    this.childNodes.splice(index, 0, node);
    node.parentNode = this;
    node.isConnected = this.isConnected;
  }
  replaceWith(node) {
    const parent = this.parentNode;
    assert.ok(parent, 'Replacement target belongs to a parent');
    parent.insertBefore(node, this);
    this.remove();
  }
  remove() {
    if (!this.parentNode) return;
    const siblings = this.parentNode.childNodes;
    siblings.splice(siblings.indexOf(this), 1);
    this.parentNode = null;
    this.isConnected = false;
  }
}

function parseElements(markup) {
  const root = new Element('main');
  const stack = [root];
  for (const match of markup.matchAll(/<(\/?)(([a-z][\w-]*))([^>]*)>/gi)) {
    if (match[1]) { stack.pop(); continue; }
    const attributes = Object.fromEntries([...match[4].matchAll(/([^\s=]+)(?:="([^"]*)")?/g)]
      .map(attribute => [attribute[1], attribute[2] || '']));
    const element = new Element(match[2], attributes);
    stack.at(-1).insertBefore(element, null);
    if (!['img', 'input', 'br', 'hr'].includes(match[2].toLowerCase())) stack.push(element);
  }
  return root.firstChild;
}

function gridHarness() {
  const tab = { id: 1, kind: 'bookmarks' };
  const main = { clientHeight: 900, scrollTop: 0, dataset: { tabId: '1' } };
  const renderGrid = extract('function renderGrid(', '\nfunction measureVirtualGrids(', 'renderGrid', {
    currentTab: () => tab, main, CatalogLogic, escapeHtml: String,
    filterFeedWorks: items => items,
    renderCard: item => `<article class="card" data-work-key="${item.key}"><button class="card-art"><img data-image-url="https://example.org/${item.key}.jpg"><img class="video-preview-frame" hidden></button></article>`
  });
  const reconcileNode = extract('function workMemberKeys(', '\nfunction renderHome(', 'reconcileNode', {
    Node: { ELEMENT_NODE: 1 }, CatalogLogic, document: {}
  });
  return {
    render: count => parseElements(renderGrid(Array.from({ length: count }, (_, index) => ({ key: `work:${index}` })), 'bookmarks')),
    reconcileNode
  };
}

for (const [before, after] of [[160, 161], [161, 160]]) {
  test(`crossing ${before} to ${after} works preserves visible card and decoded preview nodes`, () => {
    const harness = gridHarness();
    const wrapper = harness.render(before);
    const grid = wrapper.querySelector('.grid');
    const card = grid.firstChild;
    const image = card.querySelector('img[data-image-url]');
    const frame = card.querySelector('.video-preview-frame');
    image.src = 'blob:decoded-thumbnail';
    frame.src = 'blob:playing-preview';
    frame.removeAttribute('hidden');

    harness.reconcileNode(wrapper, harness.render(after));

    assert.ok(wrapper.querySelector('.grid') === grid, 'Virtual spacers must not consume the existing card grid');
    assert.ok(grid.firstChild === card, 'An overlapping visible card must retain its DOM identity');
    assert.ok(card.querySelector('img[data-image-url]') === image, 'Decoded thumbnail must retain its DOM identity');
    assert.equal(image.src, 'blob:decoded-thumbnail');
    assert.ok(card.querySelector('.video-preview-frame') === frame, 'Playing hover preview must retain its DOM identity');
    assert.equal(frame.src, 'blob:playing-preview');
    assert.equal(frame.hasAttribute('hidden'), false, 'Background reconciliation must not hide a playing hover preview');
  });
}

function loaderHarness(count = 3) {
  const images = Array.from({ length: count }, (_, index) => new Element('img', {
    'data-image-url': `https://example.org/${index}.jpg`, src: `blob:cached-${index}`
  }));
  const subscriptions = { observed: [], unobserved: [], disconnects: 0 };
  class IntersectionObserver {
    constructor(callback) { this.callback = callback; }
    observe(image) { subscriptions.observed.push(image); }
    unobserve(image) { subscriptions.unobserved.push(image); }
    disconnect() { subscriptions.disconnects++; }
  }
  const root = {
    images, clientHeight: 900,
    querySelectorAll(selector) { return this.images.filter(image => image.matches(selector)); },
    getBoundingClientRect: () => ({ top: 0, bottom: 900 })
  };
  const reads = [];
  const loader = extract('const imageLoader = {', '\nconst autoFeed = {', 'imageLoader', {
    IntersectionObserver, main: root, CatalogLogic, URL, AbortController,
    readMediaBlob: url => { reads.push(url); return new Promise(() => {}); }
  });
  images.forEach((image, index) => loader.cache.set(image.dataset.imageUrl, {
    blobUrl: `blob:cached-${index}`, size: 20
  }));
  return { loader, root, images, subscriptions, reads };
}

test('unchanged image refresh preserves visibility subscriptions without re-observing cached nodes', () => {
  const { loader, root, subscriptions } = loaderHarness();
  loader.mount(root);
  const initialDisconnects = subscriptions.disconnects;
  for (let index = 0; index < 5; index++) loader.refresh(root);
  assert.equal(subscriptions.disconnects, initialDisconnects, 'Same-tab refresh must keep the current observer connected');
  assert.equal(subscriptions.observed.length, 3, 'Unchanged images should be observed once');
});

test('image refresh subscribes additions and removes stale subscriptions without resetting retained images', () => {
  const { loader, root, images, subscriptions } = loaderHarness();
  loader.mount(root);
  const initialDisconnects = subscriptions.disconnects;
  const removed = images[0];
  removed.isConnected = false;
  const added = new Element('img', { 'data-image-url': 'https://example.org/added.jpg' });
  root.images = [images[1], images[2], added];
  loader.refresh(root);
  assert.equal(subscriptions.disconnects, initialDisconnects, 'Retained images must stay observed');
  assert.equal(subscriptions.observed.filter(image => image === added).length, 1, 'New image should be subscribed');
  assert.equal(subscriptions.observed.filter(image => image === images[1]).length, 1, 'Retained image should not be subscribed again');
  assert.ok(subscriptions.unobserved.includes(removed), 'Removed images must release their observer subscription');
});

test('an already-visible image with a changed URL starts loading without another intersection event', async () => {
  const { loader, root, images, reads } = loaderHarness(1);
  loader.mount(root);
  const image = images[0];
  loader.observer.callback([{ target: image, isIntersecting: true }]);
  image.dataset.imageUrl = 'https://example.org/replacement.jpg';
  loader.refresh(root);
  await Promise.resolve();
  assert.deepEqual(reads, ['https://example.org/replacement.jpg'], 'A retained visible node still needs its replacement media loaded');
  assert.equal(image.src, 'blob:cached-0', 'Keep the decoded preview while replacement pixels are loading');
});

test('adopting a decoded detached image keeps its exact source and the target artwork attributes', () => {
  const { loader } = loaderHarness(0);
  const root = new Element('main');
  const url = 'https://example.org/full.jpg';
  const target = new Element('img', { src: 'blob:decoded-full',
    'data-image-url': url, 'data-preview-url': 'https://example.org/thumb.jpg',
    'data-action': 'zoom-image', role: 'button', tabindex: '0',
    alt: 'Current artwork', 'aria-label': 'Enlarge current artwork' });
  root.insertBefore(target, null);
  const decoded = new Element('img', { src: 'blob:decoded-full',
    'data-stale': 'previous-artwork', role: 'presentation', alt: 'Previous artwork' });
  decoded.naturalWidth = 960;
  decoded.isConnected = false;
  let sourceWrites = 0;
  const setAttribute = decoded.setAttribute;
  decoded.setAttribute = function(name, value) {
    if (name === 'src') sourceWrites++;
    return setAttribute.call(this, name, value);
  };
  loader.cache.set(url, { blobUrl: 'blob:decoded-full', image: decoded, size: 20 });

  loader.adopt(root);

  assert.ok(root.firstChild === decoded, 'Use the actual decoded element before the first paint');
  assert.equal(target.parentNode, null);
  assert.equal(sourceWrites, 0, 'Even assigning the same src can schedule another image load');
  assert.deepEqual(Object.fromEntries(decoded.attributes.map(({ name, value }) => [name, value])), {
    src: 'blob:decoded-full', 'data-image-url': url,
    'data-preview-url': 'https://example.org/thumb.jpg', 'data-action': 'zoom-image',
    role: 'button', tabindex: '0', alt: 'Current artwork', 'aria-label': 'Enlarge current artwork'
  });
});

test('adopting media never steals a decoded image that is still connected elsewhere', () => {
  const { loader } = loaderHarness(0);
  const url = 'https://example.org/shared.jpg';
  const owner = new Element('section');
  const connected = new Element('img', { src: 'blob:shared', alt: 'Visible original' });
  connected.naturalWidth = 960;
  owner.insertBefore(connected, null);
  const root = new Element('main');
  const target = new Element('img', { 'data-image-url': url, src: 'blob:shared', alt: 'New target' });
  root.insertBefore(target, null);
  loader.cache.set(url, { blobUrl: 'blob:shared', image: connected, size: 20 });

  loader.adopt(root);

  assert.ok(owner.firstChild === connected, 'The existing screen must retain its visible image');
  assert.ok(root.firstChild === target, 'A connected cache image cannot replace another screen target');
  assert.equal(connected.getAttribute('alt'), 'Visible original');
  assert.equal(target.getAttribute('alt'), 'New target');
});

test('adopting a prepared thumbnail chooses the decoded preview while the full image is not decoded', () => {
  const { loader } = loaderHarness(0);
  const root = new Element('main');
  const fullUrl = 'https://example.org/full-pending.jpg';
  const previewUrl = 'https://example.org/ready-thumbnail.jpg';
  const full = new Element('img', { src: 'blob:pending-full' });
  full.naturalWidth = 0;
  full.isConnected = false;
  const thumbnail = new Element('img', { src: 'blob:ready-thumbnail' });
  thumbnail.naturalWidth = 320;
  thumbnail.isConnected = false;
  const target = new Element('img', { 'data-image-url': fullUrl, 'data-preview-url': previewUrl,
    src: 'blob:ready-thumbnail', role: 'button', alt: 'Thumbnail while full artwork loads' });
  root.insertBefore(target, null);
  loader.cache.set(fullUrl, { blobUrl: 'blob:pending-full', image: full, size: 20 });
  loader.cache.set(previewUrl, { blobUrl: 'blob:ready-thumbnail', image: thumbnail, size: 20 });

  loader.adopt(root);

  assert.ok(root.firstChild === thumbnail, 'Match the ready preview source instead of taking the first full-size entry');
  assert.equal(thumbnail.src, 'blob:ready-thumbnail');
  assert.equal(thumbnail.dataset.imageUrl, fullUrl, 'Keep the full-size request on the adopted thumbnail');
  assert.equal(thumbnail.dataset.previewUrl, previewUrl);
  assert.equal(thumbnail.getAttribute('role'), 'button');
  assert.equal(full.parentNode, null, 'An undecoded full-size element must stay detached');
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'wwwroot', 'app.js'), 'utf8');

function extract(startMarker, endMarker, name, context = {}) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `${name} is available`);
  return vm.runInNewContext(source.slice(start, end) + `\n${name}`, context);
}

function image(name, options = {}) {
  return {
    name, complete: options.complete ?? true,
    naturalWidth: options.width ?? 200, naturalHeight: options.height ?? 200,
    currentSrc: options.src ?? `blob:${name}`,
    getBoundingClientRect: () => options.bounds ||
      { top: 80, bottom: 180, left: 10, right: 110 },
    closest: () => ({ classList: { contains: () => !!options.failed } })
  };
}

test('profile banner chooses randomly only among visible, loaded work thumbnails', () => {
  const select = extract('function selectLoadedProfileImage(',
    '\nfunction createProfileBannerThumbnail(', 'selectLoadedProfileImage');
  const first = image('first');
  const second = image('second');
  const unloaded = image('unloaded', { complete: false });
  const offscreen = image('offscreen', { bounds:
    { top: 500, bottom: 600, left: 10, right: 110 } });
  const failed = image('failed', { failed: true });
  const root = { querySelectorAll: () =>
    [first, unloaded, offscreen, failed, second] };
  const viewport = { getBoundingClientRect: () =>
    ({ top: 0, bottom: 400, left: 0, right: 800 }) };
  assert.equal(select(root, viewport, () => 0), first);
  assert.equal(select(root, viewport, () => 0.99), second);
  assert.equal(select({ querySelectorAll: () => [unloaded, offscreen] }, viewport), null);
});

test('profile banner makes a small image from the existing decoded thumbnail', () => {
  const draws = [];
  const canvas = {
    getContext: () => ({ drawImage: (...args) => draws.push(args) }),
    toDataURL: (format, quality) => {
      assert.equal(format, 'image/webp');
      assert.ok(quality <= 0.5);
      return 'data:image/webp;base64,AA';
    }
  };
  const create = extract('function createProfileBannerThumbnail(',
    '\nfunction scheduleProfileBanner(', 'createProfileBannerThumbnail',
    { document: { createElement: () => canvas } });
  const loaded = image('ready', { width: 1000, height: 700 });
  const banner = { getBoundingClientRect: () => ({ width: 1200, height: 205 }) };
  assert.equal(create(loaded, banner), 'data:image/webp;base64,AA');
  assert.ok(canvas.width <= 320 && canvas.height <= 120);
  assert.equal(draws.length, 1);
  assert.equal(draws[0][0], loaded);
});

test('profile shows the prepared banner without a second image URL', () => {
  const renderProfile = extract('function renderProfile(', '\nfunction renderList(',
    'renderProfile', { names: { danbooru: 'Danbooru' },
      escapeHtml: value => String(value), followButton: () => '',
      renderErrors: () => '', renderGrid: () => '', renderFeedTail: () => '',
      skeletons: () => '' });
  const tab = { kind: 'profile', title: 'artist',
    profileRef: { source: 'danbooru', artist: 'artist' },
    profile: { name: 'artist' }, rating: 'all', items: [],
    profileBanner: 'data:image/webp;base64,AA' };
  const html = renderProfile(tab);
  assert.match(html, /class="profile-banner-art"[^>]*src="data:image\/webp;base64,AA"/);
  assert.doesNotMatch(html, /api\/image/);
});

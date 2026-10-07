const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const Gestures = require('../wwwroot/artwork-gestures.js');

function fixture() {
  let time = 0, next = 0;
  const timers = new Map(), actions = [], likeEvents = [], context = {};
  const gesture = Gestures.create({
    resolve: event => event.choice,
    like: (item, event) => { actions.push('like:' + item.key); likeEvents.push(event); },
    schedule: (run, delay) => { const id = ++next; timers.set(id, { run, at: time + delay }); return id; },
    unschedule: id => timers.delete(id)
  });
  const choice = target => ({ context, target, item: { key: target },
    single: () => actions.push('open:' + target) });
  const click = (target, options = {}) => {
    const event = { button: 0, detail: 1, clientX: 20, clientY: 30,
      choice: typeof target === 'string' ? choice(target) : target,
      preventDefault() { this.prevented = true; }, ...options };
    return { handled: gesture.click(event), event };
  };
  const advance = ms => {
    time += ms;
    for (const [id, entry] of [...timers]) if (entry.at <= time) {
      timers.delete(id); entry.run();
    }
  };
  return { gesture, choice, click, advance, actions, likeEvents, timers };
}

test('one image click opens once after the double-click window', () => {
  const f = fixture();
  assert.equal(f.click('a').handled, true);
  f.advance(299); assert.deepEqual(f.actions, []);
  f.advance(1); assert.deepEqual(f.actions, ['open:a']);
  assert.equal(f.timers.size, 0);
});

test('two fast clicks like once without opening, including native double-click and extra clicks', () => {
  const f = fixture();
  f.click('a'); f.advance(80); f.click('a', { detail: 2 });
  assert.equal(f.gesture.dblclick({ choice: f.choice('a'), preventDefault() {} }), true);
  f.click('a', { detail: 3 }); f.click('a', { detail: 4 });
  f.advance(1000); assert.deepEqual(f.actions, ['like:a']);
  assert.equal(f.timers.size, 0);
});

test('different images and different tabs never form a double-click like', () => {
  const f = fixture();
  f.click('a'); f.advance(80); f.click('b');
  f.advance(300); assert.deepEqual(f.actions, ['open:b']);
  f.actions.length = 0;
  const a = f.choice('a'); f.click(a);
  f.click({ ...a, context: {} }); f.advance(300);
  assert.deepEqual(f.actions, ['open:a']);
});

test('image like feedback receives the second click coordinates without another like on dblclick', () => {
  const f = fixture();
  f.click('a');
  const second = f.click('a', { detail: 2, clientX: 23, clientY: 32 });
  assert.equal(f.likeEvents[0], second.event);
  assert.equal(f.likeEvents[0].clientX, 23);
  assert.equal(f.likeEvents[0].clientY, 32);
  f.gesture.dblclick(second.event);
  f.advance(400);
  assert.equal(f.likeEvents.length, 1);
  assert.deepEqual(f.actions, ['like:a']);
});

test('a busy browser cannot treat slow clicks as a like while its timer is delayed', () => {
  const f = fixture();
  f.click('a', { timeStamp: 100 });
  f.click('a', { timeStamp: 900 });
  f.advance(300); assert.deepEqual(f.actions, ['open:a']);
});

test('leaving a viewer or changing its artwork cancels a delayed open', () => {
  const f = fixture(); let current = true;
  f.click({ ...f.choice('a'), valid: () => current });
  current = false; f.advance(400); assert.deepEqual(f.actions, []);
  f.click('a'); f.gesture.cancel(); f.advance(400);
  assert.deepEqual(f.actions, []);
});

test('keyboard, touch, modified and non-left clicks keep their existing immediate actions', () => {
  for (const options of [{ detail: 0 }, { pointerType: 'touch' }, { button: 1 }, { button: 2 },
    { ctrlKey: true }, { metaKey: true }, { altKey: true }, { shiftKey: true }]) {
    const f = fixture(); f.click('a');
    const second = f.click('a', options);
    assert.equal(second.handled, false); assert.equal(second.event.prevented, undefined);
    f.advance(400); assert.deepEqual(f.actions, []);
  }
});

test('dragging or panning never likes or opens the image', () => {
  const f = fixture();
  f.gesture.pointerdown({ choice: f.choice('a'), pointerId: 1, clientX: 20, clientY: 30 });
  f.gesture.pointermove({ pointerId: 1, clientX: 40, clientY: 50 });
  f.click('a'); f.advance(400); assert.deepEqual(f.actions, []);
  f.click('a');
  f.gesture.pointerdown({ choice: f.choice('a'), pointerId: 2, clientX: 20, clientY: 30 });
  f.gesture.pointermove({ pointerId: 2, clientX: 90, clientY: 30 });
  f.click('a', { detail: 2 }); f.advance(400); assert.deepEqual(f.actions, []);
});

test('clicking another control cancels queued image navigation', () => {
  const f = fixture(); f.click('a');
  f.gesture.pointerdown({ button: 0, choice: null });
  assert.equal(f.click(null).handled, false);
  f.advance(400); assert.deepEqual(f.actions, []);
});

test('double-click suppresses native zoom and selection only on artwork images', () => {
  const f = fixture();
  const event = { choice: f.choice('a'), preventDefault() { this.prevented = true; } };
  assert.equal(f.gesture.dblclick(event), true); assert.equal(event.prevented, true);
  assert.equal(f.gesture.dblclick({ ...event, ctrlKey: true }), false);
  assert.deepEqual(f.actions, []);
});

const app = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
function savedFixture() {
  let saved = false, release;
  const methods = [], messages = [], item = { key: 'danbooru:1', source: 'danbooru', memberKeys: [] };
  const pending = new Promise(resolve => { release = () => { saved = true; resolve({ saved: true }); }; });
  const context = vm.createContext({ savedWorkPending: new Set(), tabs: [], likes: [], bookmarks: [],
    contentPreferences: {}, currentTab: () => null, visibleFeedCard: () => null,
    isSavedWork: () => saved, syncSavedWorkButtons() {},
    request: async (_url, options) => { methods.push(options.method); return pending; },
    setSavedWorks() {}, recordViewedWorks() {}, refreshSavedWorks() {},
    toast: message => messages.push(message) });
  vm.runInContext(app.slice(app.indexOf('async function toggleSavedWork('),
    app.indexOf('\nfunction syncSavedWorkButtons(')), context);
  return { context, methods, messages, item, release, setSaved: value => { saved = value; } };
}

test('image liking shares pending guards and writes the idempotent endpoint once', async () => {
  const f = savedFixture();
  const first = f.context.toggleSavedWork(f.item, 'likes', true);
  await f.context.toggleSavedWork(f.item, 'likes', true);
  await f.context.toggleSavedWork(f.item, 'likes');
  assert.deepEqual(f.methods, ['PUT']);
  f.release(); await first;
  await f.context.toggleSavedWork(f.item, 'likes', true);
  assert.deepEqual(f.methods, ['PUT']);
  assert.equal(f.context.savedWorkPending.size, 0);
});

test('existing heart and F toggles still use the toggle endpoint', async () => {
  const f = savedFixture();
  const toggle = f.context.toggleSavedWork(f.item, 'likes');
  assert.deepEqual(f.methods, ['POST']); f.release(); await toggle;
});

test('a failed image like releases the guard so another double-click can retry', async () => {
  const f = savedFixture();
  f.context.request = async () => { throw new Error('offline'); };
  await f.context.toggleSavedWork(f.item, 'likes', true);
  assert.equal(f.context.savedWorkPending.size, 0);
  assert.equal(f.messages.length, 1);
  f.context.request = async (_url, options) => { f.methods.push(options.method); return { saved: true }; };
  await f.context.toggleSavedWork(f.item, 'likes', true);
  assert.deepEqual(f.methods, ['PUT']);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../wwwroot/theme.js'), 'utf8');

function themeSession({ dark = false, saved, storageFails = false } = {}) {
  const entries = new Map(saved ? [['dart-theme-preference', saved]] : []);
  const page = { dataset: {} };
  const meta = { content: '' };
  let listener;
  const system = { matches: dark, addEventListener(_type, callback) { listener = callback; } };
  const window = {
    document: { documentElement: page, querySelector() { return meta; } },
    matchMedia() { return system; },
    localStorage: {
      getItem(key) {
        if (storageFails) throw Error('storage blocked');
        return entries.get(key) || null;
      },
      setItem(key, value) {
        if (storageFails) throw Error('storage blocked');
        entries.set(key, value);
      }
    }
  };
  vm.runInNewContext(source, { window });
  return { window, page, meta, entries,
    setSystemDark(value) { system.matches = value; listener(); } };
}

test('system theme follows Windows light and dark changes', () => {
  const session = themeSession();
  assert.equal(session.window.DartTheme.preference, 'system');
  assert.equal(session.page.dataset.theme, 'light');
  session.setSystemDark(true);
  assert.equal(session.page.dataset.theme, 'dark');
  assert.equal(session.meta.content, '#1d1d1d');
  session.setSystemDark(false);
  assert.equal(session.page.dataset.theme, 'light');
});

test('manual choices remain stable across system changes and sessions', () => {
  const session = themeSession({ dark: true });
  assert.equal(session.window.DartTheme.setPreference('list'), true);
  assert.equal(session.page.dataset.theme, 'list');
  session.setSystemDark(false);
  assert.equal(session.page.dataset.theme, 'list');
  assert.equal(session.entries.get('dart-theme-preference'), 'list');
  const restored = themeSession({ dark: false, saved: 'list' });
  assert.equal(restored.page.dataset.theme, 'list');
  assert.equal(restored.window.DartTheme.setPreference('system'), true);
  assert.equal(restored.page.dataset.theme, 'light');
});

test('invalid or inaccessible saved preferences cannot break theme initialization', () => {
  const invalid = themeSession({ dark: true, saved: 'unknown' });
  assert.equal(invalid.page.dataset.theme, 'dark');
  assert.equal(invalid.window.DartTheme.setPreference('unknown'), false);
  assert.equal(invalid.page.dataset.theme, 'dark');
  const blocked = themeSession({ storageFails: true });
  assert.equal(blocked.window.DartTheme.setPreference('light'), true);
  assert.equal(blocked.page.dataset.theme, 'light');
});

test('client state cleanup retains the cross-launch theme choice', () => {
  const logic = require('../wwwroot/catalog-logic.js');
  const state = logic.cleanClientState({ themePreference: 'list',
    session: { tabs: [{ kind: 'settings', title: 'Settings', settingsSection: 'appearance' }],
      activeIndex: 0, savedWorksVersion: 1 } });
  assert.equal(state.themePreference, 'list');
  assert.equal(state.session.tabs[0].settingsSection, 'appearance');
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const I18n = require('../wwwroot/i18n.js');

const source = fs.readFileSync(path.join(__dirname, '../wwwroot/app.js'), 'utf8');
const start = source.indexOf('function renderSettings()');
const end = source.indexOf('\nconst sankakuMediaRecovery =', start);
assert.ok(start >= 0 && end > start);

function privacySettings(status, loading = false) {
  const context = {
    currentTab: () => ({ kind: 'settings', settingsSection: 'privacy' }),
    globalThis: { DartTheme: { preference: 'system' } },
    contentPreferences: { aiMode: 'all', excludedTags: [], hiddenAuthors: [] },
    privacyStatus: status, privacyLoading: loading, privacySaving: false,
    privacyErrors: { 'apply-failed': 'Windows could not change capture protection for this window.' }
  };
  return vm.runInNewContext(source.slice(start, end) + '\nrenderSettings()', context);
}

test('Privacy shows a disabled switch until the native window reports availability', () => {
  const markup = privacySettings({ requested: false, active: false, available: false, error: null }, true);
  assert.match(markup, /data-section="privacy"/);
  assert.match(markup, /name="hideFromScreenCapture"[^>]*disabled/);
  assert.match(markup, /Checking protection status/);
});

test('Privacy reports verified protection and native failures distinctly', () => {
  const protectedMarkup = privacySettings({ requested: true, active: true, available: true, error: null });
  assert.match(protectedMarkup, /name="hideFromScreenCapture"[^>]*checked/);
  assert.match(protectedMarkup, /Protection is active/);
  const failedMarkup = privacySettings({ requested: false, active: false, available: true, error: 'apply-failed' });
  assert.doesNotMatch(failedMarkup, /name="hideFromScreenCapture"[^>]*checked/);
  assert.match(failedMarkup, /Windows could not change capture protection/);
});

test('Privacy copy is available in English, Russian and German', () => {
  I18n.setLanguage('en');
  assert.equal(I18n.translate('Privacy'), 'Privacy');
  I18n.setLanguage('ru');
  assert.equal(I18n.translate('Privacy'), 'Конфиденциальность');
  assert.equal(I18n.translate('Protection is active.'), 'Защита включена.');
  I18n.setLanguage('de');
  assert.equal(I18n.translate('Privacy'), 'Privatsphäre');
  assert.equal(I18n.translate('Protection is active.'), 'Schutz ist aktiv.');
  I18n.setLanguage('en');
});

test('switch sends the requested protection state and reflects the verified native result', async () => {
  const sliceStart = source.indexOf('async function loadPrivacyStatus()');
  const sliceEnd = source.indexOf('\nasync function loadContentPreferences()', sliceStart);
  assert.ok(sliceStart >= 0 && sliceEnd > sliceStart);
  const requests = [];
  const context = { privacySaving: false, privacyRevision: 0, privacyLoading: false,
    privacyStatus: { requested: false, active: false, available: true, error: null },
    render: () => {}, toast: () => {}, currentTab: () => ({ kind: 'settings' }),
    request: async () => ({}),
    fetch: async (url, options) => {
      requests.push({ url, method: options.method, body: JSON.parse(options.body) });
      return { ok: true, json: async () => ({ requested: true, active: true, available: true, error: null }) };
    } };
  const control = vm.runInNewContext(source.slice(sliceStart, sliceEnd) +
    '\n({ savePrivacyStatus, status: () => privacyStatus })', context);
  await control.savePrivacyStatus(true);
  assert.deepEqual(requests, [{ url: '/api/privacy', method: 'POST',
    body: { hideFromScreenCapture: true } }]);
  assert.equal(control.status().requested, true);
  assert.equal(control.status().active, true);
});

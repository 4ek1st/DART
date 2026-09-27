const test = require('node:test');
const assert = require('node:assert/strict');
const messages = require('../wwwroot/locales.js');
const I18n = require('../wwwroot/i18n.js');

test('English is the default and every message has Russian and German translations', () => {
  assert.equal(I18n.language, 'en');
  assert.ok(messages.length > 250);
  for (const row of messages) {
    assert.equal(row.length, 3, JSON.stringify(row));
    assert.ok(row.every(message => message.trim()));
    assert.doesNotMatch(row[0], /[А-Яа-яЁё]/);
  }
});

test('language changes translate labels, dynamic counts and legacy tab names', () => {
  I18n.setLanguage('en');
  assert.equal(I18n.translate('Настройки'), 'Settings');
  assert.equal(I18n.translate('Подписки · 47'), 'Following · 47');
  assert.equal(I18n.translate('Работа #18855435'), 'Artwork #18855435');
  assert.equal(I18n.translate('Показано работ: 2 · Загружено записей: 18'),
    'Works shown: 2 · Records loaded: 18');
  I18n.setLanguage('de');
  assert.equal(I18n.translate('Settings'), 'Einstellungen');
  assert.equal(I18n.translate('Профиль художника'), 'Künstlerprofil');
  assert.equal(I18n.translate('Открыть Search · Объединено 9 записей · Sankaku: 9', ['Search']),
    'Öffnen Search · Zusammengefasst: 9 Datensätze · Sankaku: 9');
  assert.equal(I18n.translate('Автор: Original', ['Original']), 'Urheber: Original');
  assert.equal(I18n.translate('Rule34 временно не отвечает (HTTP 502). Повторим позже.'),
    'Rule34 ist vorübergehend nicht verfügbar (HTTP 502). Ein neuer Versuch erfolgt später.');
  I18n.setLanguage('ru');
  assert.equal(I18n.translate('Settings'), 'Настройки');
  assert.equal(I18n.translate('NSFW illustrations'), 'NSFW иллюстрации');
  I18n.setLanguage('unsupported');
  assert.equal(I18n.language, 'en');
});

test('catalog identifiers, tags, URLs and user entered strings are not rewritten', () => {
  for (const language of ['en', 'ru', 'de']) {
    I18n.setLanguage(language);
    assert.equal(I18n.translate('fujisaki_honami anteiru ai-created'),
      'fujisaki_honami anteiru ai-created');
    assert.equal(I18n.translate('https://sankaku.app/posts/9krZ7ggN8Rg'),
      'https://sankaku.app/posts/9krZ7ggN8Rg');
    assert.equal(I18n.translate('#ai-assisted'), '#ai-assisted');
  }
  I18n.setLanguage('en');
});

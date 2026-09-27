(function(root) {
  const messages = typeof module !== 'undefined' ? require('./locales.js') : root.DartMessages;
  const languages = ['en', 'ru', 'de'];
  let language = 'en';
  const originals = new WeakMap();
  const aliases = new Map();
  const canonical = new Map();
  messages.forEach(row => { if (!canonical.has(row[0])) canonical.set(row[0], row); });
  messages.forEach(row => row.forEach(message => aliases.set(message, canonical.get(row[0]))));
  // A trie avoids compiling hundreds of regex alternatives on the UI thread.
  const trie = new Map();
  for (const [alias, row] of aliases) {
    let node = trie;
    for (let index = 0; index < alias.length; index++) {
      const character = alias[index];
      if (!node.has(character)) node.set(character, new Map());
      node = node.get(character);
    }
    node.row = row;
  }
  const word = character => !!character && /[\p{L}\p{N}_]/u.test(character);
  function translate(text, literals = []) {
    text = String(text ?? '');
    const protectedText = [...new Set(literals.filter(value => typeof value === 'string' && value))]
      .sort((left, right) => right.length - left.length);
    if (protectedText.length) {
      let result = '', start = 0;
      while (start < text.length) {
        let next = text.length, literal;
        for (const value of protectedText) {
          const position = text.indexOf(value, start);
          if (position >= 0 && position < next) { next = position; literal = value; }
        }
        result += translate(text.slice(start, next));
        if (!literal) break;
        result += literal; start = next + literal.length;
      }
      return result;
    }
    const target = languages.indexOf(language), exact = aliases.get(text.trim());
    if (exact) return text.replace(text.trim(), exact[target]);
    let result = '';
    for (let index = 0; index < text.length;) {
      let node = trie, match, end = index;
      if (!word(text[index]) || !word(text[index - 1]))
        for (let next = index; next < text.length && node.has(text[next]); next++) {
          node = node.get(text[next]);
          if (node.row && (!word(text[next]) || !word(text[next + 1]))) {
            match = node.row; end = next + 1;
          }
        }
      if (match) { result += match[target]; index = end; }
      else result += text[index++];
    }
    return result;
  }
  function apply(node, key, read, write, literals) {
    const current = read();
    const saved = originals.get(node) || {};
    const previous = saved[key];
    const raw = previous && current === previous.rendered ? previous.raw : current;
    const rendered = translate(raw, literals);
    saved[key] = { raw, rendered }; originals.set(node, saved);
    if (current !== rendered) write(rendered);
  }
  function translateTree(tree) {
    if (!root.document || !tree) return;
    const walker = root.document.createTreeWalker(tree, 1 | 4);
    const visit = node => {
      const element = node.nodeType === 1 ? node : node.parentElement;
      if (element?.closest('script, style, textarea, code, pre, [data-no-i18n], .tag-chip')) return;
      if (node.nodeType === 3) {
        if (element?.closest('.tag-link[data-query], [data-catalog-name]')) return;
        if (element?.closest('.card-title, .detail-meta h1, .profile-head h1') &&
            !/^\s*Работа #|^\s*Artwork #|^\s*Werk #/.test(node.nodeValue)) return;
        if (element?.closest('.card-artist') && !element.closest('small') &&
            !/Автор не указан|Creator not specified|Urheber nicht angegeben/.test(node.nodeValue)) return;
        apply(node, 'text', () => node.nodeValue, value => { node.nodeValue = value; });
      }
      else if (node.nodeType === 1) {
        let literals = [];
        try { literals = JSON.parse(node.getAttribute('data-i18n-keep') || '[]'); } catch {}
        if (!Array.isArray(literals)) literals = [];
        for (const attribute of ['title', 'placeholder', 'aria-label'])
          if (node.hasAttribute(attribute)) apply(node, attribute,
            () => node.getAttribute(attribute), value => node.setAttribute(attribute, value), literals);
      }
    };
    visit(tree);
    while (walker.nextNode()) visit(walker.currentNode);
  }
  function setLanguage(value, persist = true) {
    language = languages.includes(value) ? value : 'en';
    if (root.document) {
      root.document.documentElement.lang = language;
      translateTree(root.document.body);
      if (persist) try { root.localStorage.setItem('dart-language', language); } catch {}
    }
    return language;
  }
  const api = { translate, translateTree, setLanguage,
    get language() { return language; },
    get locale() { return { en: 'en-US', ru: 'ru-RU', de: 'de-DE' }[language]; } };
  root.DartI18n = api;
  if (typeof module !== 'undefined') module.exports = api;
  else {
    try { setLanguage(root.localStorage.getItem('dart-language')); } catch { setLanguage('en'); }
    new root.MutationObserver(records => {
      const changed = new Set();
      for (const record of records) {
        if (record.type === 'childList') for (const node of record.addedNodes) changed.add(node);
        else changed.add(record.target);
      }
      for (const node of changed) translateTree(node);
    }).observe(root.document.body, { subtree: true, childList: true, characterData: true,
      attributes: true, attributeFilter: ['title', 'placeholder', 'aria-label'] });
  }
})(typeof window !== 'undefined' ? window : globalThis);

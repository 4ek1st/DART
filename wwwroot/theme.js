(function(root) {
  const key = 'dart-theme-preference';
  const choices = new Set(['system', 'light', 'dark', 'list']);
  const system = root.matchMedia?.('(prefers-color-scheme: dark)');
  let preference = 'system';
  try {
    const saved = root.localStorage?.getItem(key);
    if (choices.has(saved)) preference = saved;
  } catch { /* A private browser profile can block storage. */ }

  function effectiveTheme() {
    if (preference !== 'system') return preference;
    return system?.matches ? 'dark' : 'light';
  }

  function apply() {
    const theme = effectiveTheme();
    const page = root.document?.documentElement;
    if (page) {
      page.dataset.theme = theme;
      page.dataset.themePreference = preference;
      const meta = root.document.querySelector('meta[name="theme-color"]');
      if (meta) meta.content = { light: '#f6f7f8', dark: '#1d1d1d', list: '#292b2d' }[theme];
    }
    return theme;
  }

  function setPreference(value) {
    if (!choices.has(value)) return false;
    preference = value;
    try { root.localStorage?.setItem(key, value); } catch { /* Keep it for this session. */ }
    apply();
    return true;
  }

  const systemChanged = () => { if (preference === 'system') apply(); };
  if (system?.addEventListener) system.addEventListener('change', systemChanged);
  else system?.addListener?.(systemChanged);
  root.DartTheme = Object.freeze({
    get preference() { return preference; },
    get effective() { return effectiveTheme(); },
    setPreference
  });
  apply();
})(typeof window === 'undefined' ? globalThis : window);

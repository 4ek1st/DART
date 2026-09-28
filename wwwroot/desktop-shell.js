(function (root, factory) {
  const shell = factory();
  if (typeof module === 'object' && module.exports) module.exports = shell;
  else { root.DesktopShell = shell; shell.mount(root); }
})(typeof window === 'object' ? window : globalThis, function () {
  function canInstall(status) {
    return !!(status?.available && status.verified && status.version && !status.error && !status.installing);
  }
  function windowCommand(bridge, command) {
    if (!bridge?.postMessage || !['minimize', 'maximize', 'close'].includes(command)) return false;
    bridge.postMessage({ type: 'window-command', command });
    return true;
  }
  function mount(window) {
    const document = window.document, bridge = window.chrome?.webview;
    const controls = document.getElementById('window-controls');
    controls.hidden = !bridge;
    document.documentElement.classList.toggle('desktop-window', !!bridge);
    controls.addEventListener('click', event => {
      const command = event.target.closest('[data-window-command]')?.dataset.windowCommand;
      if (command) windowCommand(bridge, command);
    });
    bridge?.addEventListener('message', event => {
      if (event.data?.type !== 'window-state') return;
      const maximized = !!event.data.maximized;
      const button = controls.querySelector('[data-window-command="maximize"]');
      button.title = maximized ? 'Восстановить' : 'Развернуть';
      button.setAttribute('aria-label', button.title);
      document.getElementById('maximize-glyph').setAttribute('d', maximized ?
        'M5.5 2.5h8v8m-3-5h-8v8h8z' : 'M3.5 3.5h9v9h-9z');
    });

    const install = document.getElementById('install-update-button');
    let status = {}, dialog, checkedAt = 0, checkPromise, checkTimer;
    const api = async (path, options) => {
      const response = await window.fetch('/api/updates' + path, options);
      const value = await response.json();
      if (!response.ok) throw new Error(value.error || 'Не удалось выполнить обновление.');
      return value;
    };
    function showStatus(value) {
      status = value;
      install.hidden = !canInstall(status);
      const label = `Version available · DART ${status.version || ''}`;
      install.title = label;
      install.setAttribute('aria-label', label);
      if (dialog?.open) renderPanel();
    }
    function check(force = false) {
      // Focus, network recovery and the timer can arrive together. Share their request.
      if (checkPromise) return checkPromise;
      window.clearTimeout(checkTimer);
      checkPromise = (async () => {
        try { showStatus(await api(force ? '/check' : '', force ? { method: 'POST' } : undefined)); }
        catch (error) { showStatus({ ...status, available: false, error: error.message }); }
        finally {
          checkedAt = Date.now();
          checkPromise = null;
          checkTimer = window.setTimeout(() => check(true), status.error ? 60 * 1000 : 5 * 60 * 1000);
        }
      })();
      return checkPromise;
    }
    function renderPanel() {
      dialog.querySelector('[data-update-current]').textContent = `Установлено: ${status.currentVersion || 'локальная сборка'}`;
      dialog.querySelector('[data-update-status]').textContent = status.error ||
        (status.installing ? 'Скачиваем и проверяем обновление…' : canInstall(status) ?
          `Доступна версия ${status.version}` : status.configured ? 'Установлена последняя проверенная версия.' :
            'Настройка обновлений доступна в установленной DART.');
      const button = dialog.querySelector('[data-update-install]');
      button.hidden = !canInstall(status);
      button.disabled = !!status.installing;
      dialog.querySelector('[data-update-notes]').textContent = status.notes || '';
    }
    function openPanel() {
      if (!dialog) {
        dialog = document.createElement('dialog');
        dialog.className = 'update-dialog';
        dialog.innerHTML = `<div class="update-dialog-head"><h2>Обновления DART</h2><button type="button" data-update-close aria-label="Закрыть">×</button></div>
          <p data-update-current></p><p data-update-status role="status"></p><p data-update-notes class="update-notes"></p>
          <div class="update-dialog-actions"><button type="button" data-update-check>Проверить обновления</button><button type="button" data-update-install hidden>Установить и перезапустить</button></div>`;
        document.body.appendChild(dialog);
        dialog.querySelector('[data-update-close]').onclick = () => dialog.close();
        dialog.querySelector('[data-update-check]').onclick = () => check(true);
        dialog.querySelector('[data-update-install]').onclick = async () => {
          status.installing = true; install.hidden = true; renderPanel();
          try {
            if (typeof window.saveSession === 'function') window.saveSession();
            await api('/install', { method: 'POST' });
          } catch (error) { status.installing = false; status.error = error.message; renderPanel(); }
        };
      }
      renderPanel(); dialog.showModal(); check();
    }
    install.onclick = openPanel;
    const main = document.getElementById('main');
    new window.MutationObserver(() => {
      const sections = main.querySelector('.settings-sections');
      if (!sections || sections.querySelector('[data-desktop-updates]')) return;
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'settings-section'; button.dataset.desktopUpdates = '';
      button.innerHTML = 'Обновления<span>Версия и установка</span>'; button.onclick = openPanel;
      sections.appendChild(button);
    }).observe(main, { childList: true, subtree: true });
    check(true);
    function checkOnReturn() {
      if (!document.hidden && Date.now() - checkedAt >= 60 * 1000) check(true);
    }
    window.addEventListener('focus', checkOnReturn);
    window.addEventListener('online', () => check(true));
    document.addEventListener('visibilitychange', checkOnReturn);
  }
  return { canInstall, windowCommand, mount };
});

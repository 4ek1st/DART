(function (root) {
  'use strict';
  const messages = {
    en: {
      title: 'Upscale', settingsTitle: 'Image upscaling', description: 'Choose your default once. Then right-click an artwork or use ⋮ and select Upscale. The result appears in the current viewer.',
      defaultScale: 'Default enlargement', oneClick: 'One action per image, with no extra window or repeated choices. U also starts upscaling in the viewer.', done: 'Upscaled',
      optional: 'Optional module. Download once; DART connects it automatically. Images stay on this computer.',
      install: 'Download module · 36 MB', repair: 'Download again', remove: 'Remove module', clear: 'Clear result cache',
      ready: 'Ready to upscale', checking: 'Checking module…', downloading: 'Downloading module…', verifying: 'Checking download…', installing: 'Installing module…',
      cancel: 'Cancel', close: 'Close', start: 'Upscale image', save: 'Save PNG', original: 'Original', result: 'Result',
      preparing: 'Preparing the original image…', uploading: 'Preparing local processing…', queued: 'Waiting for another upscale…', processing: 'Upscaling locally…',
      completed: 'Ready', cancelled: 'Cancelled', originalSafe: 'The original stays unchanged. The enlarged PNG is saved separately.',
      'not-installed': 'Download the optional module to upscale images.', integrity: 'The module could not be verified. Download it again before processing.',
      download: 'Could not download the module. Check your connection and try again.', busy: 'The module is in use. Cancel processing or wait for it to finish.',
      image: 'Could not read the original image. Reopen the artwork and try again.', animated: 'Upscaling supports still images. Animated images are not supported.',
      'too-large': 'This image is too large at this scale. Try 2× or a smaller image.', scale: 'Choose 2× or 4×.',
      engine: 'Processing failed. Check that your graphics driver supports Vulkan, then try again.', output: 'The result was incomplete. Try again.',
      'queue-full': 'The upscale queue is full. Wait for the current jobs or cancel one.', timeout: 'Processing took too long. Try 2× or a smaller image.',
      storage: 'Could not save the local files. Check free disk space and try again.', network: 'Could not reach the local processor. Try again.',
      'not-found': 'This result is no longer cached. Upscale the image again.', source: 'Module source and license', cache: 'Result cache',
      view: 'Preview', scaleLabel: 'Enlargement', installed: 'Module installed · 8 MB', notInstalled: 'Module is not installed',
      beforeRemove: 'Remove the optional upscale module? Saved PNGs and original artworks will remain.',
      empty: 'The enlarged image will appear here.', dimensions: 'Image dimensions'
    },
    ru: {
      title: 'Апскейл', settingsTitle: 'Увеличение изображений', description: 'Один раз выберите масштаб. Затем нажмите правой кнопкой на арт или ⋮ и выберите «Апскейл». Результат появится прямо в текущем просмотре.',
      defaultScale: 'Масштаб по умолчанию', oneClick: 'Одно действие для изображения, без отдельного окна и повторных решений. Клавиша U также запускает апскейл в просмотре.', done: 'Увеличено',
      optional: 'Дополнительный модуль. Скачайте один раз — DART подключит его автоматически. Изображения остаются на этом компьютере.',
      install: 'Скачать модуль · 36 МБ', repair: 'Скачать заново', remove: 'Удалить модуль', clear: 'Очистить кэш результатов',
      ready: 'Готово к увеличению', checking: 'Проверяем модуль…', downloading: 'Скачиваем модуль…', verifying: 'Проверяем загрузку…', installing: 'Устанавливаем модуль…',
      cancel: 'Отмена', close: 'Закрыть', start: 'Увеличить изображение', save: 'Сохранить PNG', original: 'Оригинал', result: 'Результат',
      preparing: 'Подготавливаем оригинал изображения…', uploading: 'Подготавливаем локальную обработку…', queued: 'Ждём завершения другого увеличения…', processing: 'Увеличиваем локально…',
      completed: 'Готово', cancelled: 'Отменено', originalSafe: 'Оригинал останется на месте. Увеличенный PNG сохраняется отдельным файлом.',
      'not-installed': 'Скачайте дополнительный модуль для увеличения изображений.', integrity: 'Модуль не прошёл проверку. Скачайте его заново перед обработкой.',
      download: 'Не удалось скачать модуль. Проверьте подключение и повторите.', busy: 'Модуль используется. Отмените обработку или дождитесь её завершения.',
      image: 'Не удалось прочитать оригинал. Откройте арт заново и повторите.', animated: 'Увеличение работает с неподвижными изображениями. Анимация не поддерживается.',
      'too-large': 'Изображение слишком большое для этого масштаба. Попробуйте 2× или изображение поменьше.', scale: 'Выберите 2× или 4×.',
      engine: 'Обработка не удалась. Проверьте поддержку Vulkan драйвером видеокарты и повторите.', output: 'Результат оказался неполным. Повторите обработку.',
      'queue-full': 'Очередь увеличения заполнена. Дождитесь завершения или отмените одну из задач.', timeout: 'Обработка заняла слишком много времени. Попробуйте 2× или изображение поменьше.',
      storage: 'Не удалось сохранить локальные файлы. Проверьте свободное место и повторите.', network: 'Нет связи с локальной обработкой. Повторите попытку.',
      'not-found': 'Результата уже нет в кэше. Увеличьте изображение заново.', source: 'Источник модуля и лицензия', cache: 'Кэш результатов',
      view: 'Предпросмотр', scaleLabel: 'Увеличение', installed: 'Модуль установлен · 8 МБ', notInstalled: 'Модуль не установлен',
      beforeRemove: 'Удалить дополнительный модуль увеличения? Сохранённые PNG и оригиналы останутся на месте.',
      empty: 'Здесь появится увеличенное изображение.', dimensions: 'Размер изображения'
    },
    de: {
      title: 'Hochskalieren', settingsTitle: 'Bilder hochskalieren', description: 'Standard einmal auswählen. Danach per Rechtsklick oder ⋮ Hochskalieren wählen. Das Ergebnis erscheint direkt im aktuellen Betrachter.',
      defaultScale: 'Standardvergrößerung', oneClick: 'Eine Aktion pro Bild, ohne zusätzliches Fenster oder erneute Auswahl. U startet die Vergrößerung im Betrachter.', done: 'Hochskaliert',
      optional: 'Optionales Modul. Einmal herunterladen, DART verbindet es automatisch. Bilder bleiben auf diesem Computer.',
      install: 'Modul herunterladen · 36 MB', repair: 'Erneut herunterladen', remove: 'Modul entfernen', clear: 'Ergebnis-Cache leeren',
      ready: 'Bereit zum Hochskalieren', checking: 'Modul wird geprüft…', downloading: 'Modul wird heruntergeladen…', verifying: 'Download wird geprüft…', installing: 'Modul wird installiert…',
      cancel: 'Abbrechen', close: 'Schließen', start: 'Bild hochskalieren', save: 'PNG speichern', original: 'Original', result: 'Ergebnis',
      preparing: 'Originalbild wird vorbereitet…', uploading: 'Lokale Verarbeitung wird vorbereitet…', queued: 'Warten auf einen anderen Auftrag…', processing: 'Bild wird lokal hochskaliert…',
      completed: 'Fertig', cancelled: 'Abgebrochen', originalSafe: 'Das Original bleibt unverändert. Das vergrößerte PNG wird separat gespeichert.',
      'not-installed': 'Das optionale Modul herunterladen, um Bilder hochzuskalieren.', integrity: 'Das Modul konnte nicht verifiziert werden. Vor der Verarbeitung erneut herunterladen.',
      download: 'Modul konnte nicht heruntergeladen werden. Verbindung prüfen und erneut versuchen.', busy: 'Das Modul wird verwendet. Verarbeitung abbrechen oder auf den Abschluss warten.',
      image: 'Das Originalbild konnte nicht gelesen werden. Werk erneut öffnen und versuchen.', animated: 'Nur unbewegte Bilder werden unterstützt. Animierte Bilder sind nicht verfügbar.',
      'too-large': 'Das Bild ist für diesen Maßstab zu groß. 2× oder ein kleineres Bild versuchen.', scale: '2× oder 4× wählen.',
      engine: 'Verarbeitung fehlgeschlagen. Vulkan-Unterstützung des Grafiktreibers prüfen und erneut versuchen.', output: 'Das Ergebnis war unvollständig. Erneut versuchen.',
      'queue-full': 'Die Warteschlange ist voll. Auf laufende Aufträge warten oder einen abbrechen.', timeout: 'Verarbeitung dauert zu lange. 2× oder ein kleineres Bild versuchen.',
      storage: 'Lokale Dateien konnten nicht gespeichert werden. Freien Speicher prüfen und erneut versuchen.', network: 'Lokale Verarbeitung nicht erreichbar. Erneut versuchen.',
      'not-found': 'Das Ergebnis ist nicht mehr im Cache. Bild erneut hochskalieren.', source: 'Modulquelle und Lizenz', cache: 'Ergebnis-Cache',
      view: 'Vorschau', scaleLabel: 'Vergrößerung', installed: 'Modul installiert · 8 MB', notInstalled: 'Modul nicht installiert',
      beforeRemove: 'Optionales Modul entfernen? Gespeicherte PNGs und Originalwerke bleiben erhalten.',
      empty: 'Das vergrößerte Bild wird hier angezeigt.', dimensions: 'Bildabmessungen'
    }
  };
  const t = key => (messages[root.DartI18n?.language] || messages.en)[key] || messages.en[key] || key;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const busy = state => ['preparing', 'uploading', 'queued', 'processing'].includes(state);
  const installing = state => ['downloading', 'verifying', 'installing'].includes(state);
  const sleep = (ms, signal) => new Promise((resolve, reject) => {
    const cancel = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', cancel); resolve(); }, ms);
    signal?.addEventListener('abort', cancel, { once: true }); if (signal?.aborted) cancel();
  });
  function canUpscaleImage(item, url) {
    if (!url || !/^https?:\/\//i.test(url)) return false;
    if (!item?.images?.length && item?.thumbnail === url) return false;
    if (root.CatalogLogic?.videoMimeType(url)) return false;
    return !/\.(?:mp4|webm|mov|m4v|mkv|gif)(?:[?#]|$)/i.test(url);
  }
  async function json(fetcher, url, options = {}) {
    const response = await fetcher(url, { signal: AbortSignal.timeout(10000), ...options });
    const value = await response.json();
    if (!response.ok) throw new Error(value?.error || 'network');
    return value;
  }
  function createJobController({ readImage, normalize, fetch: fetcher = root.fetch?.bind(root), onChange = () => {}, wait = sleep }) {
    let active = null;
    const cancelJob = id => json(fetcher, `/api/upscale/jobs/${encodeURIComponent(id)}/cancel`, { method: 'POST' }).catch(() => {});
    function cancel(emit = true) {
      const old = active; active = null; old?.controller.abort();
      if (old?.jobId) void cancelJob(old.jobId);
      if (emit) onChange({ state: 'cancelled' });
    }
    async function start({ item, url, scale }) {
      cancel(false);
      const run = active = { controller: new AbortController(), jobId: '' }, signal = run.controller.signal;
      const update = value => { if (active === run && !signal.aborted) onChange(value); };
      try {
        update({ state: 'preparing', scale });
        const original = await readImage(item, url, signal);
        const normalized = await normalize(original, scale, signal);
        if (active !== run || signal.aborted) return;
        const base = { scale, width: normalized.width, height: normalized.height, originalBlob: normalized.blob };
        update({ ...base, state: 'uploading' });
        // Always consume an accepted upload response so closing the dialog can cancel
        // its actual job, even when the response arrives after the close.
        let job = await json(fetcher, `/api/upscale/jobs?scale=${scale}`, { method: 'POST',
          headers: { 'Content-Type': 'image/png' }, body: normalized.blob, signal: AbortSignal.timeout(60000) });
        if (active !== run || signal.aborted) { await cancelJob(job.id); return; }
        run.jobId = job.id;
        while (true) {
          update({ ...base, ...job });
          if (!['queued', 'processing'].includes(job.state)) break;
          await wait(600, signal);
          job = await json(fetcher, `/api/upscale/jobs/${encodeURIComponent(job.id)}`, { signal });
        }
      } catch (error) {
        if (active === run && !signal.aborted) {
          if (run.jobId) await cancelJob(run.jobId);
          update({ state: 'error', error: messages.en[error.message] ? error.message : 'network', scale });
        }
      } finally { if (active === run) active = null; }
    }
    return { start, cancel };
  }
  function normalizeInWorker(blob, scale, signal) {
    return new Promise((resolve, reject) => {
      const worker = new root.Worker('/upscale-worker.js');
      const finish = (error, value) => { worker.terminate(); signal?.removeEventListener('abort', cancel); error ? reject(error) : resolve(value); };
      const cancel = () => finish(new DOMException('Aborted', 'AbortError'));
      worker.onmessage = event => finish(event.data.error ? new Error(event.data.error) : null, event.data.result);
      worker.onerror = () => finish(new Error('image'));
      signal?.addEventListener('abort', cancel, { once: true });
      if (signal?.aborted) cancel(); else worker.postMessage({ blob, scale });
    });
  }

  let dependencies = {}, moduleState = null, preferences = { scale: 2 }, cacheBytes = 0;
  let moduleError = '', pollTimer = null, statusRequest = null, savingScale = false;
  let scaleSave = Promise.resolve();
  const records = new Map(), overlays = new Map();
  const request = (url, options) => json(root.fetch.bind(root), url, options);
  const mediaKey = url => root.CatalogLogic?.mediaCacheKey(url) || url;
  const active = () => [...records.values()].some(entry => busy(entry.state));
  function configure(options) { dependencies = { ...dependencies, ...options }; }
  function settingsMarkup() {
    return '<section class="settings-card upscale-settings" data-no-i18n><h2>' + escape(t('settingsTitle')) + '</h2><p>' + escape(t('description')) + '</p>' +
      '<fieldset class="upscale-defaults"><legend>' + escape(t('defaultScale')) + '</legend><div class="upscale-scales">' +
      [2,4].map(value => '<button type="button" data-upscale-scale="' + value + '" aria-pressed="' + (preferences.scale === value) + '">' + value + '×</button>').join('') +
      '</div><p class="settings-hint">' + escape(t('oneClick')) + '</p></fieldset><p>' + escape(t('optional')) + '</p>' +
      '<div data-upscale-module>' + moduleMarkup() + '</div><div class="upscale-cache"><span>' + escape(t('cache')) + ': <span data-upscale-cache>' + formatBytes(cacheBytes) +
      '</span></span><button type="button" class="secondary-button" data-upscale-action="clear"' + (active() ? ' disabled' : '') + '>' + escape(t('clear')) + '</button></div>' +
      '<p class="settings-hint"><a href="https://github.com/nihui/waifu2x-ncnn-vulkan" target="_blank" rel="noopener noreferrer">' + escape(t('source')) + '</a> · MIT · waifu2x CUnet</p></section>';
  }
  function formatBytes(bytes) { return (Math.max(0, Number(bytes) || 0) / 1024 / 1024).toLocaleString(root.DartI18n?.locale || 'en-US', { maximumFractionDigits: 1 }) + ' MB'; }
  function moduleMarkup() {
    const loading = installing(moduleState?.state), ready = moduleState?.installed && !moduleState?.error;
    const error = moduleError || moduleState?.error;
    const percent = moduleState?.totalBytes ? Math.min(100, Math.round(100 * moduleState.receivedBytes / moduleState.totalBytes)) : 0;
    return '<p class="upscale-module-status ' + (error ? 'upscale-error' : '') + '" role="status">' + escape(error ? t(error) :
      loading ? t(moduleState.state) : moduleState ? t(ready ? 'installed' : 'notInstalled') : t('checking')) + '</p>' +
      (loading ? '<progress max="100" value="' + percent + '" aria-label="' + escape(t('downloading')) + '"></progress><p class="settings-hint">' + percent + '% · ' +
        formatBytes(moduleState.receivedBytes) + ' / ' + formatBytes(moduleState.totalBytes) + '</p>' : '') +
      '<div class="upscale-module-actions">' + (loading ? '<button type="button" class="secondary-button" data-upscale-action="cancel-install">' + escape(t('cancel')) + '</button>' :
        !ready ? '<button type="button" class="primary-button" data-upscale-action="install"' + (!moduleState && !error ? ' disabled' : '') + '>' + escape(t(error ? 'repair' : 'install')) + '</button>' :
        '<button type="button" class="secondary-button" data-upscale-action="remove"' + (active() ? ' disabled' : '') + '>' + escape(t('remove')) + '</button>') + '</div>';
  }
  function paintModule() {
    const markup = moduleMarkup();
    for (const target of root.document.querySelectorAll('[data-upscale-module]')) {
      if (target._upscaleMarkup === markup) continue;
      const focused = target.contains(root.document.activeElement) ? root.document.activeElement?.dataset?.upscaleAction : '';
      target.innerHTML = markup; target._upscaleMarkup = markup;
      if (focused) target.querySelector('[data-upscale-action="' + focused + '"]')?.focus({ preventScroll: true });
    }
    for (const target of root.document.querySelectorAll('[data-upscale-cache]')) target.textContent = formatBytes(cacheBytes);
    for (const button of root.document.querySelectorAll('[data-upscale-scale]')) {
      button.setAttribute('aria-pressed', String(Number(button.dataset.upscaleScale) === preferences.scale)); button.disabled = savingScale;
    }
    for (const button of root.document.querySelectorAll('[data-upscale-action="clear"]')) button.disabled = active();
  }
  async function refresh() {
    if (statusRequest) return statusRequest;
    statusRequest = (async () => {
      try {
        const value = await request('/api/upscale', { signal: AbortSignal.timeout(8000) });
        moduleState = value.component; cacheBytes = value.cacheBytes;
        if (!savingScale && [2,4].includes(value.preferences?.scale)) preferences = value.preferences;
        moduleError = '';
      } catch { moduleError = 'network'; }
      finally { statusRequest = null; paintModule(); schedulePoll(); }
    })();
    return statusRequest;
  }
  function schedulePoll() {
    clearTimeout(pollTimer); pollTimer = null;
    if (root.document.querySelector('.upscale-settings')) pollTimer = setTimeout(refresh, installing(moduleState?.state) ? 500 : 5000);
  }
  function mounted() { applyVisible(); if (root.document.querySelector('.upscale-settings')) void refresh(); }
  async function setScale(scale) {
    if (savingScale || ![2,4].includes(scale)) return;
    savingScale = true; paintModule();
    scaleSave = request('/api/upscale/preferences', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scale }) });
    try { preferences = await scaleSave; }
    catch (error) { dependencies.toast?.(t(error.message in messages.en ? error.message : 'storage')); }
    finally { savingScale = false; paintModule(); }
  }
  function stateFor(item, url) { return records.get(mediaKey(url)) || null; }
  function resultFor(item, url) {
    const entry = stateFor(item, url);
    return entry?.resultUrl ? { url: entry.resultUrl, scale: entry.completedScale, visible: !entry.hidden } : null;
  }
  function label(item, url) {
    const entry = stateFor(item, url);
    return busy(entry?.state) ? t('processing') : t('title') + (moduleState ? ' ' + preferences.scale + '×' : '');
  }
  async function open({ item, url }) {
    if (!canUpscaleImage(item, url)) return false;
    if (savingScale) { try { await scaleSave; } catch { return false; } }
    if (!moduleState) await refresh();
    if (!moduleState?.installed || moduleState.error || installing(moduleState.state)) {
      dependencies.openSettings?.('upscale'); dependencies.toast?.(t(moduleError || 'not-installed')); return false;
    }
    const key = mediaKey(url), existing = records.get(key);
    if (busy(existing?.state)) return false;
    if (existing?.resultUrl && existing.completedScale === preferences.scale) {
      existing.hidden = false; applyVisible(); return true;
    }
    // Bound work before reading/decoding originals, not only after PNGs reach
    // the native queue. Fast browsing cannot create unlimited image workers.
    if ([...records.values()].filter(entry => busy(entry.state)).length >= 4) {
      dependencies.toast?.(t('queue-full')); return false;
    }
    const entry = { item, url, scale: preferences.scale, state: 'preparing', resultUrl: existing?.resultUrl || '',
      completedScale: existing?.completedScale, hidden: false };
    records.set(key, entry);
    entry.controller = createJobController({ readImage: dependencies.readImage, normalize: normalizeInWorker, onChange: next => {
      if (records.get(key) !== entry) return;
      entry.state = next.state; entry.error = next.error;
      if (next.state === 'completed') {
        entry.resultUrl = next.resultUrl; entry.completedScale = next.scale; entry.hidden = false;
        dependencies.toast?.(t('done') + ' ' + next.scale + '×'); applyVisible();
      } else if (next.state === 'error') {
        dependencies.toast?.(t(next.error));
        if (['integrity','not-installed'].includes(next.error)) {
          moduleState = { ...moduleState, installed: false, error: next.error }; void refresh();
        }
      }
      paintModule(); dependencies.changed?.();
    } });
    dependencies.toast?.(t('processing') + ' ' + entry.scale + '×');
    await entry.controller.start({ item, url, scale: entry.scale });
    // Keep only URL/status metadata for recent results. Decoded images belong to
    // visible viewers, never to every cached or browsed artwork.
    if (records.size > 24) for (const [oldKey, value] of records) {
      if (records.size <= 24) break;
      if (oldKey !== key && !busy(value.state) && !overlays.has(oldKey)) records.delete(oldKey);
    }
    return entry.state === 'completed';
  }
  function cancel(item, url) { const entry = stateFor(item,url); entry?.controller?.cancel(); }
  function restore(item, url) { const entry = stateFor(item,url); if (entry) { entry.hidden = true; applyVisible(); } }
  function show(item, url) { const entry = stateFor(item,url); if (entry?.resultUrl) { entry.hidden = false; applyVisible(); } }
  function download(item, url) {
    const result = resultFor(item,url); if (!result) return;
    const link = root.document.createElement('a'); link.href = result.url + '?download=1'; link.download = 'DART-' + result.scale + 'x.png';
    root.document.body.append(link); link.click(); link.remove();
  }
  function removeOverlay(key) {
    const render = overlays.get(key); if (!render) return;
    render.original?.classList.remove('upscale-original-suppressed');
    for (const original of root.document.querySelectorAll('img.upscale-original-suppressed[data-image-url]'))
      if (mediaKey(original.dataset.imageUrl) === key) original.classList.remove('upscale-original-suppressed');
    render.image.remove(); render.image.removeAttribute('src'); overlays.delete(key);
  }
  function syncPreview(original) {
    const render = overlays.get(mediaKey(original?.dataset?.imageUrl));
    if (!render) return;
    if (render.original !== original) {
      render.original?.classList.remove('upscale-original-suppressed'); render.original = original;
      if (render.ready) {
        if (render.image.parentElement !== original.parentElement) original.parentElement.append(render.image);
        original.classList.add('upscale-original-suppressed');
      }
    }
    render.image.style.transform = original.style.transform;
    render.image.style.transitionDuration = original.style.transitionDuration;
  }
  function applyVisible() {
    const visible = new Set();
    for (const original of root.document.querySelectorAll('.detail-image > img[data-image-url], .quick-preview-stage > img[data-image-url]')) {
      const key = mediaKey(original.dataset.imageUrl), entry = records.get(key);
      if (!entry?.resultUrl || entry.hidden || original.closest('[hidden], dialog:not([open])')) continue;
      visible.add(key);
      let render = overlays.get(key);
      if (render && render.url !== entry.resultUrl) { removeOverlay(key); render = null; }
      if (!render) {
        const image = new root.Image(); image.className = 'upscale-inline-result'; image.alt = ''; image.setAttribute('aria-hidden','true');
        render = { image, original, url: entry.resultUrl, ready: false }; overlays.set(key,render);
        image.src = entry.resultUrl;
        const current = render;
        image.decode().then(() => {
          if (overlays.get(key) !== current) return;
          current.ready = true; applyVisible();
          if (!root.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
            current.image.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' });
        }).catch(() => { if (overlays.get(key) === current) { removeOverlay(key); entry.resultUrl = ''; dependencies.toast?.(t('not-found')); } });
      }
      if (render.original !== original) render.original?.classList.remove('upscale-original-suppressed');
      render.original = original;
      if (render.ready) {
        if (render.image.parentElement !== original.parentElement) original.parentElement.append(render.image);
        original.classList.add('upscale-original-suppressed');
      }
      syncPreview(original);
    }
    for (const key of overlays.keys()) if (!visible.has(key)) removeOverlay(key);
  }
  async function action(name) {
    if (name === 'remove' && !root.confirm(t('beforeRemove'))) return;
    const routes = { install: 'install', 'cancel-install': 'install/cancel', remove: 'remove', clear: 'cache/clear' };
    if (!routes[name]) return;
    try {
      await request('/api/upscale/' + routes[name], { method: 'POST' }); moduleError = '';
      if (name === 'clear') { records.clear(); for (const key of overlays.keys()) removeOverlay(key); }
    } catch (error) { moduleError = messages.en[error.message] ? error.message : 'network'; paintModule(); return; }
    await refresh();
  }
  function dispose() {
    clearTimeout(pollTimer);
    for (const entry of records.values()) entry.controller?.cancel(false);
    for (const key of overlays.keys()) removeOverlay(key);
  }
  const api = { configure, canUpscaleImage, open, cancel, restore, show, download, stateFor, resultFor, label, syncPreview,
    applyVisible, settingsMarkup, mounted, refresh, createJobController, messages, dispose };
  if (typeof module !== 'undefined') module.exports = api;
  else {
    root.DartUpscale = api;
    root.document.addEventListener('click', event => {
      const target = event.target.closest('[data-upscale-action], [data-upscale-scale]'); if (!target) return;
      event.preventDefault();
      if (target.dataset.upscaleAction) void action(target.dataset.upscaleAction);
      else void setScale(Number(target.dataset.upscaleScale));
    });
    root.document.addEventListener('keydown', event => {
      if (event.code !== 'KeyU' || event.repeat || event.ctrlKey || event.metaKey || event.altKey ||
          event.target.closest('input,textarea,select,[contenteditable="true"],[role="menu"]') ||
          root.document.querySelector('dialog[open]:not(.quick-preview)')) return;
      const selected = dependencies.currentImage?.();
      if (!selected || !canUpscaleImage(selected.item, selected.url)) return;
      event.preventDefault(); void open(selected);
    });
    root.addEventListener('beforeunload', dispose);
  }
})(typeof window !== 'undefined' ? window : globalThis);

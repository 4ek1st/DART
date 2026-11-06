(function(root) {
  'use strict';
  const names = Object.freeze({ danbooru: 'Danbooru', gelbooru: 'Gelbooru', rule34: 'Rule34', sankaku: 'Sankaku' });
  const message = 'Problems on the website side.';
  function create(options = {}) {
    const document = options.document || root.document;
    const nodes = Array.from(options.nodes || document?.querySelectorAll?.('[data-source-status]') || []);
    const now = options.now || Date.now;
    const scheduleTimer = options.setTimeout || root.setTimeout?.bind(root);
    const cancelTimer = options.clearTimeout || root.clearTimeout?.bind(root);
    const fetchStatus = options.fetchStatus || (async signal => {
      const response = await root.fetch('/api/source-status', { cache: 'no-store', signal });
      if (!response.ok) throw new Error('Source status is unavailable');
      return response.json();
    });
    let timer, poll, pending, controller, started = false, disposed = false, lastRead = -Infinity;
    let tooltip, focused, placementFrame;
    const states = new Map();
    const translate = text => root.DartI18n?.translate(text) || text;
    const label = source => names[source] + (states.get(source)?.websiteUnavailable ? ' — ' + message : '');
    function hideTooltip() {
      if (tooltip) tooltip.hidden = true; focused = null;
      if (placementFrame !== undefined) root.cancelAnimationFrame?.(placementFrame); placementFrame = undefined;
    }
    function showTooltip(node) {
      if (!document?.createElement || !document.body) return;
      const rect = node.getBoundingClientRect();
      if (!rect.width || !rect.height) { hideTooltip(); return; }
      tooltip ||= Object.assign(document.createElement('div'), { className: 'source-status-tooltip', id: 'source-status-tooltip' });
      tooltip.setAttribute('role', 'tooltip');
      tooltip.textContent = translate(label(node.dataset.sourceStatus));
      if (!tooltip.isConnected) document.body.appendChild(tooltip);
      tooltip.hidden = false; focused = node;
      const bounds = tooltip.getBoundingClientRect();
      const width = root.innerWidth || document.documentElement?.clientWidth || 1024;
      tooltip.style.left = Math.max(8, Math.min(rect.left, width - bounds.width - 8)) + 'px';
      tooltip.style.top = Math.max(8, rect.top - bounds.height - 10) + 'px';
      node.setAttribute('aria-describedby', tooltip.id);
    }
    function positionTooltip() {
      if (!focused || placementFrame !== undefined || disposed) return;
      if (!root.requestAnimationFrame) { showTooltip(focused); return; }
      placementFrame = root.requestAnimationFrame(() => {
        placementFrame = undefined;
        if (!disposed && focused) showTooltip(focused);
      });
    }
    function paint() {
      for (const node of nodes) {
        const source = node.dataset.sourceStatus;
        if (!Object.hasOwn(names, source)) continue;
        const unavailable = states.get(source)?.websiteUnavailable === true;
        const text = translate(label(source));
        node.classList.toggle('source-unavailable', unavailable);
        node.setAttribute('title', text); node.setAttribute('aria-label', text);
        node.dataset.sourceState = unavailable ? 'website-unavailable' : 'normal';
        if (focused === node) showTooltip(node);
      }
    }
    function apply(value) {
      const rows = Array.isArray(value) ? value : value?.sources;
      if (!Array.isArray(rows)) return false;
      for (const row of rows) {
        if (!Object.hasOwn(names, row?.source)) continue;
        // A network error or bad API key must never be presented as a site outage.
        const websiteUnavailable = row.websiteUnavailable === true &&
          Number.isInteger(row.statusCode) && row.statusCode >= 500 && row.statusCode <= 599;
        states.set(row.source, { websiteUnavailable });
      }
      paint(); return true;
    }
    function schedule() {
      if (disposed || document?.hidden || timer !== undefined || !scheduleTimer) return;
      const delay = Math.max(100, 1500 - (now() - lastRead));
      timer = scheduleTimer(() => { timer = undefined; void refresh(); }, delay);
    }
    async function refresh() {
      if (disposed || document?.hidden) return;
      if (pending) return pending;
      lastRead = now();
      controller = typeof AbortController === 'function' ? new AbortController() : null;
      const deadline = scheduleTimer?.(() => controller?.abort(), 3000);
      pending = Promise.resolve().then(() => fetchStatus(controller?.signal)).then(value => {
        if (!disposed) apply(value);
      }).catch(() => {
        // Preserve the last observation when the local endpoint is unavailable.
      }).finally(() => {
        if (deadline !== undefined) cancelTimer?.(deadline); pending = null; controller = null;
      });
      return pending;
    }
    const focus = () => schedule();
    const visibility = () => {
      if (document?.hidden) { controller?.abort(); hideTooltip(); }
      else schedule();
    };
    function pollAgain() {
      if (disposed || !scheduleTimer) return;
      poll = scheduleTimer(() => { schedule(); pollAgain(); }, 10000);
    }
    const onFocus = event => showTooltip(event.currentTarget);
    const onBlur = event => { event.currentTarget.removeAttribute('aria-describedby'); hideTooltip(); };
    function start() {
      if (started || disposed || !nodes.length) return;
      started = true; paint();
      for (const node of nodes) { node.addEventListener?.('focus', onFocus); node.addEventListener?.('blur', onBlur); }
      root.addEventListener?.('focus', focus); root.addEventListener?.('resize', positionTooltip);
      document?.addEventListener?.('visibilitychange', visibility);
      document?.addEventListener?.('scroll', positionTooltip, true);
      void refresh(); pollAgain();
    }
    function dispose() {
      disposed = true; controller?.abort();
      if (timer !== undefined) cancelTimer?.(timer); if (poll !== undefined) cancelTimer?.(poll);
      for (const node of nodes) {
        node.removeEventListener?.('focus', onFocus); node.removeEventListener?.('blur', onBlur);
        node.removeAttribute?.('aria-describedby');
      }
      root.removeEventListener?.('focus', focus); root.removeEventListener?.('resize', positionTooltip);
      document?.removeEventListener?.('visibilitychange', visibility); document?.removeEventListener?.('scroll', positionTooltip, true);
      hideTooltip(); tooltip?.remove();
    }
    return { start, schedule, refresh, apply, dispose };
  }
  const api = { create, schedule: () => api.instance?.schedule() };
  root.DartSourceStatus = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else {
    api.instance = create(); api.instance.start();
    root.addEventListener?.('pagehide', () => api.instance.dispose(), { once: true });
  }
})(globalThis);

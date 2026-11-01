(function(root) {
  'use strict';
  const maxBytes = 20 * 1024 * 1024;
  function create({ fetch: send = root.fetch.bind(root), beforeTransfer = async () => true,
      afterImport = async () => {}, changed = () => {}, download = () => {} } = {}) {
    const state = { busy: '', pending: null, error: '', result: null, applySettings: false };
    let generation = 0;
    const emit = () => changed(state);
    const failure = message => { state.error = message; };
    async function json(path, raw) {
      const response = await send(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: raw });
      if (!response.ok) throw new Error(response.status === 413 ? 'Profile file exceeds 20 MB.' :
        response.status === 409 ? 'Could not save the profile. Existing data has been preserved.' :
          'The file is not a supported DART profile, or contains invalid values.');
      return response.json();
    }
    return {
      state,
      async choose(file) {
        if (!file || state.busy) return false;
        const current = ++generation;
        state.pending = null; state.result = null; state.error = ''; state.busy = 'preview'; emit();
        try {
          if (file.size > maxBytes) throw new Error('Profile file exceeds 20 MB.');
          const raw = await file.text();
          if (new TextEncoder().encode(raw).length > maxBytes) throw new Error('Profile file exceeds 20 MB.');
          const counts = await json('/api/profile-transfer/preview', raw);
          if (current !== generation) return false;
          state.pending = { name: String(file.name || ''), raw, counts }; state.applySettings = false;
          return true;
        } catch (error) { if (current === generation) failure(error.message || 'Could not read the profile file.'); return false; }
        finally { if (current === generation) { state.busy = ''; emit(); } }
      },
      cancel() { if (state.busy === 'import') return; generation++; state.pending = null; state.error = ''; state.busy = ''; emit(); },
      applySettings(value) { state.applySettings = value === true; },
      async import() {
        if (!state.pending || state.busy) return false;
        state.busy = 'import'; state.error = ''; state.result = null; emit();
        try {
          if (await beforeTransfer() === false) throw new Error('Could not save current changes. Please try again.');
          const result = await json(`/api/profile-transfer/import?applySettings=${state.applySettings}`, state.pending.raw);
          state.result = result; state.pending = null;
          try { await afterImport(result); }
          catch { failure('Profile merged. Some views could not refresh; reopen the affected tab.'); }
          return true;
        } catch (error) { failure(error.message || 'Could not import the profile. Existing data has been preserved.'); return false; }
        finally { state.busy = ''; emit(); }
      },
      async export() {
        if (state.busy) return false;
        state.busy = 'export'; state.error = ''; state.result = null; emit();
        try {
          if (await beforeTransfer() === false) throw new Error('Could not save current changes. Please try again.');
          const response = await send('/api/profile-transfer/export', { cache: 'no-store' });
          if (!response.ok) throw new Error('Could not export the profile. Existing data has been preserved.');
          const blob = await response.blob();
          if (blob.size > maxBytes) throw new Error('Profile file exceeds 20 MB.');
          await download(blob, `DART-profile-${new Date().toISOString().slice(0, 10)}.json`);
          return true;
        } catch (error) { failure(error.message || 'Could not export the profile.'); return false; }
        finally { state.busy = ''; emit(); }
      }
    };
  }
  const api = { create, maxBytes };
  root.DartProfileTransfer = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);

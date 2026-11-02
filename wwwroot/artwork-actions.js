(function(root) {
  'use strict';
  const sources = ['danbooru','gelbooru','rule34','sankaku'];
  function validMedia(value) {
    try {
      const url = new URL(value);
      return ['http:','https:'].includes(url.protocol) && !url.username && !url.password && value.length <= 4000 &&
        ['donmai.us','gelbooru.com','rule34.xxx','sankakucomplex.com'].some(host => url.hostname === host || url.hostname.endsWith('.'+host));
    } catch { return false; }
  }
  function media(item, selected) { return [selected, ...(item?.images || []), item?.thumbnail].find(validMedia) || null; }
  function link(item) {
    if (!sources.includes(item?.source) || !item?.id) return '';
    const id = encodeURIComponent(item.id);
    return item.source === 'danbooru' ? `https://danbooru.donmai.us/posts/${id}` : item.source === 'gelbooru' ?
      `https://gelbooru.com/index.php?page=post&s=view&id=${id}` : item.source === 'rule34' ?
      `https://rule34.xxx/index.php?page=post&s=view&id=${id}` : `https://sankaku.app/posts/${id}`;
  }
  function filename(item, url) {
    const ext = new URL(url).pathname.match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toLowerCase() || 'jpg';
    return `DART-${item.source}-${item.id}.${ext}`.replace(/[^\p{L}\p{N}._-]/gu,'_');
  }
  function create(deps = {}) {
    const { request, changed = () => {}, toast = () => {}, tokens = item => [item?.key, ...(item?.memberKeys || [])] } = deps;
    const strong = item => tokens(item).filter(token => token && !/^group:(danbooru|gelbooru|rule34|sankaku):parent:/.test(token));
    let base = [], current = [], index = new Set(), revision = 0, saving = Promise.resolve(), loadError = false;
    const pending = new Map(), busy = new Set();
    function matches(a,b) { const values = new Set(strong(a)); return strong(b).some(token => values.has(token)); }
    function rebuild() {
      current = [...base];
      for (const { item, hidden } of pending.values()) {
        current = current.filter(saved => !matches(saved,item)); if (hidden) current.unshift(item);
      }
      index = new Set(current.flatMap(strong)); changed();
    }
    function restore(items) { base = Array.isArray(items) ? items.filter(item => item?.key) : []; loadError = false; rebuild(); }
    const isHidden = item => strong(item).some(token => index.has(token));
    async function load() {
      const version = revision;
      try { const items = await request('/api/hidden-artworks'); if (!Array.isArray(items)) throw Error('Invalid response');
        if (version === revision) restore(items); return true;
      } catch { loadError = true; changed(); return false; }
    }
    function setHidden(item, hidden) {
      if (!item?.key || pending.has(item.key)) return Promise.resolve(false);
      pending.set(item.key,{ item,hidden }); revision++; rebuild();
      const operation = saving.then(async () => {
        try {
          const items = await request('/api/hidden-artworks',{ method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({item,hidden}) });
          if (!Array.isArray(items)) throw Error('Invalid response'); base = items; loadError = false; return true;
        } catch { toast('Could not change artwork visibility. Please try again.'); return false; }
        finally { pending.delete(item.key); revision++; rebuild(); }
      });
      saving = operation.catch(()=>{}); return operation;
    }
    async function run(action, context) {
      const item = context?.item;
      const key = `${action}:${item?.key || context?.tag || context?.author?.artistId || ''}`;
      if (busy.has(key)) return false;
      busy.add(key);
      try {
        if (action === 'hide') return await setHidden(item,context.hidden === undefined ? !isHidden(item) : !context.hidden);
        if (action === 'favorite') return await deps.favorite?.(item);
        if (action === 'copy-value') {
          const value = context.kind === 'author' ? context.author?.artistId || context.author?.name : context.tag;
          if (!value) return false; await deps.copyText(value); toast('Copied.'); return true;
        }
        if (action === 'copy-tags') { await deps.copyTags(item); return true; }
        if (action === 'copy-link') { const value = link(item); if (!value) throw Error('No link'); await deps.copyText(value); toast('Artwork link copied.'); return true; }
        const resolve = async () => {
          const url = deps.resolveMedia ? await deps.resolveMedia(item,context.mediaUrl) : media(item,context.mediaUrl);
          if (!validMedia(url)) throw Error('Media unavailable'); return url;
        };
        if (action === 'copy-image') {
          // Call Clipboard.write synchronously inside the gesture; its PNG value
          // is a promise, so network/decode latency cannot consume activation.
          const png = deps.png(item, context.mediaUrl, context.mediaElement, resolve);
          await deps.copyImage(png); toast('Image copied.'); return true;
        }
        const url = await resolve();
        if (action === 'copy-image-link') { await deps.copyText(url); toast('Image link copied.'); return true; }
        if (action === 'download') {
          const route = /\.(mp4|webm|mov|m4v)(?:\?|$)/i.test(url) ? 'video' : 'image';
          await deps.download(`/api/${route}?url=${encodeURIComponent(url)}`,filename(item,url)); return true;
        }
        return false;
      } catch(error) { toast(error?.status===401 ? 'Sign in to the source to access this image.' : error?.status===403 ?
        'This image requires additional access on the source website.' : action.startsWith('copy') ? 'Could not copy. Please try again.' : 'Could not download this artwork. Please try again.'); return false; }
      finally { busy.delete(key); }
    }
    return { load, restore, isHidden, setHidden, run, items:()=>current, pending:item=>pending.has(item?.key),
      get revision() { return revision; }, get loadError() { return loadError; } };
  }
  const api = {create,media,link,filename,validMedia};
  root.DartArtworkActions=api;
  if(typeof module!=='undefined')module.exports=api;
})(globalThis);

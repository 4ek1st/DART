const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../wwwroot/app.js'), 'utf8');
const bootstrap = source.slice(source.indexOf('function bootstrapApplication()'), source.indexOf('\nvoid bootstrapApplication();'));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

function fixture() {
  const jobs = Object.fromEntries(['bookmarks', 'likes', 'follows', 'settings', 'content', 'session',
    'recommendations', 'viewed', 'hidden', 'tags', 'artworks', 'groups'].map(key => [key, deferred()]));
  const calls = [];
  const context = vm.createContext({
    refreshBookmarks: () => jobs.bookmarks.promise, refreshLikes: () => jobs.likes.promise,
    refreshFollows: () => jobs.follows.promise, loadSettings: () => jobs.settings.promise,
    loadContentPreferences: () => jobs.content.promise, loadClientState: () => jobs.session.promise,
    loadRecommendationTagPreferences: () => jobs.recommendations.promise,
    loadViewedTokens: () => jobs.viewed.promise, loadFavoriteTags: () => jobs.tags.promise,
    favoritesController: () => ({ loadArtworks: () => jobs.artworks.promise }),
    artworkActionsController: () => ({ load: () => jobs.hidden.promise }),
    favoriteGroupsController: () => ({ load: () => jobs.groups.promise }),
    likes: [], bookmarks: [], recent: [], recordViewedWorks: () => { calls.push('viewed'); },
    restoreSession: () => { calls.push('restore'); return false; },
    createTab: kind => calls.push(kind)
  });
  vm.runInContext(bootstrap, context);
  return { jobs, calls, start: () => vm.runInContext('bootstrapApplication()', context) };
}

test('an optional Favorites collection cannot delay the initial tab', async () => {
  const f = fixture(), started = f.start();
  for (const key of ['bookmarks', 'likes', 'follows', 'settings', 'content', 'session', 'recommendations', 'viewed', 'hidden']) f.jobs[key].resolve();
  await started;
  assert.deepEqual(f.calls, ['viewed', 'restore', 'home']);
  for (const key of ['tags', 'artworks', 'groups']) f.jobs[key].resolve();
});

test('visibility, saved identity, session and ranking inputs stay ahead of first results', async () => {
  for (const held of ['bookmarks', 'likes', 'follows', 'settings', 'content', 'session', 'recommendations', 'viewed', 'hidden']) {
    const f = fixture(), started = f.start();
    for (const [key, job] of Object.entries(f.jobs)) if (key !== held) job.resolve();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(f.calls, [], `${held} must be ready before initial restoration`);
    f.jobs[held].resolve(); await started;
    assert.deepEqual(f.calls, ['viewed', 'restore', 'home']);
  }
});

test('a rejected optional response cannot reject startup or restore twice', async () => {
  const f = fixture(), started = f.start();
  for (const [key, job] of Object.entries(f.jobs)) key === 'artworks' ? job.reject(new Error('controlled unavailable collection')) : job.resolve();
  await started;
  assert.equal(f.calls.filter(call => call === 'restore').length, 1);
});

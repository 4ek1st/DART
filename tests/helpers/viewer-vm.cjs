// App-fragment fixtures share the real preference helpers and defaults. Keep
// their state per VM, just as each application window owns its viewer choices.
const vm = require('node:vm');
const fs = require('node:fs');
const DartViewerPreferences = require('../../wwwroot/viewer-preferences.js');
const DartArtworkActions = require('../../wwwroot/artwork-actions.js');
const DartProviderPages = require('../../wwwroot/provider-pages.js');
const app = fs.readFileSync(require.resolve('../../wwwroot/app.js'), 'utf8');
const helpers = app.slice(app.indexOf('function selectedRating('), app.indexOf('\nfunction refreshNsfwTabs('));
const feedHelpers = app.slice(app.indexOf('function knownWorkTokens('), app.indexOf('\nfunction emptyFeedMessage('));
const feedNames = [...feedHelpers.matchAll(/(?:async )?function (\w+)\(/g)].map(match => match[1]);

function createContext(sandbox = {}, options) {
  if (!Object.hasOwn(sandbox, 'DartProviderPages')) sandbox.DartProviderPages = DartProviderPages;
  if (!Object.hasOwn(sandbox, 'DartViewerPreferences')) sandbox.DartViewerPreferences = DartViewerPreferences;
  if (!Object.hasOwn(sandbox, 'viewerPreferences')) sandbox.viewerPreferences = DartViewerPreferences.normalize();
  // Fragment tests own an empty hidden collection unless explicitly supplied.
  // The production controller is used, so its identity semantics stay shared.
  const actions=DartArtworkActions.create({request:async()=>[]});
  const defaults={artworkActionsController:()=>actions,favoriteGroupFor:()=>null,
    // Fragment windows do not initialize the optional hover UI. Tests that
    // exercise its lifecycle explicitly supply an owned controller instead.
    tagPreviewController:{instance:null},tagPreviewHistory:{cache:null,retryAt:0},
    renderHiddenArtworksSettings:()=>'',svg:()=>'',recommendationTagMenu:{},closeRecommendationTagMenu(){},pruneArtworkRoutes(){},
    quickPreviewReturnFocus:null,quickPreviewSpaceHeld:false,quickPreviewRenderPending:false};
  for(const [key,value]of Object.entries(defaults))if(!Object.hasOwn(sandbox,key))sandbox[key]=value;
  const context = vm.createContext(sandbox, options);
  vm.runInContext(helpers, context);
  if (sandbox.CatalogLogic && !Object.hasOwn(sandbox, 'filterFeedWorks')) {
    // Recommendation publication shares the real grid eligibility pipeline.
    // Fragment fixtures get the same empty initial libraries as an app window;
    // explicitly supplied dependencies remain owned by their individual test.
    const provided = feedNames.filter(name => Object.hasOwn(sandbox, name)).map(name => [name, sandbox[name]]);
    const state = { likes: [], bookmarks: [], recent: [], follows: [], viewedTokens: new Set(), viewedPending: new Set() };
    for (const [name, value] of Object.entries(state)) if (!Object.hasOwn(sandbox, name)) sandbox[name] = value;
    vm.runInContext(feedHelpers, context);
    for (const [name, value] of provided) sandbox[name] = value;
  }
  if(!Object.hasOwn(sandbox,'artworkMoreButton'))vm.runInContext(app.slice(app.indexOf('function artworkMoreButton('),app.indexOf('\nasync function copyTextValue(')),context);
  return context;
}

module.exports = { ...vm, createContext,
  runInNewContext: (source, sandbox, options) => vm.runInContext(source, createContext(sandbox), options) };

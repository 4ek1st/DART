// App-fragment fixtures share the real preference helpers and defaults. Keep
// their state per VM, just as each application window owns its viewer choices.
const vm = require('node:vm');
const fs = require('node:fs');
const DartViewerPreferences = require('../../wwwroot/viewer-preferences.js');
const DartArtworkActions = require('../../wwwroot/artwork-actions.js');
const app = fs.readFileSync(require.resolve('../../wwwroot/app.js'), 'utf8');
const helpers = app.slice(app.indexOf('function selectedRating('), app.indexOf('\nfunction refreshNsfwTabs('));

function createContext(sandbox = {}, options) {
  if (!Object.hasOwn(sandbox, 'DartViewerPreferences')) sandbox.DartViewerPreferences = DartViewerPreferences;
  if (!Object.hasOwn(sandbox, 'viewerPreferences')) sandbox.viewerPreferences = DartViewerPreferences.normalize();
  // Fragment tests own an empty hidden collection unless explicitly supplied.
  // The production controller is used, so its identity semantics stay shared.
  const actions=DartArtworkActions.create({request:async()=>[]});
  const defaults={artworkActionsController:()=>actions,favoriteGroupFor:()=>null,
    renderHiddenArtworksSettings:()=>'',svg:()=>'',recommendationTagMenu:{},closeRecommendationTagMenu(){},pruneArtworkRoutes(){},
    quickPreviewReturnFocus:null,quickPreviewSpaceHeld:false};
  for(const [key,value]of Object.entries(defaults))if(!Object.hasOwn(sandbox,key))sandbox[key]=value;
  const context = vm.createContext(sandbox, options);
  vm.runInContext(helpers, context);
  if(!Object.hasOwn(sandbox,'artworkMoreButton'))vm.runInContext(app.slice(app.indexOf('function artworkMoreButton('),app.indexOf('\nasync function copyTextValue(')),context);
  return context;
}

module.exports = { ...vm, createContext,
  runInNewContext: (source, sandbox, options) => vm.runInContext(source, createContext(sandbox), options) };

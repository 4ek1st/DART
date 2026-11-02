// App-fragment fixtures share the real preference helpers and defaults. Keep
// their state per VM, just as each application window owns its viewer choices.
const vm = require('node:vm');
const fs = require('node:fs');
const DartViewerPreferences = require('../../wwwroot/viewer-preferences.js');
const app = fs.readFileSync(require.resolve('../../wwwroot/app.js'), 'utf8');
const helpers = app.slice(app.indexOf('function selectedRating('), app.indexOf('\nfunction refreshNsfwTabs('));

function createContext(sandbox = {}, options) {
  if (!Object.hasOwn(sandbox, 'DartViewerPreferences')) sandbox.DartViewerPreferences = DartViewerPreferences;
  if (!Object.hasOwn(sandbox, 'viewerPreferences')) sandbox.viewerPreferences = DartViewerPreferences.normalize();
  const context = vm.createContext(sandbox, options);
  vm.runInContext(helpers, context);
  return context;
}

module.exports = { ...vm, createContext,
  runInNewContext: (source, sandbox, options) => vm.runInContext(source, createContext(sandbox), options) };

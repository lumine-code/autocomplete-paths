const { CompositeDisposable } = require("lumine");
const PathsProvider = require("./paths-provider");
const { OptionScopes } = require("./config/option-scopes");

let provider = null;
let statusBar = null;
let statusBarTile = null;
let statusBarElement = null;
let statusBarTooltip = null;
let subscriptions = null;

function activate() {
  subscriptions = new CompositeDisposable();
  subscriptions.add(
    lumine.commands.add("lumine-workspace", "autocomplete-paths:rebuild-cache", {
      description: "Index the project's paths again for path completion.",
      didDispatch: () => {
        getProvider().rebuildCache();
      },
    }),
  );

  // The paths are the project's file index now, so core policy is owned there.
  // Package ignored names only rebuild the provider's already-materialized
  // views and never cause a project crawl.
  subscriptions.add(
    lumine.config.onDidChange("autocomplete-paths.ignoredNames", () =>
      provider?.reloadIgnoredNames(),
    ),
  );
  const scopeOptions = ["autocomplete-paths.scopes", "autocomplete-paths.ignoreBuiltinScopes"];
  for (const key of Object.keys(OptionScopes)) scopeOptions.push(`autocomplete-paths.${key}`);
  for (const option of scopeOptions) {
    subscriptions.add(lumine.config.onDidChange(option, () => provider?.reloadScopes()));
  }
}

function deactivate() {
  subscriptions?.dispose();
  subscriptions = null;
  provider?.dispose();
  provider = null;
  hideStatusBarTile();
  statusBar = null;
}

function consumeStatusBar(service) {
  statusBar = service;
}

function showStatusBarTile() {
  if (!statusBar || statusBarTile) return;
  statusBarElement = document.createElement("status-bar-tile");
  // Nothing to click: the tile only reports that the scan is running, so it
  // takes no hover or press feedback.
  statusBarElement.className = "autocomplete-paths-status is-read-only";
  statusBarElement.textContent = "Scanning project paths…";
  statusBarTooltip = lumine.tooltips.add(statusBarElement, {
    title: "Indexing the project's files so path completions can be offered",
  });
  statusBarTile = statusBar.addRightTile({ item: statusBarElement, priority: 100 });
}

function hideStatusBarTile() {
  statusBarTooltip?.dispose();
  statusBarTooltip = null;
  statusBarTile?.destroy();
  statusBarTile = null;
  statusBarElement = null;
}

// `autocomplete` calls this as soon as it consumes the service, which is window
// startup. Constructing the provider is cheap and reaches nothing; the file
// index is not touched until a completion request actually lands in a path
// scope, so a window where nobody types a path prefix never crawls.
function getProvider() {
  if (provider) return provider;
  provider = new PathsProvider({
    didChangeIndexing: (indexing) => (indexing ? showStatusBarTile() : hideStatusBarTile()),
  });
  return provider;
}

module.exports = { activate, consumeStatusBar, deactivate, getProvider };

const { CompositeDisposable } = require("lumine");
const PathsProvider = require("./paths-provider");
const { OptionScopes } = require("./config/option-scopes");

let provider = null;
let rebuildTimeout = null;
let statusBar = null;
let statusBarTile = null;
let statusBarElement = null;
let subscriptions = null;

function scheduleRebuild() {
  clearTimeout(rebuildTimeout);
  rebuildTimeout = setTimeout(() => {
    rebuildTimeout = null;
    getProvider().rebuildCache();
  }, 250);
}

function activate() {
  subscriptions = new CompositeDisposable();
  subscriptions.add(
    lumine.commands.add("lumine-workspace", "autocomplete-paths:rebuild-cache", () => {
      getProvider().rebuildCache();
    }),
  );

  const cacheOptions = [
    "core.ignoredNames",
    "core.excludeVcsIgnoredPaths",
    "autocomplete-paths.followSymlinks",
    "autocomplete-paths.ignoreSubmodules",
    "autocomplete-paths.ignoredNames",
    "autocomplete-paths.ignoredPatterns",
    "autocomplete-paths.maxFileCount",
  ];
  for (const option of cacheOptions) {
    subscriptions.add(
      lumine.config.onDidChange(option, () => {
        if (!provider) return;
        provider.pathsCache.updateConfig();
        scheduleRebuild();
      }),
    );
  }

  const scopeOptions = ["autocomplete-paths.scopes", "autocomplete-paths.ignoreBuiltinScopes"];
  for (const key of Object.keys(OptionScopes)) scopeOptions.push(`autocomplete-paths.${key}`);
  for (const option of scopeOptions) {
    subscriptions.add(lumine.config.onDidChange(option, () => provider?.reloadScopes()));
  }
}

function deactivate() {
  clearTimeout(rebuildTimeout);
  rebuildTimeout = null;
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
  statusBarElement = document.createElement("span");
  statusBarElement.className = "autocomplete-paths-status";
  statusBarElement.textContent = "Scanning project paths…";
  statusBarTile = statusBar.addRightTile({ item: statusBarElement, priority: 100 });
}

function hideStatusBarTile() {
  statusBarTile?.destroy();
  statusBarTile = null;
  statusBarElement = null;
}

function getProvider() {
  if (provider) return provider;
  provider = new PathsProvider();
  provider.on("rebuild-cache", showStatusBarTile);
  provider.on("rebuild-cache-done", hideStatusBarTile);
  provider.rebuildCache();
  return provider;
}

module.exports = { activate, consumeStatusBar, deactivate, getProvider };

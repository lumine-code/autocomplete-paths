const { EventEmitter } = require("node:events");
const path = require("node:path");
const glob = require("fast-glob");

function matchesPattern(filePath, rootPath, pattern) {
  try {
    const relativePath = path.relative(rootPath, filePath).replaceAll(path.sep, "/");
    return (
      path.matchesGlob(relativePath, pattern) || path.matchesGlob(path.basename(filePath), pattern)
    );
  } catch {
    return false;
  }
}

class PathsCache extends EventEmitter {
  constructor() {
    super();
    this.pathsByRoot = new Map();
    this.repositories = new Map();
    this.generation = 0;
    this.updateConfig();
    this.projectPathsSubscription = lumine.project.onDidChangePaths(() => this.rebuildCache());
    this.projectFilesSubscription = lumine.project.onDidChangeFiles((events) =>
      this.onDidChangeFiles(events),
    );
  }

  updateConfig() {
    this.config = {
      excludeVcsIgnoredPaths: lumine.config.get("core.excludeVcsIgnoredPaths"),
      ignoreSubmodules: lumine.config.get("autocomplete-paths.ignoreSubmodules"),
      useIgnoredNames: lumine.config.get("autocomplete-paths.ignoredNames"),
      ignoredNames: lumine.config.get("core.ignoredNames") || [],
      ignoredPatterns: lumine.config.get("autocomplete-paths.ignoredPatterns") || [],
      maxFileCount: lumine.config.get("autocomplete-paths.maxFileCount") || 10000,
      followSymlinks: lumine.config.get("autocomplete-paths.followSymlinks"),
    };
  }

  async rebuildCache() {
    const generation = ++this.generation;
    this.emit("rebuild-cache");
    const directories = lumine.project.getDirectories();
    const scans = await Promise.all(directories.map((directory) => this.scanDirectory(directory)));
    if (generation !== this.generation) return [];

    this.pathsByRoot.clear();
    for (let index = 0; index < directories.length; index += 1) {
      this.pathsByRoot.set(directories[index].getPath(), new Set(scans[index]));
    }
    this.emit("rebuild-cache-done");
    return scans;
  }

  async scanDirectory(directory) {
    const rootPath = directory.getPath();
    const repository = await lumine.project.repositoryForDirectory(directory);
    this.repositories.set(rootPath, repository || null);
    const files = await glob("**/*", {
      absolute: true,
      cwd: rootPath,
      dot: true,
      followSymbolicLinks: Boolean(this.config.followSymlinks),
      onlyFiles: true,
      unique: true,
    });

    const accepted = [];
    for (const filePath of files) {
      if (this.isPathIgnored(filePath, rootPath, repository)) continue;
      accepted.push(path.normalize(filePath));
      if (accepted.length >= this.config.maxFileCount) {
        lumine.notifications.addWarning("Path suggestion cache limit reached", {
          description: `${rootPath} contains more than ${this.config.maxFileCount} eligible files. Increase autocomplete-paths.maxFileCount to include the rest.`,
          dismissable: true,
        });
        break;
      }
    }
    return accepted;
  }

  isPathIgnored(filePath, rootPath, repository = this.repositories.get(rootPath)) {
    if (this.config.excludeVcsIgnoredPaths && repository?.isPathIgnored(filePath)) return true;
    if (this.config.ignoreSubmodules && repository?.isSubmodule(filePath)) return true;
    const patterns = [
      ...(this.config.useIgnoredNames ? this.config.ignoredNames : []),
      ...this.config.ignoredPatterns,
    ];
    return patterns.some((pattern) => matchesPattern(filePath, rootPath, pattern));
  }

  getFilePathsForProjectDirectory(directory, relativeToPath = null) {
    const rootPath = typeof directory === "string" ? directory : directory.getPath();
    const paths = [...(this.pathsByRoot.get(rootPath) || [])];
    if (!relativeToPath) return paths;
    const prefix = `${path.resolve(relativeToPath)}${path.sep}`;
    return paths.filter((filePath) => filePath === relativeToPath || filePath.startsWith(prefix));
  }

  onDidChangeFiles(events) {
    for (const event of events) {
      if (event.action === "modified") continue;
      const candidatePath = event.path || event.oldPath;
      const directory = lumine.project
        .getDirectories()
        .find((projectDirectory) => projectDirectory.contains(candidatePath));
      if (!directory) continue;
      const rootPath = directory.getPath();
      const paths = this.pathsByRoot.get(rootPath);
      if (!paths) continue;

      if (event.action === "deleted") paths.delete(path.normalize(event.path));
      if (event.action === "renamed") {
        paths.delete(path.normalize(event.oldPath));
        if (!this.isPathIgnored(event.path, rootPath)) paths.add(path.normalize(event.path));
      }
      if (event.action === "created" && !this.isPathIgnored(event.path, rootPath)) {
        if (paths.size < this.config.maxFileCount) paths.add(path.normalize(event.path));
      }
    }
  }

  dispose() {
    this.generation += 1;
    this.projectPathsSubscription?.dispose();
    this.projectFilesSubscription?.dispose();
    this.projectPathsSubscription = null;
    this.projectFilesSubscription = null;
    this.pathsByRoot.clear();
    this.repositories.clear();
    this.removeAllListeners();
  }
}

module.exports = PathsCache;

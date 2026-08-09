const { EventEmitter } = require("node:events");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const PathsCache = require("./paths-cache");
const { DefaultScopes } = require("./config/default-scopes");
const { OptionScopes } = require("./config/option-scopes");

function withForwardSlashes(value) {
  return value.replaceAll(path.sep, "/");
}

function fuzzyScore(candidate, query) {
  if (!query) return 0;
  const text = candidate.toLowerCase();
  const needle = query.toLowerCase();
  const directIndex = text.indexOf(needle);
  if (directIndex >= 0) return 1000 - directIndex - text.length / 1000;

  let cursor = 0;
  let gaps = 0;
  for (const character of needle) {
    const index = text.indexOf(character, cursor);
    if (index < 0) return Number.NEGATIVE_INFINITY;
    gaps += index - cursor;
    cursor = index + 1;
  }
  return 100 - gaps - text.length / 1000;
}

function lineForRequest({ editor, bufferPosition }) {
  return editor.getTextInRange([[bufferPosition.row, 0], bufferPosition]);
}

function scopeMatch(scope, request) {
  const sourceScopes = Array.isArray(scope.scopes) ? scope.scopes : [scope.scopes];
  const activeScopes = request.scopeDescriptor.getScopesArray();
  if (!sourceScopes.some((scopeName) => activeScopes.includes(scopeName))) return null;

  const line = lineForRequest(request);
  const prefixes = Array.isArray(scope.prefixes) ? scope.prefixes : [scope.prefixes];
  for (const prefix of prefixes) {
    try {
      const match = line.match(new RegExp(prefix, "i"));
      if (match) return match;
    } catch (error) {
      console.warn(`autocomplete-paths: Invalid prefix expression ${prefix}`, error);
    }
  }
  return null;
}

function projectDirectoryForEditor(editor) {
  const filePath = editor.getPath();
  if (!filePath) return null;
  return lumine.project.getDirectories().find((directory) => directory.contains(filePath)) || null;
}

function imageIcon(filePath) {
  const url = pathToFileURL(filePath).href.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
  return `<img class="autocomplete-paths-image" src="${url}" alt="" />`;
}

class PathsProvider extends EventEmitter {
  constructor() {
    super();
    this.selector = "*";
    this.inclusionPriority = 1;
    this.pathsCache = new PathsCache();
    this.ready = false;
    this.onRebuild = () => this.emit("rebuild-cache");
    this.onRebuildDone = () => this.emit("rebuild-cache-done");
    this.pathsCache.on("rebuild-cache", this.onRebuild);
    this.pathsCache.on("rebuild-cache-done", this.onRebuildDone);
    this.reloadScopes();
  }

  reloadScopes() {
    this.scopes = [...(lumine.config.get("autocomplete-paths.scopes") || [])];
    if (!lumine.config.get("autocomplete-paths.ignoreBuiltinScopes")) {
      this.scopes.push(...DefaultScopes);
    }
    for (const [key, scopes] of Object.entries(OptionScopes)) {
      if (lumine.config.get(`autocomplete-paths.${key}`)) this.scopes.push(...scopes);
    }
  }

  async suggestionsForScope(scope, request, match) {
    const editorPath = request.editor.getPath();
    const projectDirectory = projectDirectoryForEditor(request.editor);
    if (!editorPath || !projectDirectory) return [];

    const line = lineForRequest(request);
    const pathPrefix = line.slice(match.index + match[0].length);
    const hasTrailingSlash = /[/\\]$/.test(pathPrefix);
    const directoryGiven = pathPrefix.startsWith("./") || pathPrefix.startsWith("../");
    const parsedPrefix = path.parse(pathPrefix);
    if (hasTrailingSlash) {
      parsedPrefix.dir = path.join(parsedPrefix.dir, parsedPrefix.base);
      parsedPrefix.base = "";
    }

    const currentDirectory = path.dirname(editorPath);
    const requestedDirectory = path.resolve(currentDirectory, parsedPrefix.dir);
    const candidates = directoryGiven
      ? this.pathsCache.getFilePathsForProjectDirectory(projectDirectory, requestedDirectory)
      : this.pathsCache.getFilePathsForProjectDirectory(projectDirectory);
    const allowedExtensions = scope.extensions?.map((extension) => extension.toLowerCase());
    const query = directoryGiven ? parsedPrefix.base : pathPrefix;
    const normalizeSlashes = lumine.config.get("autocomplete-paths.normalizeSlashes");
    const showImages = lumine.config.get("autocomplete-paths.imagePreview");
    const imagePattern = /\.(?:apng|cur|gif|ico|jpe?g|jfif|pjp|png|svg)$/i;

    const ranked = [];
    for (const filePath of candidates) {
      const extension = path.extname(filePath).slice(1).toLowerCase();
      if (allowedExtensions && !allowedExtensions.includes(extension)) continue;

      const projectRelativePath = path.relative(projectDirectory.getPath(), filePath);
      const relativePath = path.relative(currentDirectory, filePath);
      let displayText = directoryGiven
        ? path.relative(requestedDirectory, filePath)
        : projectRelativePath;
      if (normalizeSlashes) displayText = withForwardSlashes(displayText);
      const rank = fuzzyScore(displayText, query);
      if (!Number.isFinite(rank)) continue;

      let text = scope.relative === false ? filePath : relativePath;
      if (
        scope.relative !== false &&
        scope.includeCurrentDirectory !== false &&
        !text.startsWith(".")
      ) {
        text = `.${path.sep}${text}`;
      }
      if (scope.projectRelativePath) text = projectRelativePath;
      if (normalizeSlashes) text = withForwardSlashes(text);
      for (const replacement of scope.replaceOnInsert || []) {
        try {
          text = text.replace(new RegExp(replacement[0]), replacement[1]);
        } catch (error) {
          console.warn("autocomplete-paths: Invalid insertion replacement", replacement, error);
        }
      }

      ranked.push({
        suggestion: {
          text,
          replacementPrefix: pathPrefix,
          displayText,
          type: "import",
          iconHTML: showImages && imagePattern.test(filePath) ? imageIcon(filePath) : undefined,
        },
        rank,
        distance: relativePath.split(path.sep).length,
      });
    }

    ranked.sort((left, right) => right.rank - left.rank || left.distance - right.distance);
    return ranked.slice(0, 10).map(({ suggestion }) => suggestion);
  }

  async getSuggestions(request) {
    const matches = this.scopes
      .map((scope) => ({ scope, match: scopeMatch(scope, request) }))
      .filter(({ match }) => match);
    const suggestions = await Promise.all(
      matches.map(({ scope, match }) => this.suggestionsForScope(scope, request, match)),
    );
    return suggestions.flat();
  }

  async rebuildCache() {
    const result = await this.pathsCache.rebuildCache();
    this.ready = true;
    return result;
  }

  isReady() {
    return this.ready;
  }

  get suggestionPriority() {
    return lumine.config.get("autocomplete-paths.suggestionPriority");
  }

  get fileCount() {
    return lumine.project.getDirectories().reduce((count, directory) => {
      return count + this.pathsCache.getFilePathsForProjectDirectory(directory).length;
    }, 0);
  }

  dispose() {
    this.pathsCache.removeListener("rebuild-cache", this.onRebuild);
    this.pathsCache.removeListener("rebuild-cache-done", this.onRebuildDone);
    this.pathsCache.dispose();
    this.removeAllListeners();
  }
}

module.exports = PathsProvider;

const path = require("node:path");
const { pathToFileURL } = require("node:url");
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

// The one exclusion this package still owns. Core policy — ignored names, VCS
// ignore files, symlink following — is the file index's, and already applied to
// everything it reports; these patterns narrow that further for suggestions
// alone.
function matchesAnyPattern(filePath, rootPath, patterns) {
  const relativePath = path.relative(rootPath, filePath).replaceAll(path.sep, "/");
  const basename = path.basename(filePath);
  for (const pattern of patterns) {
    try {
      if (path.matchesGlob(relativePath, pattern) || path.matchesGlob(basename, pattern)) {
        return true;
      }
    } catch {
      // An unparseable pattern excludes nothing.
    }
  }
  return false;
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

class PathsProvider {
  // Nothing here reaches the project. `getProvider` runs as soon as
  // `autocomplete` consumes the service, which is window startup, so anything
  // that touched the file index from a constructor would build it in every
  // window whether or not the user ever completes a path. The subscription is
  // taken in `getSuggestions`, once a path scope actually matches.
  constructor({ didChangeIndexing } = {}) {
    this.scopeSelector = "*";
    this.inclusionPriority = 1;
    this.didChangeIndexing = didChangeIndexing ?? (() => {});
    this.subscription = null;
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
    const candidates = lumine.project.getFilePathsForRoot(projectDirectory);
    // An explicit `./` or `../` narrows to a subtree. Applied in the loop below
    // rather than by asking for a filtered list: that loop already walks every
    // candidate, so this is one `startsWith` instead of a second pass and
    // another array.
    const requestedPrefix = directoryGiven ? `${requestedDirectory}${path.sep}` : null;
    const rootPath = projectDirectory.getPath();
    // Read once per request, not once per candidate: this loop runs over every
    // indexed file on every keystroke.
    const ignoredPatterns = lumine.config.get("autocomplete-paths.ignoredPatterns") || [];
    const allowedExtensions = scope.extensions?.map((extension) => extension.toLowerCase());
    const query = directoryGiven ? parsedPrefix.base : pathPrefix;
    const normalizeSlashes = lumine.config.get("autocomplete-paths.normalizeSlashes");
    const showImages = lumine.config.get("autocomplete-paths.imagePreview");
    const imagePattern = /\.(?:apng|cur|gif|ico|jpe?g|jfif|pjp|png|svg)$/i;

    const ranked = [];
    for (const filePath of candidates) {
      if (
        requestedPrefix &&
        filePath !== requestedDirectory &&
        !filePath.startsWith(requestedPrefix)
      ) {
        continue;
      }
      if (ignoredPatterns.length > 0 && matchesAnyPattern(filePath, rootPath, ignoredPatterns)) {
        continue;
      }

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
    // After the scope test, not before: this is the first moment the package
    // genuinely needs the project's file paths, and subscribing is what builds
    // the index. A caret that never sits in a path prefix never costs a crawl.
    if (matches.length === 0) return [];
    this.observeIndex();

    const suggestions = await Promise.all(
      matches.map(({ scope, match }) => this.suggestionsForScope(scope, request, match)),
    );
    return suggestions.flat();
  }

  observeIndex() {
    this.subscription ??= lumine.project.observeFilePaths(({ indexing }) =>
      this.didChangeIndexing(indexing),
    );
  }

  rebuildCache() {
    // The index is shared, so this re-crawls for every consumer of it.
    this.observeIndex();
    return lumine.project.refreshFilePaths();
  }

  isReady() {
    return this.subscription != null && !lumine.project.isIndexing();
  }

  get suggestionPriority() {
    return lumine.config.get("autocomplete-paths.suggestionPriority");
  }

  dispose() {
    this.subscription?.dispose();
    this.subscription = null;
  }
}

module.exports = PathsProvider;

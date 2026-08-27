const path = require("node:path");

describe("autocomplete-paths", () => {
  let editor;
  let provider;
  let projectDirectory;

  beforeEach(async () => {
    lumine.config.set("autocomplete-paths.ignoredNames", ["tests"]);
    lumine.config.set("core.excludeVcsIgnoredPaths", false);
    jasmine.attachToDOM(lumine.workspace.getElement());

    await lumine.packages.activatePackage("language-javascript");
    const pack = await lumine.packages.activatePackage("autocomplete-paths");
    editor = await lumine.workspace.open(path.join(__dirname, "fixtures", "tests", "test-file.js"));
    provider = pack.mainModule.getProvider();
    projectDirectory = lumine.project.getDirectories()[0];
    // The provider takes no interest in the file index until a request lands in
    // a path scope, so a spec that asks about candidates has to wake it first.
    await provider.rebuildCache();
    await whenIndexed();
  });

  function whenIndexed() {
    if (!lumine.project.isIndexing()) return Promise.resolve();
    return new Promise((resolve) => {
      const subscription = lumine.project.observeFilePaths(({ indexing }) => {
        if (indexing) return;
        subscription.dispose();
        resolve();
      });
    });
  }

  async function suggestionsFor(text) {
    editor.setText(text);
    editor.setCursorBufferPosition([0, Infinity]);
    const cursor = editor.getLastCursor();
    return provider.getSuggestions({
      editor,
      bufferPosition: cursor.getBufferPosition(),
      scopeDescriptor: cursor.getScopeDescriptor(),
      prefix: cursor.getCurrentWordBufferRange
        ? editor.getTextInBufferRange(cursor.getCurrentWordBufferRange())
        : "",
    });
  }

  it("implements the Lumine autocomplete provider contract", () => {
    expect(provider.scopeSelector).toBe("*");
    expect(provider.selector).toBeUndefined();
  });

  it("reads its candidates from the project's file index", () => {
    const files = lumine.project.getFilePathsForRoot(projectDirectory);
    expect(files.some((filePath) => filePath.endsWith(path.join("somedir", "testfile.js")))).toBe(
      true,
    );
    // The index holds everything core policy allows, including the `tests`
    // directory this package excludes — that filter is applied per request.
    expect(files.some((filePath) => filePath.includes(`${path.sep}tests${path.sep}`))).toBe(true);
    expect(provider.isReady()).toBe(true);
  });

  it("suggests matching JavaScript paths", async () => {
    const suggestions = await suggestionsFor("require('test");
    expect(suggestions.map(({ displayText }) => displayText)).toEqual([
      "somedir/testfile.js",
      "somedir/testdir/nested-test-file.js",
    ]);
  });

  it("inserts relative paths without JavaScript extensions", async () => {
    const suggestions = await suggestionsFor("require('testfile");
    expect(suggestions[0].text).toBe("../somedir/testfile");
    expect(suggestions[0].replacementPrefix).toBe("testfile");
  });

  it("narrows suggestions inside an explicitly typed directory", async () => {
    const suggestions = await suggestionsFor("require('../somedir/test");
    expect(suggestions.map(({ displayText }) => displayText)).toContain("testfile.js");
    expect(suggestions.every(({ text }) => text.startsWith("../somedir/"))).toBe(true);
  });

  it("excludes its own ignored names from suggestions", async () => {
    const suggestions = await suggestionsFor("require('test");
    // The fixture lives under `tests/`, which `ignoredNames` names — the file
    // is in the index but must not be offered.
    expect(suggestions.every(({ displayText }) => !displayText.includes("tests/"))).toBe(true);
  });

  it("rebuilds only its filtered cache when ignored names change", async () => {
    spyOn(lumine.project, "refreshFilePaths").and.callThrough();
    lumine.config.set("autocomplete-paths.ignoredNames", []);

    const suggestions = await suggestionsFor("require('test");
    expect(suggestions.map(({ displayText }) => displayText)).toContain("tests/test-file.js");
    expect(lumine.project.refreshFilePaths).not.toHaveBeenCalled();
  });

  describe("the path-syntax trigger", () => {
    // `./` and `../` are a path in any language, so they trigger everywhere
    // rather than only inside a language's import statement.
    it("completes a relative path written in a comment", async () => {
      const suggestions = await suggestionsFor("// see ../somedir/testf");
      expect(suggestions.map(({ text }) => text)).toContain("../somedir/testfile.js");
    });

    it("keeps the extension a language scope would have stripped", async () => {
      // The JavaScript scope's replaceOnInsert drops `.js` because an import
      // does not want it; prose does.
      const inComment = await suggestionsFor("// ../somedir/testf");
      const inImport = await suggestionsFor("require('../somedir/testf");
      expect(inComment[0].text).toBe("../somedir/testfile.js");
      expect(inImport[0].text).toBe("../somedir/testfile");
    });

    it("does not offer a file twice when a language scope also matches", async () => {
      const suggestions = await suggestionsFor("require('../somedir/testf");
      const texts = suggestions.map(({ text }) => text);
      // `require('../` satisfies both the JavaScript scope and the generic
      // trigger, and the results are flattened together.
      expect(new Set(texts).size).toBe(texts.length);
    });

    it("takes the last path on the line, not the first", async () => {
      // `prefixes` are applied with String#match, which returns the first hit —
      // an unanchored trigger would treat everything after `./a.js` as the path.
      const suggestions = await suggestionsFor("// ./a.js and ../somedir/testf");
      expect(suggestions.map(({ text }) => text)).toContain("../somedir/testfile.js");
    });

    it("offers nothing once the path leaves the project root", async () => {
      const suggestions = await suggestionsFor("// ../../../../../");
      expect(suggestions).toEqual([]);
    });

    it("stays quiet on text that merely contains a dot or an at-sign", async () => {
      expect(await suggestionsFor("// version 3.5 released")).toEqual([]);
      expect(await suggestionsFor("// mail someone@example.com")).toEqual([]);
      expect(await suggestionsFor(" * @param {String} value")).toEqual([]);
    });

    it("outranks a language server's completions", () => {
      // Providers are ordered by suggestionPriority, and the tiebreak is scope
      // specificity — which a `*` selector always loses. At an equal priority a
      // language server's whole identifier list would therefore be concatenated
      // ahead of the paths and bury them, which is why this sits above the 2 an
      // LSP provider reports. Safe because this provider answers with nothing
      // at all unless a path prefix matched.
      expect(provider.suggestionPriority).toBeGreaterThan(2);
    });
  });
});

// Keeping the index unbuilt in a window that never completes a path is the whole
// point of taking the subscription late, and it is a property a single
// well-meaning call in `activate` would quietly destroy.
describe("autocomplete-paths laziness", () => {
  let emitIndex, indexed, provider;

  beforeEach(async () => {
    jasmine.attachToDOM(lumine.workspace.getElement());
    indexed = [];
    let callback = null;
    spyOn(lumine.project, "observeFilePaths").and.callFake((fn) => {
      callback = fn;
      fn({ added: indexed.slice(), removed: [], indexing: false });
      return { dispose: () => (callback = null) };
    });
    spyOn(lumine.project, "getFilePathsForRoot").and.callFake(() => indexed);
    emitIndex = ({ added = [], removed = [], indexing = false }) => {
      indexed = indexed.filter((filePath) => !removed.includes(filePath)).concat(added);
      callback?.({ added, removed, indexing });
    };
    const pack = await lumine.packages.activatePackage("autocomplete-paths");
    provider = pack.mainModule.getProvider();
    spyOn(provider, "buildFilteredCache").and.callThrough();
  });

  it("does not touch the file index when the provider is constructed", () => {
    // `getProvider` is the service method, so this has already run at what would
    // be window startup.
    expect(lumine.project.observeFilePaths).not.toHaveBeenCalled();
  });

  it("does not touch the file index for a request outside every path scope", async () => {
    const editor = await lumine.workspace.open();
    editor.setText("nothing that looks like a path prefix");
    editor.setCursorBufferPosition([0, Infinity]);
    const cursor = editor.getLastCursor();

    const suggestions = await provider.getSuggestions({
      editor,
      bufferPosition: cursor.getBufferPosition(),
      scopeDescriptor: cursor.getScopeDescriptor(),
      prefix: "",
    });

    expect(suggestions).toEqual([]);
    expect(lumine.project.observeFilePaths).not.toHaveBeenCalled();
    expect(lumine.project.getFilePathsForRoot).not.toHaveBeenCalled();
  });

  it("takes the subscription on the first request that matches a path scope", async () => {
    await lumine.packages.activatePackage("language-javascript");
    const editor = await lumine.workspace.open(
      path.join(__dirname, "fixtures", "tests", "test-file.js"),
    );
    editor.setText("require('test");
    editor.setCursorBufferPosition([0, Infinity]);
    const cursor = editor.getLastCursor();

    await provider.getSuggestions({
      editor,
      bufferPosition: cursor.getBufferPosition(),
      scopeDescriptor: cursor.getScopeDescriptor(),
      prefix: "test",
    });

    expect(lumine.project.observeFilePaths).toHaveBeenCalled();
    expect(provider.buildFilteredCache).toHaveBeenCalledTimes(1);

    await provider.getSuggestions({
      editor,
      bufferPosition: cursor.getBufferPosition(),
      scopeDescriptor: cursor.getScopeDescriptor(),
      prefix: "test",
    });
    expect(provider.buildFilteredCache).toHaveBeenCalledTimes(1);

    const rootPath = lumine.project.getDirectories()[0].getPath();
    const addedPath = path.join(rootPath, "added.js");
    emitIndex({ added: [addedPath] });
    expect(provider.pathsForRoot(rootPath).has(addedPath)).toBe(true);

    emitIndex({ removed: [addedPath] });
    expect(provider.pathsForRoot(rootPath).has(addedPath)).toBe(false);
  });
});

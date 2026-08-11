const path = require("node:path");

describe("autocomplete-paths", () => {
  let editor;
  let provider;
  let projectDirectory;

  beforeEach(async () => {
    lumine.config.set("autocomplete-paths.ignoredPatterns", ["**/tests/**"]);
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

  it("excludes its own ignored patterns from suggestions", async () => {
    const suggestions = await suggestionsFor("require('test");
    // The fixture lives under `tests/`, which `ignoredPatterns` names — the file
    // is in the index but must not be offered.
    expect(suggestions.every(({ displayText }) => !displayText.includes("tests/"))).toBe(true);
  });
});

// Keeping the index unbuilt in a window that never completes a path is the whole
// point of taking the subscription late, and it is a property a single
// well-meaning call in `activate` would quietly destroy.
describe("autocomplete-paths laziness", () => {
  let provider;

  beforeEach(async () => {
    jasmine.attachToDOM(lumine.workspace.getElement());
    spyOn(lumine.project, "observeFilePaths").and.callFake(() => ({ dispose() {} }));
    const pack = await lumine.packages.activatePackage("autocomplete-paths");
    provider = pack.mainModule.getProvider();
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
  });
});

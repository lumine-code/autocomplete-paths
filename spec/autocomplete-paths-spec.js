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
    await provider.rebuildCache();
    projectDirectory = lumine.project.getDirectories()[0];
  });

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

  it("caches eligible project files", () => {
    const files = provider.pathsCache.getFilePathsForProjectDirectory(projectDirectory);
    expect(files.some((filePath) => filePath.endsWith(path.join("somedir", "testfile.js")))).toBe(
      true,
    );
    expect(files.some((filePath) => filePath.includes(`${path.sep}tests${path.sep}`))).toBe(false);
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

  it("updates created, renamed, and deleted paths incrementally", () => {
    const rootPath = projectDirectory.getPath();
    const createdPath = path.join(rootPath, "somedir", "created.js");
    const renamedPath = path.join(rootPath, "somedir", "renamed.js");

    provider.pathsCache.onDidChangeFiles([{ action: "created", path: createdPath }]);
    expect(provider.pathsCache.getFilePathsForProjectDirectory(projectDirectory)).toContain(
      createdPath,
    );
    provider.pathsCache.onDidChangeFiles([
      { action: "renamed", oldPath: createdPath, path: renamedPath },
    ]);
    expect(provider.pathsCache.getFilePathsForProjectDirectory(projectDirectory)).toContain(
      renamedPath,
    );
    provider.pathsCache.onDidChangeFiles([{ action: "deleted", path: renamedPath }]);
    expect(provider.pathsCache.getFilePathsForProjectDirectory(projectDirectory)).not.toContain(
      renamedPath,
    );
  });
});

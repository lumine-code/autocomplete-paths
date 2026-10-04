# autocomplete-paths

Complete file paths from the project file index.

> [!WARNING]
> **This package is deprecated.** Path completion now ships with [fuzzy-files](https://github.com/lumine-code/fuzzy-files), using the same project files and ignored names as its finder. This repository is archived and no longer maintained.

## Features

- **Import completion**: suggests matching project files in JavaScript, TypeScript, CSS, HTML, PHP, Python, Ruby, Lua, and C-family paths.
- **Anywhere else**: typing `./` or `../` completes a path in any file type, so paths in comments, configuration and prose work the same way.
- **Path boundaries**: preserves spaces and brackets in filenames, respects enclosing quotes and delimiters, and completes the active path on a line with several paths.
- **Relative paths**: inserts paths relative to the active file and optionally includes the current-directory prefix.
- **Project paths**: supports project-root-relative suggestions for custom scope definitions.
- **Live project index**: reads the editor's shared file index, so suggestions follow the filesystem as files come and go.
- **Ignore handling**: inherits the editor's ignored names and VCS-ignore rules, and narrows them further with package-specific ignored names using the same glob syntax.
- **Image previews**: can show local image thumbnails directly in suggestions.

## Migration

Disable or uninstall `autocomplete-paths` and install `fuzzy-files`. Keep `autocomplete` installed to display suggestions. Path-completion preferences now live under `fuzzy-files.pathCompletion`; use `fuzzy-files.ignoredNames` to exclude files from both the finder and suggestions, and `fuzzy-files:refresh` to refresh the shared project index. No settings from this deprecated package are migrated automatically.

## Commands

Commands available in `lumine-workspace`:

- `autocomplete-paths:rebuild-cache`: rescan all open project roots.

## Usage

Outside a language-specific import, start a path with `./` or `../`. Backslash forms `.\` and `..\` work too. Suggestions come from the current file's project root and are resolved relative to that file; unsaved files and paths outside that root have no suggestions.

Quotes delimit the whole path: `"../assets [draft]/report ] final"` allows spaces and brackets, and only an unescaped matching quote ends completion. Single quotes and backticks work the same way; an unescaped `${…}` makes a backtick template dynamic and disables path completion. The opening quote is preserved when a suggestion is inserted.

Quoted paths use backslash escapes for their enclosing quote and literal backslashes. Inserted suggestions escape that quote automatically; backtick paths also escape `${` to keep filenames literal. For example, a filename `owner's.txt` inserted inside single quotes becomes `./owner\'s.txt`. HTML attribute support uses character references instead, such as `&amp;`, `&quot;` and `&#39;`, and matches their decoded filenames.

Bare paths can also contain spaces and `]`. When the filename query contains whitespace, it must match the start of a filename literally; this prevents fuzzy matching from treating a sentence after a path as part of the filename. Spaces in an already typed directory do not restrict fuzzy matching of the filename. For example, `../assets [draft]/report ] f` can complete `report ] final.js`.

A bracket immediately before a bare path, optionally separated by whitespace, encloses it: `(../assets/image)` stops at the outer `)`, while `(../assets/image(final)` keeps the inner pair as part of the name. Square brackets, braces and angle brackets also delimit paths. Without an enclosing bracket, `]`, `)` and `}` are filename characters. A semicolon ends a bare path. On a line containing several separate paths or imports, completion uses the last active path; closed strings and finished imports do not keep suggesting files. Completion reads only the current line before the cursor and replaces that path prefix.

The filename alphabet follows the filesystem, while the surrounding syntax still determines which characters need quoting. Use a quoted path for names containing semicolons or quote characters. On Windows the reserved characters `<>:"/\|?*` are not filename characters. On POSIX only `/` and NUL are forbidden by the pathname format: a literal filename backslash is preserved in an explicit `./` or `../` path, and appears doubled in a quoted insertion. `.\` and `..\` explicitly select backslash separators. Unicode, spaces, DEL and C1 characters are preserved without normalization. C0 control characters, including tabs and physical line breaks in POSIX filenames, remain unsupported by the provider's single-line input grammar.

## Customization

Adjust suggestion image previews in your `styles.css`:

```css
.autocomplete-paths-image {
  width: 2em;
  height: 2em;
}
```

## Services

- `autocomplete.provider`: provided to autocomplete hubs for project path suggestions.
- `background-tips.provider`: provided to display a tip about refreshing project paths.
- `status-bar`: consumed to report project cache scanning progress.

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub. Any feedback is welcome!

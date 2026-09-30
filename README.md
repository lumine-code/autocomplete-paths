# autocomplete-paths

Complete file paths from the project file index.

## Features

- **Import completion**: suggests matching project files in JavaScript, TypeScript, CSS, HTML, PHP, Python, Ruby, Lua, and C-family paths.
- **Anywhere else**: typing `./` or `../` completes a path in any file type, so paths in comments, configuration and prose work the same way.
- **Path boundaries**: preserves spaces and brackets in filenames, respects enclosing quotes and delimiters, and completes the active path on a line with several paths.
- **Relative paths**: inserts paths relative to the active file and optionally includes the current-directory prefix.
- **Project paths**: supports project-root-relative suggestions for custom scope definitions.
- **Live project index**: reads the editor's shared file index, so suggestions follow the filesystem as files come and go.
- **Ignore handling**: inherits the editor's ignored names and VCS-ignore rules, and narrows them further with package-specific ignored names using the same glob syntax.
- **Image previews**: can show local image thumbnails directly in suggestions.

## Installation

To install `autocomplete-paths` search for it in the Install pane of the Lumine settings, or run the command `lumine --install lumine-code/autocomplete-paths`.

## Commands

Commands available in `lumine-workspace`:

- `autocomplete-paths:rebuild-cache`: rescan all open project roots.

## Usage

Outside a language-specific import, start a path with `./` or `../`. Backslash forms `.\` and `..\` work too. Suggestions come from the current file's project root and are resolved relative to that file; unsaved files and paths outside that root have no suggestions.

Quotes delimit the whole path: `"../assets [draft]/report ] final"` allows spaces and brackets, and only the matching quote ends completion. Single quotes and backticks work the same way; a template containing `${…}` is not a literal path. The opening quote is preserved when a suggestion is inserted.

Bare paths can also contain spaces and `]`. When the filename query contains whitespace, it must match the start of a filename literally; this prevents fuzzy matching from treating a sentence after a path as part of the filename. Spaces in an already typed directory do not restrict fuzzy matching of the filename. For example, `../assets [draft]/report ] f` can complete `report ] final.js`.

A bracket immediately before a bare path, optionally separated by whitespace, encloses it: `(../assets/image)` stops at the outer `)`, while `(../assets/image(final)` keeps the inner pair as part of the name. Square brackets, braces and angle brackets also delimit paths. Without an enclosing bracket, `]`, `)` and `}` are filename characters. A semicolon ends a bare path. On a line containing several separate paths or imports, completion uses the last active path; closed strings and finished imports do not keep suggesting files. Completion reads only the current line before the cursor and replaces that path prefix.

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

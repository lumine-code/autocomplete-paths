# autocomplete-paths

Complete file paths from the project file index.

## Features

- **Import completion**: suggests matching project files in JavaScript, TypeScript, CSS, HTML, PHP, Python, Ruby, Lua, and C-family paths.
- **Anywhere else**: typing `./` or `../` completes a path in any file type, so paths in comments, configuration and prose work the same way.
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
- `status-bar`: consumed to report project cache scanning progress.

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub. Any feedback is welcome!

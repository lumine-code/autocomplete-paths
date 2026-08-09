# autocomplete-paths

Complete file paths from cached project contents.

## Features

- **Import completion**: suggests matching project files in JavaScript, TypeScript, CSS, HTML, PHP, Python, Ruby, Lua, and C-family paths.
- **Relative paths**: inserts paths relative to the active file and optionally includes the current-directory prefix.
- **Project paths**: supports project-root-relative suggestions for custom scope definitions.
- **Incremental cache**: updates created, renamed, and deleted files from Lumine project events.
- **Ignore handling**: respects repository ignores, core ignored names, submodules, and custom glob patterns.
- **Image previews**: can show local image thumbnails directly in suggestions.

## Installation

To install `autocomplete-paths` search for _autocomplete-paths_ in the Install pane of the Lumine settings or run `lumine --install lumine-code/autocomplete-paths`.

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

- **autocomplete.provider** (`2.0.0`): provided to autocomplete hubs for project path suggestions.
- **status-bar** (`^1.0.0`): consumed to report project cache scanning progress.

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub. Any feedback is welcome!

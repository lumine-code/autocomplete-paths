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

## Configuration

Custom scopes are objects with `scopes`, `prefixes`, and optional `extensions`, `relative`, `includeCurrentDirectory`, `projectRelativePath`, and `replaceOnInsert` properties. All package settings are available in the Settings pane.

## Services

Provides `autocomplete.provider` version `2.0.0` and consumes `status-bar` version `^1.0.0`.

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub. Any feedback is welcome!

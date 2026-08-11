const javascriptPrefixes = [
  "import\\s+.*?from\\s+['\"]", // import foo from './foo'
  "import\\s+['\"]", // import './foo'
  "require\\(['\"]", // require('./foo')
  "define\\(\\[?['\"]", // define(['./foo']) or define('./foo')
];

const javascriptExtensions = ["js", "jsx", "ts", "tsx", "coffee", "json"];

// no index replacement
const javascriptReplaceOnInsert = [
  ["\\.jsx?$", ""],
  ["\\.ts$", ""],
  ["\\.coffee$", ""],
];

// with index replacement
const javascriptWithIndexReplaceOnInsert = [
  ["([\\/]?index)?\\.jsx?$", ""],
  ["([\\/]?index)?\\.ts$", ""],
  ["([\\/]?index)?\\.coffee$", ""],
];

// Path syntax as its own trigger, in any grammar. The other entries below key
// on a language's import syntax; this one keys on the path itself, so a path
// can be completed in a comment, a config file, a commit message or plain text.
//
// The expression matches the *boundary* before a path token that runs to the
// cursor, and matches nothing itself — `pathPrefix` is whatever follows the
// match, and the path here starts at the `./`. It has to be anchored to the end
// of the line: `prefixes` are applied with `String#match`, which takes the first
// hit, so an unanchored form would take `./a.js and ./b` as one path on a line
// mentioning two.
//
// `fallback` marks it as the generic answer: where a language scope also
// matches -- `require('./` matches both -- the language one wins, or every
// suggestion would arrive twice.
const RelativePathPrefix = "(?:^|[\\s'\"`(\\[{=,;:])(?=\\.{1,2}[\\\\/][^\\s'\"`)\\]}]*$)";

const DefaultScopes = [
  {
    scopes: ["*"],
    prefixes: [RelativePathPrefix],
    relative: true,
    fallback: true,
  },
  {
    scopes: [
      "source.js",
      "source.js.jsx",
      "source.coffee",
      "source.coffee.jsx",
      "source.ts",
      "source.tsx",
      "javascript",
      "source.flow",
    ],
    prefixes: javascriptPrefixes,
    extensions: javascriptExtensions,
    relative: true,
    replaceOnInsert: javascriptWithIndexReplaceOnInsert,
  },
  {
    scopes: ["text.html.vue"],
    prefixes: javascriptPrefixes,
    extensions: javascriptExtensions.concat("vue"),
    relative: true,
    replaceOnInsert: javascriptReplaceOnInsert,
  },
  {
    scopes: ["text.html.vue"],
    prefixes: [
      "@import[\\(|\\s+]?['\"]", // @import 'foo' or @import('foo')
    ],
    extensions: ["css", "sass", "scss", "less", "styl"],
    relative: true,
    replaceOnInsert: [
      ["(/)?_([^/]*?)$", "$1$2"], // dir1/_dir2/_file.sass => dir1/_dir2/file.sass
    ],
  },
  {
    scopes: ["source.coffee", "source.coffee.jsx"],
    prefixes: [
      "require\\s+['\"]", // require './foo'
      "define\\s+\\[?['\"]", // define(['./foo']) or define('./foo')
    ],
    extensions: javascriptExtensions,
    relative: true,
    replaceOnInsert: javascriptReplaceOnInsert,
  },
  {
    scopes: ["source.php"],
    prefixes: [
      "require_once\\(['\"]", // require_once('foo.php')
      "include\\(['\"]", // include('./foo.php')
    ],
    extensions: ["php"],
    relative: true,
  },
  {
    scopes: ["source.sass", "source.css.scss", "source.css.less", "source.stylus"],
    prefixes: [
      "@import[\\(|\\s+]?['\"]", // @import 'foo' or @import('foo')
    ],
    extensions: ["sass", "scss", "css"],
    relative: true,
    replaceOnInsert: [
      ["(/)?_([^/]*?)$", "$1$2"], // dir1/_dir2/_file.sass => dir1/_dir2/file.sass
    ],
  },
  {
    scopes: ["source.css"],
    prefixes: [
      "@import\\s+['\"]?", // @import 'foo.css'
      "@import\\s+url\\(['\"]?", // @import url('foo.css')
    ],
    extensions: ["css"],
    relative: true,
  },
  {
    scopes: ["source.css", "source.sass", "source.css.less", "source.css.scss", "source.stylus"],
    prefixes: ["url\\(['\"]?"],
    extensions: ["png", "gif", "jpeg", "jpg", "woff", "woff2", "ttf", "svg", "otf"],
    relative: true,
  },
  {
    scopes: ["source.c", "source.cpp"],
    prefixes: ["^\\s*#include\\s+['\"]"],
    extensions: ["h", "hpp"],
    relative: true,
    includeCurrentDirectory: false,
  },
  {
    scopes: ["source.lua"],
    prefixes: ["require[\\s+|\\(]['\"]"],
    extensions: ["lua"],
    relative: true,
    includeCurrentDirectory: false,
    replaceOnInsert: [
      ["\\/", "."],
      ["\\\\", "."],
      ["\\.lua$", ""],
    ],
  },
  {
    scopes: ["source.ruby"],
    prefixes: ["^\\s*require[\\s+|\\(]['\"]"],
    extensions: ["rb"],
    relative: true,
    includeCurrentDirectory: false,
    replaceOnInsert: [["\\.rb$", ""]],
  },
  {
    scopes: ["source.python"],
    prefixes: ["^\\s*from\\s+", "^\\s*import\\s+"],
    extensions: ["py"],
    relative: true,
    includeCurrentDirectory: false,
    replaceOnInsert: [
      ["\\/", "."],
      ["\\\\", "."],
      ["\\.py$", ""],
    ],
  },
];

module.exports = { DefaultScopes };

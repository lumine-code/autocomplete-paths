const javascriptPrefixes = [
  "\\bimport\\s+[^;]*?\\bfrom\\s+['\"]", // import foo from './foo'
  "\\bimport\\s+['\"]", // import './foo'
  "\\b(?:require|import)\\s*\\(\\s*['\"`]", // require('./foo') or import('./foo')
  "\\bdefine\\s*\\(\\s*\\[?\\s*['\"]", // define(['./foo']) or define('./foo')
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

const DefaultScopes = [
  {
    scopes: ["*"],
    // Recognize the active path span with its quotes or surrounding delimiters.
    // Language-specific imports take precedence over this general fallback.
    pathSyntax: true,
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
      "@import\\s*(?:\\(\\s*)?['\"]", // @import 'foo' or @import('foo')
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
      "\\brequire\\s+['\"]", // require './foo'
      "\\bdefine\\s+\\[?\\s*['\"]", // define ['./foo'] or define './foo'
    ],
    extensions: javascriptExtensions,
    relative: true,
    replaceOnInsert: javascriptReplaceOnInsert,
  },
  {
    scopes: ["source.php"],
    prefixes: ["\\b(?:require(?:_once)?|include(?:_once)?)\\s*(?:\\(\\s*)?['\"]"],
    extensions: ["php"],
    relative: true,
  },
  {
    scopes: ["source.sass", "source.css.scss", "source.css.less", "source.stylus"],
    prefixes: [
      "@import\\s*(?:\\(\\s*)?['\"]", // @import 'foo' or @import('foo')
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
      "@import\\s+url\\(\\s*['\"]?", // @import url('foo.css')
    ],
    extensions: ["css"],
    relative: true,
  },
  {
    scopes: ["source.css", "source.sass", "source.css.less", "source.css.scss", "source.stylus"],
    prefixes: ["\\burl\\(\\s*['\"]?"],
    extensions: ["png", "gif", "jpeg", "jpg", "woff", "woff2", "ttf", "svg", "otf"],
    relative: true,
  },
  {
    scopes: ["source.c", "source.cpp"],
    prefixes: ['^\\s*#include\\s+["<]'],
    extensions: ["h", "hpp"],
    relative: true,
    includeCurrentDirectory: false,
  },
  {
    scopes: ["source.lua"],
    prefixes: ["\\brequire\\s*(?:\\(\\s*)?['\"]"],
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
    prefixes: ["^\\s*require\\s*(?:\\(\\s*)?['\"]"],
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

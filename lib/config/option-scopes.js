const OptionScopes = {
  enableHtmlSupport: [
    {
      scopes: ["text.html.basic"],
      prefixes: ["\\b(?:src|href)\\s*=\\s*['\"]"],
      extensions: ["js", "png", "gif", "jpeg", "jpg", "tiff", "html", "json", "svg"],
      relative: true,
      pathEncoding: "html",
    },
  ],
};

module.exports = { OptionScopes };

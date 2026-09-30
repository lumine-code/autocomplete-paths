const quotes = new Set(["'", '"', "`"]);
const closingDelimiter = { "(": ")", "[": "]", "{": "}", "<": ">" };

function isEscaped(line, index) {
  let backslashes = 0;
  while (index > 0 && line[--index] === "\\") backslashes++;
  return backslashes % 2 === 1;
}

function regularExpressionEnd(line, start, end) {
  let inCharacterClass = false;
  for (let index = start + 1; index < end; index++) {
    const character = line[index];
    if (character === "\\") {
      index++;
    } else if (character === "[") {
      inCharacterClass = true;
    } else if (character === "]") {
      inCharacterClass = false;
    } else if (character === "/" && !inCharacterClass) {
      return index;
    }
  }
  return null;
}

function quoteBefore(line, end) {
  let active = null;
  for (let index = 0; index < end; index++) {
    const character = line[index];
    // Quotes inside a preceding regexp literal are not string delimiters. Only
    // skip a complete literal in a position where an expression can begin.
    if (!active && character === "/") {
      const preceding = line.slice(0, index).trimEnd();
      if (
        !preceding ||
        /[=(:,[!&|?;{}]$/.test(preceding) ||
        /\b(?:return|yield|throw)$/.test(preceding)
      ) {
        const literalEnd = regularExpressionEnd(line, index, end);
        if (literalEnd != null) {
          index = literalEnd;
          continue;
        }
      }
    }
    if (!quotes.has(character) || isEscaped(line, index)) continue;
    if (active) {
      if (character === active.character) active = null;
    } else {
      // Contractions and possessives in prose do not open a quoted path.
      if (
        character === "'" &&
        /\w/.test(line[index - 1] ?? "") &&
        /[\w\s]/.test(line[index + 1] ?? "")
      ) {
        continue;
      }
      active = { character, index };
    }
  }
  return active;
}

function contextAt(line, start, { allowSpaces = false } = {}) {
  const pathPrefix = line.slice(start);
  if (/\p{Cc}/u.test(pathPrefix)) return null;

  const activeQuote = quoteBefore(line, start);
  if (activeQuote) {
    // A quote identifies the whole path, rather than a token buried in a string.
    if (activeQuote.index !== start - 1) return null;
    for (let index = start; index < line.length; index++) {
      if (line[index] === activeQuote.character && !isEscaped(line, index)) return null;
    }
    if (activeQuote.character === "`" && pathPrefix.includes("${")) return null;
    return { pathPrefix, start, quoted: true };
  }

  const opener = line.slice(0, start).trimEnd().at(-1);
  if (quotes.has(line[start - 1]) || /['"`]/.test(pathPrefix)) return null;
  if (!allowSpaces && /\s/.test(pathPrefix)) return null;

  // Only a delimiter that actually surrounds the path ends it. A bare `]` is
  // a filename character; in `[./dir/[draft]/file` the inner pair is too.
  const closer = closingDelimiter[opener];
  let depth = 1;
  for (const character of pathPrefix) {
    if (closer && character === opener) depth++;
    if (closer && character === closer && --depth === 0) return null;
    if (character === ";" || character === "<" || character === ">") return null;
  }
  return { pathPrefix, start, quoted: false };
}

function relativePathContext(line) {
  const expression = /(?:^|[\s'"`([{=,;:<>])(\.{1,2}[/\\])/g;
  let context = null;
  for (const match of line.matchAll(expression)) {
    const start = match.index + match[0].length - match[1].length;
    const candidate = contextAt(line, start, { allowSpaces: true });
    if (candidate) context = candidate;
  }
  return context;
}

function scopePathContext(line, prefixes) {
  let context = null;
  for (const prefix of prefixes) {
    try {
      // Expressions still identify the text immediately before the path, but
      // every occurrence is considered and only a span ending at the caret wins.
      for (const match of line.matchAll(new RegExp(prefix, "gi"))) {
        const candidate = contextAt(line, match.index + match[0].length);
        if (candidate && (!context || candidate.start > context.start)) context = candidate;
      }
    } catch (error) {
      console.warn(`autocomplete-paths: Invalid prefix expression ${prefix}`, error);
    }
  }
  return context;
}

module.exports = { relativePathContext, scopePathContext };

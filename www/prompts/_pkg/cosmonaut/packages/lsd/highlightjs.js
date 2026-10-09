// @cosmonaut/lsd/highlightjs.js

// Derives a highlight.js custom-language definition from LSD source.
// This is necessarily heuristic where LSD's TKN regexes are freeform:
// there is no generic way to reliably tell "line comment" from "block
// comment" or "symmetric string delimiter" from arbitrary user-written
// regex. What's implemented here covers the common, unambiguous cases
// (as seen in poo.lsd) and leaves an escape hatch (`options.extraContains`,
// `options.hljs`) for anything it can't safely infer.
//
// Two entry points, as requested:
//
//   getMetaPropsFromLSD(source)
//     -> { keywords, literals, builtins, symbols, operators, ..., props, tables }
//        Every META LIST becomes a flat array under its own name.
//        Every META TABLE becomes a flat array too: all rows' trailing
//        "( a b c )" symbol columns concatenated together, under the
//        table's own name (so `operators` here is already the flat
//        ['=', '+=', '-=', ...] list, not the structured table).
//        `props` and `tables` are kept as nested, unflattened data too,
//        in case the caller needs the structured form.
//
//   createHighlightJsObjectFromLSD(source, options)
//     -> a plain object matching the shape `hljs.registerLanguage()`
//        expects as its return value.

import { splitSections } from './sections.js';
import { parseMeta }     from './meta.js';
import { parseTokens }   from './tokens.js';

// :::::: getMetaPropsFromLSD

export function getMetaPropsFromLSD (source) {
  const sections = splitSections(source);
  const meta     = parseMeta(sections.META);

  const flat = {};

  for (const [name, words] of Object.entries(meta.lists)) {
    flat[name] = words;
  }

  for (const [name, table] of Object.entries(meta.tables)) {
    flat[name] = table.rows.flatMap(row => row.symbols ?? []);
  }

  return { ...flat, props: meta.props, tables: meta.tables };
}

// :::::: createHighlightJsObjectFromLSD

const DEFAULT_KEYWORD_CATEGORY_MAP = {
  keywords : 'keyword',
  literals : 'literal',
  builtins : 'built_in',
};

export function createHighlightJsObjectFromLSD (source, options = {}) {
  const {
    hljs               = null,
    name               = undefined,
    caseInsensitive    = false,
    keywordCategoryMap = DEFAULT_KEYWORD_CATEGORY_MAP,
    classNames         = {},
    extraContains      = [],
  } = options;

  const sections  = splitSections(source);
  const tokens    = parseTokens(sections.TKN);
  const metaProps = getMetaPropsFromLSD(source);

  const findToken = tokenName => tokens.find(t => t.name.toUpperCase() === tokenName);

  const keywords = buildKeywords(metaProps, keywordCategoryMap);
  const contains = [];

  const commentTokens = tokens.filter(t => t.name.toUpperCase() === 'COMMENT');
  contains.push(...inferCommentModes(commentTokens, hljs, classNames.comment));

  const stringToken = findToken('STRING');
  contains.push(...inferStringModes(stringToken, hljs, classNames.string));

  const numberToken = findToken('NUMBER');
  const numberMode  = inferNumberMode(numberToken, classNames.number);
  if (numberMode) contains.push(numberMode);

  const operatorMode = inferOperatorMode(tokens, metaProps, classNames.operator);
  if (operatorMode) contains.push(operatorMode);

  contains.push(...extraContains);

  return {
    ...(name ? { name } : {}),
    case_insensitive : caseInsensitive,
    keywords,
    contains,
  };
}

// :::::: keywords

function buildKeywords (metaProps, keywordCategoryMap) {
  const keywords = {};
  for (const [listName, category] of Object.entries(keywordCategoryMap)) {
    if (metaProps[listName]?.length) keywords[category] = metaProps[listName].join('|');
  }
  return keywords;
}

// :::::: comments
//
// Heuristic: extracts the literal (non-regex-special) prefix a COMMENT
// TKN regex starts with, and treats it as a line comment running to end
// of line. This covers the common "// ..." / "# ..." case. It does NOT
// attempt to detect block comments ("/* ... */") automatically, since
// that requires recognizing a distinct closing delimiter inside the
// pattern, which is not reliably inferable from arbitrary regex - add
// those via `options.extraContains` (with `hljs.COMMENT(open, close)`
// if you have `hljs` available) until LSD grows an explicit
// line-vs-block distinction for COMMENT tokens.

function inferCommentModes (commentTokens, hljs, className = 'comment') {
  return commentTokens
    .filter(t => t.kind === 'regex')
    .map(t => extractLiteralPrefix(t.pattern.source))
    .filter(Boolean)
    .map(prefix => hljs
      ? hljs.COMMENT(escapeRegExp(prefix), '$')
      : { className, begin: escapeRegExp(prefix), end: '$' });
}

// Exported (not just used internally) so @cosmonaut/lsd's compile.js can
// reuse the exact same heuristic when converting a COMMENT TKN into a
// @cosmonaut/lexer comment scanner.
export function extractLiteralPrefix (regexSource) {
  const match = regexSource.match(/^((?:\\.|[^\\.*+?^${}()|[\]])+)/);
  if (!match) return null;
  return match[1].replace(/\\(.)/g, '$1'); // unescape e.g. "\/\/" -> "//"
}

// :::::: strings
//
// A single TKN STRING regex commonly alternates between several quote
// styles, e.g. "..." | '...' | `...`. This splits on top-level "|"
// (respecting paren/bracket nesting) and reads each alternative's first
// character as its (assumed symmetric) quote delimiter. Asymmetric
// string delimiters are not inferable this way - use
// `options.extraContains` for those.

function inferStringModes (stringToken, hljs, className = 'string') {
  if (!stringToken || stringToken.kind !== 'regex') return [];

  const escapeMode = hljs ? hljs.BACKSLASH_ESCAPE : { begin: /\\./, relevance: 0 };

  return splitTopLevelAlternatives(stringToken.pattern.source)
    .map(alt => alt[0])
    .filter(Boolean)
    .map(quote => ({
      className,
      begin: quote,
      end: quote,
      contains: [escapeMode],
    }));
}

function splitTopLevelAlternatives (pattern) {
  const parts = [];
  let depth = 0;
  let current = '';

  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];

    if (ch === '\\') { current += ch + (pattern[i + 1] ?? ''); i++; continue; }
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth--;

    if (ch === '|' && depth === 0) { parts.push(current); current = ''; continue; }
    current += ch;
  }

  parts.push(current);
  return parts;
}

// :::::: numbers
//
// The TKN NUMBER regex source can be handed to hljs almost as-is - hljs
// `begin` accepts a raw regex-source string directly.

function inferNumberMode (numberToken, className = 'number') {
  if (!numberToken || numberToken.kind !== 'regex') return null;
  return { className, begin: numberToken.pattern.source };
}

// :::::: operators
//
// Finds the TKN entry named OPERATOR (a `@ref` into a META TABLE),
// resolves it against the already-flattened symbol list from
// getMetaPropsFromLSD, and builds one alternation regex - longest
// symbols first, so e.g. ">=" is tried before ">".

function inferOperatorMode (tokens, metaProps, className = 'operator') {
  const operatorToken = tokens.find(t => t.name.toUpperCase() === 'OPERATOR' && t.kind === 'ref');
  if (!operatorToken) return null;

  const symbols = metaProps[operatorToken.ref];
  if (!symbols?.length) return null;

  const alternation = symbols
    .slice()
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join('|');

  return { className, begin: alternation };
}

// :::::: shared helper

function escapeRegExp (str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

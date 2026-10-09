// @poo/hljs

// A highlight.js language definition for poo.
//
// The WORD LISTS and SYMBOLS come from poo.lsd - keywords, literals,
// builtins, punctuation and the operator table are declared there, and
// duplicating them here is what let this file drift out of sync (it knew
// keywords the language does not have, and missed operators it does).
//
// The MODE STRUCTURE stays hand-written. @cosmonaut/lsd can derive a
// highlight.js object on its own (createHighlightJsObjectFromLSD), but it
// can only infer what a single TKN regex states: poo's TKN :: STRING
// alternates three quote styles, so an inferred definition would render
// backtick strings as plain strings - losing ${...} interpolation, nested
// braced code and $variable interpolation, which no regex in poo.lsd
// declares and nothing generic could guess.

import { getMetaPropsFromLSD } from '@cosmonaut/lsd';

// Same loading strategy as poo/compiler/lsd.js: fetch a co-located
// resource, top-level await, so consumers write a plain import.
const response = await fetch(new URL('../compiler/poo.lsd', import.meta.url));

if (!response.ok) {
  throw new Error(`[poo/hljs] Failed to load poo.lsd: ${response.status} ${response.statusText}`);
}

const meta = getMetaPropsFromLSD(await response.text());

// :::::: Symbols poo.lsd does not declare as operators
//
// "=>" and ":" appear in the grammar as literal delimiters (arrow functions,
// named properties), not in the META TABLE - but they read as operators, so
// they are highlighted as such. Listed explicitly rather than silently
// bundled in, so the difference to the spec stays visible.
const EXTRA_OPERATORS = ['=>'];

// :::::: Helpers

const escapeRegex = str => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Longest first, so ">>>" is tried before ">>" and ">=" before ">".
const alternation = symbols => symbols
  .slice()
  .sort((a, b) => b.length - a.length)
  .map(escapeRegex)
  .join('|');

// :::::: Derived from poo.lsd

const KEYWORDS = {
  keyword  : meta.keywords.join(' '),
  literal  : meta.literals.join(' '),
  built_in : meta.builtins.join(' '),
};

const rgx = {
  operators : new RegExp(alternation([...meta.operators, ...EXTRA_OPERATORS])),

  // "}" is excluded from the expression variant below, so both need their
  // own list rather than one shared regex.
  puncts    : new RegExp(alternation(meta.puncts)),
  punctsNoClose : new RegExp(alternation(meta.puncts.filter(p => p !== '}'))),

  // TKN :: NUMBER, taken verbatim - hljs accepts a raw regex source.
  numbers : meta.props.number ?? '0[xX][0-9a-fA-F_]+|0[bB][01_]+|\\d[\\d_]*\\.\\d[\\d_]*(?:[eE][+-]?\\d+)?|\\d[\\d_]*',
};

// :::::: Language definition

export function registerPoo (hljs) {

  const COMMENT = hljs.COMMENT(/\/\//, /$/);

  const NUMBER = {
    scope: 'number',
    match: new RegExp(rgx.numbers),
    relevance: 0,
  };

  const OPERATOR = {
    scope: 'operator',
    match: rgx.operators,
    relevance: 0,
  };

  // Used at the top level, where both braces are ordinary punctuation.
  const PUNCTUATION = {
    scope: 'punctuation',
    match: rgx.puncts,
    relevance: 0,
  };

  // Used inside ${...} and nested {...} blocks. Must NOT match "}", because
  // that character closes either EXPRESSION_INTERPOLATION or BRACED_CODE.
  const EXPRESSION_PUNCTUATION = {
    scope: 'punctuation',
    match: rgx.punctsNoClose,
    relevance: 0,
  };

  // "fn*" / "fn^" - generator and pure function markers. Not in poo.lsd's
  // keyword list, since the tokenizer sees "fn" plus an operator.
  const SPECIAL_KEYWORD = {
    scope: 'keyword',
    match: /\bfn[*^]/,
  };

  const VARIABLE_INTERPOLATION = {
    scope: 'variable',
    match: /\$[A-Za-z_][A-Za-z0-9_]*/,
    relevance: 0,
  };

  const STRING_SINGLE = {
    scope: 'string',
    begin: /'/,
    end: /'/,
    contains: [hljs.BACKSLASH_ESCAPE],
  };

  const STRING_DOUBLE = {
    scope: 'string',
    begin: /"/,
    end: /"/,
    contains: [hljs.BACKSLASH_ESCAPE, VARIABLE_INTERPOLATION],
  };

  // These three are connected below:
  //
  //   TEMPLATE_STRING
  //     -> ${ EXPRESSION_INTERPOLATION }
  //          -> nested { BRACED_CODE }
  //          -> nested `TEMPLATE_STRING`
  const EXPRESSION_INTERPOLATION = {
    scope: 'subst',
    begin: /\$\{/,
    end: /\}/,
    keywords: KEYWORDS,
    contains: [],
  };

  const TEMPLATE_STRING = {
    scope: 'string',
    begin: /`/,
    end: /`/,
    contains: [
      hljs.BACKSLASH_ESCAPE,
      EXPRESSION_INTERPOLATION, // before plain $variable interpolation
      VARIABLE_INTERPOLATION,
    ],
  };

  // A normal {...} block inside an expression interpolation.
  const BRACED_CODE = {
    begin: /\{/,
    end: /\}/,
    keywords: KEYWORDS,
    contains: [],
  };

  // Do not add a matcher for "}" here - a closing brace must stay available
  // to the enclosing BRACED_CODE or EXPRESSION_INTERPOLATION.
  const EXPRESSION_ATOMS = [
    COMMENT,
    STRING_SINGLE,
    STRING_DOUBLE,
    TEMPLATE_STRING,
    SPECIAL_KEYWORD,
    NUMBER,
    OPERATOR,
    EXPRESSION_PUNCTUATION,
  ];

  // "self" handles arbitrarily nested brace blocks - do not put BRACED_CODE
  // itself in its own contains list.
  BRACED_CODE.contains = ['self', ...EXPRESSION_ATOMS];

  // BRACED_CODE first, so an opening brace starts a nested block instead of
  // being consumed as punctuation.
  EXPRESSION_INTERPOLATION.contains = [BRACED_CODE, ...EXPRESSION_ATOMS];

  return {
    name: 'Poo',
    aliases: ['poo'],
    case_insensitive: false,
    keywords: KEYWORDS,

    contains: [
      COMMENT,
      STRING_SINGLE,
      STRING_DOUBLE,
      TEMPLATE_STRING,
      SPECIAL_KEYWORD,
      NUMBER,
      OPERATOR,
      PUNCTUATION,
    ],
  };
}

export default registerPoo;

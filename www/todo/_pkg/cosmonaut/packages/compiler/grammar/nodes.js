// @cosmonaut/compiler/grammar/nodes.js

// The grammar AST: one shape shared by every grammar frontend. LSD, EBNF
// and any third-party format all produce this, and compile.js turns it into
// working parsers. A frontend is therefore anything that emits these nodes -
// it needs to know nothing about @cosmonaut/parsers.
//
//   { type: 'literal',   value }                match this exact token
//   { type: 'reference', name }                 a token type, or another rule
//   { type: 'sequence',  factors }              a b c
//   { type: 'choice',    alternatives }         a | b | c   ORDERED, first match wins
//   { type: 'optional',  expr }                 a?
//   { type: 'repeat',    expr, atLeastOne }     a*  ·  a+
//   { type: 'group',     expr }                 ( a )
//   { type: 'list',      item, separator, atLeastOne, separatorOptional }
//
// `choice` is ordered PEG-style rather than ambiguous BNF-style, matching
// the choice() block it compiles to. A grammar frontend that assumes
// unordered alternatives has to order them itself.
//
// Any node may carry two optional annotations, both ignored by compile.js
// and meaningful only to the frontend that produced them:
//   .inlineLabel  a name attached with ":name"
//   .index        1-based position among a pattern's top-level factors

export const

GRAMMAR_LITERAL   = 'literal',
GRAMMAR_REFERENCE = 'reference',
GRAMMAR_SEQUENCE  = 'sequence',
GRAMMAR_CHOICE    = 'choice',
GRAMMAR_OPTIONAL  = 'optional',
GRAMMAR_REPEAT    = 'repeat',
GRAMMAR_GROUP     = 'group',
GRAMMAR_LIST      = 'list';

// :::::: Constructors
//
// Convenience for building a grammar programmatically, without a text
// format. Plain object literals are equally valid - these exist so that a
// frontend written in JS reads like a grammar rather than like JSON.

export const

literal   = value => ({ type: GRAMMAR_LITERAL, value }),
reference = name  => ({ type: GRAMMAR_REFERENCE, name }),

sequence  = (...factors)      => ({ type: GRAMMAR_SEQUENCE, factors: factors.flat() }),
choice    = (...alternatives) => ({ type: GRAMMAR_CHOICE, alternatives: alternatives.flat() }),

optional  = expr => ({ type: GRAMMAR_OPTIONAL, expr }),
group     = expr => ({ type: GRAMMAR_GROUP, expr }),

repeat    = (expr, atLeastOne = false) => ({ type: GRAMMAR_REPEAT, expr, atLeastOne }),

list = (item, separator = null, { atLeastOne = false, separatorOptional = false } = {}) =>
  ({ type: GRAMMAR_LIST, item, separator, atLeastOne, separatorOptional });

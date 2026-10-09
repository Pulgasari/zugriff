// @cosmonaut/compiler/grammar/compile.js

// grammar AST -> parser blocks. The single place where a declarative
// grammar becomes something that can consume a TokenStream, no matter which
// format it was written in.

import {
  choice, lazy, many, many1, optional, seq,
  sepBy, sepBy1, sepByLoose, sepBy1Loose, token,
} from '@cosmonaut/parsers';

import {
  GRAMMAR_CHOICE, 
  GRAMMAR_GROUP, 
  GRAMMAR_LIST, 
  GRAMMAR_LITERAL,
  GRAMMAR_OPTIONAL,
  GRAMMAR_REFERENCE, 
  GRAMMAR_REPEAT, 
  GRAMMAR_SEQUENCE,
} from './nodes.js';

// A bare `reference` is ambiguous on its own: "IDENTIFIER" usually means
// "match a token of this type", while "Block" means "recurse into that
// rule". `options.tokens` disambiguates - any name in it compiles to a
// token match, everything else to a rule reference.
//
// Without it, every reference becomes a rule reference. That is the right
// default for a plain EBNF grammar, where token types are not declared
// in-band and terminals are written as quoted literals.
export function compileExpr (node, options = {}) {
  const { tokens = null } = options;
  const recur = child => compileExpr(child, options);

  switch (node.type) {

    case GRAMMAR_LITERAL:
      return token(node.value);

    case GRAMMAR_REFERENCE:
      return isToken(tokens, node.name)
        ? token(node.name)
        : lazy(() => stream => stream.parse(node.name));

    case GRAMMAR_SEQUENCE:
      return seq(...node.factors.map(recur));

    case GRAMMAR_CHOICE:
      return choice(...node.alternatives.map(recur));

    case GRAMMAR_OPTIONAL:
      return optional(recur(node.expr));

    case GRAMMAR_REPEAT:
      return node.atLeastOne ? many1(recur(node.expr)) : many(recur(node.expr));

    case GRAMMAR_GROUP:
      return recur(node.expr);

    case GRAMMAR_LIST: {
      const item = recur(node.item);

      if (!node.separator) return node.atLeastOne ? many1(item) : many(item);

      const separator = recur(node.separator);

      if (node.separatorOptional) {
        return node.atLeastOne ? sepBy1Loose(item, separator) : sepByLoose(item, separator);
      }

      return node.atLeastOne ? sepBy1(item, separator) : sepBy(item, separator);
    }

    default:
      throw new Error(`[grammar] Unknown node type "${node.type}".`);
  }
}

// Compiles a whole rule set - { RuleName: node } - into parser methods
// ready for `new Parser({ methods })`. Each method has the (parser) => result
// signature the Machine registry expects.
export function compileGrammar (rules, options = {}) {
  const methods = {};

  for (const [name, node] of Object.entries(rules)) {
    const match = compileExpr(node, options);
    methods[name] = parser => match(parser.stream);
  }

  return methods;
}

// :::::: internal

function isToken (tokens, name) {
  if (!tokens)               return false;
  if (tokens instanceof Set) return tokens.has      (name);
  if (Array.isArray(tokens)) return tokens.includes (name);
  return Object.prototype.hasOwnProperty.call(tokens, name);
}

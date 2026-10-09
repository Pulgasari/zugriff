// @cosmonaut/lsd/compile.js

// Turns a parsed LSD document into the artifacts a Cosmonaut needs: a lexer
// config and a set of parser methods.
//
// Codegen is deliberately NOT part of this package. Which target a language
// compiles to (JS, later Odin, ...) is a separate axis from what the language
// IS - one spec, many targets - and a text format expressive enough for real
// code generation would end up being a worse programming language than the
// JS file it replaces.

import { compileExpr, buildTokenTypes, resolveRules } from '@cosmonaut/compiler';
import { seq }                                        from '@cosmonaut/parsers';

import { extractLiteralPrefix } from './highlightjs.js';
import { buildTypeRegistry }    from './resolve.js';

function escapeRegExp (str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// :::::: Tokenizer

// TKN entries compile to lexer content rules in DECLARATION ORDER - poo.lsd's
// own note ("order and relation of rules is part of the control flow") is
// honored directly, since rule matching tries rules in array order and the
// first sticky match wins.
//
// - kind 'regex': a direct content rule, UNLESS the TKN is named WHITESPACE -
//   the lexer skips whitespace by default, so a rule for it is redundant.
// - kind 'ref' at a META LIST: one word-boundary rule PER WORD, unless the
//   word is not word-shaped (punctuation like "(" or ";"), where "\b" would
//   silently fail to match at all.
// - kind 'ref' at a META TABLE: one rule per symbol across all rows, sorted
//   longest-first so ">=" is tried before ">".
//
// LIMITATION: a COMMENT-named TKN's regex is reduced to a line comment via
// extractLiteralPrefix() - covers "//" and "#" styles, not block comments,
// which are not reliably derivable from an arbitrary regex. Pass
// options.extraComments to add those by hand.
export function compileTokenizer (lsd, options = {}) {
  const { extraComments = [] } = options;

  const tokenTypes = buildTokenTypes(lsd.tokens.map(t => t.name));
  const rules      = [];
  const comments   = [...extraComments];
  let   keywords   = [];

  for (const tkn of lsd.tokens) {
    const upperName = tkn.name.toUpperCase();

    if (tkn.kind === 'regex') {
      if (upperName === 'WHITESPACE') continue;

      if (upperName === 'COMMENT') {
        const prefix = extractLiteralPrefix(tkn.pattern.source);
        if (prefix) { comments.push({ type: 'line', start: prefix }); continue; }
      }

      rules.push({ id: `tkn:${tkn.name}`, type: tokenTypes[tkn.name], regex: tkn.pattern });
      continue;
    }

    if (tkn.kind === 'ref') {
      const list  = lsd.meta.lists[tkn.ref];
      const table = lsd.meta.tables[tkn.ref];

      if (list) {
        // also feed the lexer's built-in IDENTIFIER -> KEYWORD reclassification
        if (upperName === 'KEYWORD') keywords = list;

        for (const word of list) {
          const isWordShaped = /^\w+$/.test(word);
          rules.push({
            id    : `tkn:${tkn.name}:${word}`,
            type  : tokenTypes[tkn.name],
            regex : isWordShaped
              ? new RegExp('\\b' + escapeRegExp(word) + '\\b')
              : new RegExp(escapeRegExp(word)),
          });
        }
        continue;
      }

      if (table) {
        const symbols = table.rows
          .flatMap(row => row.symbols ?? [])
          .sort((a, b) => b.length - a.length);

        for (const symbol of symbols) {
          rules.push({
            id    : `tkn:${tkn.name}:${symbol}`,
            type  : tokenTypes[tkn.name],
            regex : new RegExp(escapeRegExp(symbol)),
          });
        }
        continue;
      }

      throw new Error(
        `[lsd] TKN "${tkn.name}" references "@${tkn.ref}", but no META LIST or META TABLE by that name was found.`
      );
    }
  }

  // A plain config object rather than a Lexer instance - the caller decides
  // when and how a lexer gets built, and can still merge in options.
  return {
    tokenTypes,
    rules : resolveRules(rules),
    comments,
    keywords,
  };
}

// :::::: Parser methods

export function compileParserMethods (lsd) {
  const registry = buildTypeRegistry(lsd);
  const options  = { tokens: registry.tokenTypeNames };
  const methods  = {};

  // Top-level "RULE :: Name == Expr [=> N]" productions (Program, Statement,
  // Block, ...) are TRANSPARENT dispatch aliases, not node types of their own -
  // they forward whatever their pattern matched, unwrapped. A trailing "=> N"
  // extracts just raw position N, needed whenever a pattern wraps its real
  // content in delimiters (e.g. "Block == `{` Statement* `}` => 2", where the
  // useful value is the Statement* array, not all three factors).
  for (const production of lsd.grammar.productions) {
    const match = compileExpr(production.expr, options);

    methods[production.name] = production.extractIndex == null
      ? parser => match(parser.stream)
      : parser => {
          const result = match(parser.stream);
          return result === undefined ? undefined : result[production.extractIndex - 1];
        };
  }

  // Blocks DO produce node types, assembling their fields from the bindings
  // resolved in grammar.js.
  for (const block of lsd.grammar.blocks) {
    const alternatives = block.alternatives.map(alt => {
      const factors = alt.patternFactors.map(f => compileExpr(f, options));
      const match   = factors.length === 1 ? factors[0] : seq(...factors);

      return stream => {
        const position = stream.save();
        const raw      = match(stream);

        if (raw === undefined) { stream.restore(position); return undefined; }

        const values = factors.length === 1 ? [raw] : raw;
        const node   = { type: block.name };

        for (const [name, binding] of Object.entries(alt.bindings)) {
          node[name] = binding.kind === 'constant' ? binding.value : values[binding.index - 1];
        }

        return node;
      };
    });

    methods[block.name] = parser => {
      for (const matchAlternative of alternatives) {
        const result = matchAlternative(parser.stream);
        if (result !== undefined) return result;
      }
      return undefined;
    };
  }

  return methods;
}

// :::::: Highlighting

export function compileHighlighting (lsd) {
  return lsd.highlighting;
}

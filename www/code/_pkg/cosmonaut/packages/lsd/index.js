// @cosmonaut/lsd

// A full language spec frontend: unlike a bare grammar format, LSD describes
// token types, keywords, operator tables, grammar AND syntax highlighting.
// readLSD() therefore returns a complete Cosmonaut spec, not just grammar.

import { splitSections }     from './sections.js';
import { parseMeta }         from './meta.js';
import { parseTokens }       from './tokens.js';
import { parseHighlighting } from './highlighting.js';
import { parseGrammar }      from './grammar.js';

import { compileTokenizer, compileParserMethods, compileHighlighting } from './compile.js';

// :::::: Meta level - reading a language definition

// Raw intermediate representation: META / TKN / HL / RULE, with patterns
// parsed into the shared grammar AST.
export function readDocument (source) {
  const sections = splitSections(source);

  return {
    meta         : parseMeta         (sections.META),
    tokens       : parseTokens       (sections.TKN),
    highlighting : parseHighlighting (sections.HL),
    grammar      : parseGrammar({ ruleLines: sections.RULE, blocks: sections.BLOCKS }),
  };
}

// The whole way: LSD source -> a spec ready for `new Cosmonaut({ spec })`.
//
// The FIRST top-level RULE is taken as the entry point, by convention -
// "RULE :: Program == Statement*" being the first line is what makes
// Program the root. Override with `parser: { entry }` if that is wrong.
export function readLSD (source, options = {}) {
  const document = readDocument(source);
  const entry    = document.grammar.productions[0]?.name;

  return {
    lexer        : compileTokenizer(document, options.tokenizer),
    parser       : { methods: compileParserMethods(document), entry },
    highlighting : compileHighlighting(document),
    document,
  };
}

// :::::: Re-exports

export * from './bindings.js';
export * from './compile.js';
export * from './expression.js';
export * from './grammar.js';
export * from './highlighting.js';
export * from './highlightjs.js';
export * from './meta.js';
export * from './resolve.js';
export * from './sections.js';
export * from './tokens.js';

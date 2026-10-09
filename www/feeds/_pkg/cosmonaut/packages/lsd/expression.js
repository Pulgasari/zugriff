// @cosmonaut/lsd/expression.js

// LSD's pattern syntax: the right-hand side of a "RULE == ..." line, parsed
// into the shared grammar AST from @cosmonaut/compiler.
//
// This file owns the SYNTAX only. Turning those nodes into working parsers
// is compiler/grammar/compile.js's job - the same code every other grammar
// frontend goes through.
//
// Pattern syntax:
//
//   `literal`        a quoted terminal
//   Name             a token type or another rule
//   a b c            sequence
//   a | b            ordered choice, first match wins
//   ( ... )          group
//   a?  a*  a+       quantifiers
//   [ item sep? ]    list, with an optional separator
//   x:name           inline label on any factor
//
// SCOPE NOTE: inside "[...]", item and separator are restricted to a bare
// literal or reference, not a full sub-expression. That covers every current
// use in poo.lsd and keeps list handling simple - widen it if a real need
// for a grouped or quantified list item comes up.

// compileExpr used to live here; it is re-exported so existing imports keep
// working, but the implementation is shared now.
export { compileExpr } from '@cosmonaut/compiler';

// :::::: Tokenizer

function tokenizePattern (text) {
  const tokens = [];
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (/\s/.test(ch)) { i++; continue; }

    if (ch === '`') {
      let j = i + 1;
      while (j < text.length && text[j] !== '`') j++;
      if (j >= text.length) throw new Error(`[lsd] Unterminated literal in pattern: "${text}"`);
      tokens.push({ type: 'LITERAL', value: text.slice(i + 1, j) });
      i = j + 1;
      continue;
    }

    if ('[]()|?*+:'.includes(ch)) { tokens.push({ type: ch }); i++; continue; }

    if (/[A-Za-z0-9_$-]/.test(ch)) {
      let j = i;
      while (j < text.length && /[A-Za-z0-9_$-]/.test(text[j])) j++;
      tokens.push({ type: 'WORD', value: text.slice(i, j) });
      i = j;
      continue;
    }

    throw new Error(`[lsd] Unexpected character "${ch}" in pattern "${text}" at position ${i}.`);
  }

  tokens.push({ type: 'EOF' });
  return tokens;
}

// :::::: Recursive-descent parser

export function parsePattern (text) {
  const tokens = tokenizePattern(text);
  let pos = 0;

  const peek   = () => tokens[pos];
  const next   = () => tokens[pos++];
  const at     = type => peek().type === type;
  const expect = type => {
    if (!at(type)) throw new Error(`[lsd] Expected "${type}" but got "${peek().type}" in pattern "${text}".`);
    return next();
  };

  function parseChoice (terminators) {
    const alternatives = [parseSequence(['|', ...terminators])];

    while (at('|')) {
      next();
      alternatives.push(parseSequence(['|', ...terminators]));
    }

    return alternatives.length === 1 ? alternatives[0] : { type: 'choice', alternatives };
  }

  function parseSequence (terminators) {
    const factors = [];
    while (!terminators.includes(peek().type)) factors.push(parseFactor());

    if (factors.length === 0) throw new Error(`[lsd] Empty sequence in pattern "${text}".`);

    return factors.length === 1 ? factors[0] : { type: 'sequence', factors };
  }

  function parseFactor () {
    let node = parsePrimary();

    if      (at('?')) { next(); node = { type: 'optional', expr: node }; }
    else if (at('*')) { next(); node = { type: 'repeat', expr: node, atLeastOne: false }; }
    else if (at('+')) { next(); node = { type: 'repeat', expr: node, atLeastOne: true  }; }

    if (at(':')) {
      next();
      const { value: name } = expect('WORD');
      node = { ...node, inlineLabel: name };
    }

    return node;
  }

  function parsePrimary () {
    if (at('LITERAL')) { const t = next(); return { type: 'literal',   value: t.value }; }
    if (at('WORD'))    { const t = next(); return { type: 'reference', name:  t.value }; }

    if (at('(')) {
      next();
      const inner = parseChoice([')']);
      expect(')');
      return { type: 'group', expr: inner };
    }

    if (at('[')) {
      next();
      const node = parseListBody();
      expect(']');
      return node;
    }

    throw new Error(`[lsd] Unexpected token "${peek().type}" in pattern "${text}".`);
  }

  function parseListBody () {
    const item = parseSimplePrimary();

    let atLeastOne = false;
    if (at('+')) { next(); atLeastOne = true; }

    let separator         = null;
    let separatorOptional = false;

    if (!at(']')) {
      separator = parseSimplePrimary();
      if (at('?')) { next(); separatorOptional = true; }
    }

    return { type: 'list', item, separator, atLeastOne, separatorOptional };
  }

  function parseSimplePrimary () {
    if (at('LITERAL')) { const t = next(); return { type: 'literal',   value: t.value }; }
    if (at('WORD'))    { const t = next(); return { type: 'reference', name:  t.value }; }
    throw new Error(`[lsd] Expected a literal or reference inside "[...]" in pattern "${text}".`);
  }

  const result = parseChoice(['EOF']);
  expect('EOF');
  return result;
}

// :::::: Factor numbering

// Numbers a pattern's TOP-LEVEL factors (1-based `.index`) for bindings.js's
// positional mapping. A top-level "|" has no fixed factor count to number a
// mapping against, so it is rejected here with a pointer to the alternative.
export function numberTopLevelFactors (patternText) {
  const node = parsePattern(patternText);

  if (node.type === 'choice') {
    throw new Error(
      `[lsd] Top-level "|" is not supported within a single block RULE == line ` +
      `("${patternText}") - write each alternative as its own separate RULE == line instead.`
    );
  }

  const factors = node.type === 'sequence' ? node.factors : [node];
  return factors.map((factor, i) => ({ ...factor, index: i + 1 }));
}

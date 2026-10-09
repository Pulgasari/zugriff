// @cosmonaut/lsd/bindings.js

// Unifies three ways of naming a RULE alternative's captured factors into
// one resolver, so all of these are valid and produce IDENTICAL results:
//
//   (A) positional, named externally via NODE:
//       RULE == `fn` IDENTIFIER FnParams Block => 2 3 4
//       NODE == { identifier, args, body }
//
//   (B) named inline, directly on the pattern factor:
//       RULE == `fn` IDENTIFIER:identifier FnParams:args Block:body
//
//   (C) named in the mapping itself:
//       RULE == `fn` IDENTIFIER FnParams Block => identifier:2 args:3 body:4
//
// ...and any MIX of the above within a single alternative, e.g. naming
// one field inline/explicitly and leaving the rest positional against
// NODE's remaining (not-yet-claimed) fields.
//
// A "constant" binding (a value with no corresponding pattern factor,
// e.g. ArrayLikeLiteral's "kind" tag) works the same way: either named
// explicitly ("kind:`Record`") or bare ("`Record`"), positionally
// claiming the next unclaimed NODE field.

import { numberTopLevelFactors } from './expression.js';

const isDigit = sth => /^\d+$/.test(token);

// :::::: Parsing a RULE pattern's factors
//
// Delegates to expression.js's real recursive-descent parser, which
// understands "(...)" grouping/choice, quantifiers, and "[...]" list
// shapes correctly - see expression.js's file header for the full
// writeup. Only the top-level factor list (numbered + inline-labeled) is
// needed here; resolveBindings below only ever reads `.index`/
// `.inlineLabel` off each factor, so the richer per-factor AST shape
// (group/choice/list/...) slots in with no further changes needed to the
// resolver itself.

export function parsePatternFactors (patternText) {
  return numberTopLevelFactors(patternText);
}

// :::::: Parsing a "=>" mapping list
//
// Each mapping token is one of:
//   N                 - bare index                  (needs NODE to name it)
//   name:N             - named index                 (self-contained)
//   `literal`          - bare constant                (needs NODE to name it)
//   name:`literal`      - named constant               (self-contained)
//   name:bareword       - named constant, unquoted     (self-contained)

export function parseMappingTokens (mappingText) {
  if (!mappingText?.trim()) return [];

  return mappingText.trim().split(/\s+/).map(token => {
    const namedMatch = token.match(/^([A-Za-z_][A-Za-z0-9_]*):(.+)$/);

    if (namedMatch) {
      const [, name, valueText] = namedMatch;
      if (/^\d+$/.test(valueText)) return { kind: 'namedIndex'    , name, index: Number        (valueText) };
                                   return { kind: 'namedConstant' , name, value: parseConstant (valueText) };
    }

    if (/^\d+$/.test(token)) return { kind: 'index'    , index: Number        (token) };
                             return { kind: 'constant' , value: parseConstant (token) };
  });
}

function parseConstant (text) {
  const quoted = text.match(/^[`'"](.*)[`'"]$/);
  if (quoted)             return quoted[1];
  if (text === 'true')    return true;
  if (text === 'false')   return false;
  if (/^\d+$/.test(text)) return Number(text);
  return text; // bare word, used as-is
}

// :::::: The unifying resolver
//
// Produces the final { name -> { kind: 'capture', index } | { kind: 'constant', value } }
// bindings for one RULE alternative, from whichever combination of inline
// labels / mapping tokens / NODE fields was actually provided.

export function resolveBindings ({ patternFactors, mappingTokens, nodeFields }) {
  const bindings = {};

  // 1. inline pattern labels
  for (const factor of patternFactors) {
    if (factor.inlineLabel) bindings[factor.inlineLabel] = { kind: 'capture', index: factor.index };
  }

  // 2. explicitly named mapping tokens
  const unnamedSlots = [];
  for (const token of mappingTokens) {
         if (token.kind === 'namedIndex')    bindings[token.name] = { kind: 'capture',  index: token.index };     
    else if (token.kind === 'namedConstant') bindings[token.name] = { kind: 'constant', value: token.value };
    else unnamedSlots.push(token); // bare index / bare constant - resolved in step 3
    /*
    switch (token.kind) {
      case 'namedIndex'    : bindings[token.name] = { kind: 'capture',  index: token.index }; break;
      case 'namedConstant' : bindings[token.name] = { kind: 'constant', value: token.value }; break;
      default              : unnamedSlots.push(token); // bare index / bare constant - resolved in step 3
    }
    */
  }

  // 3. bare (unnamed) slots claim NODE's remaining, not-yet-used fields, in order
  if (unnamedSlots.length > 0) {
    if (!nodeFields) throw new Error(`[lsd] Alternative has ${unnamedSlots.length} unnamed capture(s)/constant(s), but no NODE is declared to name them from. Either label them inline/in the mapping, or declare a NODE with matching fields.`);     

    const alreadyClaimed  = new Set(Object.keys(bindings));
    const availableFields = nodeFields.filter(f => !alreadyClaimed.has(f));

    if (availableFields.length < unnamedSlots.length) {
      throw new Error(`[lsd] ${unnamedSlots.length} unnamed slot(s) but only ${availableFields.length} unclaimed NODE field(s) remain (${nodeFields.join(', ')}).`);
    }

    unnamedSlots.forEach((slot, i) => {
      const name = availableFields[i];
      bindings[name] = slot.kind === 'index'
        ? { kind:  'capture', index: slot.index }
        : { kind: 'constant', value: slot.value };
    });
  }

  return bindings;
}

// :::::: Cross-alternative consistency check
//
// Every alternative of a block should ultimately produce the SAME SET of
// field names (order doesn't matter - only the set does), regardless of
// which of the three styles each alternative used to get there.

export function checkBlockConsistency (blockName, alternativesBindings, nodeFields) {
  const nameSets = alternativesBindings.map(b => new Set(Object.keys(b)));
  const [first, ...rest] = nameSets;

  rest.forEach((set, i) => {
    const missing = [...first].filter(n =>   !set.has(n));
    const extra   =   [...set].filter(n => !first.has(n));
    if (missing.length || extra.length) {
      throw new Error(
        `[lsd] Block "${blockName}": alternative ${i + 2} disagrees with alternative 1 on field names.`
        + (missing.length ? ` Missing: ${missing.join(', ')}.` : '')
        +   (extra.length ?   ` Extra: ${  extra.join(', ')}.` : '')
      );
    }
  });

  if (nodeFields) {
    const declared = new Set(nodeFields);
    const produced = first;
    const missing  = [...declared].filter(n => !produced.has(n));
    const extra    = [...produced].filter(n => !declared.has(n));
    if (missing.length || extra.length) {
      throw new Error(
        `[lsd] Block "${blockName}": NODE declares { ${nodeFields.join(', ')} }, but the RULE alternatives produce a different field set.`
        + (missing.length ?  ` NODE has extra/unused: ${missing.join(', ')}.` : '')
        +   (extra.length ? ` RULEs produce undeclared: ${extra.join(', ')}.` : '')
      );
    }
  }
}

// @cosmonaut/lsd/grammar.js

// Parses:
//   (a) top-level "RULE :: Name == Expr [=> N]" productions
//   (b) "#### Name" blocks: a "META :: <BlockName>", an optional
//       "NODE == { fields }" (also accepts the legacy spelling "TYPE"),
//       one or more "RULE == pattern [=> mapping]" alternatives, and a
//       "CODE == `template`" for codegen.
//
// Field naming inside a block's alternatives supports three styles, and
// any mix of them - see bindings.js for the unifying resolver:
//
//   (1) positional + NODE:      RULE == ... Block => 2 3 4
//                                 NODE == { identifier, args, body }
//   (2) inline pattern labels:  RULE == ... Block:body
//   (3) named mapping:          RULE == ... Block => identifier:2 args:3 body:4
//
// Top-level productions get a simpler, single "=> N" extraction (see
// parseTopLevelRule) - needed whenever a multi-factor top-level pattern
// wraps its real content in delimiter literals (e.g. Block, ParenCallArgs).

import {
  parsePatternFactors,
  parseMappingTokens,
  resolveBindings,
  checkBlockConsistency,
} from './bindings.js';
import { parsePattern } from './expression.js';

export function parseGrammar ({ ruleLines, blocks }) {
  const productions    = ruleLines.map(parseTopLevelRule);
  const compiledBlocks = blocks.map(parseBlock);
  return { productions, blocks: compiledBlocks };
}

function parseTopLevelRule (line) {
  const match = line.match(/^RULE\s*::\s*(\S+)\s*==\s*(.+)$/);
  if (!match) throw new Error(`[lsd] Malformed top-level RULE line: "${line}"`);
  const [, name, rest] = match;

  const [exprText, extractText] = splitPatternAndMapping(rest);
  let extractIndex = null;

  if (extractText) {
    if (!/^\d+$/.test(extractText.trim())) {
      throw new Error(
        `[lsd] Top-level RULE "${name}": expected a single position number after "=>" ` +
        `(e.g. "=> 2"), got "${extractText}".`
      );
    }
    extractIndex = Number(extractText.trim());
  }

  return { name, expr: parsePattern(exprText.trim()), extractIndex };
}

function parseBlock ({ fullName, name, lines }) {
  const text = lines.join('\n');

  const nodeMatch  = text.match(/^(?:NODE|TYPE)\s*==\s*\{([^}]*)\}/m);
  const nodeFields = nodeMatch
    ? nodeMatch[1].split(',').map(s => s.trim()).filter(Boolean).map(f => f.split(':')[0].trim())
    : null;

  const ruleLineMatches = [...text.matchAll(/^RULE\s*==\s*(.+)$/gm)];

  const alternatives = ruleLineMatches.map(([, fullText], i) => {
    const [patternText, mappingText] = splitPatternAndMapping(fullText);
    const patternFactors = parsePatternFactors(patternText);
    const mappingTokens  = mappingText ? parseMappingTokens(mappingText) : [];

    let bindings;
    try {
      bindings = resolveBindings({ patternFactors, mappingTokens, nodeFields });
    } catch (err) {
      throw new Error(
        `[lsd] In block "${name}"${fullName ? ` (${fullName})` : ''}, alternative ${i + 1}: ${err.message}`
      );
    }

    return { patternText, mappingText, patternFactors, mappingTokens, bindings };
  });

  if (alternatives.length > 0) {
    checkBlockConsistency(name, alternatives.map(a => a.bindings), nodeFields);
  }

  const codeMatch    = text.match(/^CODE\s*==\s*`([\s\S]*?)`\s*$/m);
  const codeTemplate = codeMatch?.[1] ?? null;

  return { fullName, name, nodeFields, alternatives, codeTemplate };
}

function splitPatternAndMapping (fullText) {
  let inBacktick = false;

  for (let i = 0; i < fullText.length - 1; i++) {
    const ch = fullText[i];
    if (ch === '`') inBacktick = !inBacktick;
    if (!inBacktick && ch === '=' && fullText[i + 1] === '>') {
      return [fullText.slice(0, i).trim(), fullText.slice(i + 2).trim()];
    }
  }

  return [fullText.trim(), null];
}

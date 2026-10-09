// @cosmonaut/cosmonaut/rules

// Builders for the Lexer's two inputs: content RULES (sticky regexes tried
// in order) and SCANNERS (span consumers, tried first). Available on any
// Lexer instance as `l.$`.

import { commonTokens }                 from '../presets/index.js';
import { ensureArray, makeStickyRegex } from '../utils/index.js';

export * from './scanners.js';

// :::::: Token types

// Freezes a { NAME: 'NAME' } lookup out of the shared commons plus whatever
// the language adds, so rules can reference types by identifier rather than
// by bare string.
export function buildTokenTypes (custom = []) {
  const all = [...commonTokens, ...custom];
  return Object.freeze(Object.fromEntries(all.map(name => [name, name])));
}

// :::::: Rules

export function makeRulesFromStringList (stringList, tokenType, kind = 'literal') {
  return ensureArray(stringList).map(value => ({
    id    : `${kind}:${value}`,
    type  : tokenType,
    value,
    regex : makeStickyRegex(RegExp.escape(String(value))),
  }));
}

export function makeRulesFromPuncts (puncts, tokenTypes) {
  return makeRulesFromStringList(puncts, tokenTypes.PUNCT, 'punct');
}

export function makeRulesFromOperators (operators, tokenTypes) {
  return makeRulesFromStringList(operators, tokenTypes.OPERATOR, 'operator');
}

// Resolves a flat list of rules into the effective set. Every rule needs a
// unique `id`, so a preset rule can be overridden by redeclaring it - if the
// same id shows up twice, the last one wins.
export function resolveRules (rules = []) {
  const byId = new Map();

  for (const rule of rules) {
    if (!rule.id) {
      throw new Error('[Lexer] rule is missing an "id" (required so later rules can override earlier ones).');
    }
    byId.set(rule.id, normalizeRule(rule));
  }

  return [...byId.values()];
}

// :::::: Helpers

export function isKeyword (keywords, value) {
  if (!keywords)                    return false;
  if (keywords instanceof Set)      return keywords.has(value);
  if (Array.isArray(keywords))      return keywords.includes(value);
  if (typeof keywords === 'object') return Object.prototype.hasOwnProperty.call(keywords, value);
  return false;
}

// :::::: internal

function normalizeRule (rule) {
  return rule.regex.sticky ? rule : { ...rule, regex: makeStickyRegex(rule.regex) };
}

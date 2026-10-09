// @cosmonaut/cosmonaut/machine/registry.js

// Name handling for the method registry. Every stage (lexer, parser,
// generator) registers user-supplied methods under a title-case name, with
// or without the stage's own prefix - "parseIfStatement" and "IfStatement"
// are the same rule.

import { isTitleCase } from '../internals/index.js';

// "parseIfStatement" -> "IfStatement", "IfStatement" -> "IfStatement".
// Anything else is a mistake worth failing loudly on: a lowercase key is
// almost always a helper that slipped into the methods object by accident.
export function normalizeName (key, prefix, label) {
  if (key.startsWith(prefix) && key.length > prefix.length && isTitleCase(key.slice(prefix.length))) {
    return key.slice(prefix.length);
  }
  if (isTitleCase(key)) return key;

  throw new Error(
    `[${label}] Invalid method name "${key}" ` +
    `(expected "${prefix}MethodName" or "MethodName").`
  );
}

// Every property the instance already carries, own and inherited, at the
// moment registration starts. Replaces the hand-maintained RESERVED_CORE_NAMES
// lists the old Parser and Generator each kept - those had already drifted
// apart from each other and from the classes they were guarding.
export function snapshotReserved (instance) {
  const names = new Set();

  for (let obj = instance; obj && obj !== Object.prototype; obj = Object.getPrototypeOf(obj)) {
    for (const name of Object.getOwnPropertyNames(obj)) names.add(name);
  }

  return names;
}

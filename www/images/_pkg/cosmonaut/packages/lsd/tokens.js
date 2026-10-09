// @cosmonaut/lsd/tokens.js

// Parses TKN lines. Order is preserved (per the source comment: "order
// and relation of rules is part of the control flow"), since the
// resulting list is meant to be tried top-to-bottom by the tokenizer,
// not resolved as an unordered set.

export function parseTokens (tknLines) {
  return tknLines.map(line => {
    const match = line.match(/^TKN\s*::\s*(\S+)\s*==\s*(.+)$/);
    if (!match) throw new Error(`[lsd] Malformed TKN line: "${line}"`);

    const [, name, rhs] = match;
    const trimmed = rhs.trim();

    if (trimmed.startsWith('@')) {
      return { name, kind: 'ref', ref: trimmed.slice(1) };
    }

    const regexMatch = trimmed.match(/^\/(.+)\/([a-z]*)$/);
    if (regexMatch) {
      const [, pattern, flags] = regexMatch;
      return { name, kind: 'regex', pattern: new RegExp(pattern, flags) };
    }

    throw new Error(`[lsd] Unrecognized TKN definition for "${name}": "${trimmed}"`);
  });
}

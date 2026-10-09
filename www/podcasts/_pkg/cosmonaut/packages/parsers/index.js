// @cosmonaut/parsers

// Composable parser blocks ("combinators"). No dependencies, no knowledge
// of tokens, ASTs, or the rest of the toolkit - every block is a plain
// `(stream) => result | undefined` function built from other such functions.
//
// Two contracts hold throughout, see readme.md:
//   1. `undefined` is the ONLY failure value. `null` is a real result.
//   2. `stream` is duck-typed: save/restore/peek/next/eof/check/match/consume.

export * from './atoms.js';
export * from './chain.js';
export * from './flow.js';
export * from './repeat.js';
export * from './transform.js';

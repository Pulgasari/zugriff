// @cosmonaut/cosmonaut/patterns/parsePattern.js

// Compiles a shorthand grammar line into a parser and runs it:
//
//   p.$.parsePattern('if ( Expression ) Block', '!!?!?', { test: 2, body: 4 })
//
// `pattern`    whitespace-separated parts
// `strategies` one flag per part: '!' = expect literally, '?' = rule or token
// `capture`    optional { key: partIndex } map turning the result into an object

import { expect, map, seq, token } from '@cosmonaut/parsers';
import { isTitleCase }             from '../internals/index.js';

export default function parsePattern (parser, pattern, strategies, capture = null) {
  const parts = pattern.trim().split(/\s+/);
  const flags = strategies.trim().split('');

  if (parts.length !== flags.length) {
    throw new Error(`[Parser] Pattern has ${parts.length} parts but ${flags.length} strategy flags.`);
  }

  const compiled = parts.map((part, i) => {
    switch (flags[i]) {
      case '!' : return expect(part);
      case '?' : return parser.hasMethod(part) || isTitleCase(part)
                        ? stream => stream.parse(part)
                        : token(part);
      default  : throw new Error(`[Parser] Unknown strategy flag "${flags[i]}".`);
    }
  });

  let compiledPattern = seq(...compiled);

  if (capture) {
    compiledPattern = map(compiledPattern, result => {
      const node = {};
      for (const [key, index] of Object.entries(capture)) node[key] = result[index];
      return node;
    });
  }

  return compiledPattern(parser.stream);
}

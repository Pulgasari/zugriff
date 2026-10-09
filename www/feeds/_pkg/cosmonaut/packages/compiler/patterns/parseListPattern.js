// @cosmonaut/cosmonaut/patterns/parseListPattern.js

// Parses a separated, optionally wrapped list - the parsing counterpart to
// genList. `config` is a shorthand string: separator, then the two wrapping
// characters, e.g. ", ()" for "(a, b, c)". Pass just ", " for no wrapper.

import { expect, sepEndBy, seq } from '@cosmonaut/parsers';

export default function parseListPattern (parser, element, config = ', {}') {
  const [separator = ',', wrapper = '{}'] = config.trim().split(/\s+/);

  const open  = wrapper?.[0];
  const close = wrapper?.[1];

  const item = typeof element === 'string'
    ? stream => stream.parse(element)
    : element;

  const list = sepEndBy(item, expect(separator));

  if (!open || !close) return list(parser.stream);

  return seq(expect(open), list, expect(close))(parser.stream)[1];
}

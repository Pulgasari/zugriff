// @cosmonaut/parsers/flow.js

// `undefined` is the failure value throughout. optional() is the one place
// that deliberately converts a failure into a successful `null` - everything
// else here just propagates undefined-on-failure transparently.

import { backtrack, decorate } from './_internal.js';

export const

lazy = parser => decorate (stream => parser()(stream)),

not  = parser => decorate (stream => lookAhead(parser)(stream) === undefined ? true : undefined),

// The ONE place `undefined` (failed) becomes `null` (succeeded, matched
// nothing) - this is what lets seq() and friends downstream distinguish
// "this optional part legitimately matched nothing" from "something failed".
optional = parser => decorate (stream => {
  const result = backtrack(stream, parser);
  return result === undefined ? null : result;
}),

between = (open, inner, close) => decorate (stream => {
  const position = stream.save();

  if (open(stream) === undefined) {
    stream.restore(position);
    return undefined;
  }

  const result = inner(stream);

  if (result === undefined || close(stream) === undefined) {
    stream.restore(position);
    return undefined;
  }

  return result;
}),

choice = (...parsers) => decorate (stream => {
  for (const parser of parsers.flat()) {
    const result = backtrack(stream, parser);
    if (result !== undefined) return result;
  }
  return undefined;
}),

cut = (parser, message) => decorate (stream => {
  const result = parser(stream);
  if (result !== undefined) return result;

  message ??= 'cut(): expected parser to succeed.';

  throw stream.error
    ? stream.error(message)
    : new Error(message);
}),

lookAhead = parser => decorate (stream => {
  const position = stream.save();
  const result   = parser(stream);
  stream.restore(position);
  return result;
}),

seq = (...parsers) => decorate (stream => {
  const position = stream.save();
  const results  = [];

  for (const parser of parsers.flat()) {
    const result = parser(stream);
    if (result === undefined) {
      stream.restore(position);
      return undefined;
    }
    results.push(result);
  }

  return results;
}),

skip = (parser, discarded) => decorate (stream => {
  const position = stream.save();
  const result   = parser(stream);

  if (result === undefined || discarded(stream) === undefined) {
    stream.restore(position);
    return undefined;
  }

  return result;
}),

then = (discarded, parser) => decorate (stream => {
  const position = stream.save();

  if (discarded(stream) === undefined) {
    stream.restore(position);
    return undefined;
  }

  const result = parser(stream);

  if (result === undefined) {
    stream.restore(position);
    return undefined;
  }

  return result;
});

export const commit = cut;

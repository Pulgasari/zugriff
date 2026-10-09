// @cosmonaut/parsers/transform.js

// Result shaping. None of these touch the stream position themselves -
// they only run an inner block and reshape whatever came back.

import { decorate } from './_internal.js';

export const

capture = (parser, name) => decorate (stream => {
  const result = parser(stream);
  return result === undefined ? undefined : { [name]: result };
}),

filter = (parser, predicate) => decorate (stream => {
  const result = parser(stream);
  return result === undefined ? undefined : predicate(result, stream) ? result : undefined;
}),

map = (parser, fn) => decorate (stream => {
  const result = parser(stream);
  return result === undefined ? undefined : fn(result, stream);
}),

tap = (parser, fn) => decorate (stream => {
  const result = parser(stream);
  if (result !== undefined) fn(result, stream);
  return result;
}),

value = (parser, value) => decorate (stream => {
  const result = parser(stream);
  return result === undefined ? undefined : value;
});

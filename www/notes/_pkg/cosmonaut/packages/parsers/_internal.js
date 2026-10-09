// @cosmonaut/parsers/_internal.js

// shared plumbing for the blocks themselves - not exported from mod.js.

export const

// identity for now; reserved as the single wrapping point for future
// cross-cutting concerns (chainability, tracing, source positions), so
// that adding one does not mean touching every block.
decorate = parser => parser,

// runs `parser`, rewinding the stream if it did not match. `undefined` is
// the only failure value - `null` is a legitimate result, most importantly
// optional()'s "matched nothing".
backtrack = (stream, parser) => {
  const position = stream.save();
  const result   = parser(stream);
  if (result === undefined) stream.restore(position);
  return result;
};

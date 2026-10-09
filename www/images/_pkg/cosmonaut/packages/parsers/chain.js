// @cosmonaut/parsers/chain.js

// Context-sensitive and associative chaining: unlike map(), which only
// transforms a result, these let the result decide what gets parsed next.

import { decorate } from './_internal.js';

export const

chain = (parser, fn) => decorate (stream => {
  const position = stream.save();
  const result   = parser(stream);

  if (result === undefined) {
    stream.restore(position);
    return undefined;
  }

  const next = fn(result, stream)(stream);

  if (next === undefined) {
    stream.restore(position);
    return undefined;
  }

  return next;
}),

chain1 = (parser, fn) => decorate (stream => {
  const position = stream.save();
  const first    = parser(stream);

  if (first === undefined) {
    stream.restore(position);
    return undefined;
  }

  const results = [first];
  let current   = first;

  while (true) {
    const position = stream.save();
    const next     = fn(current, stream)(stream);

    if (next === undefined) {
      stream.restore(position);
      break;
    }

    // infinite loop guard
    if (stream.save() === position) {
      throw new Error('chain1(): parser consumed no input.');
    }

    results.push(next);
    current = next;
  }

  return results;
}),

chainl1 = (operand, operator, build) => decorate (stream => {
  let left = operand(stream);

  if (left === undefined) return undefined;

  while (true) {
    const position = stream.save();
    const op       = operator(stream);

    if (op === undefined) {
      stream.restore(position);
      break;
    }

    const right = operand(stream);

    if (right === undefined) {
      stream.restore(position);
      break;
    }

    left = build(left, op, right);
  }

  return left;
}),

chainr1 = (operand, operator, build) => decorate (stream => {
  const left = operand(stream);

  if (left === undefined) return undefined;

  const position = stream.save();
  const op       = operator(stream);

  if (op === undefined) {
    stream.restore(position);
    return left;
  }

  const right = chainr1(operand, operator, build)(stream);

  if (right === undefined) {
    stream.restore(position);
    return left;
  }

  return build(left, op, right);
});

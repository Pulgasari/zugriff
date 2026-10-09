// @cosmonaut/parsers/repeat.js

// The "always succeeds" blocks (many, sepBy, sepByLoose, sepEndBy, atMost)
// never return undefined themselves - worst case an empty array `[]`, which
// is a real value, distinct from both `null` and `undefined`. Only the
// "requires at least one" variants (many1, sepBy1, sepBy1Loose, sepEndBy1,
// many1Till) can fail, when even the first required match does not happen.

import { backtrack, decorate } from './_internal.js';

export const

atLeast = (parser, min) => times(parser, min, Infinity),
atMost  = (parser, max) => times(parser, 0, max),

many = parser => decorate (stream => {
  const results = [];

  while (true) {
    const position = stream.save();
    const result   = parser(stream);

    if (result === undefined) {
      stream.restore(position);
      break;
    }

    if (stream.save() === position) {
      throw new Error('many(): parser consumed no input.');
    }

    results.push(result);
  }

  return results;
}),

many1 = parser => decorate (stream => {
  const first = parser(stream);
  if (first === undefined) return undefined;

  const results = many(parser)(stream);
  results.unshift(first);

  return results;
}),

repeat = (parser, count) => decorate (stream => {
  const position = stream.save();
  const results  = [];

  for (let i = 0; i < count; i++) {
    const result = parser(stream);

    if (result === undefined) {
      stream.restore(position);
      return undefined;
    }

    results.push(result);
  }

  return results;
}),

sepBy = (item, separator) => decorate (stream => {
  const first = backtrack(stream, item);
  if (first === undefined) return [];
  return sepByRest(stream, item, separator, [first]);
}),

sepBy1 = (item, separator) => decorate (stream => {
  const first = item(stream);
  if (first === undefined) return undefined;
  return sepByRest(stream, item, separator, [first]);
}),

sepEndBy = (item, separator) => decorate (stream => {
  const first = backtrack(stream, item);
  if (first === undefined) return [];
  return sepEndByRest(stream, item, separator, [first]);
}),

sepEndBy1 = (item, separator) => decorate (stream => {
  const first = item(stream);
  if (first === undefined) return undefined;
  return sepEndByRest(stream, item, separator, [first]);
}),

sepByLoose = (item, separator) => decorate (stream => {
  const first = backtrack(stream, item);
  if (first === undefined) return [];
  return sepByLooseRest(stream, item, separator, [first]);
}),

sepBy1Loose = (item, separator) => decorate (stream => {
  const first = item(stream);
  if (first === undefined) return undefined;
  return sepByLooseRest(stream, item, separator, [first]);
}),

manyTill = (item, end) => decorate (stream => {
  const results = [];

  while (true) {
    const position = stream.save();
    if (end(stream) !== undefined) break;

    stream.restore(position);

    const result = item(stream);
    if (result === undefined) return undefined;

    if (stream.save() === position) {
      throw new Error('manyTill(): parser consumed no input.');
    }

    results.push(result);
  }

  return results;
}),

many1Till = (item, end) => decorate (stream => {
  const first = item(stream);
  if (first === undefined) return undefined;

  const results = manyTill(item, end)(stream);
  results.unshift(first);

  return results;
}),

times = (parser, min, max = Infinity) => decorate (stream => {
  const position = stream.save();
  const results  = [];

  for (let i = 0; i < min; i++) {
    const result = parser(stream);

    if (result === undefined) {
      stream.restore(position);
      return undefined;
    }

    results.push(result);
  }

  while (results.length < max) {
    const position = stream.save();
    const result   = parser(stream);

    if (result === undefined) {
      stream.restore(position);
      break;
    }

    if (stream.save() === position) {
      throw new Error('times(): parser consumed no input.');
    }

    results.push(result);
  }

  return results;
});

// :::::: internal continuation helpers - not exported

function sepByRest (stream, item, separator, results) {
  while (true) {
    const position = stream.save();

    if (backtrack(stream, separator) === undefined) {
      stream.restore(position);
      break;
    }

    const next = item(stream);

    if (next === undefined) {
      stream.restore(position);
      break;
    }

    results.push(next);
  }

  return results;
}

function sepEndByRest (stream, item, separator, results) {
  while (true) {
    if (backtrack(stream, separator) === undefined) break;

    const next = backtrack(stream, item);
    if (next === undefined) break; // trailing separator allowed

    results.push(next);
  }

  return results;
}

function sepByLooseRest (stream, item, separator, results) {
  while (true) {
    const position = stream.save();

    backtrack(stream, separator); // optional: consume if present, no-op otherwise

    const next = backtrack(stream, item);

    if (next === undefined) {
      stream.restore(position);
      break;
    }

    if (stream.save() === position) {
      throw new Error('sepByLoose(): parser consumed no input.');
    }

    results.push(next);
  }

  return results;
}

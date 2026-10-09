// @cosmonaut/cosmonaut/internals/index.js

// Type predicates and small string helpers used across the package.
// Not part of the public API - mod.js does not re-export this.

export const arrayfied = sth => Array.isArray(sth) ? sth : [sth];

export const isArray     = sth => Array.isArray(sth);
export const isDefined   = sth => sth !== undefined;
export const isFalsy     = sth => !sth;
export const isFunction  = sth => typeof sth === 'function';
export const isNullish   = sth => sth == null;
export const isObject    = sth => typeof sth === 'object' && sth !== null;
export const isSymbol    = sth => typeof sth === 'symbol';
export const isTruthy    = sth => !!sth;
export const isUndefined = sth => sth === undefined;
export const isUpperCase = sth => sth === sth.toUpperCase();

export const isString = (sth, length) => length
  ? typeof sth === 'string' && sth.length === length
  : typeof sth === 'string';

export const isTitleCase = sth => /^[A-Z][a-zA-Z0-9_]*$/.test(sth);

export const toPascalCase = sth => String(sth)
  .split(/[-_]+/)
  .filter(Boolean)
  .map(part => part[0].toUpperCase() + part.slice(1))
  .join('');

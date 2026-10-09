// @cosmonaut/cosmonaut/utils/index.js

// Public helpers, re-exported from mod.js.

// :::::: Polyfills

if (!RegExp.escape) {
  RegExp.escape = function (s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };
}

// :::::: Helpers

export const ensureArray = value => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return value.split('');
  if (value && typeof value === 'object') return Object.keys(value);
  return [];
};

export const escapedRegExp = (str, flags = '') => {
  return new RegExp(RegExp.escape(String(str)), flags);
};

export const makeStickyRegex = (pattern, flags = '') => {
  const f = flags.includes('y') ? flags : flags + 'y';
  return (pattern instanceof RegExp)
    ? new RegExp(pattern.source, Array.from(new Set((pattern.flags || '') + f)).join(''))
    : new RegExp(pattern, f);
};

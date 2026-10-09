// @cosmonaut/cosmonaut/rules/scanners.js

// Scanners run BEFORE the rule list and own a whole span of source outright
// (whitespace, comments, template strings, JSX). A scanner returning
// `token: null` means "consumed, but produces nothing" - the lexer loop
// simply continues.
//
// Shape:
//   { id, test(source, index) -> boolean,
//         scan(source, index, ctx) -> { token, endCursor } }

import { makeStickyRegex } from './../utils/index.js';

export function buildWhitespaceScanner () {
  return {
    id   : 'whitespace',
    test : (source, i) => /\s/.test(source[i]),
    scan : (source, i) => {
      let end = i;
      while (end < source.length && /\s/.test(source[end])) end++;
      return { token: null, endCursor: end };
    },
  };
}

export function buildCommentScanners (comments) {
  const list = Array.isArray(comments) ? comments : [];

  const scanners = list.map(c => {
    if (c.type === 'line') {
      const regex = makeStickyRegex(RegExp.escape(c.start) + '.*');
      return makeCommentScanner(`comment:${c.start}`, c.start, regex);
    }

    if (c.type === 'block') {
      const regex = makeStickyRegex(RegExp.escape(c.start) + '[\\s\\S]*?' + RegExp.escape(c.end));
      return makeCommentScanner(`comment:${c.start}...${c.end}`, c.start, regex);
    }

    throw new Error(`[Lexer] Unknown comment type: "${c.type}".`);
  });

  // longest opener first, so "///" is tried before "//"
  scanners.sort((a, b) => b._sortKey.length - a._sortKey.length);

  return scanners;
}

// :::::: internal

function makeCommentScanner (id, start, regex) {
  return {
    id,
    test : (source, i) => source.startsWith(start, i),
    scan : (source, i) => {
      regex.lastIndex = i;
      const match = regex.exec(source);
      // an unterminated block comment: consume the rest rather than looping
      const end = match ? i + match[0].length : source.length;
      return { token: null, endCursor: end };
    },
    _sortKey : start,
  };
}

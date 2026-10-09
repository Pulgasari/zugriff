// @cosmonaut/layouter/builders.js

// Pure Doc builders. Building a Doc never fails and never inspects any
// "state" - it just produces a plain, serializable tree describing layout
// intent. Rendering that tree to text is print.js's job.

import {
  DOC_TEXT, DOC_CONCAT, DOC_LINE, DOC_GROUP, DOC_INDENT, DOC_IF_BREAK, DOC_LINE_SUFFIX,
} from './nodes.js';

export const

// :::::: Atoms

nil = { type: DOC_CONCAT, parts: [] },

text = value => ({ type: DOC_TEXT, value: String(value) }),

// soft : renders as nothing when flat, "\n" when broken
// line : renders as " "  when flat, "\n" when broken
// hard : always renders as "\n", regardless of the enclosing group's mode
line     = { type: DOC_LINE, soft: false, hard: false },
softline = { type: DOC_LINE, soft: true,  hard: false },
hardline = { type: DOC_LINE, soft: false, hard: true  },

// :::::: Layout

concat = (...docs) => ({ type: DOC_CONCAT, parts: docs.flat() }),

group = (doc, { shouldBreak = false } = {}) => ({
  type: DOC_GROUP, contents: doc, break: shouldBreak,
}),

indent = (doc, amount) => ({ type: DOC_INDENT, contents: doc, amount }),

ifBreak = (breakContents, flatContents = nil) => ({
  type: DOC_IF_BREAK, breakContents, flatContents,
}),

// Defers `doc` until the next real line break (hard, or a broken group's
// line/softline), regardless of where in the tree it was inserted. Used for
// trailing content that must stick to the end of the current output line,
// e.g. a line comment attached to a node that is followed by more same-line
// content generated elsewhere in the tree.
lineSuffix = doc => ({ type: DOC_LINE_SUFFIX, contents: doc }),

// :::::: Convenience helpers built purely from the above

wrap = (open, doc, close) => concat(text(open), doc, text(close)),

join = (docs, separator) => {
  const parts = [];
  docs.forEach((doc, i) => {
    if (i > 0) parts.push(separator);
    parts.push(doc);
  });
  return concat(...parts);
},

joinMap = (items, separator, fn) => join(items.map(fn), separator);

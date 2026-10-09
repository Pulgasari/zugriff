// @cosmonaut/layouter/nodes.js

// The node type tags of the Doc tree. Kept separate from builders.js so that
// print.js can read a Doc without pulling in the constructors used to build
// one - the two halves of this package only meet at the tree itself.

export const

DOC_TEXT        = 'text',
DOC_CONCAT      = 'concat',
DOC_LINE        = 'line',
DOC_GROUP       = 'group',
DOC_INDENT      = 'indent',
DOC_IF_BREAK    = 'if-break',
DOC_LINE_SUFFIX = 'line-suffix';

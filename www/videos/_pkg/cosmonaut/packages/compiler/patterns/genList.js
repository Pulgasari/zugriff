// @cosmonaut/cosmonaut/patterns/genList.js

// Renders a separated, optionally wrapped list of items as a Doc - the
// codegen counterpart to @cosmonaut/parser's parseListPattern. Wraps the
// result in a `group`, so it automatically breaks onto multiple lines
// (one item per line, indented) when the flat rendering would exceed
// the printer's configured width.
//
// config:
//   separator     string, default ','
//   wrapper       two-character string, default '()' - pass null/'' to
//                 render an unwrapped, still-groupable sequence
//   genItem       (generator, item) -> Doc, default generator.genNode
//   trailingComma 'none' | 'always' | 'ifBreak', default 'none'

import { concat, group, ifBreak, indent, join, line, softline, text } from '@cosmonaut/layouter';

export default function genList (generator, items, config = {}) {
  const {
    separator     = ',',
    wrapper       = '()',
    genItem       = (g, item) => g.genNode(item),
    trailingComma = 'none',
  } = config;

  const open  = wrapper?.[0];
  const close = wrapper?.[1];

  const itemDocs = items.map(item => genItem(generator, item));
  const sepDoc   = concat(text(separator), line);

  let body = join(itemDocs, sepDoc);

  if (items.length > 0) {
    if (trailingComma === 'always')  body = concat(body, text(separator));
    if (trailingComma === 'ifBreak') body = concat(body, ifBreak(text(separator)));
  }

  if (!open || !close) return group(body);

  return group(concat(
    text(open),
    indent(concat(softline, body)),
    softline,
    text(close),
  ));
}

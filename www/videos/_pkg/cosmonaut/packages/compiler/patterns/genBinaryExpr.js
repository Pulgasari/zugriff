// @cosmonaut/cosmonaut/patterns/genBinaryExpr.js

// Renders a binary-expression-shaped AST node as a Doc, inserting
// parentheses around either operand when required by operator
// precedence and associativity. This is the codegen counterpart to
// @cosmonaut/parser's parseBinaryExpr: parsing climbs precedence to
// know where an operand *ends*; generating climbs the same table to
// know whether an operand needs to be *wrapped in parens*.
//
// config:
//   getOperator (node)         -> operator string, e.g. n => n.operator
//   getLeft     (node)         -> left operand node
//   getRight    (node)         -> right operand node
//   operators   { op: { precedence, associativity } }
//   genOperand  (generator, node) -> Doc   (typically generator.genNode)
//   isBinary    (node) -> boolean           (which node types recurse
//                                             through this same precedence
//                                             logic instead of falling
//                                             back to genOperand directly)

import { concat, group, indent, line, text } from '@cosmonaut/layouter';

export default function genBinaryExpr (generator, node, config, parentPrecedence = 0) {
  const {
    getOperator,
    getLeft,
    getRight,
    operators,
    genOperand,
    isBinary = () => false,
  } = config;

  const operator = getOperator(node);
  const { precedence = 0, associativity = 'left' } = operators[operator] ?? {};

  const leftMinPrecedence  = associativity === 'left'  ? precedence : precedence + 1;
  const rightMinPrecedence = associativity === 'right' ? precedence : precedence + 1;

  const renderOperand = (operandNode, minPrecedence) => {
    if (isBinary(operandNode)) {
      return genBinaryExpr(generator, operandNode, config, minPrecedence);
    }
    return genOperand(generator, operandNode);
  };

  const leftDoc  = renderOperand(getLeft(node),  leftMinPrecedence);
  const rightDoc = renderOperand(getRight(node), rightMinPrecedence);

  const inner = group(concat(
    leftDoc,
    text(' ' + operator),
    indent(concat(line, rightDoc)),
  ));

  return precedence < parentPrecedence
    ? concat(text('('), inner, text(')'))
    : inner;
}

// @cosmonaut/cosmonaut/patterns/genUnaryExpr.js

// Renders a unary-expression node, wrapping the operand in parentheses
// when it is itself a binary-shaped expression (a unary operator always
// binds tighter than any binary operator it might be applied to, e.g.
// "-(a + b)", "!(a && b)").
//
// config:
//   getOperator (node) -> operator string, e.g. '-', 'typeof', '!'
//   getArgument (node) -> operand node
//   genOperand  (generator, node) -> Doc
//   isBinary    (node) -> boolean, used to decide whether the operand
//                          needs parentheses
//   prefix      boolean, default true  - operator before or after operand
//   spaced      boolean, default false - insert a space between operator
//                                        and operand (e.g. "typeof x" vs "-x")

import { concat, text } from '@cosmonaut/layouter';

export default function genUnaryExpr (generator, node, config) {
  const {
    getOperator,
    getArgument,
    genOperand,
    isBinary = () => false,
    prefix = true,
    spaced = false,
  } = config;

  const operator     = getOperator(node);
  const argumentNode = getArgument(node);

  let operandDoc = genOperand(generator, argumentNode);

  if (isBinary(argumentNode)) {
    operandDoc = concat(text('('), operandDoc, text(')'));
  }

  const glue = spaced ? ' ' : '';

  return prefix
    ? concat(text(operator + glue), operandDoc)
    : concat(operandDoc, text(glue + operator));
}

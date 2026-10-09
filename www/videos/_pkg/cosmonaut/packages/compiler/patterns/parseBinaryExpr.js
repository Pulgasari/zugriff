// @cosmonaut/cosmonaut/patterns/parseBinaryExpr.js

export default function (parser, config, minPrecedence = 0) {

  const {
    operators,
    excluded = new Set(),
    parseOperand,
    buildNode
  } = config;

  let left = parseOperand();

  while (true) {
    const match = matchOperator (parser, operators, excluded, minPrecedence);   
    if (!match) break;
    const right = parseBinaryExpr (parser, config, match.precedence + 1);
    left = buildNode (match.operator, left, right);
  }

  return left;

}

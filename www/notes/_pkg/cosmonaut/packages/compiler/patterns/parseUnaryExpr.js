// @cosmonaut/cosmonaut/patterns/parseUnaryExpr.js

export default function (parser, config) {

  const {
    operators,
    parseOperand,
    buildNode,
    specialCases = []
  } = config;

  for (const special of specialCases) {
    if (special.test(parser)) return special.parse(parser);
  }

  for (const [token, operator] of Object.entries(operators)) {
    if (!parser.check(token)) continue;

    parser.advance();
    const argument = parseUnaryExpr (parser, config);
    return buildNode (operator, argument);
  }

  return parseOperand();

}

// @cosmonaut/cosmonaut/stages/Generator.js

// AST -> Doc -> string. A Machine with the @cosmonaut/layouter toolkit;
// dispatch happens on each node's own `type`.

import * as layouter from '@cosmonaut/layouter';
import { print }     from '@cosmonaut/layouter';
import Machine       from '../machine/Machine.js';
import genBinaryExpr from '../patterns/genBinaryExpr.js';
import genList       from '../patterns/genList.js';
import genUnaryExpr  from '../patterns/genUnaryExpr.js';

export default class Generator extends Machine {

  static prefix   = 'gen';
  static label    = 'Generator';
  static toolkit  = layouter;
  static patterns = { genBinaryExpr, genUnaryExpr, genList };
  static defaults = { methods: {}, printOptions: {}, root: null };

  // :::::: Node Dispatch

  // A node `{ type: 'BinaryExpression', ... }` dispatches to whichever method
  // was registered as `genBinaryExpression` or `BinaryExpression`.
  genNode (node) {
    if (!node || typeof node.type !== 'string') {
      throw new Error('[Generator] genNode() requires a node with a string "type" property.');
    }
    return this.gen(node.type, node);
  }

  // :::::: Run

  run (node = this.options.root, printOptions = this.options.printOptions) {
    return print(this.genNode(node), printOptions);
  }

  // kept as the reading-friendly name; run() exists so every stage answers
  // to the same call.
  generate (node, printOptions) {
    return this.run(node, printOptions);
  }

}

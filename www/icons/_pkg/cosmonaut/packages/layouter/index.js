// @cosmonaut/layouter

// Wadler-style pretty printing, in two halves that meet at the Doc tree:
//
//   builders.js  describes layout INTENT   ("this group may break here")
//   print.js     makes layout DECISIONS    ("it does not fit, so it breaks")
//
// Building a Doc never fails and never inspects any state. All width-
// dependent choices happen once, in print().

export * from './nodes.js';
export * from './builders.js';
export { print } from './print.js';

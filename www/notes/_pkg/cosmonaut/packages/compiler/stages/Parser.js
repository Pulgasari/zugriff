// @cosmonaut/compiler/stages/Parser.js

// tokens -> AST. A Machine with the @cosmonaut/parsers toolkit and a
// TokenStream underneath.

import * as parsers from '@cosmonaut/parsers';

import Machine     from '../machine/Machine.js';
import TokenStream from '../streams/TokenStream.js';

import parseBinaryExpr  from '../patterns/parseBinaryExpr.js';
import parseListPattern from '../patterns/parseListPattern.js';
import parsePattern     from '../patterns/parsePattern.js';
import parseUnaryExpr   from '../patterns/parseUnaryExpr.js';

export default class Parser extends Machine {

  static prefix   = 'parse';
  static label    = 'Parser';
  static toolkit  = parsers;
  static patterns = { parsePattern, parseListPattern, parseBinaryExpr, parseUnaryExpr };
  static defaults = { methods: {}, entry: 'Program', requireEof: true };

  constructor (options = {}) {
    super(options);
    this.stream = new TokenStream([], this);
  }

  // :::::: Run

  // Tokens are handed to run(), not to the constructor - a Parser is a
  // configured machine that can process any number of token arrays, the
  // same way a Generator processes any number of ASTs.
  run (tokens, entry = this.options.entry) {
    this.stream.setTokens(tokens);

    const result = this.parse(entry);

    // An entry rule shaped like `many(Statement)` NEVER fails: it silently
    // stops and returns whatever it collected the moment the next Statement
    // does not match. Without this check a syntax error deep in the source -
    // or any construct the grammar simply does not cover yet - would produce
    // a truncated AST instead of a clear parse error.
    if (this.options.requireEof && !this.eof()) {
      const collected = Array.isArray(result) ? `, stopped after ${result.length} item(s)` : '';
      throw this.stream.error(`Unexpected input${collected}`);
    }

    return result;
  }

  // :::::: Token API

  // Convenience façade over this.stream, for hand-written grammar rules.
  // Pure delegation, no logic of its own - blocks always receive the stream
  // itself, so there is exactly one implementation of the contract.

  check    (value)    { return this.stream.check(value); }
  match    (value)    { return this.stream.match(value); }
  expect   (value)    { return this.stream.consume(value); }
  consume  (value)    { return this.stream.consume(value); }
  next     ()         { return this.stream.next(); }
  advance  ()         { return this.stream.next(); }
  peek     (offset)   { return this.stream.peek(offset); }
  eof      ()         { return this.stream.eof(); }
  save     ()         { return this.stream.save(); }
  restore  (position) { return this.stream.restore(position); }

  checkSequence  (...values) { return this.stream.checkSequence(...values); }
  matchSequence  (...values) { return this.stream.matchSequence(...values); }
  expectSequence (...values) { return this.stream.consumeSequence(...values); }

  // :::::: Dispatch on the current token

  // p.dispatch({ 'if': 'IfStatement', 'for': 'ForStatement' }).or('ExprStatement')
  dispatch (table) {
    for (const [key, methodName] of Object.entries(table)) {
      if (this.check(key)) {
        const result = this.parse(methodName);
        return { or: () => result };
      }
    }
    return { or: fallbackName => this.parse(fallbackName) };
  }

}

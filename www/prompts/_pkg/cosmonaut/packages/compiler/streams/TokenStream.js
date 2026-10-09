// @cosmonaut/cosmonaut/streams/TokenStream.js

// The token-level cursor every parser block reads from. This is the single
// implementation of the stream contract documented in @cosmonaut/parsers -
// the Parser stage only delegates to it, it does not reimplement it.
//
// SENTINEL: `undefined` means "no match" everywhere. `null` is a real value
// (optional() returns it for "matched nothing") and must never be produced
// as a failure signal - that conflation was the original bug this design
// exists to prevent.

export default class TokenStream {

  // `machine` is the owning Parser, so that blocks can recurse into named
  // grammar rules via `stream.parse('Expression')` without holding a second
  // reference to the parser.
  constructor (tokens = [], machine = null) {
    this.machine = machine;
    this.setTokens(tokens);
  }

  setTokens (tokens = []) {
    this.tokens = tokens;
    this.index  = 0;
    return this;
  }

  reset () {
    this.index = 0;
    return this;
  }

  // :::::: Position

  save    ()           { return this.index; }
  restore (position)   { this.index = position; }
  peek    (offset = 0) { return this.tokens[this.index + offset]; }

  // Reaching the end of the array counts as EOF even when the lexer produced
  // no explicit EOF token - the old ParserState checked only for the token
  // and would happily run off the end of a hand-built token array.
  eof () {
    return this.index >= this.tokens.length || this.peek()?.type === 'EOF';
  }

  next () {
    if (this.eof()) return this.peek();
    return this.tokens[this.index++];
  }

  // :::::: Matching

  check (typeOrValue) {
    const token = this.peek();
    if (!token) return false;
    return token.type === typeOrValue || token.value === typeOrValue;
  }

  match (typeOrValue) {
    return this.check(typeOrValue) ? this.next() : undefined;
  }

  consume (typeOrValue) {
    const token = this.match(typeOrValue);
    if (token === undefined) throw this.error(`Expected '${typeOrValue}'`);
    return token;
  }

  // :::::: Sequences

  checkSequence (...values) {
    return values.every((value, offset) => {
      const token = this.peek(offset);
      return token !== undefined && (token.type === value || token.value === value);
    });
  }

  matchSequence (...values) {
    if (!this.checkSequence(...values)) return undefined;
    return values.map(() => this.next());
  }

  consumeSequence (...values) {
    const result = this.matchSequence(...values);
    if (result === undefined) throw this.error(`Expected sequence [${values.join(', ')}]`);
    return result;
  }

  // :::::: Recursion into named rules

  // Lets a block call back into the grammar: lazy(() => s => s.parse('Expr')).
  parse (name, ...args) {
    if (!this.machine) throw new Error('[TokenStream] No parser attached; cannot resolve rule "' + name + '".');
    return this.machine.parse(name, ...args);
  }

  // :::::: Errors

  // Used by the cut() block and by consume(). Carries source position when
  // the lexer supplied one, which the old parser's index-only messages did not.
  error (message) {
    const token = this.peek();
    const where = token?.line != null
      ? `${token.line}:${token.column}`
      : `token ${this.index}`;
    return new SyntaxError(`[Parser] ${message} at ${where}.`);
  }

}

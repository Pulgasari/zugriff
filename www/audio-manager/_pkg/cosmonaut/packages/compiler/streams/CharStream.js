// @cosmonaut/cosmonaut/streams/CharStream.js

// The character-level cursor the Lexer reads from - the counterpart to
// TokenStream, same method names, same opaque-checkpoint contract.
//
// Line and column are DERIVED from the cursor via a line-start index built
// once per source, not tracked incrementally. The old Lexer recomputed them
// on every consumed chunk by splitting the consumed text, which meant any
// rewind silently left the reported position wrong.

export default class CharStream {

  constructor (source = '', machine = null) {
    this.machine = machine;
    this.setSource(source);
  }

  setSource (source = '') {
    this.source      = String(source);
    this.cursor      = 0;
    this._lineStarts = buildLineStarts(this.source);
    return this;
  }

  reset () {
    this.cursor = 0;
    return this;
  }

  // :::::: Position

  save    ()         { return this.cursor; }
  restore (position) { this.cursor = position; }
  seek    (position) { this.cursor = position; }

  peek (offset = 0) { return this.source[this.cursor + offset]; }
  eof  ()           { return this.cursor >= this.source.length; }

  next () {
    if (this.eof()) return undefined;
    return this.source[this.cursor++];
  }

  advance (count = 1) {
    this.cursor = Math.min(this.cursor + count, this.source.length);
    return this;
  }

  // :::::: Derived position

  get line () {
    return lineIndexAt(this._lineStarts, this.cursor) + 1;
  }

  get column () {
    const index = lineIndexAt(this._lineStarts, this.cursor);
    return this.cursor - this._lineStarts[index] + 1;
  }

  // :::::: Matching

  startsWith (text) {
    return this.source.startsWith(text, this.cursor);
  }

  // Runs a sticky regex at the current cursor WITHOUT consuming - the caller
  // decides whether to advance, so a failed rule costs nothing.
  match (stickyRegex) {
    stickyRegex.lastIndex = this.cursor;
    return stickyRegex.exec(this.source) ?? undefined;
  }

  slice (from = this.cursor, to = this.source.length) {
    return this.source.slice(from, to);
  }

  // :::::: Errors

  error (message) {
    return new SyntaxError(`[Lexer] ${message} at ${this.line}:${this.column}.`);
  }

}

// :::::: internal

function buildLineStarts (source) {
  const starts = [0];
  for (let i = 0; i < source.length; i++) {
    if (source[i] === '\n') starts.push(i + 1);
  }
  return starts;
}

// binary search: index of the line containing `position`
function lineIndexAt (starts, position) {
  let low  = 0;
  let high = starts.length - 1;

  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (starts[mid] <= position) low = mid;
    else high = mid - 1;
  }

  return low;
}

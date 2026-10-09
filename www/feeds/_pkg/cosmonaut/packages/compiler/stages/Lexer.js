// @cosmonaut/cosmonaut/stages/Lexer.js

// source -> tokens. A Machine over a CharStream.
//
// Note how this stage differs from the other two: the DRIVING loop is not
// name dispatch but ordered testing - scanners first, then content rules,
// first match wins. The registry is still there and still useful, for named
// sub-scanners a scanner can recurse into (`l.scan('TemplateString')`), but
// it is not what moves the cursor forward. Forcing full symmetry here would
// have been symmetry for its own sake.

import Machine    from '../machine/Machine.js';
import CharStream from '../streams/CharStream.js';

import * as rules from '../rules/index.js';
import { buildCommentScanners, buildWhitespaceScanner, isKeyword, makeRulesFromOperators,
         makeRulesFromPuncts, resolveRules } from '../rules/index.js';

export default class Lexer extends Machine {

  static prefix   = 'scan';
  static label    = 'Lexer';
  static toolkit  = rules;
  static patterns = {};
  static defaults = {
    methods        : {},

    comments       : [],
    keywords       : [],
    operators      : {},
    puncts         : [],
    tokenTypes     : null,

    rules          : [],
    scanners       : [],

    skipComments   : true,
    skipWhitespace : true,
  };

  // :::::: init

  constructor (source = '', options = {}) {
    super(options);

    if (!this.options.tokenTypes) {
      throw new Error('[Lexer] options.tokenTypes is missing - build one with buildTokenTypes().');
    }

    this.stream      = new CharStream(String(source), this);
    this._tokenTypes = this.options.tokenTypes;
    this._keywordSet = new Set(this.options.keywords ?? []);
    this._peeked     = null;

    this._buildScanners();
    this._buildRules();
  }

  // :::::: Run

  setSource (source) {
    this.stream.setSource(String(source));
    this._peeked = null;
    return this;
  }

  reset () {
    this.stream.reset();
    this._peeked = null;
    return this;
  }

  run (source) {
    if (source !== undefined) this.setSource(source);
    return this.tokenize();
  }

  tokenize () {
    this.reset();

    const tokens = [];

    while (true) {
      const token = this.next();
      tokens.push(token);
      if (token.type === this._tokenTypes.EOF) break;
    }

    return tokens;
  }

  // Recursive sub-tokenization for scanners (template strings, JSX, ...).
  // Uses this.constructor, not a hardcoded class name, so it keeps working
  // for `class MyLexer extends Lexer {}`.
  tokenizeSubSource (subSource) {
    return new this.constructor(subSource, this.options).tokenize();
  }

  // :::::: Token access

  next () {
    if (this._peeked) {
      const token  = this._peeked;
      this._peeked = null;
      return token;
    }
    return this._nextToken();
  }

  peek () {
    this._peeked ??= this._nextToken();
    return this._peeked;
  }

  // :::::: Extension

  addRule (rule, atStart = false) {
    const [normalized] = resolveRules([rule]);
    if (atStart) this._rules.unshift(normalized);
    else         this._rules.push(normalized);
    return this;
  }

  addScanner (scanner, atStart = false) {
    if (atStart) this._scanners.unshift(scanner);
    else         this._scanners.push(scanner);
    return this;
  }

  // :::::: internal

  _buildRules () {
    const { tokenTypes } = this.options;

    // longest operator first, so ">=" is tried before ">"
    const operatorKeys = Array.from(
      Array.isArray(this.options.operators) ? this.options.operators : Object.keys(this.options.operators)
    ).sort((a, b) => b.length - a.length);

    this._rules = [
      ...makeRulesFromOperators(operatorKeys, tokenTypes),
      ...makeRulesFromPuncts(this.options.puncts, tokenTypes),
      ...resolveRules(this.options.rules),
    ];
  }

  _buildScanners () {
    const scanners = [];

    if (this.options.skipWhitespace) scanners.push(buildWhitespaceScanner());
    if (this.options.skipComments)   scanners.push(...buildCommentScanners(this.options.comments));

    scanners.push(...(this.options.scanners ?? []));

    this._scanners = scanners;
    this._context  = {
      lexer    : this,
      tokenize : subSource => this.tokenizeSubSource(subSource),
    };
  }

  _nextToken () {
    const stream = this.stream;

    while (true) {
      if (stream.eof()) {
        return { type: this._tokenTypes.EOF, value: '', line: stream.line, column: stream.column };
      }

      const line   = stream.line;
      const column = stream.column;

      // 1. scanners - own a whole span, may produce no token at all
      const scanner = this._scanners.find(s => s.test(stream.source, stream.cursor));

      if (scanner) {
        const { token, endCursor } = scanner.scan(stream.source, stream.cursor, this._context);
        stream.seek(endCursor);

        if (token === null) continue; // consumed whitespace / comment
        return { ...token, line: token.line ?? line, column: token.column ?? column };
      }

      // 2. content rules - first sticky match wins, in declaration order
      const matched = this._rules
        .map(rule => ({ rule, match: stream.match(rule.regex) }))
        .find(candidate => candidate.match !== undefined);

      if (!matched) throw stream.error(`Invalid character '${stream.peek()}'`);

      const raw = matched.match[0];
      let type  = matched.rule.type;

      if (type === this._tokenTypes.IDENTIFIER && isKeyword(this._keywordSet, raw)) {
        type = this._tokenTypes.KEYWORD;
      }

      stream.advance(raw.length);
      return { type, value: raw, line, column };
    }
  }
}

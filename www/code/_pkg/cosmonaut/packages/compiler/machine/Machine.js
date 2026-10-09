// @cosmonaut/cosmonaut/machine/Machine.js

// The one mechanism behind all three stages. A Machine is:
//
//   - a REGISTRY of named methods supplied by the language implementor
//   - a DISPATCH function that calls them by name
//   - a TOOLKIT namespace (`$`) of reusable building blocks
//
// The stages differ only in their prefix and their toolkit:
//
//   Lexer      'scan'   -> scanners
//   Parser     'parse'  -> @cosmonaut/parsers
//   Generator  'gen'    -> @cosmonaut/layouter
//
// Subclasses configure themselves through four statics: `prefix`, `label`,
// `toolkit` and `patterns`, plus `defaults` for option merging.

import { normalizeName, snapshotReserved } from './registry.js';

export default class Machine {

  static prefix   = 'run';
  static label    = 'Machine';
  static toolkit  = {};
  static patterns = {};
  static defaults = { methods: {} };

  // :::::: init

  constructor (options = {}) {
    const ctor = this.constructor;

    this.options  = { ...ctor.defaults, ...options };
    this._methods = {};

    // `$` is the toolkit namespace, deliberately kept OFF the instance's own
    // top-level dispatch surface. That surface is where user methods get
    // attached by name, and a grammar rule is free to be called "BinaryExpr"
    // or "List". If the built-in utilities lived at `p.parseBinaryExpr`
    // directly, registering such a rule would silently shadow the utility,
    // and any internal call to it would recurse into the user's rule instead.
    this.$ = { ...ctor.toolkit };

    for (const [name, fn] of Object.entries(ctor.patterns)) {
      this.$[name] = (...args) => fn(this, ...args);
    }

    this._buildDispatch();
    this._reserved = snapshotReserved(this);
    this._registerMethods(this.options.methods);
  }

  // :::::: Method Registration

  addMethod (key, fn) {
    this._registerMethods({ [key]: fn });
    return this;
  }

  hasMethod (name) {
    return name in this._methods;
  }

  // :::::: internal

  // Builds the stage's dispatch function - `this.parse` / `this.gen` - as a
  // real function that also carries every registered method as a property,
  // so that all of these end up equivalent:
  //
  //   p.parse('IfStatement')   p.parse.IfStatement()
  //   p.parseIfStatement()     p.IfStatement()
  _buildDispatch () {
    const { prefix, label } = this.constructor;
    const self = this;

    function dispatch (name, ...args) {
      const method = self._methods[name];
      if (!method) throw new Error(`[${label}] No "${prefix}" method registered for "${name}".`);
      return method(self, ...args);
    }

    this[prefix] = dispatch;
  }

  _registerMethods (methods = {}) {
    const { prefix, label } = this.constructor;

    for (const [key, fn] of Object.entries(methods)) {
      if (typeof fn !== 'function') continue;

      const name       = normalizeName(key, prefix, label);
      const prefixed   = prefix + name;

      if (this._reserved.has(name) || this._reserved.has(prefixed)) {
        throw new Error(
          `[${label}] Cannot register "${name}": "${prefixed}" collides with a reserved ` +
          `core property. Rename the rule or the registration key.`
        );
      }

      const bound = (...args) => fn(this, ...args);

      this._methods[name]   = fn;
      this[name]            = bound;
      this[prefixed]        = bound;
      this[prefix][name]    = bound;
    }
  }

}

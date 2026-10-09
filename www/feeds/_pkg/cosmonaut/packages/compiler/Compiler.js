// @cosmonaut/cosmonaut/Compiler.js

// The allrounder: one object, one options tree, one import.
// Owns a configured instance of each stage 
// and wires them into a pipeline, 
// while leaving every stage individually callable.

// [Lexer]     source -> tokenize -> tokens
// [Parser]    tokens -> parse    -> AST
// [Generator] AST    -> generate -> string

// The allrounder: one object, one options tree, one import. The single
// crossing point between the two levels of this toolkit -
//
//   META   defining a language   read / define      -> a spec
//   OBJECT using a language      tokenize / parse / generate / compile
//
// Everything before the constructor is meta level, everything after is
// object level. No verb appears on both sides.

import { print } from '@cosmonaut/layouter';

import Lexer     from './stages/Lexer.js';
import Parser    from './stages/Parser.js';
import Generator from './stages/Generator.js';

export default class Cosmonaut {

  // `spec` describes what the language IS - tokens, grammar, structure.
  // `target` describes what it compiles TO, and is a separate axis on
  // purpose: one spec, many targets. A target is a function of the spec,
  // so it can derive things from it (operator precedence, keyword lists)
  // instead of loading the spec a second time on its own.
  //
  // lexer / parser / generator / layout override the spec piecewise, for
  // the common case of "this language, but with one thing changed".
  constructor ({ spec = {}, target = null, lexer, parser, generator, layout } = {}) {
    this.spec         = spec;
    this.target       = typeof target === 'function' ? target(spec) : (target ?? {});
    this.printOptions = { ...this.target.layout, ...layout };
    this.lexer        = new Lexer('', { ...spec.lexer, ...lexer });
    this.parser       = new Parser({ ...spec.parser, ...parser });
    this.generator    = new Generator({
      methods : this.target.methods,
      ...generator,
      printOptions : this.printOptions,
    });
  }

  // :::::: Stages
  //
  // Bound as fields, not prototype methods, so they survive being pulled
  // off the instance - `const { compile } = cosmo` has to keep working,
  // that is how a worker or a plugin receives just the one function it needs.

  tokenize = source => {
    this.lexer.setSource(source);
    return this.lexer.tokenize();
  };

  parse = source => this.parser.run(this.tokenize(source));

  // A target may define `entry` to handle whatever parse() returned as a
  // whole - a preamble, a joiner between top-level statements, a trailing
  // newline. It is required whenever the grammar's root production is
  // transparent and yields an array rather than a single node, which is
  // the normal case.
  generate = (result, printOptions) => {
    const doc = this.target.entry
      ? this.target.entry(this.generator, result)
      : this.generator.genNode(result);

    return print(doc, { ...this.printOptions, ...printOptions });
  };

  // :::::: Pipeline

  compile = source => this.generate(this.parse(source));

}

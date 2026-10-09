// @cosmonaut/cosmonaut/presets/commons.js

// :::::: Comment Styles

export const commonStyleComments = [
  { type: 'line', start: '//' },
  { type: 'line', start: '#' },
  { type: 'block', start: '/*', end: '*/' },
];
export const cStyleComments = [
  { type: 'line', start: '//' }, 
  { type: 'block', start: '/*', end: '*/' }
];
export const hashStyleComments = [
  { type: 'line', start: '#' }
];
export const dashStyleComments = [
  { type: 'line', start: '--' }
];
export const pythonStyleComments = [
  { type: 'line', start: '#' },
  { type: 'block', start: "'''", end: "'''" },
  { type: 'block', start: '"""', end: '"""' },
];

// :::::: Basic Content Rules
// rules: { use: [baseRules.doubleQuoteString, baseRules.number, baseRules.identifier], override: { number: myOwnNumberRule } }

export const baseRules = {
  doubleQuoteString : { id: 'doubleQuoteString', type: 'STRING',     regex: /"(?:\\.|[^"\\])*"/        },
  singleQuoteString : { id: 'singleQuoteString', type: 'STRING',     regex: /'(?:\\.|[^'\\])*'/        },
  number            : { id: 'number',            type: 'NUMBER',     regex: /\d+(?:\.\d+)?/            },
  identifier        : { id: 'identifier',        type: 'IDENTIFIER', regex: /[a-zA-Z_$][a-zA-Z0-9_$]*/ },
};

// :::::: Common

export const commonPuncts = '()[]{}?!.:,;';
export const commonTokens = ['COMMENT','EOF','IDENTIFIER','KEYWORD','NUMBER','OPERATOR','PUNCT','STRING'];

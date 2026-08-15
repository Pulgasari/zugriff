// shared/js/components/code.js
//
// the syntax highlighted panes. kept out of index.js because they pull in
// highlight.js — only apps that actually show code should pay for it.
// they also need the opt-in stylesheets:
//   <link rel="stylesheet" href="./../../shared/css/panes.css">
//   <link rel="stylesheet" href="./../../shared/css/hljs.css">

export { default as CodeInputPane  } from './CodeInputPane.js';
export { default as CodeOutputPane } from './CodeOutputPane.js';
export { hljs, ensureLang }          from './hljs.js';

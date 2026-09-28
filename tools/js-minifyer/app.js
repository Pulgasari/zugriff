// tools/js-minifyer/app.js

import defineTool from '/.shared/js/tool.js';
import { CodeWorkbenchApp } from '/.shared/js/blueprints/index.js';
import { minify } from 'terser';

const { boot } = defineTool('js-minifyer');

const App = CodeWorkbenchApp({
  appID       : 'js-minifyer',
  lang        : 'javascript',
  langExt     : 'js',
  actionLabel : 'Minify',
  placeholder : 'Paste JavaScript here…',
  execute     : async src => (await minify(src, { compress: true, mangle: true })).code,
});

boot({ App });

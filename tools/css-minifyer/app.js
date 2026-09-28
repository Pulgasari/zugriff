// tools/css-minifyer/app.js

import defineTool from '/.shared/js/tool.js';
import { CodeWorkbenchApp } from '/.shared/js/blueprints/index.js';
import { minify } from 'csso';

const { boot } = defineTool('css-minifyer');

const App = CodeWorkbenchApp({
  appID       : 'css-minifyer',
  lang        : 'css',
  langExt     : 'css',
  actionLabel : 'Minify',
  placeholder : 'Paste CSS here …',
  execute     : src => minify(src).css,
});

boot({ App });

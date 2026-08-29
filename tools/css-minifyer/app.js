// tools/css-minifyer/app.js

import { boot, config } from './../../.shared/js/app.js?slug=css-minifyer';
import { CodeTransformerApp } from './../../.shared/js/patterns/index.js';
import { minify } from 'csso';

const App = CodeTransformerApp({
  appID       : 'css-minifyer',
  lang        : 'css',
  langExt     : 'css',
  actionLabel : 'Minify',
  placeholder : 'Paste CSS here …',
  execute     : src => minify(src).css,
});

boot({ config, App });

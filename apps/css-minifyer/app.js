// apps/css-minifyer/app.js

import { boot } from './../../shared/js/app.js';
import { CodeTransformerApp } from './../../shared/js/patterns/index.js';
import { minify } from 'csso';
import * as config from './app.config.js';

const App = CodeTransformerApp({
  appID       : 'css-minifyer',
  lang        : 'css',
  langExt     : 'css',
  actionLabel : 'Minify',
  placeholder : 'Paste CSS here …',
  execute     : src => minify(src).css,
});

boot({ config, App });

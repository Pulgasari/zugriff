// apps/js-minifyer/app.js

import { boot } from './../../shared/js/app.js';
import { CodeTransformerApp } from './../../shared/js/patterns/index.js';
import { minify } from 'terser';
import * as config from './app.config.js';

const App = CodeTransformerApp({
  appID       : 'js-minifyer',
  lang        : 'javascript',
  langExt     : 'js',
  actionLabel : 'Minify',
  placeholder : 'Paste JavaScript here…',
  execute     : async src => (await minify(src, { compress: true, mangle: true })).code,
});

boot({ config, App });

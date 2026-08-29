// tools/js-minifyer/app.js

import { boot, config } from './../../.shared/js/app.js?slug=js-minifyer';
import { CodeTransformerApp } from './../../.shared/js/patterns/index.js';
import { minify } from 'terser';

const App = CodeTransformerApp({
  appID       : 'js-minifyer',
  lang        : 'javascript',
  langExt     : 'js',
  actionLabel : 'Minify',
  placeholder : 'Paste JavaScript here…',
  execute     : async src => (await minify(src, { compress: true, mangle: true })).code,
});

boot({ config, App });

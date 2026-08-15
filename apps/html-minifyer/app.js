// apps/html-minifyer/app.js

import { boot } from './../../shared/js/app.js';
import { CodeTransformerApp } from './../../shared/js/patterns/index.js';
import { minify } from 'html-minifier-terser';
import * as config from './app.config.js';

const App = CodeTransformerApp({
  appID       : 'html-minifyer',
  lang        : 'xml',
  langExt     : 'html',
  actionLabel : 'Minify',
  placeholder : 'Paste HTML here …',
  execute     : src => minify(src, {
    collapseWhitespace            : true,
    removeComments                : true,
    removeRedundantAttributes     : true,
    removeScriptTypeAttributes    : true,
    removeStyleLinkTypeAttributes : true,
    minifyCSS                     : true,
    minifyJS                      : true,
  }),
});

boot({ config, App });

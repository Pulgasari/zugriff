// tools/html-minifyer/app.js

import { boot, config } from '/.shared/js/app.js?slug=html-minifyer';
import { CodeTransformerApp } from '/.shared/js/patterns/index.js';
import { minify } from 'html-minifier-terser';

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

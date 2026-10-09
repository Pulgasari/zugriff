// tools :: views/html-minifyer.js

import { CodeWorkbenchApp } from '/.shared/js/blueprints/index.js';
import { minify } from 'html-minifier-terser';

const App = CodeWorkbenchApp({
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

export default App;

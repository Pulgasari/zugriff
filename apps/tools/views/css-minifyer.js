// tools :: views/css-minifyer.js

import { CodeWorkbenchApp } from '/.shared/js/blueprints/index.js';
import { minify } from 'csso';

const App = CodeWorkbenchApp({
  appID       : 'css-minifyer',
  lang        : 'css',
  langExt     : 'css',
  actionLabel : 'Minify',
  placeholder : 'Paste CSS here …',
  execute     : src => minify(src).css,
});

export default App;

// tools :: views/js-minifyer.js

import { CodeWorkbenchApp } from '/.shared/js/blueprints/index.js';
import { minify } from 'terser';

const App = CodeWorkbenchApp({
  appID       : 'js-minifyer',
  lang        : 'javascript',
  langExt     : 'js',
  actionLabel : 'Minify',
  placeholder : 'Paste JavaScript here…',
  execute     : async src => (await minify(src, { compress: true, mangle: true })).code,
});

export default App;

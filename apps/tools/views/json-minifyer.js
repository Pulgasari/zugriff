// tools :: views/json-minifyer.js

import { CodeWorkbenchApp } from '/.shared/js/blueprints/index.js';

const App = CodeWorkbenchApp({
  appID       : 'json-minifyer',
  lang        : 'json',
  langExt     : 'json',
  actionLabel : 'Minify',
  placeholder : 'Paste JSON here…',
  execute     : src => JSON.stringify(JSON.parse(src)),
});

export default App;

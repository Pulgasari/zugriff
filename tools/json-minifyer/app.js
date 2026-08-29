// tools/json-minifyer/app.js

import { boot, config } from './../../.shared/js/app.js?slug=json-minifyer';
import { CodeTransformerApp } from './../../.shared/js/patterns/index.js';

const App = CodeTransformerApp({
  appID       : 'json-minifyer',
  lang        : 'json',
  langExt     : 'json',
  actionLabel : 'Minify',
  placeholder : 'Paste JSON here…',
  execute     : src => JSON.stringify(JSON.parse(src)),
});

boot({ config, App });

// tools/json-minifyer/app.js

import { boot } from './../../shared/js/app.js';
import { CodeTransformerApp } from './../../shared/js/patterns/index.js';
import * as config from './app.config.js';

const App = CodeTransformerApp({
  appID       : 'json-minifyer',
  lang        : 'json',
  langExt     : 'json',
  actionLabel : 'Minify',
  placeholder : 'Paste JSON here…',
  execute     : src => JSON.stringify(JSON.parse(src)),
});

boot({ config, App });

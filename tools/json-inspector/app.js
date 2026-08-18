// tools/json-inspector/app.js

import { boot } from './../../shared/js/app.js';
import { DataInspectorApp } from './../../shared/js/patterns/index.js';
import * as config from './app.config.js';

const App = DataInspectorApp({
  appID       : 'json-inspector',
  lang        : 'json',
  icon        : 'mdi:code-json',
  placeholder : 'Paste JSON here …',
  parse       : src  => JSON.parse(src),
  format      : data => JSON.stringify(data, null, 2),
  emptyIcon   : 'mdi:code-json',
  emptyLabel  : 'Paste JSON and click Inspect',
});

boot({ config, App });

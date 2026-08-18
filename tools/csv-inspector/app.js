// tools/csv-inspector/app.js

import { boot } from './../../shared/js/app.js';
import { DataInspectorApp } from './../../shared/js/patterns/index.js';
import { csvParse } from './../../shared/js/lib/data-converters.js';
import * as config from './app.config.js';

const App = DataInspectorApp({
  appID       : 'csv-inspector',
  lang        : 'plaintext',
  placeholder : 'Paste CSV here …',
  parse       : csvParse,
  emptyIcon   : 'mdi:table',
  emptyLabel  : 'Paste CSV and click Inspect',
});

boot({ config, App });

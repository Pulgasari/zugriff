// tools/csv-inspector/app.js

import { boot, config } from './../../shared/js/app.js?slug=csv-inspector';
import { DataInspectorApp } from './../../shared/js/patterns/index.js';
import { csvParse } from './../../shared/js/lib/data-converters.js';

const App = DataInspectorApp({
  appID       : 'csv-inspector',
  lang        : 'plaintext',
  placeholder : 'Paste CSV here …',
  parse       : csvParse,
  emptyIcon   : 'mdi:table',
  emptyLabel  : 'Paste CSV and click Inspect',
});

boot({ config, App });

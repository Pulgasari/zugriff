// tools/csv-inspector/app.js

import defineTool from '/.shared/js/tool.js';
import { DataInspectorApp } from '/.shared/js/blueprints/index.js';
import { csvParse } from '/.shared/js/vendors/data-converters.js';

const { boot } = defineTool('csv-inspector');

const App = DataInspectorApp({
  appID       : 'csv-inspector',
  lang        : 'plaintext',
  placeholder : 'Paste CSV here …',
  parse       : csvParse,
  emptyIcon   : 'mdi:table',
  emptyLabel  : 'Paste CSV and click Inspect',
});

boot({ App });

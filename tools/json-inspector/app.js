// tools/json-inspector/app.js

import defineTool from '/.shared/js/tool.js';
import { DataInspectorApp } from '/.shared/js/blueprints/index.js';

const { boot } = defineTool('json-inspector');

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

boot({ App });

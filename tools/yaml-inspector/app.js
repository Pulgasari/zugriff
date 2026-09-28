// tools/yaml-inspector/app.js

import defineTool from '/.shared/js/tool.js';
import { DataInspectorApp } from '/.shared/js/blueprints/index.js';
import { parse, stringify } from 'yaml';

const { boot } = defineTool('yaml-inspector');

const App = DataInspectorApp({
  appID       : 'yaml-inspector',
  lang        : 'yaml',
  placeholder : 'Paste YAML here …',
  parse       : src  => parse(src),
  format      : data => stringify(data),
  emptyIcon   : 'mdi:file-code-outline',
  emptyLabel  : 'Paste YAML and click Inspect',
});

boot({ App });

// tools/yaml-inspector/app.js

import { boot, config } from './../../shared/js/app.js?slug=yaml-inspector';
import { DataInspectorApp } from './../../shared/js/patterns/index.js';
import { parse, stringify } from 'yaml';

const App = DataInspectorApp({
  appID       : 'yaml-inspector',
  lang        : 'yaml',
  placeholder : 'Paste YAML here …',
  parse       : src  => parse(src),
  format      : data => stringify(data),
  emptyIcon   : 'mdi:file-code-outline',
  emptyLabel  : 'Paste YAML and click Inspect',
});

boot({ config, App });

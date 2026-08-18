// tools/yaml-inspector/app.js

import { boot } from './../../shared/js/app.js';
import { DataInspectorApp } from './../../shared/js/patterns/index.js';
import { parse, stringify } from 'yaml';
import * as config from './app.config.js';

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

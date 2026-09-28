// tools/toml-inspector/app.js

import defineTool from '/.shared/js/tool.js';
import { DataInspectorApp } from '/.shared/js/blueprints/index.js';
import { parse } from 'smol-toml';

const { boot } = defineTool('toml-inspector');

const App = DataInspectorApp({
  appID       : 'toml-inspector',
  lang        : 'toml',
  placeholder : 'Paste TOML here …',
  parse       : src => parse(src),
  emptyIcon   : 'mdi:file-cog-outline',
  emptyLabel  : 'Paste TOML and click Inspect',
});

boot({ App });

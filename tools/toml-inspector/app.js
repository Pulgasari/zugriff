// tools/toml-inspector/app.js

import { boot, config } from '/.shared/js/app.js?slug=toml-inspector';
import { DataInspectorApp } from '/.shared/js/patterns/index.js';
import { parse } from 'smol-toml';

const App = DataInspectorApp({
  appID       : 'toml-inspector',
  lang        : 'toml',
  placeholder : 'Paste TOML here …',
  parse       : src => parse(src),
  emptyIcon   : 'mdi:file-cog-outline',
  emptyLabel  : 'Paste TOML and click Inspect',
});

boot({ config, App });

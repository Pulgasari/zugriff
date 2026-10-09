// tools :: views/toml-inspector.js

import { DataInspectorApp } from '/.shared/js/blueprints/index.js';
import { parse } from 'smol-toml';

const App = DataInspectorApp({
  appID       : 'toml-inspector',
  lang        : 'toml',
  placeholder : 'Paste TOML here …',
  parse       : src => parse(src),
  emptyIcon   : 'mdi:file-cog-outline',
  emptyLabel  : 'Paste TOML and click Inspect',
});

export default App;

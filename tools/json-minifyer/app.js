// tools/json-minifyer/app.js

import defineTool from '/.shared/js/tool.js';
import { CodeWorkbenchApp } from '/.shared/js/blueprints/index.js';

const { boot } = defineTool('json-minifyer');

const App = CodeWorkbenchApp({
  appID       : 'json-minifyer',
  lang        : 'json',
  langExt     : 'json',
  actionLabel : 'Minify',
  placeholder : 'Paste JSON here…',
  execute     : src => JSON.stringify(JSON.parse(src)),
});

boot({ App });

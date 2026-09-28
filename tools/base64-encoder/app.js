// tools/base64-encoder/app.js

import defineTool from '/.shared/js/tool.js';
import { CodeWorkbenchApp } from '/.shared/js/blueprints/index.js';

const { boot } = defineTool('base64-encoder');

const App = CodeWorkbenchApp({
  appID       : 'base64-encoder',
  lang        : 'plaintext',
  langExt     : 'txt',
  actionLabel : 'Encode',
  placeholder : 'Paste text here …',
  execute     : src => btoa(String.fromCharCode(...new TextEncoder().encode(src))),
});

boot({ App });

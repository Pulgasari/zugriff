// tools/base64-encoder/app.js

import { boot, config } from './../../.shared/js/app.js?slug=base64-encoder';
import { CodeTransformerApp } from './../../.shared/js/patterns/index.js';

const App = CodeTransformerApp({
  appID       : 'base64-encoder',
  lang        : 'plaintext',
  langExt     : 'txt',
  actionLabel : 'Encode',
  placeholder : 'Paste text here …',
  execute     : src => btoa(String.fromCharCode(...new TextEncoder().encode(src))),
});

boot({ config, App });

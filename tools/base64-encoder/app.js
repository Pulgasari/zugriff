// tools/base64-encoder/app.js

import { boot } from './../../shared/js/app.js';
import { CodeTransformerApp } from './../../shared/js/patterns/index.js';
import * as config from './app.config.js';

const App = CodeTransformerApp({
  appID       : 'base64-encoder',
  lang        : 'plaintext',
  langExt     : 'txt',
  actionLabel : 'Encode',
  placeholder : 'Paste text here …',
  execute     : src => btoa(String.fromCharCode(...new TextEncoder().encode(src))),
});

boot({ config, App });

// tools/base64-encoder/app.js

import { boot } from './../../shared/js/app.js';
import { CodeTransformerApp } from './../../shared/js/patterns/index.js';
import config from './../registry.js?id=base64-encoder';

const App = CodeTransformerApp({
  appID       : 'base64-encoder',
  lang        : 'plaintext',
  langExt     : 'txt',
  actionLabel : 'Encode',
  placeholder : 'Paste text here …',
  execute     : src => btoa(String.fromCharCode(...new TextEncoder().encode(src))),
});

boot({ config, App });

// tools :: views/base64-encoder.js

import { CodeWorkbenchApp } from '/.shared/js/blueprints/index.js';

const App = CodeWorkbenchApp({
  appID       : 'base64-encoder',
  lang        : 'plaintext',
  langExt     : 'txt',
  actionLabel : 'Encode',
  placeholder : 'Paste text here …',
  execute     : src => btoa(String.fromCharCode(...new TextEncoder().encode(src))),
});

export default App;

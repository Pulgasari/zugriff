// tools :: views/base64-decoder.js

import { CodeWorkbenchApp } from '/.shared/js/blueprints/index.js';

const App = CodeWorkbenchApp({
  appID       : 'base64-decoder',
  lang        : 'plaintext',
  langExt     : 'txt',
  actionLabel : 'Decode',
  placeholder : 'Paste Base64 here …',
  execute     : src => new TextDecoder().decode(
    Uint8Array.from(atob(src.trim()), char => char.charCodeAt(0))
  ),
});

export default App;

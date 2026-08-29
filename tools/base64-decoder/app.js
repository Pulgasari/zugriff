// tools/base64-decoder/app.js

import { boot, config } from './../../.shared/js/app.js?slug=base64-decoder';
import { CodeTransformerApp } from './../../.shared/js/patterns/index.js';

const App = CodeTransformerApp({
  appID       : 'base64-decoder',
  lang        : 'plaintext',
  langExt     : 'txt',
  actionLabel : 'Decode',
  placeholder : 'Paste Base64 here …',
  execute     : src => new TextDecoder().decode(
    Uint8Array.from(atob(src.trim()), char => char.charCodeAt(0))
  ),
});

boot({ config, App });

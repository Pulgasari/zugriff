// tools/xml-minifyer/app.js

import { boot, config } from './../../.shared/js/app.js?slug=xml-minifyer';
import { CodeTransformerApp } from './../../.shared/js/patterns/index.js';

const App = CodeTransformerApp({
  appID       : 'xml-minifyer',
  lang        : 'xml',
  langExt     : 'xml',
  actionLabel : 'Minify',
  placeholder : 'Paste XML here …',
  execute     : src => {
    const doc = new DOMParser().parseFromString(src, 'application/xml');
    const err = doc.querySelector('parsererror');
    if (err) throw new Error(err.textContent);
    return new XMLSerializer().serializeToString(doc).replace(/>\s+</g, '><').trim();
  },
});

boot({ config, App });

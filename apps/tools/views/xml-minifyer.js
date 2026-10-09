// tools :: views/xml-minifyer.js

import { CodeWorkbenchApp } from '/.shared/js/blueprints/index.js';

const App = CodeWorkbenchApp({
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

export default App;

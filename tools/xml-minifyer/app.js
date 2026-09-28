// tools/xml-minifyer/app.js

import defineTool from '/.shared/js/tool.js';
import { CodeWorkbenchApp } from '/.shared/js/blueprints/index.js';

const { boot } = defineTool('xml-minifyer');

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

boot({ App });

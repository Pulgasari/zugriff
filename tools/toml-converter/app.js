// tools/toml-converter/app.js

import defineTool from '/.shared/js/tool.js';
import { CodeWorkbenchApp } from '/.shared/js/blueprints/index.js';
import { convert } from '/.shared/js/vendors/data-converters.js';

const { boot } = defineTool('toml-converter');

const App = CodeWorkbenchApp({
  appID       : 'toml-converter',
  inputLang   : 'toml',
  inputExt    : 'toml',
  placeholder : 'Paste TOML here…',
  actionLabel : 'Convert',
  formats : [
    { id: 'csv',  label: 'CSV',  lang: 'plaintext',  ext: 'csv'  },
    { id: 'json', label: 'JSON', lang: 'json',       ext: 'json' },
    { id: 'yaml', label: 'YAML', lang: 'yaml',       ext: 'yaml' },
    { id: 'js',   label: 'JS',   lang: 'javascript', ext: 'js'   },
  ],
  execute     : (src, fmt) => convert(src, 'toml', fmt),
});

boot({ App });

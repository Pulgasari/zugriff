// tools :: views/toml-converter.js

import { CodeWorkbenchApp } from '/.shared/js/blueprints/index.js';
import { convert } from '/.shared/js/vendors/data-converters.js';

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

export default App;

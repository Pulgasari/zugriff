// tools :: views/yaml-converter.js

import { CodeWorkbenchApp } from '/.shared/js/blueprints/index.js';
import { convert } from '/.shared/js/vendors/data-converters.js';

const App = CodeWorkbenchApp({
  appID       : 'yaml-converter',
  inputLang   : 'yaml',
  inputExt    : 'yaml',
  placeholder : 'Paste YAML here…',
  actionLabel : 'Convert',
  formats : [
    { id: 'csv',  label: 'CSV',  lang: 'plaintext',  ext: 'csv'  },
    { id: 'json', label: 'JSON', lang: 'json',       ext: 'json' },
    { id: 'toml', label: 'TOML', lang: 'toml',       ext: 'toml' },
    { id: 'js',   label: 'JS',   lang: 'javascript', ext: 'js'   },
  ],
  execute     : (src, fmt) => convert(src, 'yaml', fmt),
});

export default App;

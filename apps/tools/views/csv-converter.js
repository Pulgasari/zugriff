// tools :: views/csv-converter.js

import { CodeWorkbenchApp } from '/.shared/js/blueprints/index.js';
import { convert } from '/.shared/js/vendors/data-converters.js';

const App = CodeWorkbenchApp({
  appID       : 'csv-converter',
  inputLang   : 'plaintext',
  inputExt    : 'csv',
  placeholder : 'Paste CSV here…',
  actionLabel : 'Convert',
  formats : [
    { id: 'json', label: 'JSON', lang: 'json',       ext: 'json' },
    { id: 'yaml', label: 'YAML', lang: 'yaml',       ext: 'yaml' },
    { id: 'toml', label: 'TOML', lang: 'toml',       ext: 'toml' },
    { id: 'js',   label: 'JS',   lang: 'javascript', ext: 'js'   },
  ],
  execute     : (src, fmt) => convert(src, 'csv', fmt),
});

export default App;

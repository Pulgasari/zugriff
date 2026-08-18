// tools/csv-converter/app.js

import { boot } from './../../shared/js/app.js';
import { CodeConverterApp } from './../../shared/js/patterns/index.js';
import { convert } from './../../shared/js/lib/data-converters.js';
import * as config from './app.config.js';

const App = CodeConverterApp({
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

boot({ config, App });

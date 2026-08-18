// tools/json-converter/app.js

import { boot } from './../../shared/js/app.js';
import { CodeConverterApp } from './../../shared/js/patterns/index.js';
import { convert } from './../../shared/js/lib/data-converters.js';
import * as config from './app.config.js';

const App = CodeConverterApp({
  appID       : 'json-converter',
  inputLang   : 'json',
  inputExt    : 'json',
  placeholder : 'Paste JSON here…',
  actionLabel : 'Convert',
  formats : [
    { id: 'csv',  label: 'CSV',  lang: 'plaintext',  ext: 'csv'  },
    { id: 'yaml', label: 'YAML', lang: 'yaml',       ext: 'yaml' },
    { id: 'toml', label: 'TOML', lang: 'toml',       ext: 'toml' },
    { id: 'js',   label: 'JS',   lang: 'javascript', ext: 'js'   },
  ],
  execute     : (src, fmt) => convert(src, 'json', fmt),
});

boot({ config, App });

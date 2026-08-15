// apps/toml-converter/app.js

import { boot } from './../../shared/js/app.js';
import { CodeConverterApp } from './../../shared/js/patterns/index.js';
import { convert } from './../../shared/js/lib/data-converters.js';
import * as config from './app.config.js';

const App = CodeConverterApp({
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

boot({ config, App });

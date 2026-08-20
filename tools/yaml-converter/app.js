// tools/yaml-converter/app.js

import { boot, config } from './../../shared/js/app.js?slug=yaml-converter';
import { CodeConverterApp } from './../../shared/js/patterns/index.js';
import { convert } from './../../shared/js/lib/data-converters.js';

const App = CodeConverterApp({
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

boot({ config, App });

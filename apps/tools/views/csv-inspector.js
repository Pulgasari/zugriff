// tools :: views/csv-inspector.js

import { DataInspectorApp } from '/.shared/js/blueprints/index.js';
import { csvParse } from '/.shared/js/vendors/data-converters.js';

const App = DataInspectorApp({
  appID       : 'csv-inspector',
  lang        : 'plaintext',
  placeholder : 'Paste CSV here …',
  parse       : csvParse,
  emptyIcon   : 'mdi:table',
  emptyLabel  : 'Paste CSV and click Inspect',
});

export default App;

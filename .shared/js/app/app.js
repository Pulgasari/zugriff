// .shared/js/app/app.js
// (ersetzt später direkt: .shared/js/app.js)

import config from './app/config.js';
import state  from './app/state.js';

const app = { config, state };

// :::::: EXPORT

export       { app };
export default app;

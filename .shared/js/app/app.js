// .shared/js/app/app.js
// (ersetzt später direkt: .shared/js/app.js)
/*
ziel ist es, die wiederkehrenden muster des handlings der app-states
zu vereinheitlichen das management der jeweiligen `app.js` files
der einzelnen apps massiv zu vereinfachen.

zugriff.app.state.font = 'Inter';
zugriff.app.setState('font', 'Inter');
*/

import config from './app/config.js';
import state  from './app/state.js';

// :::::: API

const app = { config, state };
app.slug = new URL(import.meta.url).searchParams.get('slug');

app.setDialog = id => app.state.dialog = id;
app.setRoute  = id => app.state.route  = id;

app.setState    = (key, value) => app.state[key] = value;
app.toggleState = (key, force) => app.state[key] = force ?? app.state[key];

app.togglePanel = id => document.getElementById(id).classList.toggleClass('hidden');    

// :::::: EXPORT

export       { app };
export default app;




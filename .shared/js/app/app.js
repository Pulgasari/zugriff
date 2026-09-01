// .shared/js/app/app.js
// (ersetzt später direkt: .shared/js/app.js)

import config from './app/config.js';
import state  from './app/state.js';

const app = { config, state };

// :::::: EXPORT

export       { app };
export default app;


app.setDir  = value => app.state.dir  = value;
app.setFont = id    => app.state.font = id;

app.setDialog = id => app.state.dialog = id;
app.setRoute  = id => app.state.route  = id;

app.togglePanel = id => document.getElementById(id).classList.toggleClass('hidden');

app.setState    = (key, value) => app.state[key] = value;
app.toggleState = (key, force) => app.state[key] = force ?? app.state[key];


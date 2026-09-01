// .shared/js/app/app.js
// (ersetzt später direkt: .shared/js/app.js)
/*
ziel ist es, die wiederkehrenden muster des handlings der app-states
zu vereinheitlichen das management der jeweiligen `app.js` files
der einzelnen apps massiv zu vereinfachen.

zugriff.app.state.font = 'Inter';
zugriff.app.setState('font', 'Inter');
*/

import config   from './app/config.js';
import state    from './app/state.js';
import * as pwa from './app/pwa.js';

import aufbau, { html, preact } from '@aufbau/kits/preact-htm';
import Shell  from './components/Shell.js';

// :::::: API

const app = { config, state };
app.slug = new URL(import.meta.url).searchParams.get('slug');

app.setDialog = id => app.state.dialog = id;
app.setRoute  = id => app.state.route  = id;

app.setState    = (key, value) => app.state[key] = value;
app.toggleState = (key, force) => app.state[key] = force ?? app.state[key];
app.resetState  = (key)        => app.state[key] = (key in app.config) ? app.config[key] : null;

app.togglePanel = id => document.getElementById(id).classList.toggleClass('hidden');    

// pwa
app.canInstall    = pwa.canInstall;
app.isInstalled   = pwa.isInstalled;
app.promptInstall = pwa.promptInstall;

// vormals 'boot'
app.init = ({ App, target = '#app', shell } = {}) => {
  shell =?? (config.type === 'tool');

  await aufbau.init(config.aufbau);

  const $target = typeof target === 'string' ? document.querySelector(target) : target;
  const $app    = useShell ? html`<${Shell} app=${app.state}><${App} /><${Shell}>` : html`<${App} />`;  
  
  if (App) preact.render($app, $target);
}

// :::::: EXPORT

export       { app };
export default app;








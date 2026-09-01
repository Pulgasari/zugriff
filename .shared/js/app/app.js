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





// shared/js/app.js

import aufbau, { html, render } from '@aufbau/kits/preact-htm';
import Shell        from './components/Shell.js';
import { registry } from './registry.js';
import './runtime.js'; // enable globalThis.zugriff

const $root = document.documentElement;

// ── this page's config, from ?slug=… on our own module url ───────────────────

const slug = new URL(import.meta.url).searchParams.get('slug');

/** the resolved registry entry for the page that imported this module, or {} */
export const config = (slug && registry.get(slug)) || {};

// ── url overrides ──────────────────────────────────────────────────────────
// every ?--custom-prop=value in the query string is written onto :root, 
// which is how a theme gets tweaked without touching a file. 
// values that could break out of the declaration are dropped.

const MAX_VALUE_LENGTH = 100;
const BLOCKED = /[;{}]|url\s*\(/i;

export function applyUrlProps (search = location.search) {
  for (const [key, value] of new URLSearchParams(search)) {
    if (!key.startsWith('--')) continue;
    const safe = value.trim();
    if (!safe || safe.length > MAX_VALUE_LENGTH || BLOCKED.test(safe)) continue;
    $root.style.setProperty(key, safe);
  }
}

// ── service worker ────────────────────────────────────────
function ownServiceWorker () {
  return /^\/(apps|tools)\/[^/]+\//.test(location.pathname) ? './sw.js' : '/sw.js';
}

export function registerServiceWorker (url = ownServiceWorker()) {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol === 'file:') return;

  // a module worker, because sw-core.js imports @bunker by url 
  // — import maps do not reach inside a service worker
  const register = () => navigator.serviceWorker.register(url, { type: 'module' }).catch(
    error => console.warn('[zugriff] service worker registration failed:', error)
  );

  // boot() is async, so `load` has usually fired by the time we get here —
  // waiting for an event that already happened would register nothing at all
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}

// ── boot ───────────────

export async function boot ({
  config: cfg = config, // defaults to this page's ?slug= entry
  App,
  mount = '#app',
  serviceWorker = true,
  shell, // undefined → decide from the entry's type
} = {}) {
  const app          = cfg ?? {};
  const aufbauConfig = app.aufbau ?? {};
  const useShell     = shell ?? (app.type !== 'app');

  if (app.name)  document.title      = app.title ?? app.name;
  if (app.theme) $root.dataset.theme = app.theme;
  if (app.lang)  $root.lang          = app.lang;

  applyUrlProps();

  await aufbau.init(aufbauConfig);

  //if (serviceWorker) registerServiceWorker();

  const target = typeof mount === 'string' ? document.querySelector(mount) : mount;
  if (!target) throw new Error(`[zugriff] mount target "${mount}" not found`);

  if (App) {
    render(
      useShell ? html`<${Shell} app=${app}><${App} /><//>` : html`<${App} />`,
      target
    );
  }

  return { aufbau, target };
}

export default boot;


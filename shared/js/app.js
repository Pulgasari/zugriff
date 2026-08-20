// shared/js/app.js
//
// the app shell. this is what the php template used to do on the server:
// set up the document, boot the runtime, register the service worker and mount
// the app.
//
//   import { boot } from './../../shared/js/app.js';
//   import * as config from './app.config.js';
//   boot({ config, App });

import aufbau, { html, render } from '@aufbau/kits/preact-htm';
import Shell from './components/Shell.js';

// ── url overrides ──────────────────────────────────────────────────────────
// every ?--custom-prop=value in the query string is written onto :root, which
// is how a theme gets tweaked without touching a file. values that could break
// out of the declaration are dropped.

const MAX_VALUE_LENGTH = 100;
const BLOCKED = /[;{}]|url\s*\(/i;

export function applyUrlProps (search = location.search) {
  const root = document.documentElement;

  for (const [key, value] of new URLSearchParams(search)) {
    if (!key.startsWith('--')) continue;
    const safe = value.trim();
    if (!safe || safe.length > MAX_VALUE_LENGTH || BLOCKED.test(safe)) continue;
    root.style.setProperty(key, safe);
  }
}

// ── service worker ─────────────────────────────────────────────────────────

export function registerServiceWorker (url = './sw.js') {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol === 'file:') return;

  // a module worker, because sw-core.js imports @bunker by url — import maps
  // do not reach inside a service worker
  const register = () => navigator.serviceWorker.register(url, { type: 'module' }).catch(
    error => console.warn('[zugriff] service worker registration failed:', error)
  );

  // boot() is async, so `load` has usually fired by the time we get here —
  // waiting for an event that already happened would register nothing at all
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}

// ── boot ───────────────────────────────────────────────────────────────────

export async function boot ({
  config = {},
  App,
  mount = '#app',
  serviceWorker = true,
  shell = true,
} = {}) {
  //const { app = {}, aufbau: aufbauConfig = {} } = config;
  //const { app = {} } = config;
  const app = config;
  const aufbauConfig = app.aufbau;
  

  if (app.name)  document.title = app.title ?? app.name;
  if (app.theme) document.documentElement.dataset.theme = app.theme;
  if (app.lang)  document.documentElement.lang = app.lang;

  applyUrlProps();

  await aufbau.init(aufbauConfig);

  if (serviceWorker) registerServiceWorker();

  const target = typeof mount === 'string' ? document.querySelector(mount) : mount;
  if (!target) throw new Error(`[zugriff] mount target "${mount}" not found`);

  if (App) {
    render(
      shell ? html`<${Shell} app=${app}><${App} /><//>` : html`<${App} />`,
      target
    );
  }

  return { aufbau, target };
}

export default boot;

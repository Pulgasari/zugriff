// .shared/js/app.js
// the app factory behind zugriff.app. a page opens with
//
//   const app = zugriff.app('notes');
//
// which resolves that slug's registry entry, builds its reactive state and hands
// back the app handle. one instance per slug (a page is one app), so repeat calls
// are idempotent. the goal is to collapse each app's app.js boilerplate: state,
// its cross-cutting effects and the mount all live here, not in every app.
//
//   app.state.font = 'Inter';       // reactive, drives the shared webfonts effect
//   app.setState('font', 'Inter');  // same, imperative form
//   app.init({ App });              // mount (replaces the old boot())

/*
// :::::: IMPORTS

import { createState } from './app/state.js';
import { toast }       from './app/toast.js';
import * as pwa        from './app/pwa.js';

import { registry } from './data/apps.js';
import { aufbau, html, render } from './vendors.js';
import Shell from './components/Shell.js';

// :::::: CONFIG
// resolve a page's registry entry by slug (zugriff.app('notes')). a miss yields {}
// so a slugless or unknown page still boots on the registry defaults.

const configFor = slug => (slug && registry.get(slug)) || {};

// :::::: FACTORY

const instances = new Map();

export function createApp (slug) {
  if (instances.has(slug)) return instances.get(slug);

  const config = configFor(slug);
  const state  = createState(config);

  const app = { slug, config, state, toast };

  // ::: state helpers — thin sugar over the deepSignal
  app.getState    = key          => state[key];
  app.setState    = (key, value) => state[key] = value;
  app.toggleState = (key, force) => state[key] = force ?? !state[key];
  app.resetState  = key          => state[key] = key in config ? config[key] : null;
  app.setDialog   = (id = null)  => state.dialog = id;
  app.setRoute    = (id = null)  => state.route  = id;

  // ::: pwa (install-to-home-screen), lifted straight off the shared plumbing
  app.canInstall    = pwa.canInstall;
  app.isInstalled   = pwa.isInstalled;
  app.promptInstall = pwa.promptInstall;

  // ::: mount. tools get the shared Shell frame; apps own the whole #app root
  // (shell defaults off for type:'app', on otherwise) and can force it either way.
  app.init = async ({ App, target = '#app', shell } = {}) => {
    const useShell = shell ?? config.type === 'tool';

    await aufbau.init(config.aufbau);

    const $target = typeof target === 'string' ? document.querySelector(target) : target;
    if (!$target) throw new Error(`[zugriff] mount target "${target}" not found`);

    if (App) render(useShell ? html`<${Shell} app=${config}><${App} /><//>` : html`<${App} />`, $target);

    return app;
  };

  instances.set(slug, app);
  createApp.current = app;   // the page's active app — shared components (AppSettings) read it
  return app;
}

// :::::: EXPORT

export { createApp as app };
export default createApp;
*/

// ============== NEW ========================================================

// :::::: IMPORTS

import { createState } from './app/state.js';
import { toast }       from './app/toast.js';
import * as pwa        from './app/pwa.js';

import { registry } from './data/apps.js';
import { aufbau, html, render } from './vendors.js';
import Shell from './components/Shell.js';

// import * as pwa  from './app/pwa.js';
// import { toast } from './app/toast.js';

const configFor = slug => (slug && registry.get(slug)) || {};

class App {

  constructor (slug ) {
    this.baseURL = './';
    this.slug    = slug;
    this.url     = 'https://zugriff.dev/' + slug + '/';
    this.config  = configFor(this.slug);
    this.state   = createState(this.config);
  }
  
  //url = (path) => new URL (path, this.baseURL);

  // ::: init
  init = async ({ App, target = '#app', shell } = {}) => {
    //const useShell = shell ?? config.type === 'tool';
    const useShell = false;
    await aufbau.init(config.aufbau);

    const $target = typeof target === 'string' ? document.querySelector(target) : target;
    if (!$target) throw new Error(`[zugriff] mount target "${target}" not found`);

    //if (App) render(useShell ? html`<${Shell} app=${config}><${App} /><//>` : html`<${App} />`, $target);
    if (App) render(html`<${App} />`, $target);

    return app;
  };

  // ::: state helpers — thin sugar over the deepSignal
  getState    = (key)        => this.state[key];
  setState    = (key, value) => this.state[key] = value;
  toggleState = (key, force) => this.state[key] = force ?? !this.state[key];
  resetState  = (key)        => this.state[key] = key in this.config ? this.config[key] : null;
  setDialog   = (id = null)  => this.state.dialog = id;
  setRoute    = (id = null)  => this.state.route  = id;

  // ::: import app-modules
  loadModule       = (sth)  => sth.endsWith('.js') ? this.loadModuleByPath(sth) : this.loadModuleByName(sth);     
  loadModuleByName = (name) => import(`./${name}.js`);
  loadModuleByPath = (path) => import(path);
  module = new Proxy ({}, { get: (_, name) => this.loadModuleByName(name) });

  // ::: pwa (install-to-home-screen), lifted straight off the shared plumbing
  canInstall    = pwa.canInstall;
  isInstalled   = pwa.isInstalled;
  promptInstall = pwa.promptInstall;

}

// :::::: EXPORT

export       { App };
export default App;

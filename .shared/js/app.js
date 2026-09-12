// .shared/js/app.js
// the app handle behind zugriff.app — one instance per slug (memoized in runtime.js).
// `state` is the shared reactive base (createState → an @aufbau/signals deep signal);
// an app extends it with its own leaves + effects, hangs its modules on the handle
// (app.commands, app.editor, …) and mounts with app.init({ App }). the runtime and
// the handle are the single reference point, so an app never imports the runtime.

// :::::: IMPORTS

import { effect }        from '@aufbau/signals';
import { createState }   from './app/state.js';
import { createActions } from './modules/actions.js';
import { createHotkeys } from './modules/hotkeys.js';
import { toast }         from './modules/toast.js';
import * as pwa          from './app/pwa.js';

import { registry }     from './data/apps.js';
import { html, render } from './vendors.js';

import aufbau from '@aufbau/runtime';

// :::::: HELPERS

const configFor = slug => (slug && registry.get(slug)) || {};

// a dynamic import resolves to its default export, else the whole namespace
const pick = mod => mod?.default ?? mod;

// :::::: APP

class ZugriffApp {

  constructor (slug) {
    this.slug    = slug;
    this.config  = configFor(slug);
    this.baseURL = new URL(`/${slug}/`, location.origin);   // absolute — loaders resolve against it
    this.url     = this.baseURL.href;
    this.state   = createState(this.config);
    this.toast   = toast;
    this.effect  = effect;

    // ::: behaviour registries — actions (named callbacks) + hotkeys wired to them
    this._actions = createActions();
    this._hotkeys = createHotkeys(this._actions);
  }

  // ::: loaders (app-relative). ui pieces resolve to a default export when present,
  // else the namespace: component() from ./components, view() from ./views,
  // panel() from ./panels, dialog() from ./dialogs; module() from the app root.
  import    = path => import(new URL(path, this.baseURL)).then(pick);
  component = name => this.import('components' + `/${name}.js`);
  dialog    = name => this.import('dialogs'    + `/${name}.js`);
  module    = name => this.import('modules'    + `/${name}.js`);
  panel     = name => this.import('panels'     + `/${name}.js`);
  view      = name => this.import('views'      + `/${name}.js`);
  /*
  component = name => import(new URL(`components/${name}.js`, this.baseURL)).then(pick);
  module    = name => import(new URL(`modules/${name}.js`,    this.baseURL)).then(pick);
  dialog    = name => import(new URL(`dialogs/${name}.js`,    this.baseURL)).then(pick)
  panel     = name => import(new URL(`panels/${name}.js`,     this.baseURL)).then(pick);
  view      = name => import(new URL(`views/${name}.js`,      this.baseURL)).then(pick);
  */
  // ::: actions
  get actions ()    { return this._actions; }
  set actions (obj) { for (const [id, fn] of Object.entries(obj ?? {})) this._actions.add(id, fn); }

  // ::: hotkeys
  get hotkeys ()    { return this._hotkeys; }
  set hotkeys (map) { this._hotkeys.define(map); }

  // ::: state extension — the mechanism to grow app.state and wire effects.
  // scalar/plain-data leaves land on the deep signal;
  // `effects` are plain @aufbau/signals effects the caller passes as functions.
  extend = (seed = {}, effects = []) => {
    for (const [key, value] of Object.entries(seed)) this.state[key] = value;
    for (const fn of [].concat(effects)) if (fn) effect(fn);
    return this;
  };

  // persist a deep-signal subtree (app.state[key]) as one localStorage blob under
  // `zugriff:<slug>:<key>`: hydrate first, then write back on any leaf change.
  persist = (key, storeKey = `zugriff:${this.slug}:${key}`) => {
    const node = this.state[key];
    if (!node?.$signal) return this;
    try { const saved = JSON.parse(localStorage.getItem(storeKey)); if (saved) node.$update(saved); } catch {}
    let first = true;
    effect(() => {
      const snapshot = node.$signal.value;
      if (first) { first = false; return; }   // the hydrated/seed value is already stored (or intentionally not)
      try { localStorage.setItem(storeKey, JSON.stringify(snapshot)); } catch {}
    });
    return this;
  };

  // ::: state sugar — base leaves live on the deep signal
  getState    = key          => this.state[key];
  setState    = (key, value) => this.state[key] = value;
  toggleState = (key, force) => this.state[key] = force ?? !this.state[key];
  resetState  = key          => this.state[key] = key in this.config ? this.config[key] : null;
  setDialog   = (id = null)  => this.state.dialog = id;
  setRoute    = (id = null)  => this.state.route  = id;

  // ::: modal helpers (app.state.modal drives an app's overlays)
  openModal   = id => this.state.modal = id;
  closeModal  = () => this.state.modal = null;
  toggleModal = id => this.state.modal = this.state.modal === id ? null : id;

  // ::: command dispatch (app.commands is a Map<id, { exec }>)
  exec = id => this.commands?.get(id)?.exec();

  // ::: pwa (install-to-home-screen), lifted off the shared plumbing
  canInstall    = pwa.canInstall;
  isInstalled   = pwa.isInstalled;
  promptInstall = pwa.promptInstall;

  // ::: mount. the app owns the whole #app root; App is the top-level component.
  init = async ({ App, target = '#app' } = {}) => {
    await aufbau.init(this.config.aufbau);

    const $target = typeof target === 'string' ? document.querySelector(target) : target;
    if (!$target) throw new Error(`[zugriff] mount target "${target}" not found`);

    if (App) render(html`<${App} />`, $target);
    return this;
  };

}

// :::::: EXPORT

export       { ZugriffApp };
export default ZugriffApp;

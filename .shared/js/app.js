// .shared/js/app.js

// :::::: IMPORTS

import aufbau from '@aufbau/runtime';
import { effect, signal, signalStore } from '@aufbau/signals';
import webfonts                        from '@aufbau/webfonts';
import { createDB }                    from '@bunker/db';

import { createActions } from './modules/actions.js';
import { createHotkeys } from './modules/hotkeys.js';
import { toast }         from './modules/toast.js';
import { syncBars }      from './modules/bars.js';

import { registry } from './data/apps.js';
import { themes }   from './data/themes.js';

import { html, render } from './vendors.js';

// :::::: HELPERS

const pick = mod => mod?.default ?? mod;

// :::::: PWA

const standalone = () =>
  (typeof window !== 'undefined' && (
    window.matchMedia?.('(display-mode: standalone)')?.matches ||
    window.matchMedia?.('(display-mode: window-controls-overlay)')?.matches ||
    window.navigator?.standalone === true));

const canInstall  = signal (false);
const isInstalled = signal (standalone());

let deferred = null;

if (typeof window !== 'undefined') {
  // chrome/edge/android fire this when the app meets the install criteria and
  // isn't installed yet; we stash it so a button can trigger it on demand
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferred = e;
    canInstall.value = !isInstalled.value;
  });

  window.addEventListener('appinstalled', () => {
    isInstalled.value = true;
    canInstall.value  = false;
    deferred = null;
  });

  window.matchMedia?.('(display-mode: standalone)')
    ?.addEventListener?.('change', e => {
      if (e.matches) { isInstalled.value = true; canInstall.value = false; }
    });
}

async function promptInstall () {
  if (!deferred) return false;
  const evt = deferred;
  deferred = null;
  canInstall.value = false;
  try {
    evt.prompt();
    const { outcome } = await evt.userChoice;
    return outcome === 'accepted';
  } catch {
    return false;
  }
}

// :::::: THEME

const $doc  = typeof document !== 'undefined' ? document : null;
const $root = $doc?.documentElement ?? null;

const THEME_PREFIX = 'zugriff:theme';   // :bg / :fg / :accent — read by boot.js pre-paint
const COLOR_KEYS   = ['bg', 'fg', 'accent'];

const writeColor = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };

const applyTheme = preset => {
  const palette = themes[preset];
  if (!$root || !palette) return;
  $root.dataset.theme = preset;
  for (const key of COLOR_KEYS) {
    $root.style.setProperty(`--${key}`, palette[key]);
    writeColor(`${THEME_PREFIX}:${key}`, palette[key]);
  }
  const meta = $doc.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = palette.bg;
  syncBars(palette.bg); // the native bars, inside the capacitor wrapper only
};

// :::::: APP

class ZugriffApp {

  constructor (slug) {
    this.baseURL  = new URL(`/${slug}/`, location.origin);
    this.config   = (slug && registry.get(slug)) || {};
    this.database = createDB('zugriff:' + slug);
    this.slug     = slug;
    this.state    = this.#createState();
    this.url      = this.baseURL.href;

    this.effect   = effect;
    this.toast    = toast;
    
    // ::: registries
    this._actions = createActions ();
    this._hotkeys = createHotkeys (this._actions);
  }

  // ::: state
  #createState () {
    const config = this.config;

    const state = signalStore ({
      color    : { type: 'scalar', value: config.color },
      dir      : { type: 'enum',   value: config.dir, values: ['ltr', 'rtl'] },
      font     : { type: String,   value: config.font  ?? 'Manrope' },
      lang     : { type: 'scalar', value: config.lang },
      theme    : { type: 'enum',   values: Object.keys(themes), value: config.theme ?? 'dracula' },
      title    : { type: 'scalar', value: config.title ?? config.name ?? null },
      viewport : { type: 'scalar', value: config.viewport },

      // ui-frame state every app shares — persisted too: a dialog left open reopens
      dialog : { type: 'scalar', value: null },
      route  : { type: 'scalar', value: null },
    }, {
      key     : `zugriff:${this.slug}:`, // per app, each leaf persists under it
      storage : 'local',
    });

    // pure side effects — persistence is the store's job. theme additionally
    // refreshes the boot-time colour cache (see applyTheme).
    state.$onEffects({
      dir   : value => { if ($root && value) $root.setAttribute('dir', value); },
      font  : value => { if (value) webfonts.apply(value, { role: '--font' }); },
      lang  : value => { if ($root && value) $root.lang = value; },
      theme : value => applyTheme(value),
      title : value => { if ($doc && value) $doc.title = value; },
    });

    return state;
  }

  // ::: loaders (app-relative)
  import    = path => import(new URL(path, this.baseURL)).then(pick);
  component = name => this.import('components' + `/${name}.js`);
  dialog    = name => this.import('dialogs'    + `/${name}.js`);
  module    = name => this.import('modules'    + `/${name}.js`);
  panel     = name => this.import('panels'     + `/${name}.js`);
  view      = name => this.import('views'      + `/${name}.js`);
  
  // ::: actions
  get actions ()    { return this._actions; }
  set actions (obj) { for (const [id, fn] of Object.entries(obj ?? {})) this._actions.add(id, fn); }

  // ::: hotkeys
  get hotkeys ()    { return this._hotkeys; }
  set hotkeys (map) { this._hotkeys.define(map); }

  // ::: routes. an app with a router gets setRoute rewired to keep the url in sync
  setRoute = (id = null)       => this.state.route = id;
  go       = (name, id = null) => this.state.route = { name, id };

  // ::: pwa (install-to-home-screen), lifted off the shared plumbing
  canInstall    = canInstall;
  isInstalled   = isInstalled;
  promptInstall = promptInstall;

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

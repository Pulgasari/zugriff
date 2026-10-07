// .shared/js/app.js

// :::::: IMPORTS

import aufbau                          from '@aufbau/api';
import { effect, signal, signalStore } from '@aufbau/signals';
import webfonts                        from '@aufbau/webfonts';
import { createDB }                    from '@bunker/db';

import { registry }           from './data/apps.js';
import { createActions }      from './modules/actions.js';
import { createHotkeys }      from './modules/hotkeys.js';
import { toast }              from './modules/toast.js';
import { syncBars }           from './modules/bars.js';
import { reveal, transition } from './transitions.js';
import { html, render }       from './vendors.js';

// :::::: HELPERS

const pick = mod => mod?.default ?? mod;

const splitBy    = (sep) => (str) => str.split(sep);
const segmentsOf = (str) => splitBy('/');
const popOf      = (arr) => arr.pop();

// the plural of a loader: loads all names at once, resolves to { name: export }.
// a path keeps its last segment as the key: 'folder/Name' -> Name, '@aufbau/filters' -> filters
const many = load => (...names) => Promise.all(names.map(name => load(name)))
  .then(loaded => Object.fromEntries(names.map((name, index) => [name.split('/').pop(), loaded[index]])));
/*
const _many = load => (...names) => Promise.all(names.map(load)).then(
  loaded => Object.fromEntries(
    names.map((name, index) => [name.split('/').pop(), loaded[index]])
  )
);
*/

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

const bodyReady = () => $doc.body ? Promise.resolve() : new Promise(resolve => $doc.addEventListener('DOMContentLoaded', resolve, { once: true }));

// a preset of aufbau/gestalt/palettes.css or any css color. gestalt sets --palette,
// the css derives the rest, and the resolved bg feeds what css cannot reach
const applyPalette = async palette => {
  if (!$root || !palette) return;
  await aufbau.gestalt.set({ palette });
  await bodyReady();

  const { bg } = aufbau.gestalt.colors();
  const meta   = $doc.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = bg;
  syncBars(bg); // the native bars, inside the capacitor wrapper only
};

// :::::: GESTALT COOKIE

// palette, density and geometry go into a cookie as well, scoped to the app's
// path, so middleware.js can write them into the html at the edge. boot.js sets
// the same from localStorage, the cookie only moves the first paint earlier
const GESTALT = ['density', 'geometry', 'palette'];

function writeGestaltCookie (slug, values) {
  if (!$doc || !slug) return;
  const value = new URLSearchParams(GESTALT.filter(token => values[token]).map(token => [token, values[token]])).toString();
  try   { $doc.cookie = `zugriff-gestalt=${encodeURIComponent(value)}; path=/${slug}/; max-age=31536000; samesite=lax`; }
  catch {} // a sandboxed document has no cookies, the edge then just knows nothing
}

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
      density  : { type: String,   value: config.density  ?? 'normal' },
      dir      : { type: 'enum',   value: config.dir, values: ['ltr', 'rtl'] },
      font     : { type: String,   value: config.font     ?? 'Manrope' },
      geometry : { type: String,   value: config.geometry ?? 'soft' },
      lang     : { type: 'scalar', value: config.lang },
      palette  : { type: String,   value: config.palette  ?? 'dracula' },
      skin     : { type: String,   value: config.skin     ?? 'monochrome' },
      title    : { type: 'scalar', value: config.title ?? config.name ?? null },
      viewport : { type: 'scalar', value: config.viewport },

      // ui-frame state every app shares — persisted too: a dialog left open reopens
      dialog : { type: 'scalar', value: null },
      panel  : { type: 'scalar', value: null },
      route  : { type: 'scalar', value: null },
    }, {
      key     : `zugriff:${this.slug}:`, // per app, each leaf persists under it
      storage : 'local',
    });

    // pure side effects, persistence is the store's job. boot.js reads the stored
    // palette, density and geometry before the first paint. what they change is
    // up to aufbau's gestalt, zugriff only hands the values on
    const gestalt = {};
    const remember = (token, value) => { gestalt[token] = value; writeGestaltCookie(this.slug, gestalt); };

    state.$onEffects({
      density  : value => { remember('density', value); if (value) aufbau.gestalt.set({ density: value }); },
      dir      : value => { if ($root && value) $root.setAttribute('dir', value); },
      font     : value => { if (value) webfonts.apply(value, { role: '--font' }); },
      geometry : value => { remember('geometry', value); if (value) aufbau.gestalt.set({ geometry: value }); },
      lang     : value => { if ($root && value) $root.lang = value; },
      palette  : value => { remember('palette', value); applyPalette(value); },
      skin     : value => { if (value) aufbau.gestalt.set({ skin: value }); },
      title    : value => { if ($doc && value) $doc.title = value; },
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

  components = many(this.component);
  dialogs    = many(this.dialog);
  modules    = many(this.module);
  panels     = many(this.panel);
  views      = many(this.view);
  
  // ::: actions
  get actions ()    { return this._actions; }
  set actions (obj) { for (const [id, fn] of Object.entries(obj ?? {})) this._actions.add(id, fn); }

  // ::: hotkeys
  get hotkeys ()    { return this._hotkeys; }
  set hotkeys (map) { this._hotkeys.define(map); }

  // ::: routes, each change a view transition (transitions.js). an app with a
  // router gets setRoute rewired to keep the url in sync
  setRoute = (id = null)       => transition(() => { this.state.route = id; });
  go       = (name, id = null) => transition(() => { this.state.route = { name, id }; });

  // ::: the frame. #app is the page's <app-root>, its areas and views are the app's
  get root () { return document.getElementById('app'); }
  area = name => this.root?.area?.(name) ?? null;
  show = name => this.root?.show?.(name);

  // ::: dialogs and panels, one of each open at a time. the same id closes it again
  toggleDialog = id => { this.state.dialog = this.state.$dialog === id ? null : id; };
  togglePanel  = id => { this.state.panel  = this.state.$panel  === id ? null : id; };

  // ::: pwa (install-to-home-screen), lifted off the shared plumbing
  canInstall    = canInstall;
  isInstalled   = isInstalled;
  promptInstall = promptInstall;

  // ::: mount. App renders into #app, the <app-root>: its areas, or anything else
  init = async ({ App, target = '#app' } = {}) => {
    // aufbau.css comes with index.css, the palette is the app's own
    await aufbau.boot({ ...this.config.aufbau, css: { palette: this.state.$palette, reset: false, skin: this.state.$skin } });

    const $target = typeof target === 'string' ? document.querySelector(target) : target;
    if (!$target) throw new Error(`[zugriff] mount target "${target}" not found`);

    if (App) render(html`<${App} />`, $target);
    await reveal($target);   // frame, dock and first view appear together

    // android build `capacitor`: confirm this bundle, fetch a newer one for the next start
    if (globalThis.Capacitor?.Plugins?.CapacitorUpdater) import('./modules/ota.js').then(({ ota }) => ota());
    return this;
  };

}

// :::::: EXPORT

export       { ZugriffApp, many };
export default ZugriffApp;

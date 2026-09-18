// .shared/js/app/state.js
// the per-app reactive state as a signalStore: one typed leaf per key, each its own
// signal, each persisted under a `zugriff:<app-id>:` prefix (font, dir, theme, dialog,
// route ... each its own storage key). hydration and write-back are the store's job —
// createState only declares the leaves from the app's registry config and wires the
// cross-cutting DOM side effects.
//
// a leaf reads as its signal and `$name` as its value:
//
//   app.state.theme          the EnumSignal
//   app.state.$theme         'dracula'
//   app.state.$theme = 'nord'
//
// an app adds its own keys with $extend; those are reactive but not stored unless the
// leaf says `persist: true`.
//
//   app.state.$extend({ filter: { type: String, value: '' } });

// :::::: IMPORTS

import { signalStore, local } from '@aufbau/signals';
import webfonts          from '@aufbau/webfonts';
//import { aufbau }        from './../vendors.js';
import { themes }        from './../data/themes.js';

// :::::: REFS

const $doc  = typeof document !== 'undefined' ? document : null;
const $root = $doc?.documentElement ?? null;

// :::::: THEME
// a preset is only three colours; theme.css derives the rest. applyTheme pushes those
// three onto :root and mirrors them into the global keys boot.js restores before first
// paint (no FOUC). that colour cache is derived from the preset and shared by every app,
// so it lives outside the per-app state — only the preset name is a state leaf.

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
};

// :::::: MAIN

export function createState (config = {}) {
  // typed where the value is really constrained, scalar where it is genuinely
  // optional — a String leaf would turn an absent `dir` into '' and an absent
  // `title` into the empty string rather than leaving them unset.
  const state = signalStore({
    color    : { type: 'scalar', value: config.color },
    dir      : { type: 'scalar', value: config.dir },
    font     : { type: String,   value: config.font  ?? 'Manrope' },
    lang     : { type: 'scalar', value: config.lang },
    theme    : { type: 'enum',   values: Object.keys(themes), value: config.theme ?? 'dracula' },
    title    : { type: 'scalar', value: config.title ?? config.name ?? null },
    viewport : { type: 'scalar', value: config.viewport },

    // ui-frame state every app shares — persisted too: a dialog left open reopens
    dialog : { type: 'scalar', value: null },
    route  : { type: 'scalar', value: null },
  }, {
    key   : `zugriff:${config.id ?? 'app'}:`,   // shared prefix; each leaf persists under it
    store : local,
  });

  // :::::: EFFECTS
  // pure side effects — persistence is the factory's job. theme additionally refreshes
  // the boot-time colour cache (see applyTheme).

  state.$onEffects({
    dir   : value => { if ($root && value) $root.setAttribute('dir', value); },
    font  : value => { if (value) webfonts?.init?.({ name: value, target: '--font' }); },
    lang  : value => { if ($root && value) $root.lang = value; },
    theme : value => applyTheme(value),
    title : value => { if ($doc && value) $doc.title = value; },
  });

  return state;
}

// :::::: EXPORT

export default createState;

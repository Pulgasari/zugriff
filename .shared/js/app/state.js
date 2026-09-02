// .shared/js/app/state.js
// the per-app reactive state, built on @aufbau/signals' `signal` factory in nested mode:
// one deep signal whose every leaf is independent AND persisted per-leaf under a
// `zugriff:<app-id>:` prefix (font, dir, theme, dialog, route ... each its own key).
// hydration and write-back are the factory's job now — createState only seeds the leaves
// from the app's registry config and wires the cross-cutting DOM side effects. an app
// adds its own keys by assigning them onto the returned state (…app('notes').state.filter
// = ''); those extra keys are reactive but not auto-persisted (the seeded keys are).

// :::::: IMPORTS

import { signal, local } from '@aufbau/signals';
import { aufbau }        from './../vendors.js';
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
  const state = signal({
    key    : `zugriff:${config.id ?? 'app'}:`,   // shared prefix; each leaf persists under it
    store  : local,
    nested : true,                               // per-leaf persistence (implies a deep carrier)
    value  : {
      color    : config.color,
      dir      : config.dir,
      font     : config.font  ?? 'Manrope',
      lang     : config.lang,
      theme    : config.theme ?? 'dracula',
      title    : config.title ?? config.name ?? null,
      viewport : config.viewport,

      // ui-frame state every app shares — persisted too: a dialog left open reopens
      dialog : null,
      route  : null,
    },
  });

  // :::::: EFFECTS
  // pure side effects — persistence is the factory's job. theme additionally refreshes
  // the boot-time colour cache (see applyTheme).

  state.$onEffects({
    dir   : value => { if ($root && value) $root.setAttribute('dir', value); },
    font  : value => { if (value) aufbau.webfonts?.init?.({ name: value, target: '--font' }); },
    lang  : value => { if ($root && value) $root.lang = value; },
    theme : value => applyTheme(value),
    title : value => { if ($doc && value) $doc.title = value; },
  });

  return state;
}

// :::::: EXPORT

export default createState;

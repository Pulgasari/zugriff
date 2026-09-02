// .shared/js/app/state.js
// the per-app reactive state, built on @aufbau/signals' deepSignal: every leaf
// is its own signal, so writing one key only wakes the effects that read it.
// createState seeds the cross-cutting keys from the app's registry config and
// wires the shared side effects (theme -> :root, font -> webfonts, dir/lang/title
// -> document) once. an app adds its own keys by assigning them onto the returned
// state (zugriff.app('notes').state.filter = '').

// :::::: IMPORTS

import { deepSignal } from '@aufbau/signals';
import { aufbau }     from './../vendors.js';
import { themes }     from './../data/themes.js';

// :::::: REFS

const $doc  = typeof document !== 'undefined' ? document : null;
const $root = $doc?.documentElement ?? null;

// :::::: PERSISTENCE
// theme colours share the storage keys boot.js reads pre-paint (no FOUC), so the
// apply/persist here and the boot-time restore stay in lockstep.

const THEME_PREFIX = 'zugriff:theme';   // :bg / :fg / :accent / :preset
const FONT_KEY     = 'zugriff:app:font';
const COLOR_KEYS   = ['bg', 'fg', 'accent'];

const readJSON = key => {
  try { const raw = localStorage.getItem(key); return raw === null ? undefined : JSON.parse(raw); }
  catch { return undefined; }
};
const writeJSON = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };

// apply a preset's three colours to :root (theme.css derives the rest), update the
// address-bar colour, and persist — so the next load restores it before first paint
const applyTheme = preset => {
  const palette = themes[preset];
  if (!$root || !palette) return;
  $root.dataset.theme = preset;
  for (const key of COLOR_KEYS) {
    $root.style.setProperty(`--${key}`, palette[key]);
    writeJSON(`${THEME_PREFIX}:${key}`, palette[key]);
  }
  writeJSON(`${THEME_PREFIX}:preset`, preset);
  const meta = $doc.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = palette.bg;
};

// :::::: MAIN

export function createState (config = {}) {
  const savedTheme = readJSON(`${THEME_PREFIX}:preset`);
  const savedFont  = readJSON(FONT_KEY);

  const state = deepSignal({
    color    : config.color,
    dir      : config.dir,
    font     : savedFont  ?? config.font  ?? 'Manrope',
    lang     : config.lang,
    theme    : savedTheme ?? config.theme ?? 'dracula',
    title    : config.title ?? config.name ?? null,
    viewport : config.viewport,

    // ui-frame state every app shares
    dialog : null,
    route  : null,
  });

  // :::::: EFFECTS

  state.$onEffects({
    dir   : value => { if ($root && value) $root.setAttribute('dir', value); },
    font  : value => { if (value) { aufbau.webfonts?.init?.({ name: value, target: '--font' }); writeJSON(FONT_KEY, value); } },
    lang  : value => { if ($root && value) $root.lang = value; },
    theme : value => applyTheme(value),
    title : value => { if ($doc && value) $doc.title = value; },
  });

  return state;
}

// :::::: EXPORT

export default createState;

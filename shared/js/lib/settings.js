// shared/js/lib/settings.js
//
// a setting is a persisted signal plus enough description for the panel to
// render it without knowing what it means. adding one is a single entry:
//
//   const s = defineSettings('my-app', {
//     'show-preview' : { type: 'boolean', default: true },
//     'layout'       : { type: 'enum', values: ['grid', 'list'], default: 'grid' },
//   });
//   s.value('layout');        // read
//   s.set('layout', 'list');  // write, runs the group's onSet hook
//
// keys are shown verbatim in the ui — no label mapping, on purpose.

import { effect } from '@aufbau/kits/preact-htm';
import { stored } from './signals.js';
import { themes, themeNames, DEFAULT_THEME, COLOR_KEYS } from './../data/themes.js';

export const TYPES = ['boolean', 'enum', 'color'];

export function defineSettings (namespace, schema, { onSet } = {}) {
  const signals = {};

  for (const [key, entry] of Object.entries(schema)) {
    signals[key] = stored(entry.default, `${namespace}:${key}`);
  }

  const group = {
    namespace,
    schema,
    signals,
    keys  : Object.keys(schema),
    value : key => signals[key].value,
    set   : (key, value) => {
      signals[key].value = value;
      onSet?.(key, value, group);
    },
    reset : () => {
      for (const [key, entry] of Object.entries(schema)) signals[key].value = entry.default;
    },
  };

  return group;
}

// ── theme ──────────────────────────────────────────────────────────────────
// shared by the launcher and every app: the namespace carries no slug, so
// picking an accent in one app picks it everywhere.

export const theme = defineSettings('zugriff:theme', {
  preset : { type: 'enum', look: 'combobox', values: [...themeNames, 'custom'], default: DEFAULT_THEME },
  bg     : { type: 'color', default: themes[DEFAULT_THEME].bg },
  fg     : { type: 'color', default: themes[DEFAULT_THEME].fg },
  accent : { type: 'color', default: themes[DEFAULT_THEME].accent },
}, {
  // picking a preset writes the three colours; editing a colour by hand drops
  // the preset to 'custom'. the guard keeps the two from chasing each other.
  onSet (key, value, group) {
    if (key === 'preset') {
      if (value === 'custom' || !themes[value]) return;
      applying = true;
      for (const colour of COLOR_KEYS) group.signals[colour].value = themes[value][colour];
      applying = false;
      return;
    }

    if (COLOR_KEYS.includes(key) && !applying) group.signals.preset.value = 'custom';
  },
});

let applying = false;

// the three base tokens go onto :root — everything else in theme.css derives
// from them, so one write repaints the whole palette
effect(() => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  for (const key of COLOR_KEYS) root.style.setProperty(`--${key}`, theme.signals[key].value);
});

// ── launcher ───────────────────────────────────────────────────────────────

export const launcher = defineSettings('zugriff:launcher', {
  'filter-position'  : { type: 'enum', values: ['top', 'bottom'], default: 'bottom' },
  'filter-sticky'    : { type: 'boolean', default: true },
  'filter-autofocus' : { type: 'boolean', default: false },
});

/** what an app shows while it has no settings of its own */
export const themeGroup = { title: 'theme', settings: theme };

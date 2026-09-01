// shared/js/lib/settings.js

import aufbau, { effect }    from '@aufbau/kits/preact-htm';
import { stored }            from './signals.js';
import { appSettingsSchema } from './../registry.js';
import { themes, themeNames, DEFAULT_THEME, COLOR_KEYS } from './../data/themes.js';

const TYPES = ['boolean', 'enum', 'color'];

function defineSettings (namespace, schema, { onSet } = {}) {
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
    set   : (key, value) => { signals[key].value = value; onSet?.(key, value, group); },
    reset : () => { for (const [key, entry] of Object.entries(schema)) signals[key].value = entry.default; },
  };

  return group;
}

// ── theme ─────────────────────────────────────────────

const theme = defineSettings('zugriff:theme', {
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

effect(() => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  for (const key of COLOR_KEYS) root.style.setProperty(`--${key}`, theme.signals[key].value);
});

// ── launcher ───────────────────────────────────────────────────────────────

const launcher = defineSettings('zugriff:launcher', {
  'filter-position'  : { type: 'enum', values: ['top', 'bottom'], default: 'bottom' },
  'filter-sticky'    : { type: 'boolean', default: true },
  'filter-autofocus' : { type: 'boolean', default: false },
});

// ── app (font + direction) ───────────────────────────
const fontValues = [['', 'default'], ...aufbau.webfonts.fonts.map(f => [f.id, f.name])];

function applyFont (id) {
  if (!id) return;
  aufbau.webfonts.load(id).then(ok => { if (ok) aufbau.webfonts.apply({ name: id, target: '--font' }); });
}

function applyDir (value) {
  if (typeof document === 'undefined') return;
  document.documentElement.dir = value || 'ltr';
}

const app = defineSettings('zugriff:app', {
  ...appSettingsSchema,
  font : { ...appSettingsSchema.font, values: fontValues },
}, {
  onSet (key, value) {
    if (key === 'font') applyFont(value);
    if (key === 'dir')  applyDir(value);
  },
});

// apply whatever was persisted, on load
applyFont(app.value('font'));
applyDir(app.value('dir'));

const appGroup   = { title: 'app', settings: app };
const themeGroup = { title: 'theme', settings: theme };

// :::::: EXPORT

export {
  app,
  appGroup,
  defineSettings,
  launcher,
  theme,
  themeGroup,
  TYPES,
}

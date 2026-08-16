// shared/js/data/themes.js
//
// a preset is only ever three colours. everything else in the palette —
// --accent-10, --fg-50, --zebra, --shadow … — is derived from these in
// shared/css/theme.css, so a preset never has to list more than this.
//
// keep the list alphabetical — it is what the settings combobox shows, in this
// order. fg on bg clears 8:1 everywhere and accent on bg clears 4.5:1; a new
// preset that misses those is unreadable in half the apps.

export const themes = {
  beton     : { bg: '#3a3a3a', fg: '#dcdcdc', accent: '#9ad1d4' },
  desert    : { bg: '#e3cfa4', fg: '#3b2c17', accent: '#8a3a0f' },
  dracula   : { bg: '#282a36', fg: '#f8f8f2', accent: '#ff79c6' },
  flamingo  : { bg: '#2b1e25', fg: '#ffe9f1', accent: '#ff5c8a' },
  hell      : { bg: '#ffffff', fg: '#101317', accent: '#0a66c2' },
  kontrast  : { bg: '#000000', fg: '#ffffff', accent: '#ffff00' },
  lavendel  : { bg: '#f3f0fa', fg: '#241c33', accent: '#6b3fd4' },
  matrix    : { bg: '#0b0f0b', fg: '#c8f7c5', accent: '#39ff14' },
  nightsky  : { bg: '#0b1a2e', fg: '#dbe4f0', accent: '#6ea8fe' },
  oled      : { bg: '#000000', fg: '#e9e9e9', accent: '#00e5ff' },
  papier    : { bg: '#efe9dd', fg: '#2b2622', accent: '#8f5d3a' },
  parrot    : { bg: '#10241a', fg: '#f3f7e8', accent: '#ff4d2d' },
  rubin     : { bg: '#1a0a0f', fg: '#f2dfe3', accent: '#f2295b' },
  smaragd   : { bg: '#07160f', fg: '#dff3e6', accent: '#50c878' },
  snowflake : { bg: '#e9f1f7', fg: '#16262f', accent: '#00697a' },
  softblack : { bg: '#151515', fg: '#e6e6e6', accent: '#ffb86c' },
  softwhite : { bg: '#f2f2ef', fg: '#1c1c1c', accent: '#c2255c' },
  synthwave : { bg: '#241b3a', fg: '#ffe9fb', accent: '#f92aad' },
  tinte     : { bg: '#0e0e1a', fg: '#dcd9f0', accent: '#8b7dff' },
};

// sorted, so appending to the literal instead of inserting cannot quietly
// scramble the combobox
export const themeNames = Object.keys(themes).sort();

export const DEFAULT_THEME = 'dracula';

/** the three tokens a preset sets, in the order the settings panel shows them */
export const COLOR_KEYS = ['bg', 'fg', 'accent'];

export default themes;

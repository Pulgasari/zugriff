// shared/js/data/themes.js
//
// a preset is only ever three colours. everything else in the palette —
// --accent-10, --fg-50, --zebra, --shadow … — is derived from these in
// shared/css/theme.css, so a preset never has to list more than this.

export const themes = {
  dracula   : { bg: '#282a36', fg: '#f8f8f2', accent: '#ff79c6' },
  oled      : { bg: '#000000', fg: '#e9e9e9', accent: '#00e5ff' },
  softblack : { bg: '#151515', fg: '#e6e6e6', accent: '#ffb86c' },
  softwhite : { bg: '#f2f2ef', fg: '#1c1c1c', accent: '#c2255c' },
  flamingo  : { bg: '#2b1e25', fg: '#ffe9f1', accent: '#ff5c8a' },
  beton     : { bg: '#3a3a3a', fg: '#dcdcdc', accent: '#9ad1d4' },
  papier    : { bg: '#efe9dd', fg: '#2b2622', accent: '#8f5d3a' },
  matrix    : { bg: '#0b0f0b', fg: '#c8f7c5', accent: '#39ff14' },
};

export const themeNames = Object.keys(themes);

export const DEFAULT_THEME = 'dracula';

/** the three tokens a preset sets, in the order the settings panel shows them */
export const COLOR_KEYS = ['bg', 'fg', 'accent'];

export default themes;

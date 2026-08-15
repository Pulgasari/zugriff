// cli/app.config.js

import { themeColors, fontFamily } from './../shared/js/lib/theme.js';

export const app = {
  slug  : 'cli',
  name  : 'zugriff',
  icon  : 'mdi:console',
  theme : 'dracula',
  lang  : 'en',
};

export const aufbau = {
  elements : { mode: 'auto' },
};

// xterm needs concrete colours, so the app theme is read back out of css here
// instead of being written down a second time — switch data-theme and the
// terminal follows
const colors = themeColors();

export const terminal = {
  cursorBlink : true,
  fontFamily  : fontFamily(),
  fontSize    : 14,
  theme       : {
    background    : colors.bg,
    foreground    : colors.fg,
    cursor        : colors.accent,
    cursorAccent  : colors.bg,
    selectionBackground : colors.accent + '40',

    black   : colors.bg,
    red     : colors.accent,
    green   : colors.accent3,
    yellow  : colors.accent2,
    blue    : '#8be9fd',
    magenta : colors.accent,
    cyan    : '#8be9fd',
    white   : colors.fg,
  },
};

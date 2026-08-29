// cli/app.config.js

import { themeColors, fontFamily } from '/.shared/js/lib/theme.js';

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
// instead of being written down a second time. this runs at module evaluation,
// before settings.js gets a chance to write anything — theme-boot.js is what
// puts the user's palette on :root in time, so the terminal follows the
// settings panel and not just data-theme
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

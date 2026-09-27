// cli/app.config.js

import { gestalt } from '@aufbau/api';

// xterm needs concrete colours, so they are read back from the resolved theme
// once the app has booted, instead of being written down a second time
export function terminalOptions () {
  const colors = gestalt.colors();
  const code   = getComputedStyle(document.documentElement).getPropertyValue('--font-code').trim();
  const faded  = color => color.replace(/^rgb\((.*)\)$/, 'rgba($1, 0.25)');   // computed colors are rgb(r, g, b)

  return {
    cursorBlink : true,
    fontFamily  : code || "'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace",
    fontSize    : 14,
    theme       : {
      background          : colors.bg,
      cursor              : colors.accent,
      cursorAccent        : colors.bg,
      foreground          : colors.fg,
      selectionBackground : faded(colors.accent),

      black   : colors.bg,
      blue    : '#8be9fd',
      cyan    : '#8be9fd',
      green   : '#50fa7b',
      magenta : colors.accent,
      red     : colors.accent,
      white   : colors.fg,
      yellow  : '#f1fa8c',
    },
  };
}

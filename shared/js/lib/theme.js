// shared/js/lib/theme.js
//
// reading the theme tokens back out of css, for the places that cannot use a
// custom property directly — a canvas, or xterm, which wants concrete colours
// at construction time.
//
// only works for tokens declared as literals (--bg, --fg, --accent and the
// theme colours in theme.css). anything built with color-mix() or hsl(from …)
// comes back as the unresolved expression, so do not read those.

export function cssVar (name, fallback = '') {
  if (typeof document === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/** the tokens the apps theme themselves with */
export function themeColors () {
  return {
    accent  : cssVar('--accent',   '#ff79c6'),
    accent2 : cssVar('--accent-2', '#f1fa8c'),
    accent3 : cssVar('--accent-3', '#50fa7b'),
    bg      : cssVar('--bg',       '#282a36'),
    fg      : cssVar('--fg',       '#f8f8f2'),
    success : cssVar('--success',  '#50fa7b'),
  };
}

export const fontFamily = () => cssVar('--font', '"JetBrains Mono", monospace');

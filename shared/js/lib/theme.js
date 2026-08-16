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

// ── light or dark ──────────────────────────────────────────────────────────
// a preset is three colours and says nothing about which way round it is, but
// the palettes that do not derive from it — the syntax colours in hljs.css,
// the data types in theme.css — need to know. so the background decides, and
// the answer rides on <html data-scheme>, which those stylesheets branch on.
//
// theme-boot.js repeats this, because a classic script cannot import.

/** wcag relative luminance of a #rrggbb literal */
export function luminance (hex) {
  const channel = value => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  const [r, g, b] = [1, 3, 5].map(i => channel(parseInt(hex.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** the cutoff sits where black text starts beating white text on that background */
export const schemeFor = bg => /^#[0-9a-f]{6}$/i.test(bg) && luminance(bg) > 0.18 ? 'light' : 'dark';

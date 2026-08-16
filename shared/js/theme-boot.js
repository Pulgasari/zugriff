// shared/js/theme-boot.js
//
// the theme, applied before the first paint.
//
// shared/js/lib/settings.js writes --bg/--fg/--accent onto :root, but it only
// runs once the module graph has resolved — and that graph is fetched from the
// cdn. for the whole of that time the loading screen sits on whatever
// theme.css hands out, which is the dracula block. this script is a classic,
// blocking <head> script, so it runs while the body is still unparsed and the
// loading screen paints in the right colours straight away.
//
// it also means themeColors() (shared/js/lib/theme.js) reads the user's
// palette instead of the css defaults, which is what the cli hands to xterm at
// module-evaluation time.
//
// the keys and the colour names are repeated here as literals: a classic
// script cannot import settings.js or data/themes.js. they have to stay in
// sync with defineSettings('zugriff:theme', …) and COLOR_KEYS.

(() => {

const KEYS = ['bg', 'fg', 'accent'];

// what <input type="color"> writes, plus the shorthand and alpha forms
const HEX = /^#[0-9a-f]{3,8}$/i;

try {
  const root = document.documentElement;
  let background = '';

  for (const key of KEYS) {
    const raw = localStorage.getItem(`zugriff:theme:${key}`);
    if (raw === null) continue;

    // the store json-encodes every value, so a colour arrives quoted
    let value;
    try { value = JSON.parse(raw); } catch { continue; }
    if (typeof value !== 'string' || !HEX.test(value)) continue;

    root.style.setProperty(`--${key}`, value);
    if (key === 'bg') background = value;
  }

  // which way round the theme is — hljs.css and theme.css branch on this for
  // the colours that cannot derive from --bg/--fg/--accent. same maths as
  // schemeFor() in lib/theme.js, repeated because this cannot import
  if (background) {
    const channel = v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    const [r, g, b] = [1, 3, 5].map(i => channel(parseInt(background.slice(i, i + 2), 16) / 255));
    root.dataset.scheme = 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.18 ? 'light' : 'dark';
  }

  // the browser chrome is themed by a meta tag, which no signal ever touches
  if (background) {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = background;
  }
} catch {
  // localStorage throws outright in some privacy modes — the css defaults are
  // a perfectly good fallback, and nothing here may block the page
}

})();

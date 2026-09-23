// .shared/js/modules/bars.js
//
// keeps the icon contrast of android's status and navigation bar in line with the
// theme while an app runs inside its capacitor wrapper.
//
// the bar color itself needs nothing here: capacitor 8 targets sdk 36, the app
// runs edge-to-edge (viewport-fit=cover), and html paints var(--bg) behind the
// bars. what the page cannot set is whether their text and icons are light or
// dark, so a light theme would get light icons on a light background. that is
// capacitor's built-in SystemBars plugin.
//
// reached through window.Capacitor.Plugins, not imported: with a remote server.url
// the page comes from zugriff.dev and has no npm packages, but capacitor injects
// its bridge into it. outside the wrapper there is no bridge and this is a no-op.

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

// relative luminance, same threshold as the build scripts
const isLight = (color) => {
  const hex = color.length === 4 ? [...color.slice(1)].map(c => c + c).join('') : color.slice(1);
  const lin = hex.match(/../g)
    .map(c => parseInt(c, 16) / 255)
    .map(c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2] > 0.5;
};

export function syncBars (color) {
  const capacitor = globalThis.Capacitor;
  if (!capacitor?.isNativePlatform?.() || !HEX.test(color ?? '')) return;

  // the style names the content, not the bar: DARK is light icons for a dark
  // background. without `bar` it applies to status and navigation bar alike
  capacitor.Plugins?.SystemBars
    ?.setStyle({ style: isLight(color) ? 'LIGHT' : 'DARK' })
    ?.catch?.(() => {});
}

export default syncBars;

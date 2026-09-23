// .shared/js/modules/bars.js
//
// keeps android's status and navigation bar in the theme background while an app
// runs inside its capacitor wrapper. the build bakes the registry color into the
// bars (.github/scripts/gen-capacitor-res.mjs); this follows a theme picked at
// runtime, including the icon contrast a light theme needs.
//
// the plugins are reached through window.Capacitor.Plugins, not imported: with a
// remote server.url the page comes from zugriff.dev and has no npm packages, but
// capacitor injects its bridge into it. outside the wrapper there is no bridge
// and every call is a no-op.
//
//   StatusBar      @capacitor/status-bar
//   NavigationBar  @hugotomazi/capacitor-navigation-bar
//
// NOTE: background colors only apply while targetSdk <= 34 (capacitor 6). with the
// edge-to-edge android 15 enforces from targetSdk 35 only the icon contrast is left.

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

// #rgb -> #rrggbb, the only shape android's color parser takes besides #aarrggbb
const expand = (hex) => hex.length === 4 ? '#' + [...hex.slice(1)].map(c => c + c).join('') : hex;

// relative luminance, same threshold as the build script
const isLight = (hex) => {
  const lin = hex.slice(1).match(/../g)
    .map(c => parseInt(c, 16) / 255)
    .map(c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2] > 0.5;
};

// a plugin missing from the native build rejects instead of throwing
const quiet = (promise) => promise?.catch?.(() => {});

export function syncBars (color) {
  const capacitor = globalThis.Capacitor;
  if (!capacitor?.isNativePlatform?.() || !HEX.test(color ?? '')) return;

  const hex   = expand(color);
  const light = isLight(hex);
  const { StatusBar, NavigationBar } = capacitor.Plugins ?? {};

  // style names the text, not the bar: DARK is light text for a dark background
  quiet(StatusBar?.setBackgroundColor({ color: hex }));
  quiet(StatusBar?.setStyle({ style: light ? 'LIGHT' : 'DARK' }));
  quiet(NavigationBar?.setColor({ color: hex, darkButtons: light }));
}

export default syncBars;

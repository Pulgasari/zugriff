// bundler.config.js
// the www/ of one app for @aufbau/bundler (aufbau/bundler), used by the
// capacitor build (.github/scripts/stage-capacitor-www.mjs): the root shell,
// .shared and the app where vercel's rewrite puts it on the live site, the
// first-party packages as local copies, the third-party modules vendored, the
// icons as svgs, only the fonts in use, the app named in index.html, and whatever nothing
// reaches dropped.
//
//   node <aufbau>/bundler/cli.js bundler.config.js slug=notes out=build/notes/www packages=build/_pkg

import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// the importmap every page gets, data/importmap.js sets it on the global it runs in
function importmapOf (file) {
  const context = {};
  vm.runInNewContext(readFileSync(file, 'utf8'), { globalThis: context });
  return { imports: context.__IMPORTMAP__ };
}

// the capacitor build makes a second, `-dev` build of every app with devtools
// when this is set. the regular one leaves @aufbau/devtools and eruda out
export const devtools = true;

export default ({ dev = false, out, packages = 'build/_pkg', slug }) => ({
  out,
  root : '.',

  copy : [
    { from: '.shared' },
    { from: `apps/${slug}`, to: slug },
    { from: 'icon.svg' },
    { from: 'index.html' },
    { from: 'logo.svg' },
    { from: 'sw.js' },
  ],

  packages : {
    clone  : 'https://github.com/Pulgasari/{repo}.git',
    origin : 'https://code.pulgasari.dev',
    path   : '/_pkg',
    source : packages,
  },

  // the svgs of the icons found in the staged files, provided to <svg-icon>
  icons : {
    element : '@aufbau/elements/webcomponents/svg-icon.js',
    path    : '/_icons',
  },

  // everything nothing reaches goes. the app's entry is loaded by a path built
  // from the route and stays whole with its views, dialogs, panels, css.
  // components load by name through the runtime, each call keeps its component.
  // aufbau declares its own runtime css in its package.json
  prune : {
    entries : [`/${slug}/app.js`],
    exclude : dev ? [] : ['@aufbau/devtools/boot.js'],   // the recorder stays, it is tiny
    keep    : [`/${slug}/`],
    loaders : {
      'zugriff.component'  : '/.shared/js/components/{name}.js',
      'zugriff.components' : '/.shared/js/components/{name}.js',
    },
    origins : ['https://zugriff.dev'],
  },

  // capacitor opens https://localhost/ and the page stays there: its index.html names
  // the app (data-app, stage-capacitor-www.mjs). the dev build opens with ?dev, devtools on
  start : dev ? '/?dev' : null,

  // the local entries reach boot.js as __BOOT_CONFIG__.imports, laid over the map
  vendor : {
    exclude   : dev ? [] : [/\/eruda@/],   // the devtools console, only behind ?dev
    importmap : importmapOf('.shared/js/data/importmap.js'),
    inject    : imports => `<script>window.__BOOT_CONFIG__ = { imports: ${JSON.stringify(imports)} };</script>`,
    path      : '/_vendor',
  },

  // the fonts the shared css and the app state name (manrope, jetbrains mono),
  // the settings offer those. more go into keep
  webfonts : {
    catalog : '_pkg/aufbau/webfonts/data.js',
    keep    : [],
    scan    : true,
  },
});

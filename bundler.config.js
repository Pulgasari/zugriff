// bundler.config.js
// the www/ of one app for @aufbau/bundler (aufbau/bundler), used by the
// capacitor build (.github/scripts/stage-capacitor-www.mjs): the root shell,
// .shared and the app where vercel's rewrite puts it on the live site, the
// first-party packages as local copies, the third-party modules vendored, and /
// moved to the app.
//
//   node <aufbau>/bundler/cli.js bundler.config.js slug=notes out=build/notes/www packages=build/_pkg

import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// the importmap boot.js injects at runtime, read by running it against a stub
// dom that keeps the <script type="importmap"> it writes. boot.js goes on after
// that (devtools, service worker, runtime), whatever fails there is past the map
function importmapOf (file) {
  let map = null;
  const noop    = () => {};
  const element = () => ({ addEventListener: noop, after: node => { if (node.type === 'importmap') map = JSON.parse(node.textContent); }, append: noop, classList: { add: noop, remove: noop, toggle: noop }, dataset: {}, setAttribute: noop, style: {} });
  const document = { addEventListener: noop, body: null, createDocumentFragment: element, createElement: tag => ({ ...element(), tagName: tag }), currentScript: { ...element(), src: 'https://zugriff.dev/.shared/js/boot.js' }, documentElement: element(), head: element(), querySelector: () => null };
  const console  = { debug: noop, error: noop, info: noop, log: noop, trace: noop, warn: noop };
  const window   = { addEventListener: noop, console, document, localStorage: { getItem: () => null, setItem: noop }, location: new URL('https://zugriff.dev/'), navigator: {} };

  // a dynamic import() stays pending, the runtime it would load is not needed.
  // node's vm only takes import() with a flag, so it is renamed to a stub
  const source = readFileSync(file, 'utf8').replace(/\bimport\s*\(/g, 'importStub(');
  try   { vm.runInNewContext(source, { ...window, importStub: () => new Promise(noop), JSON, URL, URLSearchParams, queueMicrotask: noop, setTimeout: noop, window }); }
  catch { /* past the importmap */ }
  if (!map) throw new Error(`bundler.config: no importmap from ${file}`);
  return map;
}

export default ({ out, packages = 'build/_pkg', slug }) => ({
  out,
  root : '.',

  copy : [
    { from: '.shared' },
    { from: `apps/${slug}`, to: slug },
    { from: 'icon.svg' },
    { from: 'index.html' },
    { from: 'logo.svg' },
  ],

  packages : {
    clone  : 'https://github.com/Pulgasari/{repo}.git',
    origin : 'https://code.pulgasari.dev',
    path   : '/_pkg',
    source : packages,
  },

  // capacitor opens https://localhost/, the shell reads its route from the path
  start : `/${slug}/`,

  // boot.js builds the importmap itself, the local entries reach it as
  // __BOOT_CONFIG__.imports, which it lays over its own
  vendor : {
    exclude   : [/\/eruda@/],   // the devtools console, only behind ?dev
    importmap : importmapOf('.shared/js/boot.js'),
    inject    : imports => `<script>window.__BOOT_CONFIG__ = { imports: ${JSON.stringify(imports)} };</script>`,
    path      : '/_vendor',
  },
});

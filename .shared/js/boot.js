/* shared/js/boot.js

the single classic <head> script every page loads. it replaces the old
theme-boot.js + importmap.js pair:

1. apply the stored theme to :root before first paint (no FOUC)
2. inject the framework importmap + modulepreloads
3. (optional) register a service worker

<script src="/.shared/js/boot.js"></script>

override the defaults with data-attributes or a window.__BOOT_CONFIG__ object
set before this script runs (data-sw="./sw.js" to opt back into sw here).
==================== */
(() => {
  
const currentScript = document.currentScript;
if (!currentScript) throw new Error('[boot] Must be executed synchronously as a classic script in <head>');


// :::::: HELPERS + REFS
const createElement = (tag, props) => Object.assign(document.createElement(tag), props);
const $head = document.head;
const $root = document.documentElement;

// ──────── TASKS ──────────────────────────────────

// :::::: Task 0: Devtools Recorder
// @aufbau/devtools/recorder.js records console calls and failed loads from here
// on, for the devtools console that mounts much later (see its README). it has to
// run before anything else and synchronously: written in while this classic
// script runs, the parser loads and runs it right after, ahead of the rest of
// <head>. an appended <script> would load async and could come too late.
// importScripts() exists in workers only
function initDevRecorder () {
  document.write('<script src="https://code.pulgasari.dev/aufbau/devtools/recorder.js"><\/script>');
}

initDevRecorder();

// :::::: Task 1: Dev Tools Injection | ?dev
function initDevTools (force = false) {
  try {
    const KEY = 'zugriff:devtools';
    const dev = force || new URLSearchParams(location.search).get('dev');
    if (dev !== null) {
      if (dev === 'off' || dev === '0') sessionStorage.removeItem(KEY);
      else sessionStorage.setItem(KEY, '1');
    }
    if (sessionStorage.getItem(KEY)) {
      document.head.append(createElement('script', {
        src    : 'https://cdn.jsdelivr.net/npm/eruda@3',
        onload : () => { try { window.eruda?.init(); } catch {} },
      }));
    }
  } catch {} // storage may be blocked in incognito
}
  
// :::::: Task 2: Gestalt Boot (Synchronous - Prevents FOUC)
// the palette, density and geometry leaves of the app's store
// (zugriff:<slug>:<leaf>), set before the first paint. aufbau's css resolves
// everything from the tokens, so the names are all it takes. on zugriff.dev
// middleware.js may have written them into the html already, from the cookie
// app.js keeps; localStorage stays the truth, so they are set here regardless
const GESTALT_TOKENS = ['density', 'geometry', 'palette'];

function applyGestalt ({ prefix }) {
  const slug = $root.dataset.app;
  if (!prefix || !slug) return;
  for (const token of GESTALT_TOKENS) {
    try {
      const value = JSON.parse(localStorage.getItem(`${prefix}:${slug}:${token}`));
      if (typeof value !== 'string' || !value) continue;
      $root.style.setProperty(`--${token}`, value);
      $root.dataset[token] = value;
    } catch {} // storage may be blocked, a stored value may be broken
  }
}

  // :::::: Task 3: Import Map & Preloads Injection
  function injectImportMapAndPreloads (imports, preload, scriptURL) {
    // rebase relative URLs against this boot script's location
    for (const key in imports) imports[key] = new URL(imports[key], scriptURL).href;
    const map = { imports };
    const $importmap =  createElement('script', { type: 'importmap', textContent: JSON.stringify(map) });   
    currentScript.after($importmap); // Inject importmap immediately after currentScript

    // Inject <link rel="modulepreload"> tags for critical paths
    if (preload.length > 0) {
      const fragment = document.createDocumentFragment();
      for (const key of preload) {
        const href = imports[key];
        if (href) fragment.append(createElement('link', { href, rel: 'modulepreload' }));
      }
      document.head.append(fragment);
    }
  }

  // :::::: Task 4: Service Worker Registration
  function registerServiceWorker (sw) {
    if (!sw.path) return;
    window.addEventListener('load', () => {
      const options = { type: sw.type };
      if (sw.scope) options.scope = sw.scope;

      navigator?.serviceWorker?.register(sw.path, options)
      .catch(err => console.warn('[boot] service worker registration failed:', err));
    });
  }

  // :::::: Task 5: Zugriff Runtime Initialization
  // kick off the runtime import here (after the importmap is in place) and expose the
  // readiness promise so the index.html shell can await it before loading the app
  // module. binds `zugriff` (and html/toast) to window; an app never imports the runtime.
  function initRuntime () {
    window.__ZUGRIFF_READY__ = import('./runtime.js')
      .catch(error => { console.error('[boot] runtime init failed:', error); throw error; });
  }

  
  

  // hidden until ready. an app page reveals itself once its first view has settled
  // (transitions.js), any other page on load. the timeout is the failsafe: an app
  // that crashed on the way must not leave an empty page behind
  const ready = () => { $root.classList.remove('is-loading'); $root.classList.add('is-ready'); };
  $root.classList.add('is-loading');
  if ($root.dataset.app) setTimeout(ready, 4000);
  else window.addEventListener('load', ready);

  // Merge options: HTML data-attributes < global window config < default options
  const ds = currentScript.dataset;
  const userConfig = window.__BOOT_CONFIG__ || {};

  const config = {
    sw: {
      path  : ds.sw      ?? userConfig.sw      ?? '/sw.js',     // off by default — app.js registers the sw; set data-sw to enable here
      type  : ds.swType  ?? userConfig.swType  ?? 'module',  // 'module' | 'classic'
      scope : ds.swScope ?? userConfig.swScope ?? undefined,
    },
    gestalt: {
      prefix : ds.gestaltPrefix ?? userConfig.gestaltPrefix ?? 'zugriff',
    },
    preload     : userConfig.preload || [],
    imports: Object.assign(getImportMap(), userConfig.imports || {})
  };
  const { preload, sw } = config;

  // Run tasks sequentially
  initDevTools();   // eruda only behind ?dev, remembered for the tab
  applyGestalt(config.gestalt);
  injectImportMapAndPreloads(config.imports, config.preload, currentScript.src);
  registerServiceWorker(config.sw);
  initRuntime();

  // ── FRAMEWORK DEFAULTS ───────────────────────────────────────────────────

  function getImportMap () {
    const jsr    = 'https://esm.sh/jsr';
    const pkg    = 'https://code.pulgasari.dev';
    const PREACT = '10.20.1';
    const HLJS   = '11.10.0';

    return {
      '@/components/' : '/.shared/js/components/', // do not use
      '@/modules/'    : '/.shared/js/modules/',    // do not use

      "@aufbau/api"             : `${pkg}/aufbau/api/index.js`,
      "@aufbau/ass"             : `${pkg}/aufbau/ass/index.js`,
      "@aufbau/ass/"            : `${pkg}/aufbau/ass/`,
      "@aufbau/builders/docs"   : `${pkg}/aufbau/builders/docs/index.js`,
      "@aufbau/builders/docs/"  : `${pkg}/aufbau/builders/docs/`,
      "@aufbau/devtools"        : `${pkg}/aufbau/devtools/index.js`,
      "@aufbau/devtools/"       : `${pkg}/aufbau/devtools/`,
      "@aufbau/element"         : `${pkg}/aufbau/element/index.js`,
      "@aufbau/element/"        : `${pkg}/aufbau/element/`,
      "@aufbau/elements"        : `${pkg}/aufbau/elements/index.js`,
      "@aufbau/elements/htx"    : `${pkg}/aufbau/elements/adapters/htx.js`,
      "@aufbau/elements/"       : `${pkg}/aufbau/elements/`,
      "@aufbau/filters"         : `${pkg}/aufbau/filters/index.js`,
      "@aufbau/gestalt"         : `${pkg}/aufbau/gestalt/index.js`,
      "@aufbau/gestalt/"        : `${pkg}/aufbau/gestalt/`,
      "@aufbau/gestures"        : `${pkg}/aufbau/gestures/index.js`,
      "@aufbau/gestures/preact" : `${pkg}/aufbau/gestures/adapters/preact.js`,
      "@aufbau/gui"             : `${pkg}/aufbau/gui/index.js`,
      "@aufbau/import"          : `${pkg}/aufbau/import/index.js`,
      "@aufbau/patterns"        : `${pkg}/aufbau/patterns/index.js`,
      "@aufbau/signals"         : `${pkg}/aufbau/signals/index.js`,
      "@aufbau/signals/"        : `${pkg}/aufbau/signals/`,
      "@aufbau/store"           : `${pkg}/aufbau/store/index.js`,
      "@aufbau/svg"             : `${pkg}/aufbau/svg/index.js`,
      "@aufbau/svg/"            : `${pkg}/aufbau/svg/`,
      "@aufbau/webfonts"        : `${pkg}/aufbau/webfonts/index.js`,
      "@aufbau/webfonts/"       : `${pkg}/aufbau/webfonts/`,
      "@aufbau/webfonts/google" : `${pkg}/aufbau/webfonts/google.js`,

      "@bunker/cache"   : `${pkg}/bunker/cache/index.js`,
      "@bunker/core"    : `${pkg}/bunker/core/index.js`,
      "@bunker/db"      : `${pkg}/bunker/db/index.js`,
      "@bunker/kit"     : `${pkg}/bunker/kit/index.js`,
      "@bunker/opfs"    : `${pkg}/bunker/opfs/index.js`,
      "@bunker/policy"  : `${pkg}/bunker/policy/index.js`,
      "@bunker/storage" : `${pkg}/bunker/storage/index.js`,
      "@bunker/utils"   : `${pkg}/bunker/utils/index.js`,
      "@bunker/utils/"  : `${pkg}/bunker/utils/`,

      "@cosmonaut/compiler" : `${pkg}/cosmonaut/packages/compiler/index.js`,
      "@cosmonaut/ebnf"     : `${pkg}/cosmonaut/packages/ebnf/index.js`,
      "@cosmonaut/layouter" : `${pkg}/cosmonaut/packages/layouter/index.js`,
      "@cosmonaut/lsd"      : `${pkg}/cosmonaut/packages/lsd/index.js`,
      "@cosmonaut/parsers"  : `${pkg}/cosmonaut/packages/parsers/index.js`,
      "@cosmonaut/parsers/" : `${pkg}/cosmonaut/packages/parsers/`,
      "@cosmonaut/layouter/": `${pkg}/cosmonaut/packages/layouter/`,
      "@cosmonaut/compiler/": `${pkg}/cosmonaut/packages/compiler/`,

      "@domina/core"     : `${pkg}/domina/core/index.js`,
      "@domina/core/"    : `${pkg}/domina/core/`,
    //"@domina/methods"  : `${pkg}/domina/core/methods/index.js`,
    //"@domina/methods/" : `${pkg}/domina/core/methods/`,

      "@domina/element"      : `${pkg}/domina/packages/element/index.js`,
      "@domina/element/lazy" : `${pkg}/domina/packages/element/lazy.js`,
      "@domina/fonts"        : `${pkg}/domina/packages/fonts/index.js`,
      "@domina/form"         : `${pkg}/domina/packages/form/index.js`,
      "@domina/meta"         : `${pkg}/domina/packages/meta/index.js`,
      "@domina/methods"      : `${pkg}/domina/packages/methods/index.js`,
      "@domina/methods/"     : `${pkg}/domina/packages/methods/`,
      "@domina/observer"     : `${pkg}/domina/packages/observer/index.js`,
      "@domina/raf"          : `${pkg}/domina/packages/raf/index.js`,
      "@domina/stylesheet"   : `${pkg}/domina/packages/stylesheet/index.js`,

      "@poo/compiler" : `${pkg}/poo/js-packages/compiler/index.js`,
      "@poo/hljs"     : `${pkg}/poo/js-packages/hljs/index.js`,

      "@pulgasari/arr"              : `${pkg}/js-packages/arr/index.js`,
      "@pulgasari/arr/fp"           : `${pkg}/js-packages/arr/fp.js`,
      "@pulgasari/canonicalmap"     : `${pkg}/js-packages/obj/CanonicalMap.js`,
      "@pulgasari/coerce"           : `${pkg}/js-packages/coerce/index.js`,
      "@pulgasari/hash"             : `${pkg}/js-packages/hash/index.js`,
      "@pulgasari/is"               : `${jsr}/@pulgasari/is`,
      "@pulgasari/logger"           : `${jsr}/@pulgasari/logger`,
      "@pulgasari/num"              : `${pkg}/js-packages/num/index.js`,
      "@pulgasari/obj"              : `${pkg}/js-packages/obj/index.js`,
      "@pulgasari/obj/CanonicalMap" : `${pkg}/js-packages/obj/CanonicalMap.js`,
      "@pulgasari/random"           : `${pkg}/js-packages/random/index.js`,
      "@pulgasari/shift"            : `${pkg}/js-packages/shift/index.js`,
      "@pulgasari/str"              : `${jsr}/@pulgasari/str`,
      "@pulgasari/timing"           : `${pkg}/js-packages/timing/index.js`,
      "@pulgasari/url"              : `${pkg}/js-packages/url/index.js`,

      //"@pulgasari/htx"       : `${pkg}/js-packages/htx/index.js`,
      //"@pulgasari/htx/"      : `${pkg}/js-packages/htx/`,

      "@htx/compiler" : `${pkg}/htx/packages/compiler/index.js`,
      "@htx/elements" : `${pkg}/htx/packages/elements/index.js`,
      "@htx/htx"      : `${pkg}/htx/packages/htx/index.js`,
      "@htx/js"       : `${pkg}/htx/packages/js/index.js`,
      "@htx/preact"   : `${pkg}/htx/packages/preact/index.js`,

      // ::: preact + htm — one instance only; dependents pin PREACT via
      // ?external= / ?deps= so esm.sh never ships a second copy
      "acorn"              : "https://esm.sh/acorn@8", // parser of @htx/compiler
      "htm"                : "https://esm.sh/htm@3.1.1",
      "htm/preact"         : `https://esm.sh/htm@3.1.1/preact?deps=preact@${PREACT}`,
      "preact"             : `https://esm.sh/preact@${PREACT}`,
      "preact/hooks"       : `https://esm.sh/preact@${PREACT}/hooks`,
      "preact/jsx-runtime" : `https://esm.sh/preact@${PREACT}/jsx-runtime`, // wie kommt das hier rein lol
      "@preact/signals"    : "https://esm.sh/@preact/signals@1.2.2?external=preact", // resolved transitively by @aufbau/signals; do not import directly

      // ::: syntax highlighting
      "hljs"                    : "https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/+esm",
      "highlight.js"            : `https://esm.sh/highlight.js@${HLJS}/lib/core`,
      "highlight.js/languages/" : `https://esm.sh/highlight.js@${HLJS}/lib/languages/`,

      // ::: terminal (cli)
      "@xterm/addon-fit" : "https://esm.sh/@xterm/addon-fit@0.10.0",
      "@xterm/xterm"     : "https://esm.sh/@xterm/xterm@5.5.0",

      // ::: data formats
      "smol-toml" : "https://esm.sh/smol-toml@1.3.1",
      "yaml"      : "https://esm.sh/yaml@2.4.5",

      // ::: minifiers
      "csso"                 : "https://esm.sh/csso@5.0.5",
      "html-minifier-terser" : "https://esm.sh/html-minifier-terser@7.2.0",
      "terser"               : "https://esm.sh/terser@5.31.1",

      // ::: documents
      "pdf-lib"      : "https://esm.sh/pdf-lib@1.17.1",
      "pdfjs"        : "https://esm.sh/pdfjs-dist@4.4.168",
      "pdfjs-worker" : "https://esm.sh/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs",
      "epubjs"       : "https://esm.sh/epubjs@0.3.93",

      // ::: media — the ffmpeg core wasm (~32 mb) is fetched from the cdn on
      // first use and cached by the service worker from there on
      "@ffmpeg/ffmpeg" : "https://esm.sh/@ffmpeg/ffmpeg@0.12.10",
      "@ffmpeg/util"   : "https://esm.sh/@ffmpeg/util@0.12.1",
      "@ffmpeg/core"   : "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js",
      "upng-js"        : "https://esm.sh/upng-js@2.1.0",
      "gifenc"         : "https://cdn.jsdelivr.net/npm/gifenc@1.0.3/+esm",
      "music-metadata" : "https://esm.sh/music-metadata@11",

      // ::: color
      "culori" : "https://esm.sh/culori@3.3.0",

      // ::: vision / on-device ml (looksmaxx) — wasm + models fetched at runtime
      "@mediapipe/tasks-vision" : "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm",
    };
  }
})();

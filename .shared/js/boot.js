/* shared/js/boot.js

the single classic <head> script every page loads. it replaces the old
theme-boot.js + importmap.js pair:

1. apply the stored theme colours to :root before first paint (no FOUC)
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
  
// :::::: Task 1: Dev Tools Injection | ?dev
// :::::: Task 1b: Live Dev CSS Injector
function initDevCss () {
  try {
    const KEY = 'zugriff:dev-css';

    // Inject style tag immediately so saved CSS applies before paint
    const $style = createElement('style', { id: 'dev-live-css' });
    $style.textContent = localStorage.getItem(KEY) || '';
    document.head.append($style);

    // Render floating panel once DOM is ready
    const mountPanel = () => {
      if (!document.body || document.getElementById('dev-css-panel')) return;

      const $panel = createElement('div', { id: 'dev-css-panel' });
      Object.assign($panel.style, {
        position: 'fixed',
        bottom: '12px',
        right: '12px',
        zIndex: '999999',
        width: '320px',
        background: '#18181b',
        border: '1px solid #3f3f46',
        borderRadius: '8px',
        padding: '8px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
        fontFamily: 'monospace',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px'
      });

      const $header = createElement('div', { textContent: '⚡ Dev Live CSS' });
      Object.assign($header.style, {
        color: '#a1a1aa',
        fontSize: '11px',
        fontWeight: 'bold',
        cursor: 'pointer',
        userSelect: 'none',
        display: 'flex',
        justifyContent: 'space-between'
      });

      const $textarea = createElement('textarea', { placeholder: '/* live css */', value: localStorage.getItem(KEY) || '' });

      Object.assign($textarea.style, {
        width: '100%',
        height: '160px',
        background: '#09090b',
        color: '#4ade80',
        border: '1px solid #27272a',
        borderRadius: '4px',
        padding: '8px',
        fontSize: '12px',
        fontFamily: 'inherit',
        resize: 'vertical',
        boxSizing: 'border-box',
        outline: 'none'
      });

      // Update live style tag and sync to storage
      $textarea.addEventListener('input', (e) => {
        const val = e.target.value;
        $style.textContent = val;
        localStorage.setItem(KEY, val);
      });

      // Collapse / expand panel on header click
      let isCollapsed = false;
      $header.addEventListener('click', () => {
        isCollapsed = !isCollapsed;
        $textarea.style.display = isCollapsed ? 'none' : 'block';
      });

      $panel.append($header,$textarea);
      document.body.append($panel);
    };

    if (document.readyState === 'loading') {
      window.addEventListener('DOMContentLoaded', mountPanel);
    } else {
      mountPanel();
    }
  } catch {}
}
function initDevTools (force = false) {
  try {
    const KEY = 'zugriff:devtools';
    const css =          new URLSearchParams(location.search).get('css');
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
      //
      if (css) initDevCss();
    }
  } catch {} // storage may be blocked in incognito
}
  
// :::::: Task 2: Theme Boot (Synchronous - Prevents FOUC)
function applyTheme (theme) {
  if (!theme.prefix) return;
  const HEX = /^#[0-9a-f]{3,8}$/i;
  try {
    let background = '';

    for (const key of theme.keys) {
      const raw = localStorage.getItem(`${theme.prefix}:${key}`);
      if (raw === null) continue;

      let value;
      try { value = JSON.parse(raw); } catch { continue; }
      if (typeof value !== 'string' || !HEX.test(value)) continue;

      $root.style.setProperty(`--${key}`, value);
      if (key === 'bg') background = value;
    }

    if (background) {
      $root.style.background = 'var(--bg)';
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.content = background;
    }
  } catch {}
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

  
  

  $root.classList.add('is-loading');
  window.addEventListener('load', () => {
    $root.classList.remove('is-loading');
    $root.classList.add('is-ready');
  });

  // Merge options: HTML data-attributes < global window config < default options
  const ds = currentScript.dataset;
  const userConfig = window.__BOOT_CONFIG__ || {};

  const config = {
    sw: {
      path  : ds.sw      ?? userConfig.sw      ?? '/sw.js',     // off by default — app.js registers the sw; set data-sw to enable here
      type  : ds.swType  ?? userConfig.swType  ?? 'module',  // 'module' | 'classic'
      scope : ds.swScope ?? userConfig.swScope ?? undefined,
    },
    theme: {
      prefix : ds.themePrefix ?? userConfig.themePrefix ?? 'zugriff:theme',
      keys   : userConfig.themeKeys || ['bg', 'fg', 'accent'],
    },
    preload     : userConfig.preload || [],
    imports: Object.assign(getImportMap(), userConfig.imports || {})
  };
  const { preload, sw, theme } = config;

  // Run tasks sequentially
  initDevTools(true);
  applyTheme(config.theme);
  injectImportMapAndPreloads(config.imports, config.preload, currentScript.src);
  registerServiceWorker(config.sw);
  initRuntime();

  // ── FRAMEWORK DEFAULTS ───────────────────────────────────────────────────

  function getImportMap () {
    const pkg    = 'https://code.pulgasari.dev';
    const PREACT = '10.20.1';
    const HLJS   = '11.10.0';

    return {
      '@/components/' : '/.shared/js/components/', // do not use
      '@/modules/'    : '/.shared/js/modules/',    // do not use
      
      "@aufbau/builders/docs"   : `${pkg}/aufbau/builders/docs/index.js`,
      "@aufbau/builders/docs/"  : `${pkg}/aufbau/builders/docs/`,
      "@aufbau/elements"        : `${pkg}/aufbau/elements/index.js`,
      "@aufbau/elements/"       : `${pkg}/aufbau/elements/`,
      "@aufbau/filters"         : `${pkg}/aufbau/filters/index.js`,
      "@aufbau/gestures"        : `${pkg}/aufbau/gestures/index.js`,
      "@aufbau/gestures/preact" : `${pkg}/aufbau/gestures/adapters/preact.js`,
      "@aufbau/import"          : `${pkg}/aufbau/import/index.js`,
      "@aufbau/kits/preact-htm" : `${pkg}/aufbau/kits/preact-htm.js`,
      "@aufbau/patterns"        : `${pkg}/aufbau/patterns/index.js`,
      "@aufbau/runtime"         : `${pkg}/aufbau/runtime/index.js`,
      "@aufbau/runtime/"        : `${pkg}/aufbau/runtime/`,
      "@aufbau/signals"         : `${pkg}/aufbau/signals/index.js`,
      "@aufbau/signals/"        : `${pkg}/aufbau/signals/`,
      "@aufbau/store"           : `${pkg}/aufbau/store/index.js`,
      "@aufbau/stylesheet"      : `${pkg}/aufbau/stylesheet/index.js`,
      "@aufbau/stylesheet/"     : `${pkg}/aufbau/stylesheet/`,
      "@aufbau/svg/"            : `${pkg}/aufbau/svg/`,
      "@aufbau/webfonts"        : `${pkg}/aufbau/webfonts/index.js`,
      "@aufbau/webfonts/"       : `${pkg}/aufbau/webfonts/`,
      "@aufbau/webfonts/google" : `${pkg}/aufbau/webfonts/google.js`,

      "@bunker/cache"   : `${pkg}/bunker/cache/index.js`,
      "@bunker/core"    : `${pkg}/bunker/core/index.js`,
      "@bunker/db"      : `${pkg}/bunker/db/index.js`,
      "@bunker/kit"     : `${pkg}/bunker/kit/index.js`,
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

      "@pulgasari/array"  : `${pkg}/js/array.js`,
      "@pulgasari/canonicalmap" : `${pkg}/js/canonicalmap.js`,
      "@pulgasari/coerce" : `${pkg}/js/coerce.js`,
      "@pulgasari/hash"   : `${pkg}/js/hash.js`,
      "@pulgasari/is"     : `${pkg}/js/is.js`,
      "@pulgasari/logger" : `${pkg}/js/logger.js`,
      "@pulgasari/num"    : `${pkg}/js/num.js`,
      "@pulgasari/obj"    : `${pkg}/js/obj.js`,
      "@pulgasari/random" : `${pkg}/js/random.js`,
      "@pulgasari/str"    : `${pkg}/js/str.js`,
      "@pulgasari/timing" : `${pkg}/js/timing.js`,
      "@pulgasari/url"    : `${pkg}/js/url.js`,

      // ::: preact + htm — one instance only; dependents pin PREACT via
      // ?external= / ?deps= so esm.sh never ships a second copy
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

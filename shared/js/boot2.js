// shared/js/boot.js
(() => {
  const currentScript = document.currentScript;
  if (!currentScript) throw new Error('[boot] Must be executed synchronously as a classic script in <head>');

  // Merge options: HTML data-attributes < global window config < default options
  const ds = currentScript.dataset;
  const userConfig = window.__BOOT_CONFIG__ || {};

  const config = {
    sw: {
      path  : ds.sw      ?? userConfig.sw      ?? './sw.js', // SW path, set 'false' to disable        
      type  : ds.swType  ?? userConfig.swType  ?? 'module',  // 'module' | 'classic'
      scope : ds.swScope ?? userConfig.swScope ?? undefined,
    },
    theme: {
      prefix : ds.themePrefix ?? userConfig.themePrefix ?? 'zugriff:theme',
      keys   : userConfig.themeKeys || ['bg', 'fg', 'accent'],
    },
    preload     : userConfig.preload || [
      '@aufbau/kits/preact-htm',
      '@aufbau/elements',
      '@domina/core',
      'preact'
    ],
    // Base framework importmap (can be extended/overridden via userConfig.imports)
    imports: Object.assign(getFrameworkImportMap(), userConfig.imports || {})
  };
  const { preload, sw, theme } = config;

  const createElement = (tag, props) => Object.assign(document.createElement(tag), props);

  // ── 1. THEME BOOT (Synchronous - Prevents FOUC) ──────────────────────────

  if (theme.prefix) {
    const HEX = /^#[0-9a-f]{3,8}$/i;
    try {
      const root = document.documentElement;
      let background = '';

      for (const key of theme.keys) {
        const raw = localStorage.getItem(`${theme.prefix}:${key}`);
        if (raw === null) continue;

        let value;
        try { value = JSON.parse(raw); } catch { continue; }
        if (typeof value !== 'string' || !HEX.test(value)) continue;

        root.style.setProperty(`--${key}`, value);
        if (key === 'bg') background = value;
      }

      if (background) {
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.content = background;
      }
    } catch {} // ignore storage restrictions (e.g., incognito mode)
  }

  // ── 2. IMPORT MAP & PRELOADS ─────────────────────────────────────────────
  const { imports } = config;
  const scriptURL = currentScript.src;

  // rebase relative URLs against this boot script's location
  for (const key in imports) imports[key] = new URL(imports[key], scriptURL).href;

  const map = { imports };

  // Inject importmap immediately after currentScript
  currentScript.after(
    createElement('script', { type: 'importmap', textContent: JSON.stringify(map) })
  );

  // Inject <link rel="modulepreload"> tags for critical paths
  if (preload.length > 0) {
    const fragment = document.createDocumentFragment();
    for (const key of preload) {
      const href = imports[key];
      if (href) fragment.append(createElement('link', { href, rel: 'modulepreload' }));
    }
    document.head.append(fragment);
  }

  // ── 3. SERVICE WORKER REGISTRATION ───────────────────────────────────────

  if (sw.path) window.addEventListener('load', () => {
    const options = { type: sw.type };
    if (sw.scope) options.scope = sw.scope;

    navigator?.serviceWorker?.register(sw.path, options)
        .catch(err => console.warn('[boot] service worker registration failed:', err));
  });

  // ── FRAMEWORK DEFAULTS ───────────────────────────────────────────────────

  function getFrameworkImportMap () {
    const pkg    = 'https://code.pulgasari.dev';
    const PREACT = '10.20.1';
    const HLJS   = '11.10.0';

    return {
      "@aufbau/kits/preact-htm" : `${pkg}/aufbau/kits/preact-htm.js`,
      "@aufbau/elements"        : `${pkg}/aufbau/elements/index.js`,
      "@domina/core"            : `${pkg}/domina/core/index.js`,
      "preact"                  : `https://esm.sh/preact@${PREACT}`,
      "preact/hooks"            : `https://esm.sh/preact@${PREACT}/hooks`,
      "htm"                     : "https://esm.sh/htm@3.1.1",
      "hljs"                    : "https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/+esm"
    };
  }
})();

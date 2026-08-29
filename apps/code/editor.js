// apps/code/editor.js
//
// the editor's own state: the Monaco construction options (persisted as one
// object) plus the Monaco theme catalogue and the loader that pulls a theme's
// json in on demand. this is the port of the old js/editor.js — where that used
// preact-x's deepSignalWithStorage, here the whole options object lives in a
// single `stored()` signal and the update/toggle helpers rewrite it immutably.
//
// https://microsoft.github.io/monaco-editor/docs.html
// https://github.com/brijeshb42/monaco-themes

import { stored } from './../../.shared/js/lib/signals.js';

// ── Monaco theme catalogue ───────────────────────────────────────────────────

const MONACO_THEMES = {
  'active4d'                : 'Active4D',
  'all-hallows-eve'         : 'All Hallows Eve',
  'amy'                     : 'Amy',
  'birds-of-paradise'       : 'Birds of Paradise',
  'blackboard'              : 'Blackboard',
  'brilliance-black'        : 'Brilliance Black',
  'brilliance-dull'         : 'Brilliance Dull',
  'chrome-devtools'         : 'Chrome DevTools',
  'clouds-midnight'         : 'Clouds Midnight',
  'clouds'                  : 'Clouds',
  'cobalt'                  : 'Cobalt',
  'cobalt2'                 : 'Cobalt2',
  'dawn'                    : 'Dawn',
  'dracula'                 : 'Dracula',
  'dreamweaver'             : 'Dreamweaver',
  'eiffel'                  : 'Eiffel',
  'espresso-libre'          : 'Espresso Libre',
  'github-dark'             : 'GitHub Dark',
  'github-light'            : 'GitHub Light',
  'github'                  : 'GitHub',
  'idle'                    : 'IDLE',
  'katzenmilch'             : 'Katzenmilch',
  'kuroir-theme'            : 'Kuroir Theme',
  'lazy'                    : 'LAZY',
  'magicwb--amiga-'         : 'MagicWB (Amiga)',
  'merbivore-soft'          : 'Merbivore Soft',
  'merbivore'               : 'Merbivore',
  'monokai-bright'          : 'Monokai Bright',
  'monokai'                 : 'Monokai',
  'night-owl'               : 'Night Owl',
  'nord'                    : 'Nord',
  'oceanic-next'            : 'Oceanic Next',
  'pastels-on-dark'         : 'Pastels on Dark',
  'slush-and-poppies'       : 'Slush and Poppies',
  'solarized-dark'          : 'Solarized-dark',
  'solarized-light'         : 'Solarized-light',
  'spacecadet'              : 'SpaceCadet',
  'sunburst'                : 'Sunburst',
  'textmate--mac-classic-'  : 'Textmate (Mac Classic)',
  'tomorrow-night-blue'     : 'Tomorrow-Night-Blue',
  'tomorrow-night-bright'   : 'Tomorrow-Night-Bright',
  'tomorrow-night-eighties' : 'Tomorrow-Night-Eighties',
  'tomorrow-night'          : 'Tomorrow-Night',
  'tomorrow'                : 'Tomorrow',
  'twilight'                : 'Twilight',
  'upstream-sunburst'       : 'Upstream Sunburst',
  'vibrant-ink'             : 'Vibrant Ink',
  'xcode-default'           : 'Xcode_default',
  'zenburnesque'            : 'Zenburnesque',
  'iplastic'                : 'iPlastic',
  'idlefingers'             : 'idleFingers',
  'krtheme'                 : 'krTheme',
  'monoindustrial'          : 'monoindustrial',
};
const NATIVE_THEMES = ['vs', 'vs-dark', 'hc-black', 'hc-light'];
const themes        = [...NATIVE_THEMES, ...Object.keys(MONACO_THEMES)];
const themeCache    = new Set();

// ── options (the persisted Monaco construction object) ───────────────────────

const DEFAULTS = {
  autoIndent           : 'none',
  automaticLayout      : true,
  contextmenu          : false,
  cursorBlinking       : 'blink',
  cursorStyle          : 'line',
  cursorWidth          : 2,
  disableLayerHinting  : true,
  dragAndDrop          : true,
  folding              : true,
  fontLigatures        : true,
  fontSize             : 13,
  letterSpacing        : 0,
  lineNumbers          : 'on',
  lineNumbersMinChars  : 3,
  links                : true,
  readOnly             : false,
  renderLineHighlight  : 'none',
  scrollBeyondLastLine : false,
  showUnused           : true,
  tabSize              : 2,
  wordBasedSuggestions : false,
  wordWrap             : 'off',
  wrappingStrategy     : 'simple',
  theme                : 'dracula',
  minimap : {
    enabled          : false,
    renderCharacters : false,
    side             : 'right',
  },
};

// a single signal holding the whole options object; `stored` hydrates it from
// localStorage and writes every change back. we merge over DEFAULTS so options
// added in a later version appear for users who already have a saved object.
const config = stored({ ...DEFAULTS }, 'code:editor-config');
config.value = { ...DEFAULTS, ...config.value, minimap: { ...DEFAULTS.minimap, ...(config.value.minimap ?? {}) } };

// ── option helpers (immutable rewrites of the object) ────────────────────────

const clone = obj => JSON.parse(JSON.stringify(obj));

/** read one option, dotted keys allowed ('minimap.enabled') */
const get = key => key.split('.').reduce((o, k) => (o == null ? o : o[k]), config.value);

/** set one option, dotted keys allowed */
const set = (key, value) => {
  const next  = clone(config.value);
  const parts = key.split('.');
  const last  = parts.pop();
  let target  = next;
  for (const p of parts) target = (target[p] ??= {});
  target[last] = value;
  config.value = next;
};

/** shallow/deep merge a partial options object in */
const updateConfig = (patch) => {
  const next = clone(config.value);
  const merge = (dst, src) => {
    for (const [k, v] of Object.entries(src)) {
      if (v !== null && typeof v === 'object' && !Array.isArray(v)) merge((dst[k] ??= {}), v);
      else dst[k] = v;
    }
  };
  merge(next, patch);
  config.value = next;
};

/** flip a boolean / 'on'|'off' option, dotted keys allowed */
const toggleConfig = (key) => {
  const v = get(key);
  const next = typeof v === 'boolean' ? !v
            : v === 'on'  ? 'off'
            : v === 'off' ? 'on'
            : v;
  set(key, next);
};

// ── Monaco theme loading ─────────────────────────────────────────────────────

const updateTheme = async (themeKey) => {
  const M = self.monaco; // the Monaco namespace, set in components/Editor.js
  if (!M) return;

  if (NATIVE_THEMES.includes(themeKey)) {
    M.editor.setTheme(themeKey);
  } else {
    if (!themeCache.has(themeKey)) {
      const themeName = MONACO_THEMES[themeKey];
      const url       = `https://unpkg.com/monaco-themes/themes/${themeName}.json`;
      const themeData = await fetch(url).then(r => r.json());
      M.editor.defineTheme(themeKey, themeData);
      themeCache.add(themeKey);
    }
    M.editor.setTheme(themeKey);
  }
  set('theme', themeKey);
};

const editor = {
  config,                 // the whole-options signal
  get, set, updateConfig, toggleConfig,
  updateTheme,
  themes,
};

export default editor;
export { editor };

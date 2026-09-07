// apps/code/modules/editor.js
// the Monaco layer. the editor OPTIONS are state and live on app.state.editor (a
// deep-signal subtree, seeded from DEFAULTS and persisted in app.js); this module is
// the behaviour bridge over them — the whole-object `config` view, the option
// read/write helpers, the theme loader and the live editor instance.
// https://microsoft.github.io/monaco-editor/docs.html · https://github.com/brijeshb42/monaco-themes

import { loadMonaco } from './monaco.js';

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

// ── the persisted Monaco construction object (seeded onto app.state.editor) ───

export const DEFAULTS = {
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
  insertSpaces         : true,   // tab inserts spaces; drives the statusbar indent indicator
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

// ── config: a whole-object view over app.state.editor ─────────────────────────
// the module + components treat the options as one object via `config.value`;
// reading returns the deep signal's memoized snapshot ($signal — reactive, stable
// identity that changes only on a real leaf change), assigning replaces every leaf.

const node   = () => zugriff.app.state.editor;
const config = {
  get value ()     { return node().$signal.value; },
  set value (next) { node().$replace(next); },
};

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
  const next  = clone(config.value);
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

// ── the quick-action toolbar (editor actions above the keyboard) ──────────────

const toolbar = [
  { cmd: 'file:save'           , icon: 'save'            },
  { cmd: 'editor:copy'         , icon: 'copy'            },
  { cmd: 'editor:cut'          , icon: 'cut'             },
  { cmd: 'editor:paste'        , icon: 'paste'           },
  { cmd: 'editor:selectAll'    , icon: 'select-all'      },
  { cmd: 'editor:duplicateLine', icon: 'copy-lines-down' },
  { cmd: 'editor:moveLineDown' , icon: 'move-lines-down' },
  { cmd: 'editor:moveLineUp'   , icon: 'move-lines-up'   },
  { cmd: 'editor:joinLines'    , icon: 'join-lines'      },
  { cmd: 'editor:sortLinesAsc' , icon: 'sort-lines'      },
];

// ── the module ────────────────────────────────────────────────────────────────

const editor = {
  config,                                   // whole-options view over app.state.editor
  get, set, updateConfig, toggleConfig,
  updateTheme, themes,
  toolbar,
  load     : loadMonaco,
  instance : null,                          // the live Monaco editor, bound in components/Editor.js
};

export default editor;
export { editor };

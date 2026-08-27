// apps/code/state.js
//
// the one shared app object — the port of the old js/ratcode.js. it was a global
// (`window.ratcode`) that the server's service worker auto-imported into every
// component; here it is an ordinary module export that components import as
// `state`. it holds the UI config (persisted with the shared `stored()` in place
// of preact-x's signalWithCookie), the open-file list, the active modal, the
// toolbar layout, and the command dispatcher.

import { signal } from '@aufbau/kits/preact-htm';
import { stored } from './../../shared/js/lib/signals.js';

import commands from './commands.js';
import editor   from './editor.js';
import fs       from './fs.js';

// ── methods ──────────────────────────────────────────────────────────────────

const methods = {
  closeModal   : ()  => (state.modal.value = null),
  openModal    : id  => (state.modal.value = id),
  toggleModal  : id  => (state.modal.value = state.modal.value === id ? null : id),
  toggleSignal : sig => (sig.value = !sig.value),
};

const state = { commands, editor, fs, ...methods };

// ── UI configuration / panel state (persisted) ───────────────────────────────

const DEFAULT_UI_FONTSIZE = 12;
const DEFAULT_UI_THEME    = 'dracula';

state.config = {
  disableAndroidKeyboard : stored(true,               'code:disableAndroidKeyboard'),
  fileSizeFormat         : stored('formatted',        'code:fileSizeFormat'),
  fontSize               : stored(DEFAULT_UI_FONTSIZE, 'code:fontSize'),
  theme                  : stored(DEFAULT_UI_THEME,   'code:theme'),
  showBrowser            : stored(false,              'code:showBrowser'),
  showKeyboard           : stored(true,               'code:showKeyboard'),
  showStatusbar          : stored(true,               'code:showStatusbar'),
  showToolbar            : stored(true,               'code:showToolbar'),
};

// ── open files ───────────────────────────────────────────────────────────────

state.openFiles  = signal([]);
state.activeFile = signal(null);

// language guessed from the file extension — Monaco's built-in modes only
const LANG_BY_EXT = {
  js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript',
  ts: 'typescript', tsx: 'typescript',
  json: 'json', css: 'css', scss: 'scss', less: 'less',
  html: 'html', htm: 'html', xml: 'xml', svg: 'xml',
  md: 'markdown', markdown: 'markdown',
  php: 'php', py: 'python', rb: 'ruby', go: 'go', rs: 'rust',
  java: 'java', c: 'c', h: 'c', cpp: 'cpp', cc: 'cpp', hpp: 'cpp',
  cs: 'csharp', sh: 'shell', bash: 'shell', yml: 'yaml', yaml: 'yaml',
  sql: 'sql', toml: 'ini', ini: 'ini',
};
export const languageOf = name => LANG_BY_EXT[name.split('.').pop().toLowerCase()] ?? 'plaintext';

/** open a file from its handle (or activate it if already open) */
state.openFile = async (handle) => {
  const existing = state.openFiles.value.find(f => f.handle === handle);
  if (existing) { state.activeFile.value = existing; return existing; }

  const file    = await handle.getFile();
  const content = await file.text();
  const fileObj = { handle, name: handle.name, content, language: languageOf(handle.name), isDirty: false };

  state.openFiles.value  = [...state.openFiles.value, fileObj];
  state.activeFile.value = fileObj;
  return fileObj;
};

/** replace the record for a file in the open list (keeps activeFile in sync) */
state.patchFile = (file, patch) => {
  const next = { ...file, ...patch };
  state.openFiles.value = state.openFiles.value.map(f => f.handle === file.handle ? next : f);
  if (state.activeFile.value?.handle === file.handle) state.activeFile.value = next;
  return next;
};

/** write the active file back to disk (needs write permission on its handle) */
state.saveActiveFile = async () => {
  const file = state.activeFile.value;
  if (!file?.handle?.createWritable) return false;
  const ok = await state.fs.ensureWritePermission(file.handle);
  if (!ok) return false;
  const writable = await file.handle.createWritable();
  await writable.write(file.content);
  await writable.close();
  state.patchFile(file, { isDirty: false });
  return true;
};

/** close a file (activates the previous tab, or none) */
state.closeFile = (file) => {
  const rest = state.openFiles.value.filter(f => f !== file);
  state.openFiles.value = rest;
  if (state.activeFile.value === file) state.activeFile.value = rest.at(-1) ?? null;
};

// ── toolbar ──────────────────────────────────────────────────────────────────

state.toolbar = {
  items: signal([
    { cmd: 'editor:copy'         , icon: 'copy'            },
    { cmd: 'editor:cut'          , icon: 'cut'             },
    { cmd: 'editor:paste'        , icon: 'paste'           },
    { cmd: 'editor:selectAll'    , icon: 'select-all'      },
    { cmd: 'editor:duplicateLine', icon: 'copy-lines-down' },
    { cmd: 'editor:moveLineDown' , icon: 'move-lines-down' },
    { cmd: 'editor:moveLineUp'   , icon: 'move-lines-up'   },
    { cmd: 'editor:joinLines'    , icon: 'join-lines'      },
    { cmd: 'editor:sortLinesAsc' , icon: 'sort-lines'      },
  ]),
};

// ── modal + command dispatch ─────────────────────────────────────────────────

state.modal  = signal(null);
state.exec   = cmd => state.commands.get(cmd)?.exec();
state.monaco = null; // the Monaco editor instance, bound in components/Editor.js

export { state };
export default state;

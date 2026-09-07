// apps/code/app.js
// the code app assembled on the shared handle. the runtime binds `zugriff` (and
// zugriff.app) to window before this module runs, so nothing here imports the runtime —
// app / zugriff are the reference points. this file seeds the app's reactive state on
// app.state, hangs its modules on the handle (app.commands / editor / files /
// workspaces), wires the cross-cutting effects and mounts.

// ::: app modules
import configDefaults                    from './modules/config.js';
import editor, { DEFAULTS as editorDefaults } from './modules/editor.js';
import commands                          from './modules/commands.js';
import files                             from './modules/files.js';
import workspaces                        from './modules/workspaces.js';
import { disableAndroidKeyboard, enableAndroidKeyboard } from './modules/keyboard.js';

// ::: the app handle
const app = zugriff.app;

// :::::: STATE
// seed the app's own reactive state onto the shared base (app.state); theme/font/dir
// already live there from the registry. config + editor are durable deep-signal
// subtrees — app.persist hydrates them and writes each change back.

app.state.modal  = null;                    // active overlay id | null (ephemeral)
app.state.config = { ...configDefaults };   // chrome / panel prefs (persisted)
app.state.editor = { ...editorDefaults };   // monaco construction options (persisted)
app.persist('config');
app.persist('editor');

// :::::: MODULES
// app.editor.config is the bridge to app.state.editor (the options view over the
// subtree above); the rest read app.state / each other through the app handle.

app.commands   = commands;
app.editor     = editor;
app.files      = files;
app.workspaces = workspaces;

// :::::: COMPONENTS
// app-specific components through app.component, the shared overlay through zugriff.

const
Browser     = await app.component('Browser'),
Commands    = await app.component('Commands'),
Dock        = await app.component('Dock'),
Editor      = await app.component('Editor'),
FileBrowser = await app.component('FileBrowser'),
FileList    = await app.component('FileList'),
GitHub      = await app.component('GitHub'),
Keyboard    = await app.component('Keyboard'),
Plugins     = await app.component('Plugins'),
Settings    = await app.component('Settings'),
Statusbar   = await app.component('Statusbar'),
Toolbar     = await app.component('Toolbar'),
WebDAV      = await app.component('WebDAV'),
Workspace   = await app.component('Workspace');

const Prompt = await zugriff.component('Prompt');

// :::::: EFFECTS

const $root = document.documentElement;

// app chrome font size (drives --fontSize in app.css)
app.effect(() => $root.style.setProperty('--fontSize', `${app.state.config.fontSize}px`));

// theme is driven by the shared applyTheme effect off app.state.theme (see
// .shared/js/app/state.js) — it sets data-theme and refreshes the boot colour cache,
// so the app wires no theme effect of its own.

// native (Android) keyboard: hidden while the code keyboard is up, or when the user
// has forced it off in settings
app.effect(() => {
  const forceDisable  = app.state.config.disableAndroidKeyboard;
  const keyboardShown = app.state.config.showKeyboard;
  (forceDisable || keyboardShown) ? disableAndroidKeyboard() : enableAndroidKeyboard();
});

// restore stored GitHub token + saved WebDAV connections in the background
app.workspaces.github.load().catch(() => {});
app.workspaces.webdav.load().catch(() => {});

// :::::: APP

function App () {
  const cfg   = app.state.config;
  const modal = app.state.modal;

  return html`
    <div id="workspace">
      ${cfg.showBrowser   && html`<${Browser} />`}
      ${cfg.showStatusbar && html`<${Statusbar} />`}
      <${FileList} />
      <${Editor} />
      ${cfg.showToolbar && html`<${Toolbar} />`}

      ${modal === 'commands'    && html`<${Commands} />`}
      ${modal === 'filebrowser' && html`<${FileBrowser} />`}
      ${modal === 'github'      && html`<${GitHub} />`}
      ${modal === 'webdav'      && html`<${WebDAV} />`}
      ${modal === 'plugins'     && html`<${Plugins} />`}
      ${modal === 'settings'    && html`<${Settings} />`}
      ${modal === 'workspaces'  && html`<${Workspace} />`}
    </div>

    <div id="underdock">
      ${cfg.showKeyboard && html`<${Keyboard} />`}
      <${Dock} />
    </div>

    <${Prompt} />
  `;
}

// :::::: BOOT
app.init({ App });

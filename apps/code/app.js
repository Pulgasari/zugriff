// code :: app.js

// ::: app modules
import configDefaults from './modules/config.js';
import { DEFAULTS as editorDefaults } from './modules/editor.js';
import { disableAndroidKeyboard, enableAndroidKeyboard } from './modules/keyboard.js';

// ::: the app handle
const app = zugriff.app;

// :::::: STATE
app.state.modal  = null;                    // active overlay id | null (ephemeral)
app.state.config = { ...configDefaults };   // chrome / panel prefs (persisted)
app.state.editor = { ...editorDefaults };   // monaco construction options (persisted)
app.persist('config');
app.persist('editor');

// :::::: MODULES
app.commands   = await app.module('commands');
app.editor     = await app.module('editor');
app.files      = await app.module('files');
app.workspaces = await app.module('workspaces');

// :::::: COMPONENTS

const // local components
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

const // shared components
Prompt = await zugriff.component('Prompt');

// :::::: EFFECTS

const $root = document.documentElement;

app.effect(() => $root.style.setProperty('--fontSize', `${app.state.config.fontSize}px`));

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

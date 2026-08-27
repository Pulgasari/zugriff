// apps/code/app.js
//
// the code editor — a mobile-first IDE. this is the port of ratcode (a PHP +
// Preact app) onto zugriff's static app shell: the PHP template became the
// index.html + shared boot, the server's auto-import service worker became plain
// es-module imports, and preact-x's cookie/storage signals + the internal
// bunker build became the shared `stored()` and `@bunker/db`. Monaco, the code
// keyboard, the command palette and the File System Access workspace all carry
// over. what's still stubbed upstream (Browser / Plugins / Workspaces) stays a
// stub here.

// :::::: IMPORTS :::::::::::::::::::::::::::::::::::::::::::

// ::: vendors
import { html, effect } from '@aufbau/kits/preact-htm';

// ::: shared
import { boot, config } from './../../shared/js/app.js?slug=code';

// ::: local — state first (it wires commands/editor/fs together)
import state from './state.js';

import Statusbar   from './components/Statusbar.js';
import FileList    from './components/FileList.js';
import Editor      from './components/Editor.js';
import Toolbar     from './components/Toolbar.js';
import Dock        from './components/Dock.js';
import Browser     from './components/Browser.js';
import Commands    from './components/Commands.js';
import FileBrowser from './components/FileBrowser.js';
import Plugins     from './components/Plugins.js';
import Settings    from './components/Settings.js';
import Workspace   from './components/Workspace.js';
import Keyboard, { disableAndroidKeyboard, enableAndroidKeyboard } from './components/Keyboard.js';

// :::::: EFFECTS ::::::::::::::::::::::::::::::::::::::::::::

const $root = document.documentElement;

// app chrome font size (drives --fontSize in app.css)
effect(() => $root.style.setProperty('--fontSize', `${state.config.fontSize.value}px`));

// app theme — one of the shared presets; overrides the boot default
effect(() => { $root.dataset.theme = state.config.theme.value; });

// native (Android) keyboard: hidden while the code keyboard is up, or when the
// user has forced it off in settings
effect(() => {
  const forceDisable  = state.config.disableAndroidKeyboard.value;
  const keyboardShown = state.config.showKeyboard.value;
  (forceDisable || keyboardShown) ? disableAndroidKeyboard() : enableAndroidKeyboard();
});

// :::::: APP :::::::::::::::::::::::::::::::::::::::::::::::

function App () {
  const cfg   = state.config;
  const modal = state.modal.value;

  return html`
    <div id="workspace">
      ${cfg.showBrowser.value  && html`<${Browser} />`}
      ${cfg.showStatusbar.value && html`<${Statusbar} />`}
      <${FileList} />
      <${Editor} />
      ${cfg.showToolbar.value && html`<${Toolbar} />`}

      ${modal === 'commands'    && html`<${Commands} />`}
      ${modal === 'filebrowser' && html`<${FileBrowser} />`}
      ${modal === 'plugins'     && html`<${Plugins} />`}
      ${modal === 'settings'    && html`<${Settings} />`}
      ${modal === 'workspaces'  && html`<${Workspace} />`}
    </div>

    <div id="underdock">
      ${cfg.showKeyboard.value && html`<${Keyboard} />`}
      <${Dock} />
    </div>
  `;
}

// :::::: BOOT ::::::::::::::::::::::::::::::::::::::::::::::

boot({ config, App });

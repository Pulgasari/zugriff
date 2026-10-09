// code :: app.js

// ::: app modules
import { useEffect, useRef } from './vendors.js';
import configDefaults from './modules/config.js';
import { DEFAULTS as editorDefaults } from './modules/editor.js';
import { disableAndroidKeyboard, enableAndroidKeyboard } from './modules/keyboard.js';

// ::: the app handle
const app = zugriff.app;

// :::::: STATE
// config and editor are deep: every option is its own signal, read and written as
// app.state.config.fontSize. both persist, stored options merge over the defaults
app.state.$extend({
  modal  : { type: 'scalar', value: null },                                   // active overlay id | null
  config : { type: 'deep',   value: { ...configDefaults }, persist: true },   // chrome / panel prefs
  editor : { type: 'deep',   value: { ...editorDefaults }, persist: true },   // monaco construction options
});

// the overlays are this app's own, one at a time
app.openModal   = id => app.state.modal = id;
app.closeModal  = () => app.state.modal = null;
app.toggleModal = id => app.state.modal = app.state.$modal === id ? null : id;

// :::::: MODULES
app.commands   = await app.module('commands');
app.exec       = id => app.commands.get(id)?.exec();
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

// the overlays are areas of the root, one open at a time. app.state.modal stays
// the one place that says which: the areas follow it, closing an area clears it
const AREA_OF = {
  commands    : 'commands',
  filebrowser : 'files',
  github      : 'files',
  plugins     : 'config',
  settings    : 'config',
  webdav      : 'files',
  workspaces  : 'files',
};

const PANELS = {
  commands    : Commands,
  filebrowser : FileBrowser,
  github      : GitHub,
  plugins     : Plugins,
  settings    : Settings,
  webdav      : WebDAV,
  workspaces  : Workspace,
};

// the panel of the open overlay, when it belongs to this area
function Overlay ({ area }) {
  const modal = app.state.$modal;
  if (AREA_OF[modal] !== area) return null;
  const Panel = PANELS[modal];
  return html`<${Panel} />`;
}

const onToggle = area => event => {
  if (!event.detail?.open && AREA_OF[app.state.$modal] === area) app.closeModal();
};

function App () {
  const cfg  = app.state.config;
  const root = useRef(null);

  useEffect(() => app.effect(() => {
    const open = AREA_OF[app.state.$modal];
    for (const area of root.current?.areas ?? []) {
      if (area.docked) area.toggle(area.getAttr('name') === open);
    }
  }), []);

  return html`
    <app-root ref=${root} routing='none'>
      <app-area name='main'>
        <div id="workspace">
          ${cfg.showBrowser   && html`<${Browser} />`}
          ${cfg.showStatusbar && html`<${Statusbar} />`}
          <${FileList} />
          <${Editor} />
          ${cfg.showToolbar && html`<${Toolbar} />`}
        </div>

        <div id="underdock">
          ${cfg.showKeyboard && html`<${Keyboard} />`}
          <${Dock} />
        </div>

        <${Prompt} />
      </app-area>

      <app-area name='files'    dock='start'  ontoggle=${onToggle('files')}><${Overlay} area='files' /></app-area>
      <app-area name='config'   dock='end'    ontoggle=${onToggle('config')}><${Overlay} area='config' /></app-area>
      <app-area name='commands' dock='bottom' ontoggle=${onToggle('commands')}><${Overlay} area='commands' /></app-area>
    </app-root>
  `;
}

// :::::: BOOT
app.init({ App });

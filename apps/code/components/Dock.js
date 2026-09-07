// apps/code/components/Dock.js
// the bottom bar: modal toggles on the left, undo/commands/redo in the middle,
// panel toggles on the right.

import { html } from './../vendors.js';
import Tap   from './Tap.js';

const app = zugriff.app;

export default function Dock () {
  const modal  = app.state.modal;
  const config = app.state.config;

  return html`
    <div id="dock">
      <div class="section">
        <${Tap} cmd="settings:toggle"    icon="settings"          className=${modal === 'settings'    ? 'active' : ''} />
        <${Tap} cmd="plugins:toggle"     icon="gridicons:plugins" className=${modal === 'plugins'     ? 'active' : ''} />
        <${Tap} cmd="filebrowser:toggle" icon="mdi:file-tree"     className=${modal === 'filebrowser' ? 'active' : ''} />
        <${Tap} cmd="github:toggle"      icon="github"            className=${modal === 'github'      ? 'active' : ''} />
        <${Tap} cmd="webdav:toggle"      icon="mdi:cloud-outline" className=${modal === 'webdav'      ? 'active' : ''} />
      </div>
      <div class="section">
        <${Tap} cmd="editor:undo"     icon="undo" />
        <${Tap} cmd="commands:toggle" icon="commands" className=${modal === 'commands' ? 'active' : ''} />
        <${Tap} cmd="editor:redo"     icon="redo" />
      </div>
      <div class="section">
        <${Tap} cmd="browser:toggle"  icon="mynaui:globe" className=${config.showBrowser  ? 'active' : ''} />
        <${Tap} cmd="keyboard:toggle" icon="keyboard"     className=${config.showKeyboard ? 'active' : ''} />
        <${Tap} cmd="toolbar:toggle"  icon="mdi:tools"    className=${config.showToolbar  ? 'active' : ''} />
      </div>
    </div>
  `;
}

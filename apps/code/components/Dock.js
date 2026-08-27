// apps/code/components/Dock.js
// the bottom bar: modal toggles on the left, undo/commands/redo in the middle,
// panel toggles on the right.

import { html } from '@aufbau/kits/preact-htm';
import state from './../state.js';
import Tap   from './Tap.js';

export default function Dock () {
  const modal  = state.modal.value;
  const config = state.config;

  return html`
    <div id="dock">
      <div class="section">
        <${Tap} cmd="settings:toggle"    icon="settings"          className=${modal === 'settings'    ? 'active' : ''} />
        <${Tap} cmd="plugins:toggle"     icon="gridicons:plugins" className=${modal === 'plugins'     ? 'active' : ''} />
        <${Tap} cmd="filebrowser:toggle" icon="mdi:file-tree"     className=${modal === 'filebrowser' ? 'active' : ''} />
        <${Tap} cmd="workspaces:toggle"  icon="workspaces"        className=${modal === 'workspaces'  ? 'active' : ''} />
      </div>
      <div class="section">
        <${Tap} cmd="editor:undo"     icon="bx:undo" />
        <${Tap} cmd="commands:toggle" icon="bx:command" className=${modal === 'commands' ? 'active' : ''} />
        <${Tap} cmd="editor:redo"     icon="bx:redo" />
      </div>
      <div class="section">
        <${Tap} cmd="browser:toggle"  icon="mynaui:globe" className=${config.showBrowser.value  ? 'active' : ''} />
        <${Tap} cmd="keyboard:toggle" icon="bxs:keyboard" className=${config.showKeyboard.value ? 'active' : ''} />
        <${Tap} cmd="toolbar:toggle"  icon="mdi:tools"    className=${config.showToolbar.value  ? 'active' : ''} />
      </div>
    </div>
  `;
}

// apps/code/components/Toolbar.js
// a quick strip of editor actions above the keyboard.

import { html } from './../vendors.js';
import Tap   from './Tap.js';

const app = zugriff.app;

export default function Toolbar () {
  return html`
    <div id="toolbar">
      ${app.editor.toolbar.map(({ cmd, icon }) => html`<${Tap} cmd=${cmd} icon=${icon} />`)}
    </div>
  `;
}

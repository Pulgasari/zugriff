// apps/code/components/Toolbar.js
// a quick strip of editor actions above the keyboard.

import { html } from '@aufbau/kits/preact-htm';
import state from './../state.js';
import Tap   from './Tap.js';

export default function Toolbar () {
  const items = state.toolbar.items.value;
  return html`
    <div id="toolbar">
      ${items.map(({ cmd, icon }) => html`<${Tap} cmd=${cmd} icon=${icon} />`)}
    </div>
  `;
}

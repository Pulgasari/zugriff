// apps/code/components/Picker.js
// a row of chips; the active value is highlighted.

import { html } from '@aufbau/kits/preact-htm';

export default function Picker ({ callback, options, value }) {
  return html`
    <div class="picker">
      ${options.map(opt => html`
        <button class=${opt === value ? 'active' : ''} onClick=${() => callback(opt)}>${opt}</button>
      `)}
    </div>
  `;
}

// apps/code/components/Dropdown.js

import { html } from '@aufbau/kits/preact-htm';

export default function Dropdown ({ onChange, options, selected }) {
  return html`
    <select onChange=${onChange} value=${selected}>
      ${options.map(opt => {
        const label = Array.isArray(opt) ? opt[0] : opt;
        const value = Array.isArray(opt) ? opt[1] : opt;
        return html`<option value=${value}>${label}</option>`;
      })}
    </select>
  `;
}

// components/Toggle.js
// wraps <aufbau-toggle look='switch'>.

import { html } from './../vendors.js';

function Toggle ({ value = false, onChange, label, look = 'switch' }) {
  const change = event => onChange?.(Boolean(event.target?.checked));

  return html`
    <label class='toggle'>
      <aufbau-toggle look=${look} checked=${value} onChange=${change}></aufbau-toggle>
      ${label && html`<span>${label}</span>`}
    </label>
  `;
}

export       { Toggle };
export default Toggle;

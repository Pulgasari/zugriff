// shared/js/components/Toggle.js
//
// wraps <aufbau-toggle look='switch'>.

import { html } from '@aufbau/kits/preact-htm';

export default function Toggle ({ value = false, onChange, label, look = 'switch' }) {
  // the toggle keeps its state in `checked`, not in `value` — so that is what
  // the change event has to be read from
  const change = event => onChange?.(Boolean(event.target?.checked));

  return html`
    <label class='toggle'>
      <aufbau-toggle look=${look} checked=${value} onChange=${change}></aufbau-toggle>
      ${label && html`<span>${label}</span>`}
    </label>`;
}

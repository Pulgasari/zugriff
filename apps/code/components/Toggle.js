// apps/code/components/Toggle.js

import { html } from '@aufbau/kits/preact-htm';
import Icon from './Icon.js';

export default function Toggle ({ value = false, onChange, label, size = '32' }) {
  const opacity = value ? '100%' : '50%';
  const icon    = value ? 'bx:toggle-right' : 'bx:toggle-left';
  const onClick = () => onChange && onChange(!value);

  return html`
    <div class="toggle" style=${{ opacity }} onClick=${onClick}>
      <${Icon} name=${icon} />
      ${label && html`<span>${label}</span>`}
    </div>
  `;
}

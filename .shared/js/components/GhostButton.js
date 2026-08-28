// shared/js/components/GhostButton.js

import { html } from '@aufbau/kits/preact-htm';
import Icon from './Icon.js';

export default function GhostButton ({ children, icon, label, text, onClick, title }) {
  return html`
    <button class='btn ghost ghost-btn' onClick=${onClick} title=${title}>
      ${icon && html`<${Icon} name=${icon} />`}
      ${children || label || text}
    </button>`;
}

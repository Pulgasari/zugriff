// apps/code/components/KeyboardButton.js

import { html } from '@aufbau/kits/preact-htm';
import Icon from './Icon.js';

export default function KeyboardButton ({ keyValue, icon, label, className = '', active = false, disabled = false, onAction }) {
  const content     = icon ? html`<${Icon} name=${icon} />` : (label || keyValue);
  const onMouseDown = event => { event.preventDefault(); if (!disabled) onAction(keyValue); };

  return html`
    <button
      class=${className}
      disabled=${disabled}
      onMouseDown=${onMouseDown}
      data-active=${active}
      tabindex="-1"
    >
      ${content}
    </button>
  `;
}

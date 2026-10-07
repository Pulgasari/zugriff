// apps/code/components/Toggle.js

import { html } from './../vendors.js';

export default function Toggle ({ value = false, onChange, label, size = '32' }) {
  const opacity = value ? '100%' : '50%';
  const icon    = value ? 'bx:toggle-right' : 'bx:toggle-left';
  const onClick = () => onChange && onChange(!value);

  return html`
    <div class="toggle" style=${{ opacity }} onClick=${onClick}>
      <svg-icon icon=${icon}></svg-icon>
      ${label && html`<span>${label}</span>`}
    </div>
  `;
}

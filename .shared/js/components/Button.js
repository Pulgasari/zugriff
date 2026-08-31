// shared/js/components/Button.js

import { html } from '@aufbau/kits/preact-htm';
import Icon from './Icon.js';

function Button ({ children, className, class: klass, icon, onClick, label, text, disabled, title }) {
  return html`
    <button class=${className || klass} onClick=${onClick} disabled=${disabled} title=${title}>
      ${icon && html`<${Icon} name=${icon} />`}
      ${children || label || text}
    </button>`;
}

export       { Button };
export default Button;

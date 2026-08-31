// .shared/js/components/IconButton.js
// the icon-only button every app kept redefining. styled by the shared `.ibtn`
// class (see .shared/css/components.css); pass `className` to add an app class.
//
//   <${IconButton} icon="arrow-left" label="Back" onClick=${back} />

import { html } from '@aufbau/kits/preact-htm';
import Icon from './Icon.js';

function IconButton ({ icon, label, onClick, disabled, active, className = '', class: klass, title }) {
  const cls = ['ibtn', className || klass, active ? 'active' : ''].filter(Boolean).join(' ');
  return html`
    <button class=${cls} title=${title ?? label} aria-label=${label}
            disabled=${disabled} onClick=${onClick}>
      <${Icon} name=${icon} />
    </button>`;
}

export       { IconButton };
export default IconButton;

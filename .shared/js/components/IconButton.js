// .shared/js/components/IconButton.js

import { html } from '@aufbau/kits/preact-htm';

function IconButton ({ icon, label, onClick, disabled, active }) {
  return html`
    <button 
      class=${'iv-btn' + (active ? ' active' : '')} 
      title=${label}
      aria-label=${label}
      disabled=${disabled} 
      onClick=${onClick}
      >
      <${Icon} name=${icon} />
    </button>
  `;
}

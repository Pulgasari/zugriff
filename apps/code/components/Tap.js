// apps/code/components/Tap.js
// a single tappable icon that fires a command id.

import { html } from '@aufbau/kits/preact-htm';
import state from './../state.js';
import Icon  from './Icon.js';

export default function Tap ({ cmd, icon, className }) {
  return html`
    <div class=${className || ''} onClick=${() => state.exec(cmd)}>
      <${Icon} name=${icon} />
    </div>
  `;
}

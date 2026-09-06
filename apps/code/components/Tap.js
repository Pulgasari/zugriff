// apps/code/components/Tap.js
// a single tappable icon that fires a command id.

import Icon  from '/.shared/js/components/Icon.js';
import state from './../state.js';

export default function Tap ({ cmd, icon, className }) {
  return html`
    <div class=${className || ''} onClick=${() => state.exec(cmd)}>
      <${Icon} name=${icon} />
    </div>
  `;
}

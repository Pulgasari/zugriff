// apps/code/components/Tap.js
// a single tappable icon that fires a command id.

import Icon from '/.shared/js/components/Icon.js';

const app = zugriff.app;

export default function Tap ({ cmd, icon, className }) {
  return html`
    <div class=${className || ''} onClick=${() => app.exec(cmd)}>
      <${Icon} name=${icon} />
    </div>
  `;
}

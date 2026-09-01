// shared/js/components/InstallTip.js
// <${InstallTip} show=${db.sources.value.length > 0} />
// <${InstallTip} message="Install to keep your book folders connected." />

import { html } from '@aufbau/kits/preact-htm';
import Button from './Button.js';
import Icon   from './Icon.js';

const DEFAULT_MESSAGE = 'Install the app so your folders stay connected between visits — no reconnecting.';

function InstallTip ({ message = DEFAULT_MESSAGE }) {
  if (zugriff.app.isInstalled) return null;

  return html`
    <div class="install-tip">
      <${Icon} name="info" />
      <span class="install-tip-text">${message}</span>
      ${zugriff.app.canInstall
        ? html`<${Button} class="small primary" onClick=${zugriff.app.promptInstall} icon="mdi:download" label='Install app' />`      
        : html`<span class="install-tip-hint">Use your browser’s <b>Install</b> / <b>Add to Home screen</b> menu.</span>`}
    </div>`;
}

export       { InstallTip };
export default InstallTip;

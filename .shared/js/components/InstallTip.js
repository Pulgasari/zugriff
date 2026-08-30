// shared/js/components/InstallTip.js
// the "install the app so granted folders stay connected" nudge. every folder
// app used to define its own copy of this; they can render this one instead.
//
// it hides itself once the app is installed. the folder apps only want it while
// folders are actually in use, so the caller passes `show` (usually
// sources.length > 0):
//
//   <${InstallTip} show=${db.sources.value.length > 0} />
//   <${InstallTip} message="Install to keep your book folders connected." />

import { html } from '@aufbau/kits/preact-htm';
import Icon from './Icon.js';
import * as pwa from './../lib/pwa.js';

const DEFAULT_MESSAGE =
  'Install the app so your folders stay connected between visits — no reconnecting.';

function InstallTip ({ show = true, message = DEFAULT_MESSAGE }) {
  if (pwa.installed.value || !show) return null;

  return html`
    <div class="install-tip">
      <${Icon} name="mdi:information-outline" size=${18} />
      <span class="install-tip-text">${message}</span>
      ${pwa.canInstall.value
        ? html`<button class="btn small primary" onClick=${() => pwa.promptInstall()}>
            <${Icon} name="mdi:download" size=${15} /> Install app</button>`
        : html`<span class="install-tip-hint">Use your browser’s <b>Install</b> / <b>Add to Home screen</b> menu.</span>`}
    </div>`;
}

export { InstallTip };
export default InstallTip;

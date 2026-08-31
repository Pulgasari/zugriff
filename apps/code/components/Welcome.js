// apps/code/components/Welcome.js
// shown in the editor pane when no file is open.

import { html } from '@aufbau/kits/preact-htm';
import state from './../state.js';
import Icon  from './Icon.js';

export default function Welcome () {
  return html`
    <div id="welcome">
      <img class="welcome-logo" src="./app.svg" alt="Code" width="160" height="160" />
      <div class="welcome-hint" onClick=${() => state.toggleModal('filebrowser')}>
        <${Icon} name="material-symbols:info" />
        <span>No file selected — grant a folder to start.</span>
      </div>
    </div>
  `;
}

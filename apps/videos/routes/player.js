// apps/videos/routes/player.js
// the player route: the shared video engine's Stage + Controls. the shell's mode
// bar is the chrome here, so there is no per-app topbar.

import { html } from '@aufbau/kits/preact-htm';
import { Stage, Controls } from '/.shared/js/media/videoplayer.js';

function PlayerRoute () {
  return html`
    <div class="vid-player">
      <${Stage} />
      <${Controls} />
    </div>`;
}

export { PlayerRoute };
export default PlayerRoute;

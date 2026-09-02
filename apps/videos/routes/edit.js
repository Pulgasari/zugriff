// apps/videos/routes/edit.js
// hint only for now — the plan is quick clip edits (trim/cut, rotate, flip, crop),
// not an NLE. rotate/flip/crop already exist on the player as live transforms; the
// editor will bake them plus a trim into an exported clip. wired up later.

import { html } from '@aufbau/kits/preact-htm';
import { Icon } from '/.shared/js/components/index.js';
import { src }  from '/.shared/js/media/videoplayer.js';

const PLANNED = [
  { icon: 'mdi:content-cut',     label: 'Trim / cut' },
  { icon: 'mdi:rotate-right',    label: 'Rotate' },
  { icon: 'mdi:flip-horizontal', label: 'Flip / mirror' },
  { icon: 'mdi:crop',            label: 'Crop' },
  { icon: 'mdi:speedometer',     label: 'Speed' },
  { icon: 'mdi:music-note-off',  label: 'Mute / extract audio' },
];

function EditRoute () {
  return html`
    <div class="vid-edit">
      <div class="vid-edit-hint">
        <${Icon} name="mdi:movie-edit-outline" />
        <h2>Quick edits</h2>
        <p>${src.value ? 'Editing tools are on the way.' : 'Open a clip in the player first.'}</p>
        <ul class="vid-edit-planned">
          ${PLANNED.map(t => html`<li key=${t.label}><${Icon} name=${t.icon} /> ${t.label}</li>`)}
        </ul>
      </div>
    </div>`;
}

export { EditRoute };
export default EditRoute;

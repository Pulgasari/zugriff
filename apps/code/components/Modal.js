// apps/code/components/Modal.js

import { html } from '@aufbau/kits/preact-htm';
import state from './../state.js';
import Icon  from './Icon.js';

export default function Modal ({ children, id, title }) {
  return html`
    <div class="modal" id=${id}>
      <div class="inner">
        <div class="aside">
          <span>${title}</span>
          <div class="modal-close" onClick=${() => (state.modal.value = null)}>
            <${Icon} name="close" />
          </div>
        </div>
        <div class="main">
          ${children}
        </div>
      </div>
    </div>
  `;
}

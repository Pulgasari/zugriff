// apps/code/components/Modal.js

import { html } from './../vendors.js';
import Icon from '/.shared/js/components/Icon.js';

const app = zugriff.app;

export default function Modal ({ children, id, title }) {
  return html`
    <div class="modal" id=${id}>
      <div class="inner">
        <div class="aside">
          <span>${title}</span>
          <div class="modal-close" onClick=${() => app.closeModal()}>
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

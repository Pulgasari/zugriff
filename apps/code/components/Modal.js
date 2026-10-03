// apps/code/components/Modal.js
// an overlay's panel. app.js puts it into the area it belongs to, the panel's close
// button closes that area and with it the overlay

import { html } from './../vendors.js';

export default function Modal ({ children, id, title }) {
  return html`
    <app-panel id=${id} heading=${title}>
      <div class="main">${children}</div>
    </app-panel>
  `;
}

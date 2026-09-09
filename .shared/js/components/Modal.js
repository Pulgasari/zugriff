// components/Modal.js
// a centered dialog on a dimming backdrop. `children` are the body, `actions`
// become footer buttons, `onClose` fires on a backdrop click. header and footer
// are only rendered when there is something to put in them.

import { html } from './../vendors.js';
import Button   from './Button.js';

function Modal ({ children, headline, info, actions, onClose, ...rest }) {
  // only the backdrop itself dismisses — clicks inside the dialog bubble up too
  const onBackdrop = e => { if (e.target === e.currentTarget) onClose?.(); };

  return html`
    <div class='ModalScrim' onClick=${onBackdrop}>
      <div class='Modal' ...${rest}>
        ${(headline || info) && html`
          <header>
            ${headline && html`<h2>${headline}</h2>`}
            ${info     && html`<i>${info}</i>`}
          </header>`}

        <main>${children}</main>

        ${actions?.length && html`
          <footer>
            ${actions.map((action, i) => html`<${Button} key=${i} ...${action} />`)}
          </footer>`}
      </div>
    </div>
  `;
}

export       { Modal };
export default Modal;

// components/Modal.js

import Button from './Button.js';

function Modal ({ children, headline, info, actions, onClose, ...rest }) {
  // only the backdrop itself dismisses — clicks inside the dialog bubble up too
  const onBackdrop = e => { if (e.target === e.currentTarget) onClose?.(); };

  return html`
    <div class='modal-backdrop modal-scrim' onClick=${onBackdrop}>
      <div class='modal' ...${rest}>
        ${(headline || info) && html`
          <header>
            ${headline && html`<h2>${headline}</h2>`}
            ${info     && html`<i>${info}</i>`}
          </header>
        `}

        <main>${children}</main>

        ${actions?.length && html`
          <footer>
            ${actions.map((action, i) => html`<${Button} key=${i} ...${action} />`)}
          </footer>
        `}
      </div>
    </div>
  `;
}

export       { Modal };
export default Modal;

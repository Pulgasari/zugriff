// components/Modal.js

import Button from './Button.js';

function ModalScrim ({ children, ...rest }) {
  return html`<div class='ModalScrim' ...${rest}>${children}</div>`;
}

function Modal ({ children, headline, info, actions, ...rest }) {
  return html`
    <${ModalScrim}>
      <div class='Modal' ...${rest}>
        <header>
          ${headline && html`<h2>${headline}</h2>`}
          ${info     && html`<i>${info}</i>`}
        </header>
        
        <main>${children}</main>
        
        <footer>
          ${actions && actions.map(Button)}
        </footer>
      </div>
    </${ModalScrim}>
  `;
}

export default Modal;

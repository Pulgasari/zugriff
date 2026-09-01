// components/Button.js

import { html } from './../vendors.js';
import Icon     from './Icon.js';

function Button ({ children, className, class: klass, icon, onClick, label, text, disabled, title }) {
  return html`
    <button class=${className || klass} ...${{ disabled, onClick, title }}>
      ${icon && html`<${Icon} name=${icon} />`}
      ${children || label || text}
    </button>
  `;
}

export       { Button };
export default Button;

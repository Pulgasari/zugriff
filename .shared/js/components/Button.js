// components/Button.js

import Icon from './Icon.js';

function Button ({ children, icon, label, text, ...rest }) {
  return html`
    <btn-push aria-current=${current} ...${rest}>
      ${icon && html`<${Icon} name=${icon} />`}
      ${children || label || text}
    </btn-push>
  `;
}

export       { Button };
export default Button;

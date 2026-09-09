// components/Link.js
//TODO: 'target' usw automatischje nach URL

import { html } from './../vendors.js';
import Icon     from './Icon.js';

function Link ({ children, className, class: klass, icon, label, text, title, ...rest }) {
  return html`
    <a class=${'Link ' + className || klass} ...${{ href, target, title, ...rest }}>
      ${icon && html`<${Icon} name=${icon} />`}
      ${children || label || text}
    </a>
  `;
}

export       { Link };
export default Link;

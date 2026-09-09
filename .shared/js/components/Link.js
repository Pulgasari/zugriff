// components/Link.js
//TODO: 'target' usw automatischje nach URL

import { html } from './../vendors.js';
import Icon     from './Icon.js';

function Link ({ children, className, class: klass, icon, label, text, ...rest }) {
  const cls = ['Link', className, klass].filter(Boolean).join(' ');
  return html`
    <a class=${cls} target="_blank" rel="noopener" ...${rest}>
      ${icon && html`<${Icon} name=${icon} />`}
      ${children || label || text}
    </a>
  `;
}

export       { Link };
export default Link;

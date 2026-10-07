// components/Link.js
//TODO: 'target' usw automatischje nach URL

import { html } from './../vendors.js';

function Link ({ children, className, class: klass, icon, label, text, ...rest }) {
  const cls = ['Link', className, klass].filter(Boolean).join(' ');
  return html`
    <a class=${cls} target="_blank" rel="noopener" ...${rest}>
      ${icon && html`<svg-icon icon=${icon}></svg-icon>`}
      ${children || label || text}
    </a>
  `;
}

export       { Link };
export default Link;

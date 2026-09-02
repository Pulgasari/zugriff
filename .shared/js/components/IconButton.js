// components/IconButton.js
// <${IconButton} icon="arrow-left" label="Back" onClick=${back} />

import { html } from './../vendors.js';
import Button from './Button.js';

function IconButton ({ className = '', class: klass, ...rest }) {
  //const cls = ['ibtn', className || klass, active ? 'active' : ''].filter(Boolean).join(' ');     
  return html`<${Button} ...${{ class: cls, ...rest }} />`;
}

export       { IconButton };
export default IconButton;

// components/IconButton.js
// <${IconButton} icon="arrow-left" label="Back" onClick=${back} />

import { html } from './../vendors.js';
import Button from './Button.js';

function IconButton (props = {}) {
  return html`<${Button} ...${props} />`;
}

export       { IconButton };
export default IconButton;

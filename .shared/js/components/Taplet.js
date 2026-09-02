// components/Taplet.js

import { html } from './../vendors.js';
import Button from './Button.js';
import Icon   from './Icon.js';

function Taplet ({ icon, size, title, onClick }) {
  return html`
    <${Button} class="taplet" title=${title} onClick=${onClick}>
      <${Icon} name=${icon} />
    </${Button}>
  `;
}

export       { Taplet };
export default Taplet;

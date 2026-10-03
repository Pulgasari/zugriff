// components/Input.js

import { html } from './../vendors.js';

function Input ({ ...props }) {
  return html`<input-value ...${props}></input-value>`;
}

export       { Input };
export default Input;

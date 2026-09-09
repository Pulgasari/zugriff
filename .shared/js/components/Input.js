// components/Input.js

import { html } from './../vendors.js';

function Input ({ ...props }) {
  return html`<aufbau-input ...${props}></aufbau-input>`;
}

export       { Input };
export default Input;

// shared/js/components/Shell.js
//
// the frame around every app: the header the php template used to print
// server-side. the app itself only renders its #app-body.

import { html } from '@aufbau/kits/preact-htm';
import Icon from './Icon.js';

export default function Shell ({ app = {}, actions, children }) {
  return html`
    <div id='app-head'>
      <div id='app-logo'>
        ${app.icon && html`<${Icon} name=${app.icon} />`}
        <span>${app.name}</span>
      </div>
      ${actions && html`<div class='actions'>${actions}</div>`}
    </div>

    ${children}
  `;
}

// components/Shell.js
// the frame around every tool

import { html } from './../vendors.js';

import Icon               from './Icon.js';
import Settings           from './Settings.js';
import { SettingsButton } from './Settings.js';

function Shell ({ app = {}, actions, children }) {
  return html`
    <div id='app-head'>
      <div id='app-logo'>
        ${app.icon && html`<${Icon} name=${app.icon} />`}
        <span>${app.name}</span>
      </div>
      <div class='actions'>
        ${actions}
        <${SettingsButton} />
      </div>
    </div>
    <${Settings} />
    ${children}
  `;
}

export       { Shell };
export default Shell;

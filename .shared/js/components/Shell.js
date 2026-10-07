// components/Shell.js
// the frame around every tool

import { html } from './../vendors.js';

import { SettingsButton, SettingsPanel } from './Settings.js';

function Shell ({ app = {}, actions, children }) {
  return html`
    <div id='app-head'>
      <div id='app-logo'>
        ${app.icon && html`<svg-icon icon=${app.icon}></svg-icon>`}
        <span>${app.name}</span>
      </div>
      <div class='actions'>
        ${actions}
        <${SettingsButton} />
      </div>
    </div>
    <${SettingsPanel} />
    ${children}
  `;
}

export       { Shell };
export default Shell;

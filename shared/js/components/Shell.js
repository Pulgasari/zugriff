// shared/js/components/Shell.js
//
// the frame around every app: the header the php template used to print
// server-side, plus the settings panel that drops in between the header and
// the app's own body. the app itself only renders its #app-body.

import { html } from '@aufbau/kits/preact-htm';
import Icon from './Icon.js';
import Settings, { SettingsButton } from './Settings.js';
import { themeGroup } from './../lib/settings.js';

export default function Shell ({ app = {}, actions, groups = [themeGroup], children }) {
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

    <${Settings} groups=${groups} />

    ${children}
  `;
}

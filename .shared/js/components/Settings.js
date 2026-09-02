// components/Settings.js
// the settings surface. `settingsOpen` is the single shared open-state signal;
// `AppSettings` is the app-facing control — a gear button plus a small panel wired
// straight to zugriff.app.current.state, so a change to theme/font flows through the
// shared state effects (apply + persist) with no per-app settings plumbing.

// :::::: IMPORTS

import Icon from './Icon.js';

import { aufbau, html, signal } from './../vendors.js';
import { themeNames }           from './../data/themes.js';

// :::::: STATE

const settingsOpen   = signal(false);
const toggleSettings = () => settingsOpen.value = !settingsOpen.value;

// :::::: BUTTON

function SettingsButton () {
  return html`
    <button
      class=${'ghost-btn' + (settingsOpen.value ? ' active' : '')}
      onClick=${toggleSettings}
      title="settings"
      aria-expanded=${settingsOpen.value}>
      <${Icon} name="settings" />
    </button>`;
}

// :::::: APP SETTINGS
// reads the page's active app off the runtime (set by zugriff.app('<slug>')), so a
// shared component needs no prop-drilling to reach this app's state.

function SettingsPanel () {
  const app = globalThis.zugriff?.app?.current;
  if (!app) return null;

  const { state } = app;
  const fonts = aufbau.webfonts?.fonts ?? [];

  return html`
    <div id="app-settings" class="app-settings" role="dialog" aria-label="Settings">
      <div class="app-settings-head">
        <span>Settings</span>
        <button class="ghost-btn" aria-label="Close" onClick=${toggleSettings}><${Icon} name="close" /></button>
      </div>

      <label class="app-settings-row">
        <span>Theme</span>
        <select value=${state.theme} onChange=${e => state.theme = e.target.value}>
          ${themeNames.map(name => html`<option key=${name} value=${name}>${name}</option>`)}
        </select>
      </label>

      <label class="app-settings-row">
        <span>Font</span>
        <select value=${state.font} onChange=${e => state.font = e.target.value}>
          <option value="Manrope">default</option>
          ${fonts.map(f => html`<option key=${f.id} value=${f.id}>${f.name}</option>`)}
        </select>
      </label>
    </div>`;
}

function AppSettings () {
  return html`
    <${SettingsButton} />
    ${settingsOpen.value && html`<${SettingsPanel} />`}`;
}

// tools mount this through Shell; the app panel is the live surface for now
function Settings () {
  return settingsOpen.value ? html`<${SettingsPanel} />` : null;
}

// :::::: EXPORT

export       { Settings, SettingsButton, AppSettings, settingsOpen, toggleSettings };
export default Settings;

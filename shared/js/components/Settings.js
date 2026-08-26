// shared/js/components/Settings.js
//
// renders whatever a settings group describes. it knows the three types, not
// the settings themselves — a new entry in a schema shows up here by itself.
//
//   <${Settings} groups=${[{ title: 'theme', settings: theme }]} />
//
// TODO:should use `aufbau.gui` (@aufbau/runtime/gui.js)

// :::::: IMPORT

import { html, signal } from '@aufbau/kits/preact-htm';
import Icon   from './Icon.js';
import Taplet from './Taplet.js';

import Picker from './Picker.js';
import Toggle from './Toggle.js';

// :::::: STATE + HELPERS

const LOOK_THRESHOLD = 4;
const lookFor        = entry => entry.look ?? (entry.values.length > LOOK_THRESHOLD ? 'combobox' : 'segments');
const settingsOpen   = signal(false);
const toggleSettings = () => settingsOpen.value = !settingsOpen.value;
//const toggleSettings = () => toggleSignal(settingsOpen);

// :::::: COMPONENTS

function Field ({ group, name }) {
  const entry = group.schema[name];
  const value = group.signals[name].value;
  const set   = next => group.set(name, next);
  
  const control = entry.type === 'boolean' ? html`<${Toggle} value=${value} onChange=${set} />`
                : entry.type === 'enum'    ? html`<${Picker} look=${lookFor(entry)} options=${entry.values} value=${value} onChange=${set} />`     
                : entry.type === 'color'   ? html`<div class="setting-options"><input type="color" value=${value} onInput=${event => set(event.target.value)} /><code class="setting-value">${value}</code></div>`     
                : html`<code class="setting-value">${String(value)}</code>`;

  return html`
    <div class=${'setting setting-' + entry.type}>
      <code class="setting-key">${name}</code>
      ${control}
    </div>`;
}


function Group ({ group }) {
  const { title, settings } = group;

  return html`
    <section>
      <header>
        <code class="settings-title">${title}</code>
        <button class="ghost-btn" onClick=${settings.reset} title="back to defaults">
          <${Icon} name="mdi:restore" /> reset
        </button>
      </header>
      ${settings.keys.map(name => html`<${Field} key=${name} group=${settings} name=${name} />`)}
    </section>`;
}

function Settings ({ groups = [] }) {
  if (!settingsOpen.value) return null;

  return html`
    <div id="app-settings">
      ${groups.map(group => html`<${Group} key=${group.title} group=${group} />`)}
    </div>`;
}

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

// :::::: EXPORT

export {
  settingsOpen,
  toggleSettings,
  // components
  Settings,
  SettingsButton,
}

export default Settings;

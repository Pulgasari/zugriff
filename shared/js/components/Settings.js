// shared/js/components/Settings.js
//
// renders whatever a settings group describes. it knows the three types, not
// the settings themselves — a new entry in a schema shows up here by itself.
//
//   <${Settings} groups=${[{ title: 'theme', settings: theme }]} />

import { html, signal } from '@aufbau/kits/preact-htm';
import Icon from './Icon.js';
import Toggle from './Toggle.js';

/** one panel per document, so the header button can toggle it from anywhere */
export const settingsOpen = signal(false);

export const toggleSettings = () => settingsOpen.value = !settingsOpen.value;

function Field ({ group, name }) {
  const entry = group.schema[name];
  const value = group.signals[name].value;
  const set   = next => group.set(name, next);

  const control =
      entry.type === 'boolean' ? html`<${Toggle} value=${value} onChange=${set} />`

    : entry.type === 'enum' ? html`
        <div class="setting-options">
          ${entry.values.map(option => html`
            <button
              key=${option}
              class=${'chip' + (value === option ? ' active' : '')}
              onClick=${() => set(option)}>
              ${option}
            </button>`)}
        </div>`

    : entry.type === 'color' ? html`
        <div class="setting-options">
          <input type="color" value=${value} onInput=${event => set(event.target.value)} />
          <code class="setting-value">${value}</code>
        </div>`

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
    <section class="settings-group">
      <header class="settings-group-head">
        <code class="settings-title">${title}</code>
        <button class="ghost-btn" onClick=${() => settings.reset()} title="back to defaults">
          <${Icon} name="mdi:restore" /> reset
        </button>
      </header>
      ${settings.keys.map(name => html`<${Field} key=${name} group=${settings} name=${name} />`)}
    </section>`;
}

export default function Settings ({ groups = [] }) {
  if (!settingsOpen.value) return null;

  return html`
    <div id="app-settings">
      ${groups.map(group => html`<${Group} key=${group.title} group=${group} />`)}
    </div>`;
}

export function SettingsButton () {
  return html`
    <button
      class=${'ghost-btn' + (settingsOpen.value ? ' active' : '')}
      onClick=${toggleSettings}
      title="settings"
      aria-expanded=${settingsOpen.value}>
      <${Icon} name="settings" />
    </button>`;
}

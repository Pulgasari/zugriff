// components/Settings.js
// the settings of an app. `Settings` is the core: a form rendered by @aufbau/gui
// from the app's settings schema, bound to zugriff.app.state. the frames around
// it are the app's choice:
//
//   SettingsView  — a view of its own, e.g. a route
//   SettingsModal — a modal dialog on <aufbau-modal>
//   SettingsPanel — a panel that drops in below the app's header
//
// modal and panel follow `settingsOpen` unless `open` and `onClose` are given,
// so an app can bind them to its own state, e.g. app.state.dialog.
// SettingsButton toggles `settingsOpen`.
//
//   <${SettingsButton} />
//   <${SettingsModal} />
//
// an app adds its own fields as a spec, their changes go to `onChange`, the
// shared ones (theme and the registry schema) keep writing into app.state:
//
//   <${Settings} fields=${{ proxy: { type: 'url', label: 'CORS proxy' } }}
//                values=${{ proxy: proxy.value }}
//                onChange=${(values, key) => key === 'proxy' && (proxy.value = values.proxy)} />

// :::::: IMPORTS

import Icon from './Icon.js';
import View from './View.js';

import { gestalt } from '@aufbau/api';
import gui         from '@aufbau/gui';
import webfonts    from '@aufbau/webfonts';

import { signal, useEffect, useRef } from './../vendors.js';

// :::::: STATE

const settingsOpen   = signal(false);
const closeSettings  = () => settingsOpen.value = false;
const toggleSettings = () => settingsOpen.value = !settingsOpen.value;

// :::::: SPEC

const labelOf = key => key[0].toUpperCase() + key.slice(1);

// palette is the one field every app carries, the rest comes from the registry
// schema (font, dir …). an enum with `source: 'webfonts'` gets the catalog as values
function sharedSpec (config, palettes) {
  const fonts = [['', 'default'], ...(webfonts?.fonts ?? []).map(font => [font.id, font.name])];
  const spec  = { palette: { type: 'enum', look: 'combobox', values: palettes, default: 'dracula', label: 'Palette' } };

  for (const [key, entry] of Object.entries(config.settings ?? {})) {
    const wf = entry.source === 'webfonts' ? { values: fonts } : {};
    spec[key] = { label: labelOf(key), ...entry, ...wf };
  }

  return spec;
}

// :::::: CORE

function Settings ({ fields = {}, onChange, values = {} }) {
  const app  = globalThis.zugriff?.app;
  const host = useRef(null);

  useEffect(() => {
    if (!app || !host.current) return;
    let closed = false;

    // the palette names come from aufbau's palettes.css, loaded once
    gestalt.palettes().then(palettes => {
      if (closed) return;
      const shared = sharedSpec(app.config, palettes);
      const spec   = { ...shared, ...fields };
      const form   = gui.render(spec, {
        values   : { ...Object.fromEntries(Object.keys(shared).map(key => [key, app.state['$' + key]])), ...values },   // the leaf's value, not its signal
        onChange : (next, key) => {
          if (key == null) return;
          if (key in shared) app.state[key] = next[key];
          onChange?.(next, key);
        },
      });
      host.current?.replaceChildren(form);
    });

    return () => { closed = true; host.current?.replaceChildren(); };
  }, [app]);

  if (!app) return null;

  return html`<div class="settings" ref=${host}></div>`;
}

// :::::: FRAMES

function SettingsButton () {
  return html`
    <button
      class=${'ghost-btn' + (settingsOpen.value ? ' active' : '')}
      onClick=${toggleSettings}
      title="Settings"
      aria-expanded=${settingsOpen.value}>
      <${Icon} name="settings" />
    </button>
  `;
}

function SettingsModal ({ open = settingsOpen.value, onClose = closeSettings, ...props }) {
  const modal = useRef(null);

  // escape, the backdrop and the close button close the dialog itself, the state follows
  useEffect(() => {
    const element = modal.current;
    const closed  = event => { if (!event.detail?.open) onClose(); };
    element?.addEventListener('aufbau-modal', closed);
    return () => element?.removeEventListener('aufbau-modal', closed);
  }, [onClose]);

  // the form is built on opening, so it shows the values of that moment
  return html`
    <aufbau-modal ref=${modal} class="settings-modal" heading="Settings" open=${open}>
      ${open && html`<${Settings} ...${props} />`}
    </aufbau-modal>
  `;
}

function SettingsPanel ({ open = settingsOpen.value, onClose = closeSettings, ...props }) {
  if (!open) return null;

  return html`
    <div id="app-settings" class="settings-panel" role="dialog" aria-label="Settings">
      <header>
        <span class="settings-title">Settings</span>
        <button class="ghost-btn" aria-label="Close" onClick=${onClose}><${Icon} name="close" /></button>
      </header>
      <${Settings} ...${props} />
    </div>
  `;
}

function SettingsView (props) {
  return html`
    <${View} class='settings-view' title='settings'>
      <${Settings} ...${props} />
    </${View}>
  `;
}

// :::::: EXPORT

export {
  Settings,
  SettingsButton,
  SettingsModal,
  SettingsPanel,
  SettingsView,
  
  settingsOpen,

  closeSettings,
  toggleSettings,
};
export default Settings;

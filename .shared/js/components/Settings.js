// components/Settings.js
// the settings surface. `settingsOpen` is the single shared open-state signal;
// `AppSettings` is the app-facing control — a gear button plus a panel built by
// @aufbau/runtime/gui.js straight from the app's settings schema, so every app
// gets a settings ui from its registry entry with no per-app plumbing. a change
// writes into zugriff.app.current.state, which drives the shared state effects
// (theme/font/dir apply + persist).

// :::::: IMPORTS

import Icon from './Icon.js';

import gui                          from '@aufbau/runtime/gui.js';
import { aufbau, html, signal, useEffect, useRef } from './../vendors.js';
import { themeNames, DEFAULT_THEME } from './../data/themes.js';

// :::::: STATE

const settingsOpen   = signal(false);
const toggleSettings = () => settingsOpen.value = !settingsOpen.value;

// :::::: SPEC
// theme is the one cross-cutting field; the rest comes verbatim from the app's
// registry settings schema (font, dir, …). the font enum's values are filled from
// the webfont catalog at build time, the registry stays import-free.

function buildSpec (config) {
  const fonts      = aufbau.webfonts?.fonts ?? [];
  const fontValues = [['', 'default'], ...fonts.map(f => [f.id, f.name])];
  const labelOf    = key => key[0].toUpperCase() + key.slice(1);

  const spec = {
    theme: { type: 'enum', look: 'combobox', values: themeNames, default: DEFAULT_THEME, label: 'Theme' },
  };
  for (const [key, entry] of Object.entries(config.settings ?? {}))
    spec[key] = { label: labelOf(key), ...entry, ...(key === 'font' ? { values: fontValues } : {}) };

  return spec;
}

// :::::: COMPONENTS

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

// reads the page's active app off the runtime (set by zugriff.app('<slug>')), so a
// shared component reaches this app's state without prop-drilling. gui.controls
// returns a live dom subtree, mounted into the panel via a ref.
function SettingsPanel () {
  const app  = globalThis.zugriff?.app?.current;
  const host = useRef(null);

  useEffect(() => {
    if (!app || !host.current) return;
    const spec   = buildSpec(app.config);
    const values = Object.fromEntries(Object.keys(spec).map(key => [key, app.state[key]]));
    const panel  = gui.controls(spec, {
      values,
      onChange: (next, key) => { if (key != null) app.state[key] = next[key]; },
    });
    host.current.replaceChildren(panel);
    return () => host.current?.replaceChildren();
  }, [app]);

  if (!app) return null;

  return html`
    <div id="app-settings" class="app-settings" role="dialog" aria-label="Settings">
      <div class="app-settings-head">
        <span>Settings</span>
        <button class="ghost-btn" aria-label="Close" onClick=${toggleSettings}><${Icon} name="close" /></button>
      </div>
      <div class="app-settings-fields" ref=${host}></div>
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

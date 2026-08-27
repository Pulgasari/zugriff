// shared/js/components/Settings.js
//
// renders whatever a settings group describes. the fields themselves are built
// by aufbau.gui (@aufbau/runtime/gui.js): each group's schema is handed to
// gui.controls(), which turns it into <aufbau-*> controls, and the DOM it
// returns is mounted into the preact tree through a ref. this component only
// owns the chrome around them — the open/close toggle, the per-group header and
// its reset button — so a new entry in a schema shows up here by itself.
//
//   <${Settings} groups=${[{ title: 'theme', settings: theme }]} />

// :::::: IMPORT

import { html, signal, useRef, useEffect, useState } from '@aufbau/kits/preact-htm';
import * as gui from '@aufbau/runtime/gui.js';
import Icon from './Icon.js';
import { appGroup, themeGroup } from './../lib/settings.js';

// :::::: STATE + HELPERS

const settingsOpen   = signal(false);
const toggleSettings = () => settingsOpen.value = !settingsOpen.value;

// :::::: COMPONENTS

// mounts one group's fields as aufbau controls. gui.controls() builds a detached
// DOM subtree from the schema and, given onChange, reports the changed field back
// so we can write it into the group's signal (which runs the group's onSet hook).
// `nonce` bumps on reset to rebuild the controls from the freshly defaulted values.
function GuiFields ({ settings, nonce }) {
  const ref = useRef(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;

    const values = Object.fromEntries(settings.keys.map(key => [key, settings.value(key)]));
    const fields = gui.controls(settings.schema, {
      values,
      wrap : 'div',
      onChange (vals, name) {
        if (name && name in settings.schema) settings.set(name, vals[name]);
      },
    });

    host.replaceChildren(fields);
    return () => host.replaceChildren();
  }, [settings, nonce]);

  return html`<div class="settings-fields" ref=${ref}></div>`;
}

function Group ({ group }) {
  const { title, settings } = group;
  const [nonce, setNonce] = useState(0);

  // reset defaults the signals, then rebuilds the controls so they show it
  const reset = () => { settings.reset(); setNonce(n => n + 1); };

  return html`
    <section class="settings-group">
      <header>
        <code class="settings-title">${title}</code>
        <button class="ghost-btn" onClick=${reset} title="back to defaults">
          <${Icon} name="reset" /> reset
        </button>
      </header>
      <${GuiFields} settings=${settings} nonce=${nonce} />
    </section>`;
}

// just the group sections — no open/close gating, no panel wrapper. this is what
// an app folds into its own settings dialog to show, say, only the app (font/dir)
// group inline.
function SettingsGroups ({ groups = [] }) {
  return groups.map(group => html`<${Group} key=${group.title} group=${group} />`);
}

// the standalone panel: gated by the shared settingsOpen signal and wrapped in
// #app-settings. `overlay` marks it as the fixed dropdown the /apps chrome uses
// (styled by shared/css/settings.css); the tools Shell + launcher leave it off
// and keep the inline panel their own sheets style.
function Settings ({ groups = [], overlay = false }) {
  if (!settingsOpen.value) return null;

  return html`
    <div id="app-settings" class=${overlay ? 'app-settings-overlay' : ''}>
      <${SettingsGroups} groups=${groups} />
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

// drop-in for an app that draws its own chrome: the header gear plus the overlay
// panel, defaulting to the predefined app settings (font + direction) and theme.
// place it in the app's header actions — the panel positions itself.
function AppSettings ({ groups = [appGroup, themeGroup] }) {
  return html`
    <${SettingsButton} />
    <${Settings} groups=${groups} overlay />`;
}

// :::::: EXPORT

export {
  settingsOpen,
  toggleSettings,
  // components
  Settings,
  SettingsGroups,
  SettingsButton,
  AppSettings,
}

export default Settings;

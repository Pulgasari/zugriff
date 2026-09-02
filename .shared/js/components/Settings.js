// components/Settings.js

// :::::: IMPORT

import Button      from './Button.js';
import GhostButton from './GhostButton.js';
import Icon        from './Icon.js';

import { aufbau, html, preact, signal } from './../vendors.js';
const { gui } = aufbau;
const { useEffect, useRef, useState } = preact;

// :::::: STATE + HELPERS

const settingsOpen   = signal(false);
const toggleSettings = () => settingsOpen.value = !settingsOpen.value;

// :::::: COMPONENTS

function Settings ({ options, overlay = false }) {
  if (!settingsOpen.value) return null;

  return html`
    <div id="app-settings" class=${overlay ? 'overlay' : ''}>
      ... render by gui ...
    </div>
  `;
}

function SettingsButton () {
  return html`
    <button
      class=${'ghost-btn' + (settingsOpen.value ? ' active' : '')}
      onClick=${toggleSettings}
      title="settings"
      aria-expanded=${settingsOpen.value}>
      <${Icon} name="settings" />
    </button>
  `;
}

// :::::: EXPORT

export       { Settings, SettingsButton, settingsOpen, toggleSettings }
export default Settings;

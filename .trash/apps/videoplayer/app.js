// apps/videoplayer/app.js
// the standalone player: the shared engine (@shared/media/videoplayer) plus this
// app's own chrome (topbar + settings sheet). the videos app reuses the same
// engine in its player route.

// ::: vendors
import { html, signal } from '@aufbau/kits/preact-htm';

// ::: shared
import { zugriff } from '/.shared/js/runtime.js';
const app    = zugriff.app('videoplayer');
const config = app.config;
import { Icon, Taplet, AppSettings } from '/.shared/js/components/index.js';
import { title, chromeHidden, Stage, Controls } from '/.shared/js/media/videoplayer.js';

// :::::: CHROME

const settingsOpen = signal(false);

function SettingsTaplet () {
  return html`<${Taplet} icon='settings' title='Settings' onClick=${() => settingsOpen.value = true} />`;
}

function TopBar () {
  return html`
    <header class="topbar">
      <span class="title">${title.value || config.name}</span>
      <span class="spacer"></span>
      <${SettingsTaplet} />
    </header>`;
}

function SettingsPanel () {
  if (!settingsOpen.value) return null;
  return html`
    <div class="sheet-backdrop" onClick=${() => settingsOpen.value = false}>
      <aside class="sheet" onClick=${e => e.stopPropagation()}>
        <header class="sheet-head">
          <strong>Settings</strong>
          <button class="icon-btn" title="Close" onClick=${() => settingsOpen.value = false}>
            <${Icon} name="mdi:close" />
          </button>
        </header>
        <div class="sheet-body">
          <${AppSettings} />
        </div>
      </aside>
    </div>`;
}

// :::::: APP

function App () {
  return html`
    <div id="app-main" class=${chromeHidden.value ? 'chrome-off' : ''}>
      <${TopBar} />
      <${Stage} />
      <${Controls} />
      <${SettingsPanel} />
    </div>`;
}

// :::::: BOOT

app.init({ App });

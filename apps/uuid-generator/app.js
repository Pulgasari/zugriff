// apps/uuid-generator/app.js

// ::: vendors
import { html, signal } from '@aufbau/kits/preact-htm';

// ::: shared
import { boot } from './../../shared/js/app.js';
import { CopyIcon, Icon } from './../../shared/js/components/index.js';
import { stored } from './../../shared/js/lib/signals.js';

// ::: local
import * as config from './app.config.js';

let count   = stored(5,    'uuidgen:count');
let version = stored('v4', 'uuidgen:version');
let uuids   = signal([]);
let copied  = signal(null);

let VERSIONS = ['v4', 'v1'];

function genV4 () {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    let r = crypto.getRandomValues(new Uint8Array(1))[0] & 15;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function genV1 () {
  // pseudo-v1: timestamp-based, not spec-compliant but useful
  let now  = Date.now();
  let time = (BigInt(now) * 10000n + 122192928000000000n).toString(16).padStart(16, '0');
  let t1   = time.slice(-8);
  let t2   = time.slice(-12, -8);
  let t3   = '1' + time.slice(-15, -12);
  let rand = [...crypto.getRandomValues(new Uint8Array(8))].map(b => b.toString(16).padStart(2,'0')).join('');
  let clock = ((parseInt(rand.slice(0,2), 16) & 0x3f) | 0x80).toString(16).padStart(2,'0');
  return `${t1}-${t2}-${t3}-${clock}${rand.slice(2,6)}-${rand.slice(6)}`;
}

function generate () {
  let gen = version.value === 'v4' ? genV4 : genV1;
  uuids.value = Array.from({ length: count.value }, gen);
}

function copyOne (uuid) {
  navigator.clipboard.writeText(uuid);
  copied.value = uuid;
  setTimeout(() => copied.value = null, 1500);
}

function copyAll () {
  navigator.clipboard.writeText(uuids.value.join('\n'));
  copied.value = '__all__';
  setTimeout(() => copied.value = null, 1500);
}

// generate on load
generate();

function App() {
  let list = uuids.value;
  return html`
    <div id="app-body">
      
      <div class="controls">
        <div class="version-picker">
          ${VERSIONS.map(v => html`
            <button class=${'chip' + (version.value === v ? ' active' : '')}
              onClick=${() => { version.value = v; generate(); }}>${v}</button>`)}
        </div>
        <div class="count-row">
          <label>Count</label>
          <input type="range" min=1 max=100 value=${count.value}
            onInput=${e => count.value = +e.target.value}
            style="flex:1;accent-color:var(--accent)" />
          <span class="count-val">${count.value}</span>
        </div>
        <div class="actions">
          <button class="btn primary" onClick=${generate}>
            <${Icon} name="mdi:refresh" /> Generate
          </button>
          ${list.length > 0 && html`
            <button class="btn secondary" onClick=${copyAll}>
              <${Icon} name=${copied.value === '__all__' ? 'mdi:check' : 'mdi:content-copy'} />
              ${copied.value === '__all__' ? 'Copied!' : 'Copy all'}
            </button>`}
        </div>
      </div>
      
      <div class="uuid-list">
        ${list.map(uuid => html`
          <div class="uuid-row" onClick=${() => copyOne(uuid)} title="Click to copy">
            <code class="uuid">${uuid}</code>
            <${Icon} name=${copied.value === uuid ? 'mdi:check' : 'mdi:content-copy'} class="copy-icon" />
          </div>`)}
        ${list.map(uuid => html`
          <div class="uuid-row">
            <code class="uuid">${uuid}</code>
            <${CopyIcon} content=${uuid} />
          </div>`)}
      </div>
    </div>
  `;
}

boot({ config, App });

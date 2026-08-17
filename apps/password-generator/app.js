// apps/password-generator/app.js

// ::: vendors
import { html, signal } from '@aufbau/kits/preact-htm';

// ::: shared
import { boot } from './../../shared/js/app.js';
import { Icon, Toggle } from './../../shared/js/components/index.js';
import { stored } from './../../shared/js/lib/signals.js';

// ::: local
import * as config from './app.config.js';

// ── charsets ──────────────────────────────────────────────────────────────────
let CHARS = {
  upper   : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lower   : 'abcdefghijklmnopqrstuvwxyz',
  digits  : '0123456789',
  symbols : '!@#$%^&*()-_=+[]{}|;:,.<>?',
  similar : 'iIlL1oO0',
};

let WORDLIST_URL = 'https://raw.githubusercontent.com/EFF/BIP39-English/master/wordlist.txt';

// ── state ─────────────────────────────────────────────────────────────────────
let mode      = stored('random',   'pwgen:mode');   // random | passphrase | pin
let length    = stored(16,          'pwgen:length');
let useUpper  = stored(true,        'pwgen:upper');
let useLower  = stored(true,        'pwgen:lower');
let useDigits = stored(true,        'pwgen:digits');
let useSymbols= stored(false,       'pwgen:symbols');
let noSimilar = stored(false,       'pwgen:nosimilar');
let wordCount = stored(4,           'pwgen:words');
let separator = stored('-',         'pwgen:sep');
let pinLength = stored(6,           'pwgen:pinlen');
let count     = stored(5,           'pwgen:count');
let passwords = signal([]);
let copied    = signal(null);
let   wordlist  = null;

// ── entropy ───────────────────────────────────────────────────────────────────
function calcEntropy() {
  if (mode.value === 'pin') {
    return +(Math.log2(Math.pow(10, pinLength.value))).toFixed(1);
  }
  if (mode.value === 'passphrase') {
    let wl = wordlist?.length ?? 2048;
    return +(Math.log2(Math.pow(wl, wordCount.value))).toFixed(1);
  }
  let pool = '';
  if (useUpper.value)   pool += CHARS.upper;
  if (useLower.value)   pool += CHARS.lower;
  if (useDigits.value)  pool += CHARS.digits;
  if (useSymbols.value) pool += CHARS.symbols;
  if (noSimilar.value)  pool = [...pool].filter(c => !CHARS.similar.includes(c)).join('');
  return pool.length ? +(Math.log2(Math.pow(pool.length, length.value))).toFixed(1) : 0;
}

let entropyLabel = e =>
  e < 40  ? { label: 'Weak',   color: '#e06c75' } :
  e < 60  ? { label: 'Fair',   color: '#d19a66' } :
  e < 80  ? { label: 'Strong', color: '#98c379' } :
            { label: 'Very strong', color: '#56b6c2' };

// ── random bytes ──────────────────────────────────────────────────────────────
function randInt(max) {
  let arr = new Uint32Array(1);
  let result;
  do {
    crypto.getRandomValues(arr);
    result = arr[0];
  } while (result >= Math.floor(0xffffffff / max) * max); // rejection sampling
  return result % max;
}

// ── generators ────────────────────────────────────────────────────────────────
function genRandom() {
  let pool = '';
  if (useUpper.value)   pool += CHARS.upper;
  if (useLower.value)   pool += CHARS.lower;
  if (useDigits.value)  pool += CHARS.digits;
  if (useSymbols.value) pool += CHARS.symbols;
  if (noSimilar.value)  pool = [...pool].filter(c => !CHARS.similar.includes(c)).join('');
  if (!pool) return '(enable at least one charset)';

  // guarantee at least one char from each enabled set
  let required = [];
  if (useUpper.value)   required.push(pickFrom(CHARS.upper,   noSimilar.value));
  if (useLower.value)   required.push(pickFrom(CHARS.lower,   noSimilar.value));
  if (useDigits.value)  required.push(pickFrom(CHARS.digits,  noSimilar.value));
  if (useSymbols.value) required.push(pickFrom(CHARS.symbols, false));

  let rest = Array.from({ length: Math.max(0, length.value - required.length) },
    () => pool[randInt(pool.length)]);

  return shuffle([...required, ...rest]).join('');
}

function pickFrom (charset, noSim) {
  let pool = noSim ? [...charset].filter(c => !CHARS.similar.includes(c)).join('') : charset;
  return pool[randInt(pool.length)];
}

function shuffle (arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    let j = randInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function getWordlist() {
  if (wordlist) return wordlist;
  let res  = await fetch(WORDLIST_URL);
  let text = await res.text();
  wordlist   = text.trim().split('\n').map(w => w.trim()).filter(Boolean);
  return wordlist;
}

async function genPassphrase() {
  let wl  = await getWordlist();
  let sep = separator.value;
  return Array.from({ length: wordCount.value }, () => wl[randInt(wl.length)]).join(sep);
}

function genPIN() {
  return Array.from({ length: pinLength.value }, () => randInt(10)).join('');
}

// ── main generate ─────────────────────────────────────────────────────────────
async function generate() {
  let n   = count.value;
  let gen = mode.value === 'passphrase' ? genPassphrase
          : mode.value === 'pin'        ? async () => genPIN()
          :                               async () => genRandom();
  passwords.value = await Promise.all(Array.from({ length: n }, gen));
}

function copyOne(pw) {
  navigator.clipboard.writeText(pw);
  copied.value = pw;
  setTimeout(() => copied.value = null, 1500);
}

function copyAll() {
  navigator.clipboard.writeText(passwords.value.join('\n'));
  copied.value = '__all__';
  setTimeout(() => copied.value = null, 1500);
}

// generate on load
generate();

// ── components ────────────────────────────────────────────────────────────────

function EntropyBar() {
  let e   = calcEntropy();
  let { label, color } = entropyLabel(e);
  let pct = Math.min(100, (e / 128) * 100);
  return html`
    <div class="entropy">
      <div class="entropy-bar">
        <div class="entropy-fill" style=${{ width: pct + '%', background: color }} />
      </div>
      <span class="entropy-label" style=${{ color }}>${e} bits — ${label}</span>
    </div>`;
}

function RandomSettings() {
  return html`
    <div class="settings-group">
      <div class="setting-row">
        <label>Length <span class="val">${length.value}</span></label>
        <input type="range" min=4 max=128 value=${length.value}
          onInput=${e => length.value = +e.target.value}
          style="flex:1;accent-color:var(--accent)" />
      </div>
      <div class="toggles">
        <${Toggle} value=${useUpper.value} onChange=${v => useUpper.value = v}   label="A–Z uppercase" />
        <${Toggle} value=${useLower.value} onChange=${v => useLower.value = v}   label="a–z lowercase" />
        <${Toggle} value=${useDigits.value} onChange=${v => useDigits.value = v}  label="0–9 digits"    />
        <${Toggle} value=${useSymbols.value} onChange=${v => useSymbols.value = v} label="!@# symbols"   />
        <${Toggle} value=${noSimilar.value} onChange=${v => noSimilar.value = v}  label="No similar chars (i l 1 o 0)" />
      </div>
    </div>`;
}

function PassphraseSettings() {
  let SEPS = ['-', '.', '_', ' ', '/'];
  return html`
    <div class="settings-group">
      <div class="setting-row">
        <label>Words <span class="val">${wordCount.value}</span></label>
        <input type="range" min=2 max=10 value=${wordCount.value}
          onInput=${e => wordCount.value = +e.target.value}
          style="flex:1;accent-color:var(--accent)" />
      </div>
      <div class="setting-row">
        <label>Separator</label>
        <div class="chip-group">
          ${SEPS.map(s => html`
            <button class=${'chip' + (separator.value === s ? ' active' : '')}
              onClick=${() => separator.value = s}>
              ${s === ' ' ? '·space·' : s}
            </button>`)}
          <input class="field sep-input" type="text" maxlength=3 value=${separator.value}
            onInput=${e => separator.value = e.target.value}
            placeholder="custom" />
        </div>
      </div>
    </div>`;
}

function PINSettings() {
  return html`
    <div class="settings-group">
      <div class="setting-row">
        <label>Length <span class="val">${pinLength.value}</span></label>
        <input type="range" min=4 max=12 value=${pinLength.value}
          onInput=${e => pinLength.value = +e.target.value}
          style="flex:1;accent-color:var(--accent)" />
      </div>
    </div>`;
}

function PasswordRow({ pw }) {
  let isCopied = copied.value === pw;
  return html`
    <div class="pw-row" onClick=${() => copyOne(pw)} title="Click to copy">
      <code class="pw-value">${pw}</code>
      <${Icon} name=${isCopied ? 'mdi:check' : 'mdi:content-copy'} class="copy-icon" />
    </div>`;
}

// ── App ───────────────────────────────────────────────────────────────────────
let MODES = [
  { id: 'random',     icon: 'mdi:dice-multiple-outline', label: 'Random'     },
  { id: 'passphrase', icon: 'mdi:text',                  label: 'Passphrase' },
  { id: 'pin',        icon: 'mdi:numeric',               label: 'PIN'        },
];

function App() {
  let m    = mode.value;
  let list = passwords.value;

  return html`
    <div id="app-body">
      
      <div class="mode-picker">
        ${MODES.map(({ id, icon, label }) => html`
          <button class=${'mode-btn' + (m === id ? ' active' : '')}
            onClick=${() => { mode.value = id; generate(); }}>
            <${Icon} name=${icon} /> ${label}
          </button>`)}
      </div>
      
      <div class="panel">
        ${m === 'random'     && html`<${RandomSettings} />`}
        ${m === 'passphrase' && html`<${PassphraseSettings} />`}
        ${m === 'pin'        && html`<${PINSettings} />`}
        
        <${EntropyBar} />
        
        <div class="count-row">
          <label>Generate <span class="val">${count.value}</span></label>
          <input type="range" min=1 max=20 value=${count.value}
            onInput=${e => count.value = +e.target.value}
            style="flex:1;accent-color:var(--accent)" />
        </div>

        <div class="actions">
          <button class="btn primary" onClick=${generate}>
            <${Icon} name="mdi:refresh" /> Generate
          </button>
          ${list.length > 1 && html`
            <button class="btn secondary" onClick=${copyAll}>
              <${Icon} name=${copied.value === '__all__' ? 'mdi:check' : 'mdi:content-copy'} />
              ${copied.value === '__all__' ? 'Copied!' : 'Copy all'}
            </button>`}
        </div>
      </div>

      <div class="pw-list">
        ${list.map(pw => html`<${PasswordRow} key=${pw} pw=${pw} />`)}
      </div>
    </div>`;
}

boot({ config, App });

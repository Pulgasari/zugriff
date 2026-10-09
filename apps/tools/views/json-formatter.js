// tools :: views/json-formatter.js

// ::: vendors
import { html, signal } from '/.shared/js/vendors.js';

// ::: shared
import { CodeInputPane, CodeOutputPane } from '/.shared/js/components/code.js';

// ::: local

// ── state ──────────────────────────────────────────────────────────────────

const input  = zugriff.app.persisted('json-formatter:input', '');
const indent = zugriff.app.persisted('json-formatter:indent', 2);
const output = signal('');
const status = signal('idle');
const errMsg = signal('');

const INDENTS = [
  { value: 2,    label: '2 spaces' },
  { value: 4,    label: '4 spaces' },
  { value: '\t', label: 'tab'      },
];

// ── logic ──────────────────────────────────────────────────────────────────

function doFormat () {
  const src = input.value.trim();
  if (!src) return;

  errMsg.value = '';
  try {
    output.value = JSON.stringify(JSON.parse(src), null, indent.value);
    status.value = 'done';
  } catch (error) {
    errMsg.value = error.message;
    status.value = 'error';
    output.value = '';
  }
}

function setIndent (value) {
  indent.value = value;
  if (output.value) doFormat();
}

const clear = () => {
  input.value  = '';
  output.value = '';
  errMsg.value = '';
  status.value = 'idle';
};

// ── components ─────────────────────────────────────────────────────────────

function IndentPicker () {
  return html`
    <div class="indent-picker">
      <span class="indent-label">Indent</span>
      ${INDENTS.map(({ value, label }) => html`
        <button
          class=${'chip' + (indent.value === value ? ' active' : '')}
          onClick=${() => setIndent(value)}>
          ${label}
        </button>`)}
    </div>`;
}

function App () {
  return html`
    <div class="tool-body">

      <div class="panes">
        <${CodeInputPane}  lang='json' signal=${input}  placeholder="Paste JSON here…" filename="input.json" />
        <${CodeOutputPane} lang='json' signal=${output} filename="formatted.json"
                           status=${status} errorMessage=${errMsg}
                           placeholder="Formatted JSON appears here…" />
      </div>

      <div id="app-actions">
        <button class="btn primary" onClick=${doFormat} disabled=${!input.value}>
          <svg-icon icon="mdi:auto-fix" /> Format
        </button>
        <${IndentPicker} />
        <button class="btn secondary" onClick=${clear} disabled=${!input.value}>
          <svg-icon icon="mdi:close" /> Clear
        </button>
      </div>

    </div>`;
}

export default App;

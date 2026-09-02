// blueprints/DataInspectorApp.js
// paste data -> parse -> browse it as a tree. the parse/format pair is what
// makes it a json, yaml, toml or csv inspector.

import { html, signal, preact } from './../vendors.js';
const { useState } = preact;

import CodeInputPane from './../components/CodeInputPane.js';
import Icon          from './../components/Icon.js';

import { stored }    from './../lib/signals.js'; // needs: @aufbau/signals

// ── shared type helpers ───────────────────────────────────────────────────────
let typeOf    = v => v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v;
let typeIcon  = t => ({ object:'mdi:code-braces', array:'mdi:code-brackets', string:'mdi:format-quote-close', number:'mdi:numeric', boolean:'mdi:toggle-switch-outline', null:'mdi:null' })[t] ?? 'mdi:help';
let typeColor = t => ({ string:'var(--c-string)', number:'var(--c-number)', boolean:'var(--c-bool)', null:'var(--c-null)' })[t];

let matchesSearch = (node, q) => JSON.stringify(node).toLowerCase().includes(q.toLowerCase());

let copyVal  = val  => navigator.clipboard.writeText(typeof val === 'string' ? val : JSON.stringify(val, null, 2));
let copyPath = path => navigator.clipboard.writeText(path);

// ── Node ──────────────────────────────────────────────────────────────────────
function Node ({ keyName, value, path, depth = 0 }) {
  let type      = typeOf(value);
  let isComplex = type === 'object' || type === 'array';
  let [open, setOpen] = useState(depth < 3);

  if (isComplex) {
    let entries = type === 'array' ? value.map((v,i) => [i,v]) : Object.entries(value);
    let bracket = type === 'array' ? ['[',']'] : ['{','}'];
    return html`
      <div class=${'node depth-' + depth}>
        <div class="node-row" onClick=${() => setOpen(o => !o)}>
          <${Icon} name=${open ? 'mdi:chevron-down' : 'mdi:chevron-right'} class="toggle-icon" />
          ${keyName !== undefined && html`<span class="node-key">${keyName}</span><span class="colon">:</span>`}
          <${Icon} name=${typeIcon(type)} class="type-icon" />
          <span class="bracket">${bracket[0]}</span>
          ${!open && html`<span class="preview">${entries.length} ${entries.length === 1 ? 'item' : 'items'}</span><span class="bracket">${bracket[1]}</span>`}
          <div class="node-actions" onClick=${e => e.stopPropagation()}>
            <button class="act-btn" title="Copy path"  onClick=${() => copyPath(path)}><${Icon} name="mdi:vector-link" /></button>
            <button class="act-btn" title="Copy value" onClick=${() => copyVal(value)}><${Icon} name="mdi:content-copy" /></button>
          </div>
        </div>
        ${open && html`
          <div class="node-children">
            ${entries.map(([k,v]) => html`
              <${Node} key=${k} keyName=${k} value=${v}
                path=${type === 'array' ? path+'['+k+']' : path+'.'+k}
                depth=${depth + 1} />`)}
          </div>
          <div class="node-row closing"><span class="bracket">${bracket[1]}</span></div>`}
      </div>`;
  }

  let strVal = value === null ? 'null' : type === 'string' ? '"' + value + '"' : String(value);
  return html`
    <div class=${'node depth-' + depth}>
      <div class="node-row leaf">
        <span class="leaf-indent" />
        ${keyName !== undefined && html`<span class="node-key">${keyName}</span><span class="colon">:</span>`}
        <${Icon} name=${typeIcon(type)} class="type-icon" style=${{ color: typeColor(type) }} />
        <span class="prim-val" style=${{ color: typeColor(type) }}>${strVal}</span>
        <div class="node-actions">
          <button class="act-btn" title="Copy path"  onClick=${() => copyPath(path)}><${Icon} name="mdi:vector-link" /></button>
          <button class="act-btn" title="Copy value" onClick=${() => copyVal(value)}><${Icon} name="mdi:content-copy" /></button>
        </div>
      </div>
    </div>`;
}

// ── Stats ─────────────────────────────────────────────────────────────────────
function collectStats (val, stats = { keys:0, strings:0, numbers:0, booleans:0, nulls:0, depth:0 }, depth = 0) {
  stats.depth = Math.max(stats.depth, depth);
  let type = typeOf(val);
  if (type === 'object' || type === 'array') {
    if (type === 'object') stats.keys += Object.keys(val).length;
    (type === 'array' ? val : Object.values(val)).forEach(v => collectStats(v, stats, depth + 1));
  } else {
    if (type === 'string')  stats.strings++;
    if (type === 'number')  stats.numbers++;
    if (type === 'boolean') stats.booleans++;
    if (type === 'null')    stats.nulls++;
  }
  return stats;
}
function Stats ({ value }) {
  let s = collectStats(value);
  return html`
    <div class="stats-bar">
      ${[
        ['mdi:code-braces',           s.keys,     'keys'      ],
        ['mdi:format-quote-close',    s.strings,  'strings'   ],
        ['mdi:numeric',               s.numbers,  'numbers'   ],
        ['mdi:toggle-switch-outline', s.booleans, 'booleans'  ],
        ['mdi:null',                  s.nulls,    'nulls'     ],
        ['mdi:arrow-collapse-down',   s.depth,    'max depth' ],
      ].map(([icon, val, label]) => val > 0 && html`
        <span class="stat"><${Icon} name=${icon} /> ${val} ${label}</span>`)}
    </div>`;
}

// ── factory ───────────────────────────────────────────────────────────────────
function DataInspectorApp ({
  appID,
  lang        = 'plaintext',
  icon        = 'mdi:code-json',
  placeholder = 'Paste data here …',
  parse,                          // (src: string) => any — throws on error
  format,                         // optional (data) => string — enables Format button
  emptyIcon   = 'mdi:code-json',
  emptyLabel  = 'Paste data and click Inspect',
}) {
  let input  = stored('', appID + ':input');
  let parsed = signal(null);
  let errMsg = signal('');
  let search = signal('');

  function doParse() {
    let src = input.value.trim();
    if (!src) { parsed.value = null; errMsg.value = ''; return; }
    try { parsed.value = parse(src); errMsg.value = ''; }
    catch(e) { parsed.value = null; errMsg.value = e.message; }
  }

  let doFormat = format ? () => {
    if (!parsed.value) return;
    input.value = format(parsed.value);
    doParse();
  } : null;

  let clear = () => { input.value = ''; parsed.value = null; errMsg.value = ''; search.value = ''; };

  function App() {
    let data = parsed.value;
    let err  = errMsg.value;
    let q    = search.value;

    let filteredNode = (v, path, depth) => {
      if (!q) return html`<${Node} value=${v} path=${path} depth=${depth} />`;
      if (!matchesSearch(v, q)) return null;
      return html`<${Node} value=${v} path=${path} depth=${depth} />`;
    };

    return html`
      <div id="app-body">
        <div class="layout">

          <div class="input-col">
            <${CodeInputPane} sig=${input} lang=${lang} placeholder=${placeholder} />
            <div class="input-actions">
              <button class="btn primary" onClick=${doParse} disabled=${!input.value}>
                <${Icon} name="mdi:magnify" /> Inspect
              </button>
              ${doFormat && data && html`
                <button class="btn secondary" onClick=${doFormat}>
                  <${Icon} name="mdi:auto-fix" /> Format
                </button>`}
              ${input.value && html`
                <button class="btn secondary" onClick=${clear}>
                  <${Icon} name="mdi:close" /> Clear
                </button>`}
            </div>
            ${err && html`
              <div class="err-block">
                <${Icon} name="mdi:alert-circle-outline" /> ${err}
              </div>`}
          </div>

          <div class="tree-col">
            ${data !== null && data !== undefined ? html`
              <${Stats} value=${data} />
              <div class="search-row">
                <${Icon} name="mdi:magnify" class="search-icon" />
                <input class="search-input" type="text" placeholder="Filter keys & values…"
                  value=${q} onInput=${e => search.value = e.target.value} />
                ${q && html`<button class="act-btn" onClick=${() => search.value = ''}><${Icon} name="mdi:close" /></button>`}
              </div>
              <div class="tree">
                ${filteredNode(data, '$', 0)}
              </div>
            ` : html`
              <div class="tree-empty">
                <${Icon} name=${emptyIcon} />
                <span>${emptyLabel}</span>
              </div>`}
          </div>

        </div>
      </div>`;
  }

  return App;
}

export       { DataInspectorApp, typeColor, typeIcon, typeOf };
export default DataInspectorApp;

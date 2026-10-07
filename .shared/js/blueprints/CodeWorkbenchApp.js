// blueprints/CodeWorkbenchApp.js
/*
input pane -> execute() -> output pane. without `formats` it transforms, with
them it converts.

const App = CodeWorkbenchApp({ appID, lang, execute });

with `formats` the output side gets a format switcher and execute() is
called as execute(src, formatId).
*/

import { debounce, html, effect, signal } from './../vendors.js';

import CodeInputPane  from './../components/CodeInputPane.js';
import CodeOutputPane from './../components/CodeOutputPane.js';
import Icon           from './../components/Icon.js';

// muss aufs neue @aufbau/signals umgestellt werden
import { typedSignal } from '@aufbau/signals';

function CodeWorkbenchApp ({
  appID        = 'app',
  debounceTime = 1000,

  // fallbacks, used when the panes are not configured separately
  lang    = 'javascript',
  langExt = 'js',

  inputLang  = null,
  inputExt   = null,
  outputLang = null,
  outputExt  = null,

  placeholder       = 'Paste code here…',
  outputPlaceholder = 'Output appears here…',
  inputFilename     = null,
  outputFilename    = null,
  actionLabel       = 'Run',

  // optional output format switcher: [{ id, label, lang, ext }]
  formats = null,

  execute, // (src, formatId?) => string | Promise<string>

  couldURL     = true,
  couldUpload  = true,
  uploadAccept = 'text/*',
}) {
  const iLang = inputLang  ?? lang;
  const iExt  = inputExt   ?? langExt;
  const oLang = outputLang ?? lang;
  const oExt  = outputExt  ?? langExt;

  const live   = typedSignal({ value: false, key: appID + ':live' });
  const input  = typedSignal({ value: '', key: appID + ':input' });
  const output = signal('');
  const status = signal('idle');
  const errMsg = signal('');
  const stats  = signal(null);

  const fmt = formats ? typedSignal({ value: formats[0].id, key: appID + ':fmt' }) : null;

  const activeFmt  = () => fmt ? formats.find(f => f.id === fmt.value) : null;
  const activeLang = () => activeFmt()?.lang ?? oLang;
  const activeExt  = () => activeFmt()?.ext  ?? oExt;

  const filenameInput  = inputFilename ?? 'input.' + iExt;
  const filenameOutput = () => outputFilename ?? 'output.' + activeExt();

  async function doExecute () {
    const src = input.value.trim();

    if (!src) {
      output.value = '';
      stats.value  = null;
      status.value = 'idle';
      errMsg.value = '';
      return;
    }

    status.value = 'running';
    errMsg.value = '';

    try {
      const out = await execute(src, fmt?.value);
      output.value = out;
      stats.value  = { before: src.length, after: out.length, ratio: Math.round((1 - out.length / src.length) * 100) };
      status.value = 'done';
    } catch (error) {
      errMsg.value = error.message;
      status.value = 'error';
      output.value = '';
      stats.value  = null;
    }
  }

  const debouncedExecute = debounce(doExecute, debounceTime);

  effect(() => live.value && (input.value, debouncedExecute()));
  if (fmt) effect(() => { fmt.value; if (input.value) doExecute(); });
  if (input.value) doExecute();

  return function App () {
    const busy = status.value === 'running';

    return html`
      <div id="app-body">

        <div class="panes">
          <${CodeInputPane}
            signal=${input}
            lang=${iLang}
            filename=${filenameInput}
            placeholder=${placeholder}
            couldURL=${couldURL}
            couldUpload=${couldUpload}
            uploadAccept=${uploadAccept}
          />
          <${CodeOutputPane}
            signal=${output}
            lang=${activeLang()}
            filename=${filenameOutput()}
            placeholder=${outputPlaceholder}
            status=${status}
            errorMessage=${errMsg}
            stats=${stats}
          />
        </div>

        <div id="app-actions">
          ${formats && html`
            <div class="format-picker">
              ${formats.map(f => html`
                <button
                  class=${'chip' + (fmt.value === f.id ? ' active' : '')}
                  onClick=${() => fmt.value = f.id}>
                  ${f.label}
                </button>`)}
            </div>`}

          ${!live.value && html`
            <button class="btn primary" onClick=${doExecute} disabled=${busy || !input.value}>
              <${Icon} name=${busy ? 'mdi:loading' : 'mdi:lightning-bolt'} className=${busy ? 'spin' : ''} />
              ${busy ? 'Running…' : actionLabel}
            </button>`}

          <label class='toggle'><input-bool look='switch' checked=${live.value} onChange=${e => live.value = e.target.checked}></input-bool><span>Live-Mode</span></label>
        </div>

      </div>
    `;
  };
}

export       { CodeWorkbenchApp };
export default CodeWorkbenchApp;

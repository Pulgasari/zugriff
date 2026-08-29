// tools/downloader/app.js

// ::: vendors
import { html, signal } from '@aufbau/kits/preact-htm';

// ::: shared
import { boot, config } from './../../.shared/js/app.js?slug=downloader';
import { Icon } from './../../.shared/js/components/index.js';

// ::: local

let url     = signal('');
let status  = signal('idle'); // idle | loading | done | error
let errMsg  = signal('');
let outName = signal('');

/*
let download = (blob, name) => {
  let a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob), download: name,
  });
  a.click();
  URL.revokeObjectURL(a.href);
};
*/

let doDownload = () => {
  let src = url.value.trim();
  if (!src) return;
  window.location.href = src;
};

let basename = str => {
  try { return new URL(str).pathname.split('/').filter(Boolean).pop() || 'download'; }
  catch { return 'download'; }
};

let onKeyDown = e => { if (e.key === 'Enter') doDownload(); };

function App() {
  let busy = status.value === 'loading';
  return html`
    <div id="app-body">
      
      <div class="input-row">
        <input
          class="field url-input"
          type="url"
          placeholder="https://example.com/file.js"
          spellcheck="false"
          value=${url.value}
          onInput=${e => { url.value = e.target.value; status.value = 'idle'; }}
          onKeyDown=${onKeyDown}
        />
        <button class="btn primary" onClick=${doDownload} disabled=${busy || !url.value}>
          <${Icon} name=${busy ? 'mdi:loading' : 'mdi:download'} class=${busy ? 'spin' : ''} />
          ${busy ? 'Fetching…' : 'Download'}
        </button>
      </div>
      
    </div>`;
}

boot({ config, App });

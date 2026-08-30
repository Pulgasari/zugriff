// shared/js/components/CodeOutputPane.js

import { html, useEffect, useRef } from '@aufbau/kits/preact-htm';
import GhostButton from './GhostButton.js';
import Icon        from './Icon.js';
import { hljs, ensureLang } from './hljs.js';

function Highlighted ({ code, lang, innerRef }) {
  const ref = useRef(null);

  // ensureLang() is async, and the first call for a language takes far longer
  // than the ones after it — without the cancel flag a slow early render lands
  // last and paints stale output over the current one
  useEffect(() => {
    if (!ref.current) return;
    let cancelled = false;

    ensureLang(lang).then(() => {
      if (cancelled || !ref.current) return;
      ref.current.removeAttribute('data-highlighted');
      ref.current.textContent = code;
      hljs.highlightElement(ref.current);
    });

    return () => { cancelled = true; };
  }, [code, lang]);

  if (!code) return null;

  return html`
    <pre class="output-pre"><code
      class=${'language-' + lang}
      ref=${node => { ref.current = node; if (innerRef) innerRef.current = node; }}
    ></code></pre>`;
}

function CodeOutputPane ({
  sig, status, errorMessage, filename, stats,
  lang        = 'javascript',
  title       = 'Output',
  placeholder = 'Output appears here…',
}) {
  const hasOut = !!sig.value;
  const s      = stats?.value;
  const codeRef = useRef(null);

  const copy   = () => navigator.clipboard.writeText(sig.value);
  const select = () => {
    if (!codeRef.current) return;
    const range = document.createRange();
    range.selectNodeContents(codeRef.current);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  };
  const download = () => {
    if (!filename) return;
    const a = Object.assign(document.createElement('a'), {
      href     : URL.createObjectURL(new Blob([sig.value], { type: 'text/plain' })),
      download : filename,
    });
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return html`
    <div class="pane">

      <div class="pane-header">
        <span class='pane-title'>${title}</span>
        <div class='pane-actions'>
          ${hasOut && html`
            <${GhostButton} icon='mdi:content-copy' text='Copy' onClick=${copy} />
            ${filename && html`<${GhostButton} icon='mdi:download' text='Download' onClick=${download} />`}
            <${GhostButton} icon='mdi:select-all' text='Select' onClick=${select} />
          `}
        </div>
      </div>

      <div class=${'output-wrap' + (!hasOut ? ' empty' : '')}>
        ${!hasOut && status?.value !== 'error' && html`
          <span class="placeholder">${placeholder}</span>
        `}
        ${status?.value === 'error' && html`
          <div class="err-block">
            <${Icon} name="mdi:alert-circle-outline" /><pre>${errorMessage?.value}</pre>
          </div>
        `}
        ${hasOut && html`<${Highlighted} code=${sig.value} lang=${lang} innerRef=${codeRef} />`}
      </div>

      <div class="pane-footer">
        ${hasOut && html`
          <span class="stats">
            ${s && html`<span class="stat-badge">${s.ratio}% smaller</span> ${s.after} chars`}
          </span>
        `}
      </div>

    </div>`;
}

export       { CodeOutputPane };
export default CodeOutputPane;

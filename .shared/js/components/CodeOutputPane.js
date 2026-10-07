// shared/js/components/CodeOutputPane.js

import { html, useEffect, useRef } from './../vendors.js';
import { hljs, ensureLang }        from './hljs.js';

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
  signal, status, errorMessage, filename, stats,
  lang        = 'javascript',
  title       = 'Output',
  placeholder = 'Output appears here…',
}) {
  const hasOut = !!signal.value;
  const s      = stats?.value;
  const codeRef = useRef(null);

  const copy   = () => navigator.clipboard.writeText(signal.value);
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
      href     : URL.createObjectURL(new Blob([signal.value], { type: 'text/plain' })),
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
            <btn-tap icon='mdi:content-copy' label='Copy' onClick=${copy} />
            ${filename && html`<btn-tap icon='mdi:download' label='Download' onClick=${download} />`}
            <btn-tap icon='mdi:select-all' label='Select' onClick=${select} />
          `}
        </div>
      </div>

      <div class=${'output-wrap' + (!hasOut ? ' empty' : '')}>
        ${!hasOut && status?.value !== 'error' && html`
          <span class="placeholder">${placeholder}</span>
        `}
        ${status?.value === 'error' && html`
          <div class="err-block">
            <svg-icon icon="mdi:alert-circle-outline"></svg-icon><pre>${errorMessage?.value}</pre>
          </div>
        `}
        ${hasOut && html`<${Highlighted} code=${signal.value} lang=${lang} innerRef=${codeRef} />`}
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

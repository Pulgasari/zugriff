// shared/js/components/CodeInputPane.js
//
// an editable, syntax highlighted code pane. it is a contenteditable <code>
// rather than a textarea, which is why the cursor has to be restored by hand
// after every repaint.

import { html, useEffect, useRef } from './../vendors.js';
import { Prompt, openPrompt }      from './Prompt.js';
import { hljs, ensureLang }        from './hljs.js';

// ── cursor helpers ─────────────────────────────────────────────────────────

function getCursor (el) {
  const sel = window.getSelection();
  if (!sel.rangeCount) return 0;
  const range = sel.getRangeAt(0).cloneRange();
  range.selectNodeContents(el);
  range.setEnd(sel.getRangeAt(0).endContainer, sel.getRangeAt(0).endOffset);
  return range.toString().length;
}

function setCursor (el, pos) {
  const sel   = window.getSelection();
  const range = document.createRange();
  let chars = 0, found = false;

  (function traverse (node) {
    if (found) return;
    if (node.nodeType === Node.TEXT_NODE) {
      const end = chars + node.length;
      if (end >= pos) {
        range.setStart(node, pos - chars);
        range.collapse(true);
        found = true;
      } else { chars = end; }
    } else {
      for (const child of node.childNodes) traverse(child);
    }
  })(el);

  if (!found) { range.selectNodeContents(el); range.collapse(false); }
  sel.removeAllRanges();
  sel.addRange(range);
}

// ── component ──────────────────────────────────────────────────────────────

function CodeInputPane ({
  filename, signal,
  placeholder   = 'Paste code here …',
  lang          = 'javascript',
  title         = 'Input',
  couldDownload = false,
  couldSelect   = false,
  couldUpload   = true,
  couldURL      = true,
  uploadAccept  = 'text/*',
}) {
  const ref       = useRef(null);
  const shownLang = useRef(null);
  const fileRef   = useRef(null);

  // the dom is only rewritten when it does not already show the signal's value.
  // typing updates the element first and the signal second, so this leaves the
  // caret alone — and because ensureLang() is async the check has to happen on
  // both sides of the await, otherwise a fast typist races their own repaint.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.textContent === signal.value && shownLang.current === lang) return;

    let cancelled = false;

    ensureLang(lang).then(() => {
      const el = ref.current;
      if (cancelled || !el) return;

      const langChanged = shownLang.current !== lang;
      shownLang.current = lang;
      if (el.textContent === signal.value && !langChanged) return;

      const focused = document.activeElement === el;
      const pos     = focused ? getCursor(el) : 0;

      el.textContent = signal.value;
      el.removeAttribute('data-highlighted');
      if (signal.value) hljs.highlightElement(el);
      if (focused) setCursor(el, Math.min(pos, signal.value.length));
    });

    return () => { cancelled = true; };
  }, [signal.value, lang]);

  const onInput = () => {
    const el  = ref.current;
    const pos = getCursor(el);
    signal.value = el.textContent;
    el.removeAttribute('data-highlighted');
    if (el.textContent) hljs.highlightElement(el);
    setCursor(el, pos);
  };

  const onKeyDown = event => {
    if (event.key !== 'Tab') return;
    event.preventDefault();
    const selection = window.getSelection();
    const range     = selection.getRangeAt(0);
    const tab       = document.createTextNode('  ');
    range.deleteContents();
    range.insertNode(tab);
    range.setStartAfter(tab);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    onInput();
  };

  const clear  = () => signal.value = '';
  const copy   = () => navigator.clipboard.writeText(signal.value);
  const select = () => {
    const range = document.createRange();
    range.selectNodeContents(ref.current);
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

  const onFileChange = event => {
    const file = event.target.files?.[0];
    if (!file) return;
    file.text().then(text => signal.value = text);
    event.target.value = '';
  };
  const triggerUpload = () => fileRef.current?.click();

  const loadFromURL = () => openPrompt({
    title       : 'Load from URL',
    placeholder : 'https://example.com/file.txt',
    type        : 'url',
    onConfirm   : async url => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(res.statusText);
        signal.value = await res.text();
      } catch (error) {
        alert('Fetch failed: ' + error.message);
      }
    },
  });

  return html`
    <div class="pane">

      <div class="pane-header">
        <span class="pane-title">${title}</span>
        <div class="pane-actions">
          ${couldUpload && html`
            <input type="file" ref=${fileRef} accept=${uploadAccept} style="display:none" onChange=${onFileChange} />
            <btn-tap icon="mdi:upload" label="Upload" onClick=${triggerUpload} />
          `}
          ${couldURL && html`<btn-tap icon="mdi:web" label="URL" onClick=${loadFromURL} />`}
          ${signal.value && html`
            <btn-tap icon="mdi:content-copy" label="Copy" onClick=${copy} />
            ${(filename || couldDownload) && html`<btn-tap icon="mdi:download"   label="Download" onClick=${download} />`}
            ${couldSelect                 && html`<btn-tap icon="mdi:select-all" label="Select"   onClick=${select}   />`}
            <btn-tap icon="mdi:close" label="Clear" onClick=${clear} />
          `}
        </div>
      </div>

      <div class="input-wrap">
        <pre class="input-pre"><code
          class=${'language-' + lang}
          contenteditable="true"
          spellcheck="false"
          data-placeholder=${placeholder}
          ref=${ref}
          onInput=${onInput}
          onKeyDown=${onKeyDown}
        /></pre>
      </div>

      <div class="pane-footer">
        ${signal.value && html`<span class="char-count">${signal.value.length} chars</span>`}
      </div>

      <${Prompt} />

    </div>`;
}

export       { CodeInputPane };
export default CodeInputPane;

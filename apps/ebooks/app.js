// apps/ebooks/app.js

// :::::: IMPORTS :::::::::::::::::::::::::::::::::::::::::::

// ::: vendors
import { html, signal, computed, useEffect, useRef } from '@aufbau/kits/preact-htm';

// ::: shared
import { boot, config }      from '/.shared/js/app.js?slug=ebooks';
import { Icon, AppSettings } from '/.shared/js/components/index.js';
import { stored }            from '/.shared/js/lib/signals.js';
import * as fs               from '/.shared/js/filesystem/fsaccess.js';
import * as pwa              from '/.shared/js/lib/pwa.js';

// ::: local
import * as db                               from './db.js';
import { createPdfReader, createEpubReader } from './reader.js';

// :::::: STATE ::::::::::::::::::::::::::::::::::::::::::::::

const route  = signal({ name: 'library' });        // { name:'library' } | { name:'reader', key }
const search = signal('');
const sort   = stored('recent', 'ebooks:sort');    // recent | title | author | added
const folder = signal('');                         // '' = all folders, else sourceId
const toast  = signal(null);

let toastTimer = null;
function flash (text, kind = 'ok') {
  toast.value = { text, kind };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.value = null, kind === 'err' ? 5000 : 2500);
}

// :::::: HELPERS :::::::::::::::::::::::::::::::::::::::::::

const authorOf = b => b.author || '';
const pct = key => db.progressOf(key)?.percent ?? 0;

// a stable pastel from a title, for the placeholder cover
function hueOf (str = '') {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h % 360;
}

const sortBooks = (list, mode) => [...list].sort((a, b) =>
  mode === 'title'  ? a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
  : mode === 'author' ? authorOf(a).localeCompare(authorOf(b), undefined, { sensitivity: 'base' })
                        || a.title.localeCompare(b.title)
  : mode === 'added'  ? (b.addedAt || 0) - (a.addedAt || 0)
  : /* recent */        (db.progressOf(b.key)?.lastOpenedAt || 0) - (db.progressOf(a.key)?.lastOpenedAt || 0)
                        || (b.addedAt || 0) - (a.addedAt || 0));

const visibleBooks = computed(() => {
  const q = search.value.trim().toLowerCase();
  let list = db.books.value;
  if (folder.value) list = list.filter(b => b.sourceId === folder.value);
  if (q) list = list.filter(b =>
    b.title.toLowerCase().includes(q) || authorOf(b).toLowerCase().includes(q) || b.name.toLowerCase().includes(q));
  return sortBooks(list, sort.value);
});

const continueReading = computed(() =>
  db.books.value
    .filter(b => db.progressOf(b.key)?.lastOpenedAt)
    .sort((a, b) => (db.progressOf(b.key).lastOpenedAt) - (db.progressOf(a.key).lastOpenedAt))
    .slice(0, 12));

// :::::: SHARED BITS ::::::::::::::::::::::::::::::::::::::::

function IconBtn ({ icon, label, onClick, active, disabled, size = 18, className = '' }) {
  return html`
    <button class=${'ibtn ' + className + (active ? ' active' : '')} title=${label} aria-label=${label}
            disabled=${disabled} onClick=${onClick}><${Icon} name=${icon} size=${size} /></button>`;
}

function Empty ({ icon, title, hint, action }) {
  return html`
    <div class="empty">
      <${Icon} name=${icon} size=${56} />
      <p class="empty-title">${title}</p>
      ${hint && html`<p class="empty-hint">${hint}</p>`}
      ${action}
    </div>`;
}

// a cover: the extracted image if we have it, otherwise a titled placeholder
function Cover ({ book, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !book.cover) return;
    const url = URL.createObjectURL(book.cover);
    el.style.backgroundImage = `url("${url}")`;
    el.classList.add('has-img');
    return () => { URL.revokeObjectURL(url); el.style.backgroundImage = ''; el.classList.remove('has-img'); };
  }, [book.cover]);

  return html`
    <div ref=${ref} class=${'cover ' + className} style=${`--hue:${hueOf(book.title)}`}>
      ${!book.cover && html`
        <div class="cover-fallback">
          <${Icon} name=${book.kind === 'pdf' ? 'mdi:file-pdf-box' : 'mdi:book-open-page-variant-outline'} size=${22} />
          <span class="cover-title">${book.title}</span>
          ${book.author && html`<span class="cover-author">${book.author}</span>`}
        </div>`}
      <span class=${'kind-badge ' + book.kind}>${book.kind.toUpperCase()}</span>
    </div>`;
}

function BookCard ({ book }) {
  const p = pct(book.key);
  return html`
    <button class="book" onClick=${() => openReader(book.key)} title=${book.name}>
      <${Cover} book=${book} className="book-cover" />
      <div class="book-meta">
        <div class="book-title">${book.title}</div>
        ${book.author && html`<div class="book-author">${book.author}</div>`}
      </div>
      ${p > 0 && html`<span class="book-progress"><span style=${`width:${Math.round(p * 100)}%`}></span></span>`}
    </button>`;
}

// :::::: LIBRARY VIEW :::::::::::::::::::::::::::::::::::::::

function SortPicker ({ value, options, onChange }) {
  return html`
    <div class="seg">
      ${options.map(([val, label]) => html`
        <button key=${val} class=${'seg-btn' + (value === val ? ' active' : '')}
                onClick=${() => onChange(val)}>${label}</button>`)}
    </div>`;
}

function FolderBar () {
  const list = db.sources.value;
  if (list.length < 2) return null;
  return html`
    <div class="folder-bar">
      <button class=${'chip' + (folder.value === '' ? ' active' : '')} onClick=${() => folder.value = ''}>All</button>
      ${list.map(s => html`
        <button key=${s.id} class=${'chip' + (folder.value === s.id ? ' active' : '')}
                onClick=${() => folder.value = s.id}>${s.name}</button>`)}
    </div>`;
}

function SourceStatus () {
  // surface folders that need reconnecting after a reload
  const stale = db.sources.value.filter(s => db.perms.value[s.id] && db.perms.value[s.id] !== 'granted');
  if (!stale.length) return null;
  return html`
    <div class="reconnect-bar">
      <${Icon} name="mdi:folder-alert-outline" size=${18} />
      <span>${stale.length} folder${stale.length === 1 ? '' : 's'} need reconnecting to read on this device.</span>
      ${stale.map(s => html`
        <div key=${s.id} class="reconnect-item">
          <span class="reconnect-name">${s.name}</span>
          <button class="btn small primary" onClick=${() => db.reconnect(s.id).then(res => {
            if (res.granted) return;
            const why = res.error ? `${res.error.name || 'error'}` : `browser said “${res.state}”`;
            console.warn('[ebooks] reconnect failed', { source: s, ...res });
            flash(`Reconnect failed — ${why}. Try “Choose folder”.`, 'err');
          })}>
            <${Icon} name="mdi:folder-key-outline" size=${15} /> Reconnect</button>
          <button class="btn small ghost" title="Re-select the folder — always works"
                  onClick=${() => db.repick(s.id).then(ok => ok || flash(`Could not open ${s.name}`, 'err'))}>
            <${Icon} name="mdi:folder-search-outline" size=${15} /> Choose folder</button>
        </div>`)}
    </div>`;
}

// installing the app is what makes the browser persist folder permission
// across visits — otherwise a tab drops it each session and every return needs
// a reconnect. shown once folders are in use and the app isn't installed.
function InstallTip () {
  if (pwa.installed.value || !db.sources.value.length) return null;
  return html`
    <div class="install-tip">
      <${Icon} name="mdi:information-outline" size=${18} />
      <span class="install-tip-text">Install the app to keep your book folders connected between visits — no reconnecting.</span>
      ${pwa.canInstall.value
        ? html`<button class="btn small primary" onClick=${() => pwa.promptInstall()}>
            <${Icon} name="mdi:download" size=${15} /> Install app</button>`
        : html`<span class="install-tip-hint">Use your browser’s <b>Install</b> / <b>Add to Home screen</b> menu.</span>`}
    </div>`;
}

function Library () {
  const books = visibleBooks.value;
  const cont  = continueReading.value;
  const hasFolders = db.sources.value.length > 0;

  return html`
    <div class="library">
      <header class="lib-head">
        <div class="brand"><${Icon} name="mdi:bookshelf" size=${24} /> <strong>eBooks</strong></div>
        <div class="lib-tools">
          ${db.pending.value > 0 && html`
            <span class="scan-note"><${Icon} name="svg-spinners:bars-scale-middle" size=${14} /> ${db.pending.value} left</span>`}
          <${IconBtn} icon="mdi:refresh" label="Rescan folders" onClick=${() => db.rescanAll()} />
          <button class="btn primary" onClick=${addFolder}>
            <${Icon} name="mdi:folder-plus-outline" size=${16} /> Add folder</button>
          <${AppSettings} />
        </div>
      </header>

      <${SourceStatus} />
      <${InstallTip} />

      ${!hasFolders
        ? html`<${Empty} icon="mdi:bookshelf" title="Your library is empty"
                 hint="Add a folder of EPUB and PDF files. It stays on your device — only the folder permission is remembered."
                 action=${html`<button class="btn primary" onClick=${addFolder}>
                   <${Icon} name="mdi:folder-plus-outline" size=${16} /> Add a folder</button>`} />`
        : html`
          <div class="lib-controls">
            <div class="lib-search">
              <${Icon} name="mdi:magnify" size=${18} />
              <input type="search" placeholder="Search title or author…" value=${search.value}
                     onInput=${e => search.value = e.target.value} />
              ${search.value && html`<button class="ibtn" aria-label="Clear" onClick=${() => search.value = ''}>
                <${Icon} name="mdi:close" size=${16} /></button>`}
            </div>
            <${SortPicker} value=${sort.value} onChange=${v => sort.value = v}
               options=${[['recent', 'Recent'], ['title', 'Title'], ['author', 'Author'], ['added', 'Added']]} />
          </div>

          <${FolderBar} />

          ${cont.length > 0 && !search.value && !folder.value && html`
            <section class="shelf">
              <h2 class="shelf-title">Continue reading</h2>
              <div class="shelf-row">
                ${cont.map(b => html`<${BookCard} book=${b} key=${b.key} />`)}
              </div>
            </section>`}

          <section class="shelf">
            <h2 class="shelf-title">${folder.value ? db.sourceById(folder.value)?.name : 'All books'}
              <span class="shelf-count">${books.length}</span></h2>
            ${books.length
              ? html`<aufbau-index class="book-grid" viewmode="grid" item-size="150px" gap="1.5rem">
                  ${books.map(b => html`<aufbau-item key=${b.key}><${BookCard} book=${b} /></aufbau-item>`)}
                </aufbau-index>`
              : html`<${Empty} icon=${search.value ? 'mdi:magnify-close' : 'mdi:book-outline'}
                       title=${search.value ? 'Nothing matches your search' : 'No books here yet'}
                       hint=${search.value ? '' : 'Scanning may still be running, or this folder has no EPUB/PDF files.'} />`}
          </section>`}
    </div>`;
}

// :::::: READER VIEW :::::::::::::::::::::::::::::::::::::::

const readerUi = signal({ ready: false });

function openReader (key) {
  route.value = { name: 'reader', key };
  db.markOpened(key);
}
const closeReader = () => { route.value = { name: 'library' }; };

function ReaderView ({ bookKey }) {
  const stageRef = useRef(null);
  const engineRef = useRef(null);
  const tocRef = useRef(null);
  const book = db.bookByKey(bookKey);

  useEffect(() => {
    if (!book) return;
    let alive = true;
    let saveTimer = 0;
    let latest = null;
    readerUi.value = { ready: false, error: null, kind: book.kind, tocOpen: false, toc: null };

    const flush = () => { if (latest) { db.saveProgress(bookKey, latest); latest = null; } };
    const onState = st => {
      // merge live state into the ui and debounce the persisted write
      readerUi.value = { ...readerUi.value, ...st };
      latest = book.kind === 'pdf'
        ? { page: st.page, pages: st.pages, percent: st.percent }
        : { location: st.cfi, percent: st.percent };
      clearTimeout(saveTimer);
      saveTimer = setTimeout(flush, 800);
    };

    (async () => {
      try {
        const file = await db.openFile(book);
        if (!alive) return;
        const prog = db.progressOf(bookKey);
        const engine = book.kind === 'pdf'
          ? await createPdfReader(stageRef.current, file, { initialPage: prog?.page || 1, onState })
          : await createEpubReader(stageRef.current, file, {
              initialCfi: prog?.location || null,
              flow: readerFlow.value, fontSize: readerFont.value, onState,
            });
        if (!alive) { engine.destroy(); return; }
        engineRef.current = engine;
        readerUi.value = { ...readerUi.value, ready: true, kind: engine.kind, flow: engine.flow, fontSize: engine.fontSize };
      } catch (err) {
        if (alive) readerUi.value = { ...readerUi.value, ready: true, error: err.message };
      }
    })();

    return () => {
      alive = false;
      clearTimeout(saveTimer); flush();
      engineRef.current?.destroy();
      engineRef.current = null;
    };
  }, [bookKey]);

  // keyboard: page/chapter turn
  useEffect(() => {
    const onKey = e => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      const eng = engineRef.current;
      if (!eng) return;
      if (e.key === 'ArrowLeft')  eng.prev();
      if (e.key === 'ArrowRight') eng.next();
      if (e.key === 'Escape')     closeReader();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toggleToc = async () => {
    const ui = readerUi.value;
    if (!ui.tocOpen && ui.toc == null) {
      readerUi.value = { ...ui, tocOpen: true, toc: [] };
      const items = await engineRef.current?.outline?.() ?? [];
      readerUi.value = { ...readerUi.value, toc: items };
    } else {
      readerUi.value = { ...ui, tocOpen: !ui.tocOpen };
    }
  };

  const ui = readerUi.value;
  const eng = engineRef.current;

  return html`
    <div class="reader">
      <header class="reader-bar">
        <button class="ibtn" title="Back to library" aria-label="Back" onClick=${closeReader}>
          <${Icon} name="mdi:arrow-left" size=${20} /></button>
        <div class="reader-id">
          <span class="reader-title">${book?.title ?? 'Book'}</span>
          ${book?.author && html`<span class="reader-author">${book.author}</span>`}
        </div>

        <div class="reader-controls">
          ${ui.kind === 'pdf' && html`
            <${IconBtn} icon="mdi:minus" label="Zoom out" onClick=${() => eng?.zoomOut()} />
            <${IconBtn} icon="mdi:plus"  label="Zoom in"  onClick=${() => eng?.zoomIn()} />`}
          ${ui.kind === 'epub' && html`
            <${IconBtn} icon="mdi:format-font-size-decrease" label="Smaller text" disabled=${!eng} onClick=${() => { if (!eng) return; eng.fontDown(); readerFont.value = eng.fontSize; }} />
            <${IconBtn} icon="mdi:format-font-size-increase" label="Larger text"  disabled=${!eng} onClick=${() => { if (!eng) return; eng.fontUp();   readerFont.value = eng.fontSize; }} />
            <${IconBtn} icon=${ui.flow === 'scrolled' ? 'mdi:book-open-page-variant-outline' : 'mdi:page-layout-body'}
              label=${ui.flow === 'scrolled' ? 'Paginated' : 'Scrolled'} disabled=${!eng}
              onClick=${async () => { if (!eng) return; const f = ui.flow === 'scrolled' ? 'paginated' : 'scrolled'; readerFlow.value = f; await eng.setFlow(f); readerUi.value = { ...readerUi.value, flow: f }; }} />`}
          <${IconBtn} icon="mdi:table-of-contents" label="Contents" active=${ui.tocOpen} onClick=${toggleToc} />
        </div>
      </header>

      <div class="reader-main">
        <div class="reader-stage" ref=${stageRef}></div>

        ${ui.tocOpen && html`
          <${TocPanel} items=${ui.toc} kind=${ui.kind}
            onPick=${target => { if (ui.kind === 'pdf') eng?.gotoDest(target); else eng?.gotoHref(target); readerUi.value = { ...readerUi.value, tocOpen: false }; }} />`}

        ${!ui.ready && !ui.error && html`
          <div class="reader-loading"><${Icon} name="svg-spinners:bars-scale-middle" size=${28} /></div>`}
        ${ui.error && html`
          <div class="reader-error"><${Empty} icon="mdi:book-alert-outline" title="Couldn’t open this book" hint=${ui.error} /></div>`}

        ${ui.kind === 'epub' && ui.ready && !ui.error && html`
          <button class="page-edge left"  aria-label="Previous" onClick=${() => eng?.prev()}><${Icon} name="mdi:chevron-left" size=${28} /></button>
          <button class="page-edge right" aria-label="Next"     onClick=${() => eng?.next()}><${Icon} name="mdi:chevron-right" size=${28} /></button>`}
      </div>

      <footer class="reader-foot">
        ${ui.kind === 'pdf' && ui.pages
          ? html`
            <button class="ibtn" aria-label="Previous page" onClick=${() => eng?.prev()}><${Icon} name="mdi:chevron-up" size=${18} /></button>
            <span class="foot-label">Page ${ui.page ?? 1} / ${ui.pages}</span>
            <button class="ibtn" aria-label="Next page" onClick=${() => eng?.next()}><${Icon} name="mdi:chevron-down" size=${18} /></button>`
          : html`<span class="foot-label">${ui.percent != null ? Math.round((ui.percent || 0) * 100) + '%' : ''}</span>`}
        <span class="foot-bar"><span style=${`width:${Math.round((ui.percent || 0) * 100)}%`}></span></span>
      </footer>
    </div>`;
}

// epub reading prefs, remembered across books
const readerFlow = stored('paginated', 'ebooks:flow');
const readerFont = stored(100, 'ebooks:font');

function TocPanel ({ items, kind, onPick }) {
  const render = list => html`
    <ul class="toc-list">
      ${(list || []).map((it, i) => html`
        <li key=${i}>
          <button class="toc-link" onClick=${() => onPick(kind === 'pdf' ? it.dest : it.href)}>${it.label || 'Untitled'}</button>
          ${it.children?.length ? render(it.children) : null}
        </li>`)}
    </ul>`;
  return html`
    <aside class="toc-panel">
      <div class="toc-head">Contents</div>
      ${items == null
        ? html`<div class="toc-loading"><${Icon} name="svg-spinners:bars-scale-middle" size=${16} /></div>`
        : items.length ? render(items) : html`<div class="toc-empty">No contents in this book.</div>`}
    </aside>`;
}

// :::::: ACTIONS :::::::::::::::::::::::::::::::::::::::::::

async function addFolder () {
  if (!fs.supported()) { flash('This browser can’t open folders — try Chrome, Edge or another Chromium browser.', 'err'); return; }
  try {
    const rec = await db.addFolder();
    if (rec) flash(`Added ${rec.name}`);
  } catch (err) { flash(err.message, 'err'); }
}

// :::::: TOAST + APP :::::::::::::::::::::::::::::::::::::::

function Toast () {
  const t = toast.value;
  if (!t) return null;
  return html`<div class="toasts"><div class=${'toast ' + t.kind}>${t.text}</div></div>`;
}

function App () {
  useEffect(() => {
    db.load().catch(err => flash('Could not open the library: ' + err.message, 'err'));
  }, []);

  if (!db.ready.value) {
    return html`<div class="booting"><${Icon} name="svg-spinners:bars-scale-middle" size=${28} /></div>`;
  }

  const r = route.value;
  return html`
    <div class="ebooks-app">
      ${r.name === 'reader'
        ? html`<${ReaderView} bookKey=${r.key} key=${r.key} />`
        : html`<main class="main"><${Library} /></main>`}
      <${Toast} />
    </div>`;
}

// :::::: BOOT ::::::::::::::::::::::::::::::::::::::::::::::

boot({ config, App });

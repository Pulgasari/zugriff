// apps/file-explorer/app.js
//
// a file explorer over the browser's Origin Private File System — the same
// on-device storage the cli reads and writes. it draws its own chrome (sidebar,
// toolbar, details panel, status bar); there is no tools Shell here.

// :::::: IMPORTS :::::::::::::::::::::::::::::::::::::::::::

// ::: vendors
import { html, signal, computed, useEffect, useRef } from '@aufbau/kits/preact-htm';

// ::: shared
import { boot }    from './../../shared/js/app.js';
import { Icon }    from './../../shared/js/components/index.js';
import { stored }  from './../../shared/js/lib/signals.js';

// ::: local
import * as config from './app.config.js';
import * as fs     from './fs.js';

// :::::: STATE :::::::::::::::::::::::::::::::::::::::::::::

const path     = signal([]);      // current directory as an array of segments
const entries  = signal([]);      // rows in the current directory
const loading  = signal(false);
const error    = signal('');
const selected = signal(null);    // name of the selected entry
const details  = signal(null);    // { ...entry, text?, url? } for the panel
const filter   = signal('');
const store    = signal({ usage: 0, quota: 0 });
const dialog   = signal(null);    // { mode, title, value, entry? }
const menu     = signal(null);    // { x, y, entry }
const dragging = signal(false);
const busy     = signal(false);   // a write is in flight

const view = stored('list', 'file-explorer:view');   // 'list' | 'grid'

const visible = computed(() => {
  const q = filter.value.trim().toLowerCase();
  return q ? entries.value.filter(e => e.name.toLowerCase().includes(q)) : entries.value;
});

// a preview object url outlives a render, so it is tracked here and revoked by
// hand the moment a different entry is shown
let previewUrl = null;
function dropPreviewUrl () {
  if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
}

// :::::: HELPERS :::::::::::::::::::::::::::::::::::::::::::

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];
function fmtSize (bytes = 0) {
  if (!bytes) return '0 B';
  const i = Math.min(UNITS.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const n = bytes / 1024 ** i;
  return `${i === 0 ? n : n.toFixed(n < 10 ? 1 : 0)} ${UNITS[i]}`;
}

function fmtDate (ms) {
  if (!ms) return '—';
  const d = new Date(ms);
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

const ext = name => (name.includes('.') ? name.split('.').pop().toLowerCase() : '');

const IMAGE = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif']);
const TEXT  = new Set([
  'txt', 'md', 'markdown', 'json', 'js', 'mjs', 'ts', 'jsx', 'tsx', 'css', 'html',
  'htm', 'xml', 'svg', 'yaml', 'yml', 'toml', 'csv', 'tsv', 'log', 'sh', 'bash',
  'py', 'rb', 'rs', 'go', 'c', 'h', 'cpp', 'java', 'php', 'sql', 'ini', 'conf',
  'env', 'gitignore', 'lock',
]);

const isImage = e => e.type?.startsWith('image/') || IMAGE.has(ext(e.name));
const isText  = e => e.type?.startsWith('text/')  || TEXT.has(ext(e.name));

function iconFor (e) {
  if (e.kind === 'directory') return 'mdi:folder';
  if (isImage(e)) return 'mdi:file-image-outline';
  const x = ext(e.name);
  if (e.type?.startsWith('audio/')) return 'mdi:file-music-outline';
  if (e.type?.startsWith('video/')) return 'mdi:file-video-outline';
  if (x === 'pdf')                            return 'mdi:file-pdf-box';
  if (['zip', 'gz', 'tar', 'rar', '7z'].includes(x)) return 'mdi:folder-zip-outline';
  if (['json', 'js', 'ts', 'css', 'html', 'xml', 'yaml', 'yml', 'toml'].includes(x)) return 'mdi:file-code-outline';
  if (isText(e)) return 'mdi:file-document-outline';
  return 'mdi:file-outline';
}

// a name that does not clash with anything already in the folder
function uniqueName (name) {
  const taken = new Set(entries.value.map(e => e.name));
  if (!taken.has(name)) return name;
  const dot  = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const tail = dot > 0 ? name.slice(dot)    : '';
  let n = 1;
  while (taken.has(`${base} (${n})${tail}`)) n++;
  return `${base} (${n})${tail}`;
}

// :::::: ACTIONS :::::::::::::::::::::::::::::::::::::::::::

async function refresh () {
  loading.value = true;
  error.value   = '';
  try {
    entries.value = await fs.list(path.value);
    store.value   = await fs.usage();
    // a selection that no longer exists is dropped
    if (selected.value && !entries.value.some(e => e.name === selected.value)) clearSelection();
  } catch (err) {
    error.value   = err?.message || String(err);
    entries.value = [];
  } finally {
    loading.value = false;
  }
}

function clearSelection () {
  selected.value = null;
  details.value  = null;
  dropPreviewUrl();
}

async function select (entry) {
  selected.value = entry.name;
  dropPreviewUrl();

  if (entry.kind === 'directory') { details.value = { ...entry }; return; }

  // load a preview for the details panel — images inline, small text inline,
  // everything else just its metadata
  const info = { ...entry };
  try {
    if (isImage(entry)) {
      const file = await fs.readFile(path.value, entry.name);
      previewUrl = URL.createObjectURL(file);
      info.url   = previewUrl;
    } else if (isText(entry) && entry.size <= 512 * 1024) {
      const file = await fs.readFile(path.value, entry.name);
      info.text  = await file.text();
    }
  } catch (err) {
    info.previewError = err?.message || String(err);
  }
  // guard against a newer selection having landed while we awaited
  if (selected.value === entry.name) details.value = info;
}

function open (entry) {
  if (entry.kind === 'directory') {
    path.value = [...path.value, entry.name];
    clearSelection();
    filter.value = '';
    refresh();
  } else {
    select(entry);
  }
}

function goTo (depth) {
  path.value = path.value.slice(0, depth);
  clearSelection();
  filter.value = '';
  refresh();
}

const up = () => { if (path.value.length) goTo(path.value.length - 1); };

async function withBusy (fn) {
  busy.value = true;
  try { await fn(); } catch (err) { error.value = err?.message || String(err); }
  finally { busy.value = false; }
}

async function uploadFiles (fileList) {
  const files = [...fileList].filter(f => f);
  if (!files.length) return;
  await withBusy(async () => {
    for (const file of files) {
      await fs.writeFile(path.value, uniqueName(file.name), file);
    }
    await refresh();
  });
}

async function download (entry) {
  const file = await fs.readFile(path.value, entry.name);
  const url  = URL.createObjectURL(file);
  const a    = Object.assign(document.createElement('a'), { href: url, download: entry.name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── dialogs ────────────────────────────────────────────────────────────────

const askNewFolder = () => dialog.value = { mode: 'new-folder', title: 'New folder',  value: 'untitled folder' };
const askNewFile   = () => dialog.value = { mode: 'new-file',   title: 'New file',    value: 'untitled.txt' };
const askRename    = entry => dialog.value = { mode: 'rename',  title: 'Rename',      value: entry.name, entry };
const askDelete    = entry => dialog.value = { mode: 'delete',  title: 'Delete',      entry };

async function submitDialog (raw) {
  const d = dialog.value;
  if (!d) return;

  if (d.mode === 'delete') {
    await withBusy(async () => { await fs.remove(path.value, d.entry.name); clearSelection(); await refresh(); });
    dialog.value = null;
    return;
  }

  const name = (raw ?? '').trim();
  if (!name || name === '.' || name === '..' || name.includes('/')) {
    dialog.value = { ...d, error: 'pick a name without a slash' };
    return;
  }
  if (d.mode === 'rename' && name === d.entry.name) { dialog.value = null; return; }
  if (entries.value.some(e => e.name === name && e.name !== d.entry?.name)) {
    dialog.value = { ...d, error: `“${name}” already exists here` };
    return;
  }

  await withBusy(async () => {
    if (d.mode === 'new-folder') await fs.mkdir(path.value, name);
    if (d.mode === 'new-file')   await fs.touch(path.value, name);
    if (d.mode === 'rename')     await fs.rename(path.value, d.entry.name, name, d.entry.kind);
    await refresh();
    selected.value = name;
    const row = entries.value.find(e => e.name === name);
    if (row) select(row);
  });
  dialog.value = null;
}

// :::::: COMPONENTS ::::::::::::::::::::::::::::::::::::::::

function ToolButton ({ icon, label, onClick, disabled, active }) {
  return html`
    <button
      class=${'tbtn' + (active ? ' active' : '')}
      onClick=${onClick}
      disabled=${disabled}
      title=${label}
      aria-label=${label}>
      <${Icon} name=${icon} size="18" />
    </button>`;
}

function Breadcrumb () {
  const segs = path.value;
  return html`
    <nav class="crumbs" aria-label="path">
      <button class="crumb root" onClick=${() => goTo(0)} title="Home">
        <${Icon} name="mdi:home-outline" size="16" /> files
      </button>
      ${segs.map((name, i) => html`
        <span class="sep" key=${'s' + i}>/</span>
        <button
          class=${'crumb' + (i === segs.length - 1 ? ' current' : '')}
          key=${'c' + i}
          onClick=${() => goTo(i + 1)}>${name}</button>`)}
    </nav>`;
}

function Row ({ entry }) {
  const active = selected.value === entry.name;
  return html`
    <div
      class=${'row' + (active ? ' active' : '')}
      tabindex="0"
      onClick=${() => select(entry)}
      onDblClick=${() => open(entry)}
      onContextMenu=${e => { e.preventDefault(); menu.value = { x: e.clientX, y: e.clientY, entry }; }}
      onKeyDown=${e => { if (e.key === 'Enter') open(entry); }}>
      <span class=${'ic ' + entry.kind}><${Icon} name=${iconFor(entry)} size="20" /></span>
      <span class="nm">${entry.name}</span>
      <span class="sz">${entry.kind === 'file' ? fmtSize(entry.size) : '—'}</span>
      <span class="dt">${entry.kind === 'file' ? fmtDate(entry.lastModified) : 'folder'}</span>
    </div>`;
}

function Cell ({ entry }) {
  const active = selected.value === entry.name;
  return html`
    <div
      class=${'cell' + (active ? ' active' : '')}
      tabindex="0"
      onClick=${() => select(entry)}
      onDblClick=${() => open(entry)}
      onContextMenu=${e => { e.preventDefault(); menu.value = { x: e.clientX, y: e.clientY, entry }; }}
      onKeyDown=${e => { if (e.key === 'Enter') open(entry); }}>
      <span class=${'ic ' + entry.kind}><${Icon} name=${iconFor(entry)} size="34" /></span>
      <span class="nm">${entry.name}</span>
    </div>`;
}

function Listing () {
  const rows = visible.value;

  if (loading.value && !rows.length) return html`<div class="hint">loading…</div>`;
  if (error.value)  return html`<div class="hint err"><${Icon} name="mdi:alert-outline" size="20" /> ${error.value}</div>`;

  if (!rows.length) return html`
    <div class="empty">
      <${Icon} name=${filter.value ? 'mdi:file-search-outline' : 'mdi:folder-open-outline'} size="56" />
      <p>${filter.value ? `nothing matches “${filter.value}”` : 'this folder is empty'}</p>
      ${!filter.value && html`<p class="sub">drop files here, or use the buttons above</p>`}
    </div>`;

  if (view.value === 'grid') return html`
    <div class="grid">${rows.map(e => html`<${Cell} entry=${e} key=${e.name} />`)}</div>`;

  return html`
    <div class="list">
      <div class="head">
        <span></span><span class="nm">name</span><span class="sz">size</span><span class="dt">modified</span>
      </div>
      ${rows.map(e => html`<${Row} entry=${e} key=${e.name} />`)}
    </div>`;
}

function Details () {
  const d = details.value;
  if (!d) return null;

  return html`
    <aside class="details">
      <div class="d-head">
        <span class=${'ic ' + d.kind}><${Icon} name=${iconFor(d)} size="22" /></span>
        <span class="d-name" title=${d.name}>${d.name}</span>
        <button class="tbtn" onClick=${clearSelection} title="Close" aria-label="Close details">
          <${Icon} name="mdi:close" size="16" />
        </button>
      </div>

      <div class="preview">
        ${d.url  && html`<img src=${d.url} alt=${d.name} />`}
        ${d.text != null && html`<pre>${d.text}</pre>`}
        ${d.previewError && html`<div class="hint err">${d.previewError}</div>`}
        ${!d.url && d.text == null && !d.previewError && html`
          <div class="no-preview">
            <${Icon} name=${d.kind === 'directory' ? 'mdi:folder-open-outline' : 'mdi:file-hidden'} size="40" />
            <span>${d.kind === 'directory' ? 'open to browse' : 'no preview'}</span>
          </div>`}
      </div>

      <dl class="meta">
        <dt>kind</dt><dd>${d.kind}${d.kind === 'file' && d.type ? ` · ${d.type}` : ''}</dd>
        ${d.kind === 'file' && html`<dt>size</dt><dd>${fmtSize(d.size)}</dd>`}
        ${d.kind === 'file' && html`<dt>modified</dt><dd>${fmtDate(d.lastModified)}</dd>`}
      </dl>

      <div class="d-actions">
        ${d.kind === 'directory'
          ? html`<button class="btn" onClick=${() => open(d)}><${Icon} name="mdi:folder-open-outline" size="16" /> Open</button>`
          : html`<button class="btn" onClick=${() => download(d)}><${Icon} name="mdi:download" size="16" /> Download</button>`}
        <button class="btn ghost" onClick=${() => askRename(d)}><${Icon} name="mdi:form-textbox" size="16" /> Rename</button>
        <button class="btn danger" onClick=${() => askDelete(d)}><${Icon} name="mdi:trash-can-outline" size="16" /> Delete</button>
      </div>
    </aside>`;
}

function ContextMenu () {
  const m = menu.value;
  if (!m) return null;
  const e = m.entry;
  const item = (icon, label, fn) => html`
    <button onClick=${() => { menu.value = null; fn(); }}>
      <${Icon} name=${icon} size="16" /> ${label}
    </button>`;

  return html`
    <div class="ctx" style=${`left:${m.x}px; top:${m.y}px`}>
      ${e.kind === 'directory'
        ? item('mdi:folder-open-outline', 'Open', () => open(e))
        : item('mdi:eye-outline', 'Preview', () => select(e))}
      ${e.kind === 'file' && item('mdi:download', 'Download', () => download(e))}
      ${item('mdi:form-textbox', 'Rename', () => askRename(e))}
      ${item('mdi:trash-can-outline', 'Delete', () => askDelete(e))}
    </div>`;
}

function Dialog () {
  const d   = dialog.value;
  const ref = useRef(null);
  useEffect(() => {
    if (!d) return;
    ref.current?.focus();
    ref.current?.select?.();
  }, [d?.mode, d?.entry?.name]);
  if (!d) return null;

  const del = d.mode === 'delete';

  return html`
    <div class="scrim" onClick=${e => { if (e.target === e.currentTarget) dialog.value = null; }}>
      <div class="modal" role="dialog" aria-modal="true">
        <h2>${d.title}</h2>
        ${del
          ? html`<p class="modal-body">Delete <strong>${d.entry.name}</strong>${d.entry.kind === 'directory' ? ' and everything inside it' : ''}? This cannot be undone.</p>`
          : html`
            <input
              ref=${ref}
              class="modal-input"
              value=${d.value}
              onInput=${e => dialog.value = { ...d, value: e.target.value, error: '' }}
              onKeyDown=${e => { if (e.key === 'Enter') submitDialog(d.value); }} />`}
        ${d.error && html`<p class="modal-err">${d.error}</p>`}
        <div class="modal-actions">
          <button class="btn ghost" onClick=${() => dialog.value = null}>Cancel</button>
          <button class=${'btn' + (del ? ' danger' : ' primary')} disabled=${busy.value}
                  onClick=${() => submitDialog(d.value)}>
            ${del ? 'Delete' : 'OK'}
          </button>
        </div>
      </div>
    </div>`;
}

function StorageMeter () {
  const { usage, quota } = store.value;
  const pct = quota ? Math.min(100, (usage / quota) * 100) : 0;
  return html`
    <div class="meter" title=${`${fmtSize(usage)} of ${fmtSize(quota)} used`}>
      <div class="meter-label">
        <${Icon} name="mdi:database-outline" size="14" /> storage
      </div>
      <div class="meter-bar"><div class="meter-fill" style=${`width:${pct}%`}></div></div>
      <div class="meter-text">${fmtSize(usage)}${quota ? ` / ${fmtSize(quota)}` : ''}</div>
    </div>`;
}

function Sidebar () {
  return html`
    <aside class="sidebar">
      <div class="brand">
        <${Icon} name="mdi:folder-outline" size="22" />
        <span>Files</span>
      </div>
      <nav class="places">
        <button class=${'place' + (path.value.length === 0 ? ' active' : '')} onClick=${() => goTo(0)}>
          <${Icon} name="mdi:home-outline" size="18" /> Home
        </button>
      </nav>
      <div class="side-foot">
        <${StorageMeter} />
        <div class="side-links">
          <a href="./../../"><${Icon} name="mdi:view-grid-outline" size="14" /> launcher</a>
          <a href="./../../cli/"><${Icon} name="mdi:console" size="14" /> cli</a>
        </div>
      </div>
    </aside>`;
}

function Toolbar ({ onUpload }) {
  return html`
    <div class="toolbar">
      <${ToolButton} icon="mdi:arrow-up" label="Up" onClick=${up} disabled=${path.value.length === 0} />
      <${Breadcrumb} />
      <div class="spacer"></div>
      <div class="search">
        <${Icon} name="mdi:magnify" size="16" />
        <input
          type="search"
          placeholder="Filter…"
          value=${filter.value}
          onInput=${e => filter.value = e.target.value} />
      </div>
      <div class="seg">
        <${ToolButton} icon="mdi:view-list"  label="List view" active=${view.value === 'list'} onClick=${() => view.value = 'list'} />
        <${ToolButton} icon="mdi:view-grid"  label="Grid view" active=${view.value === 'grid'} onClick=${() => view.value = 'grid'} />
      </div>
      <div class="seg">
        <${ToolButton} icon="mdi:folder-plus-outline" label="New folder" onClick=${askNewFolder} disabled=${busy.value} />
        <${ToolButton} icon="mdi:file-plus-outline"   label="New file"   onClick=${askNewFile}   disabled=${busy.value} />
        <${ToolButton} icon="mdi:upload"              label="Upload"     onClick=${onUpload}      disabled=${busy.value} />
        <${ToolButton} icon="mdi:refresh"             label="Refresh"    onClick=${refresh}       disabled=${loading.value} />
      </div>
    </div>`;
}

function StatusBar () {
  const n   = visible.value.length;
  const sel = selected.value;
  const dirs  = visible.value.filter(e => e.kind === 'directory').length;
  const files = n - dirs;
  return html`
    <footer class="statusbar">
      <span>${dirs} folder${dirs === 1 ? '' : 's'}, ${files} file${files === 1 ? '' : 's'}</span>
      ${sel && html`<span class="sel">·  ${sel}</span>`}
      ${busy.value && html`<span class="working"><${Icon} name="svg-spinners:bars-scale-middle" size="14" /> working…</span>`}
      <span class="spacer"></span>
      <span>${fmtSize(store.value.usage)} used</span>
    </footer>`;
}

// ── the unsupported-environment screen ───────────────────────────────────────

function Unsupported () {
  return html`
    <div class="unsupported">
      <${Icon} name="mdi:database-alert-outline" size="64" />
      <h1>No private storage here</h1>
      <p>This browser doesn't expose the Origin Private File System, so there's
         nothing for the explorer to browse. Try a recent Chromium, Firefox or Safari.</p>
    </div>`;
}

// :::::: APP :::::::::::::::::::::::::::::::::::::::::::::::

function App () {
  if (!fs.supported()) return html`<${Unsupported} />`;

  const fileInput = useRef(null);

  useEffect(() => {
    refresh();

    const onKey = e => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if (e.key === 'Escape') { menu.value = null; if (dialog.value) dialog.value = null; else clearSelection(); return; }
      if (dialog.value || typing) return;
      if (e.key === 'Backspace') { e.preventDefault(); up(); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected.value) {
        const row = entries.value.find(en => en.name === selected.value);
        if (row) askDelete(row);
      }
      if (e.key === 'F2' && selected.value) {
        const row = entries.value.find(en => en.name === selected.value);
        if (row) askRename(row);
      }
    };
    const onClick = () => { if (menu.value) menu.value = null; };

    window.addEventListener('keydown', onKey);
    window.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('click', onClick);
      dropPreviewUrl();
    };
  }, []);

  const pickFiles = () => fileInput.current?.click();

  const onDrop = e => {
    e.preventDefault();
    dragging.value = false;
    if (e.dataTransfer?.files?.length) uploadFiles(e.dataTransfer.files);
  };

  return html`
    <div class="fx">
      <${Sidebar} />
      <section class="main">
        <${Toolbar} onUpload=${pickFiles} />
        <div
          class=${'stage' + (dragging.value ? ' dropping' : '')}
          onDragOver=${e => { e.preventDefault(); dragging.value = true; }}
          onDragLeave=${e => { if (e.target === e.currentTarget) dragging.value = false; }}
          onDrop=${onDrop}>
          <div class="listing-wrap" onClick=${e => { if (e.target === e.currentTarget) clearSelection(); }}>
            <${Listing} />
          </div>
          <${Details} />
          <div class="drop-hint"><${Icon} name="mdi:tray-arrow-down" size="40" /> <span>Drop to upload</span></div>
        </div>
        <${StatusBar} />
      </section>

      <input ref=${fileInput} type="file" multiple hidden
             onChange=${e => { uploadFiles(e.target.files); e.target.value = ''; }} />

      <${ContextMenu} />
      <${Dialog} />
    </div>`;
}

// :::::: BOOT ::::::::::::::::::::::::::::::::::::::::::::::

// the app draws its own chrome, so it skips the tools Shell
boot({ config, App, shell: false });
